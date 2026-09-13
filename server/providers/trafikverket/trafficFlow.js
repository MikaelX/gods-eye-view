import { escapeXml, parseWktPoint, inBbox, capRows } from './wkt.js';
import { buildCountyNoFilterXml } from './county.js';
import { extractTrafikinfoRows } from './client.js';
import { prioritizeFeatures } from './geo.js';
import {
  SWEDEN_BBOX,
  DEFAULT_TRAFIKVERKET_MAX_TRAFFIC_FLOW,
  TRAFIKVERKET_ATTRIBUTION,
} from './constants.js';

/**
 * TrafficFlow REQUEST XML (schema 1.4) — nationwide point sensors.
 * @param {string} apiKey
 * @param {number[]|null} countyNos
 */
export function buildTrafficFlowRequestXml(apiKey, countyNos) {
  const key = escapeXml(String(apiKey || '').trim());
  const countyFilter = buildCountyNoFilterXml(countyNos);
  const filterInner = countyFilter
    ? `<FILTER>${countyFilter}</FILTER>`
    : `<FILTER></FILTER>`;
  return (
    `<REQUEST>` +
    `<LOGIN authenticationkey="${key}" />` +
    `<QUERY objecttype="TrafficFlow" schemaversion="1.4">` +
    filterInner +
    `<INCLUDE>SiteId</INCLUDE>` +
    `<INCLUDE>MeasurementTime</INCLUDE>` +
    `<INCLUDE>AverageVehicleSpeed</INCLUDE>` +
    `<INCLUDE>VehicleFlowRate</INCLUDE>` +
    `<INCLUDE>CountyNo</INCLUDE>` +
    `<INCLUDE>Deleted</INCLUDE>` +
    `<INCLUDE>Geometry.WGS84</INCLUDE>` +
    `</QUERY>` +
    `</REQUEST>`
  );
}

/**
 * Normalize one TrafficFlow row → Point Feature or null.
 * @param {object} record
 * @returns {object|null}
 */
export function normalizeTrafficFlow(record) {
  if (!record || typeof record !== 'object') return null;
  if (record.Deleted === true || record.deleted === true) return null;
  const id = String(record.SiteId ?? record.siteId ?? record.Id ?? record.id ?? '').trim();
  if (!id) return null;
  const wkt = record.Geometry?.WGS84 ?? record.geometry?.WGS84 ?? '';
  const point = parseWktPoint(wkt);
  if (!Number.isFinite(point.lat) || !Number.isFinite(point.lon)) return null;
  if (
    !inBbox(point.lat, point.lon, {
      minLat: SWEDEN_BBOX.minLat,
      maxLat: SWEDEN_BBOX.maxLat,
      minLon: SWEDEN_BBOX.minLon,
      maxLon: SWEDEN_BBOX.maxLon,
    })
  ) {
    return null;
  }
  const speed = Number(
    record.AverageVehicleSpeed ?? record.averageVehicleSpeed,
  );
  const flowRate = Number(record.VehicleFlowRate ?? record.vehicleFlowRate);
  return {
    type: 'Feature',
    id: `tv-flow-${id}`,
    geometry: { type: 'Point', coordinates: [point.lon, point.lat] },
    properties: {
      id,
      averageVehicleSpeed: Number.isFinite(speed) ? speed : null,
      vehicleFlowRate: Number.isFinite(flowRate) ? flowRate : null,
      measurementTime: record.MeasurementTime ?? record.measurementTime ?? null,
      countyNo: record.CountyNo ?? record.countyNo ?? null,
      attribution: TRAFIKVERKET_ATTRIBUTION,
      source: 'trafikverket-traffic-flow',
    },
  };
}

export function trafficFlowToGeoJson(
  payload,
  maxFeatures = DEFAULT_TRAFIKVERKET_MAX_TRAFFIC_FLOW,
) {
  const rows = extractTrafikinfoRows(payload, 'TrafficFlow');
  const features = [];
  for (const row of rows) {
    const feature = normalizeTrafficFlow(row);
    if (feature) features.push(feature);
  }
  const prioritized = prioritizeFeatures(features, maxFeatures);
  return {
    type: 'FeatureCollection',
    features: prioritized,
    truncated: prioritized.length < features.length,
    totalNormalized: features.length,
  };
}

export function resolveMaxTrafficFlow(env = process.env) {
  const raw = Number(
    env.TRAFIKVERKET_TRAFFIC_FLOW_MAX_FEATURES ||
      DEFAULT_TRAFIKVERKET_MAX_TRAFFIC_FLOW,
  );
  if (!Number.isFinite(raw)) return DEFAULT_TRAFIKVERKET_MAX_TRAFFIC_FLOW;
  return Math.max(8, Math.min(8000, Math.floor(raw)));
}

export function isTrafikverketTrafficFlowEnabled(env = process.env) {
  const enabled =
    String(env.TRAFIKVERKET_TRAFFIC_FLOW_ENABLED || '1').trim() !== '0';
  const key = String(env.TRAFIKVERKET_API_KEY || '').trim();
  return enabled && key.length > 0;
}
