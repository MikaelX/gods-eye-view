import { escapeXml, parseWktPoint, inBbox } from './wkt.js';
import { buildCountyNoFilterXml } from './county.js';
import { extractTrafikinfoRows } from './client.js';
import { prioritizeFeatures } from './geo.js';
import {
  SWEDEN_BBOX,
  DEFAULT_TRAFIKVERKET_MAX_SAFETY_CAMERAS,
  TRAFIKVERKET_ATTRIBUTION,
} from './constants.js';

/**
 * TrafficSafetyCamera (ATK) REQUEST XML — speed enforcement POIs.
 * Distinct from CCTV Camera stills; label clearly as ATK.
 * @param {string} apiKey
 * @param {number[]|null} countyNos
 */
export function buildTrafficSafetyCameraRequestXml(apiKey, countyNos) {
  const key = escapeXml(String(apiKey || '').trim());
  const countyFilter = buildCountyNoFilterXml(countyNos);
  const filterInner = countyFilter
    ? `<FILTER>${countyFilter}</FILTER>`
    : `<FILTER></FILTER>`;
  return (
    `<REQUEST>` +
    `<LOGIN authenticationkey="${key}" />` +
    `<QUERY objecttype="TrafficSafetyCamera" schemaversion="1">` +
    filterInner +
    `<INCLUDE>Id</INCLUDE>` +
    `<INCLUDE>Name</INCLUDE>` +
    `<INCLUDE>RoadNumber</INCLUDE>` +
    `<INCLUDE>Bearing</INCLUDE>` +
    `<INCLUDE>CountyNo</INCLUDE>` +
    `<INCLUDE>Deleted</INCLUDE>` +
    `<INCLUDE>Geometry.WGS84</INCLUDE>` +
    `</QUERY>` +
    `</REQUEST>`
  );
}

export function normalizeTrafficSafetyCamera(record) {
  if (!record || typeof record !== 'object') return null;
  if (record.Deleted === true || record.deleted === true) return null;
  const id = String(record.Id ?? record.id ?? '').trim();
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
  const name = String(record.Name ?? record.name ?? '').trim() || `ATK ${id}`;
  const bearing = Number(record.Bearing ?? record.bearing);
  return {
    type: 'Feature',
    id: `tv-atk-${id}`,
    geometry: { type: 'Point', coordinates: [point.lon, point.lat] },
    properties: {
      id,
      name,
      /** Explicit label so UI never confuses ATK with CCTV stills. */
      kind: 'traffic-safety-camera-atk',
      label: 'ATK (speed camera)',
      roadNumber: String(record.RoadNumber ?? record.roadNumber ?? '').trim(),
      bearing: Number.isFinite(bearing) ? bearing : null,
      countyNo: record.CountyNo ?? record.countyNo ?? null,
      attribution: TRAFIKVERKET_ATTRIBUTION,
      source: 'trafikverket-traffic-safety-camera',
    },
  };
}

export function trafficSafetyCamerasToGeoJson(
  payload,
  maxFeatures = DEFAULT_TRAFIKVERKET_MAX_SAFETY_CAMERAS,
) {
  const rows = extractTrafikinfoRows(payload, 'TrafficSafetyCamera');
  const features = [];
  for (const row of rows) {
    const feature = normalizeTrafficSafetyCamera(row);
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

export function resolveMaxTrafficSafetyCameras(env = process.env) {
  const raw = Number(
    env.TRAFIKVERKET_SAFETY_CAMERA_MAX_FEATURES ||
      DEFAULT_TRAFIKVERKET_MAX_SAFETY_CAMERAS,
  );
  if (!Number.isFinite(raw)) return DEFAULT_TRAFIKVERKET_MAX_SAFETY_CAMERAS;
  return Math.max(8, Math.min(3000, Math.floor(raw)));
}

export function isTrafikverketSafetyCameraEnabled(env = process.env) {
  const enabled =
    String(env.TRAFIKVERKET_SAFETY_CAMERA_ENABLED || '1').trim() !== '0';
  const key = String(env.TRAFIKVERKET_API_KEY || '').trim();
  return enabled && key.length > 0;
}
