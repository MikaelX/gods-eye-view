import { escapeXml, parseWktLineString, inBbox, capRows } from './wkt.js';
import { buildCountyNoFilterXml } from './county.js';
import { extractTrafikinfoRows } from './client.js';
import {
  SWEDEN_BBOX,
  DEFAULT_TRAFIKVERKET_MAX_ROUTES,
  TRAFIKVERKET_ATTRIBUTION,
} from './constants.js';

/** Map Trafikverket TrafficStatus → free|slow|jam. */
export function trafficStatusToBucket(status) {
  const raw = String(status || '')
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, '');
  if (!raw) return 'free';
  if (
    raw.includes('congest') ||
    raw.includes('queue') ||
    raw === 'stopandgo' ||
    raw === 'stationary'
  ) {
    return 'jam';
  }
  if (
    raw.includes('heavy') ||
    raw.includes('slow') ||
    raw === 'medium' ||
    raw.includes('impact')
  ) {
    return 'slow';
  }
  return 'free';
}

/** TravelTimeRoute REQUEST XML (schema 1.5). */
export function buildTravelTimeRouteRequestXml(apiKey, countyNos) {
  const key = escapeXml(String(apiKey || '').trim());
  const countyFilter = buildCountyNoFilterXml(countyNos);
  const filterInner = countyFilter
    ? `<FILTER>${countyFilter}</FILTER>`
    : `<FILTER></FILTER>`;
  return (
    `<REQUEST>` +
    `<LOGIN authenticationkey="${key}" />` +
    `<QUERY objecttype="TravelTimeRoute" schemaversion="1.5">` +
    filterInner +
    `<INCLUDE>Id</INCLUDE>` +
    `<INCLUDE>Name</INCLUDE>` +
    `<INCLUDE>TrafficStatus</INCLUDE>` +
    `<INCLUDE>AverageSpeed</INCLUDE>` +
    `<INCLUDE>TravelTime</INCLUDE>` +
    `<INCLUDE>FreeFlowTravelTime</INCLUDE>` +
    `<INCLUDE>CountyNo</INCLUDE>` +
    `<INCLUDE>Geometry.WGS84</INCLUDE>` +
    `</QUERY>` +
    `</REQUEST>`
  );
}

/** Normalize one TravelTimeRoute → GeoJSON Feature or null. */
export function normalizeTravelTimeRoute(record) {
  if (!record || typeof record !== 'object') return null;
  const id = String(record.Id ?? record.id ?? '').trim();
  if (!id) return null;
  const wkt = record.Geometry?.WGS84 ?? record.geometry?.WGS84 ?? '';
  const coords = parseWktLineString(wkt);
  if (coords.length < 2) return null;
  const mid = coords[Math.floor(coords.length / 2)];
  if (
    !inBbox(mid[1], mid[0], {
      minLat: SWEDEN_BBOX.minLat,
      maxLat: SWEDEN_BBOX.maxLat,
      minLon: SWEDEN_BBOX.minLon,
      maxLon: SWEDEN_BBOX.maxLon,
    })
  ) {
    return null;
  }
  const status = record.TrafficStatus ?? record.trafficStatus ?? '';
  const bucket = trafficStatusToBucket(status);
  const speed = Number(record.AverageSpeed ?? record.averageSpeed);
  const travelTime = Number(record.TravelTime ?? record.travelTime);
  const name = String(record.Name ?? record.name ?? '').trim() || id;
  return {
    type: 'Feature',
    id: `tv-route-${id}`,
    geometry: { type: 'LineString', coordinates: coords },
    properties: {
      id,
      name,
      trafficStatus: String(status || ''),
      bucket,
      averageSpeed: Number.isFinite(speed) ? speed : null,
      travelTime: Number.isFinite(travelTime) ? travelTime : null,
      countyNo: record.CountyNo ?? record.countyNo ?? null,
      attribution: TRAFIKVERKET_ATTRIBUTION,
      source: 'trafikverket-travel-time-route',
    },
  };
}

export function travelTimeRoutesToGeoJson(
  payload,
  maxFeatures = DEFAULT_TRAFIKVERKET_MAX_ROUTES,
) {
  const rows = extractTrafikinfoRows(payload, 'TravelTimeRoute');
  const features = [];
  for (const row of rows) {
    const feature = normalizeTravelTimeRoute(row);
    if (feature) features.push(feature);
  }
  const capped = capRows(features, maxFeatures);
  return {
    type: 'FeatureCollection',
    features: capped,
    truncated: capped.length < features.length,
    totalNormalized: features.length,
  };
}

export function resolveMaxTravelTimeRoutes(env = process.env) {
  const raw = Number(
    env.TRAFIKVERKET_TRAFFIC_MAX_ROUTES || DEFAULT_TRAFIKVERKET_MAX_ROUTES,
  );
  if (!Number.isFinite(raw)) return DEFAULT_TRAFIKVERKET_MAX_ROUTES;
  return Math.max(8, Math.min(2000, Math.floor(raw)));
}

export function isTrafikverketTrafficEnabled(env = process.env) {
  const enabled = String(env.TRAFIKVERKET_TRAFFIC_ENABLED || '1').trim() !== '0';
  const key = String(env.TRAFIKVERKET_API_KEY || '').trim();
  return enabled && key.length > 0;
}
