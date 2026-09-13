import {
  escapeXml,
  parseWktPoint,
  parseWktLineString,
  inBbox,
} from './wkt.js';
import { buildCountyNoFilterXml } from './county.js';
import { extractTrafikinfoRows } from './client.js';
import { prioritizeFeatures } from './geo.js';
import {
  SWEDEN_BBOX,
  DEFAULT_TRAFIKVERKET_MAX_ROAD_CONDITIONS,
  TRAFIKVERKET_ATTRIBUTION,
} from './constants.js';

/**
 * RoadCondition REQUEST XML (schema 1.2).
 * @param {string} apiKey
 * @param {number[]|null} countyNos
 */
export function buildRoadConditionRequestXml(apiKey, countyNos) {
  const key = escapeXml(String(apiKey || '').trim());
  const countyFilter = buildCountyNoFilterXml(countyNos);
  const filterInner = countyFilter
    ? `<FILTER>${countyFilter}</FILTER>`
    : `<FILTER></FILTER>`;
  return (
    `<REQUEST>` +
    `<LOGIN authenticationkey="${key}" />` +
    `<QUERY objecttype="RoadCondition" schemaversion="1.2">` +
    filterInner +
    `<INCLUDE>Id</INCLUDE>` +
    `<INCLUDE>ConditionCode</INCLUDE>` +
    `<INCLUDE>ConditionText</INCLUDE>` +
    `<INCLUDE>Message</INCLUDE>` +
    `<INCLUDE>LocationText</INCLUDE>` +
    `<INCLUDE>CountyNo</INCLUDE>` +
    `<INCLUDE>Deleted</INCLUDE>` +
    `<INCLUDE>Geometry.WGS84</INCLUDE>` +
    `</QUERY>` +
    `</REQUEST>`
  );
}

function swedenOk(lat, lon) {
  return inBbox(lat, lon, {
    minLat: SWEDEN_BBOX.minLat,
    maxLat: SWEDEN_BBOX.maxLat,
    minLon: SWEDEN_BBOX.minLon,
    maxLon: SWEDEN_BBOX.maxLon,
  });
}

export function normalizeRoadCondition(record) {
  if (!record || typeof record !== 'object') return null;
  if (record.Deleted === true || record.deleted === true) return null;
  const id = String(record.Id ?? record.id ?? '').trim();
  if (!id) return null;
  const wkt = record.Geometry?.WGS84 ?? record.geometry?.WGS84 ?? '';
  const point = parseWktPoint(wkt);
  const line = parseWktLineString(wkt);
  let geometry = null;
  if (Number.isFinite(point.lat) && Number.isFinite(point.lon)) {
    if (!swedenOk(point.lat, point.lon)) return null;
    geometry = { type: 'Point', coordinates: [point.lon, point.lat] };
  } else if (line.length >= 2) {
    const mid = line[Math.floor(line.length / 2)];
    if (!swedenOk(mid[1], mid[0])) return null;
    geometry = { type: 'LineString', coordinates: line };
  } else {
    return null;
  }
  const conditionText =
    String(record.ConditionText ?? record.conditionText ?? '').trim() ||
    String(record.Message ?? record.message ?? '').trim() ||
    id;
  return {
    type: 'Feature',
    id: `tv-roadcond-${id}`,
    geometry,
    properties: {
      id,
      conditionCode: record.ConditionCode ?? record.conditionCode ?? null,
      conditionText,
      message: String(record.Message ?? record.message ?? '').trim(),
      locationText: String(record.LocationText ?? record.locationText ?? '').trim(),
      countyNo: record.CountyNo ?? record.countyNo ?? null,
      attribution: TRAFIKVERKET_ATTRIBUTION,
      source: 'trafikverket-road-condition',
    },
  };
}

export function roadConditionsToGeoJson(
  payload,
  maxFeatures = DEFAULT_TRAFIKVERKET_MAX_ROAD_CONDITIONS,
) {
  const rows = extractTrafikinfoRows(payload, 'RoadCondition');
  const features = [];
  for (const row of rows) {
    const feature = normalizeRoadCondition(row);
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

export function resolveMaxRoadConditions(env = process.env) {
  const raw = Number(
    env.TRAFIKVERKET_ROAD_CONDITION_MAX_FEATURES ||
      DEFAULT_TRAFIKVERKET_MAX_ROAD_CONDITIONS,
  );
  if (!Number.isFinite(raw)) return DEFAULT_TRAFIKVERKET_MAX_ROAD_CONDITIONS;
  return Math.max(8, Math.min(5000, Math.floor(raw)));
}

export function isTrafikverketRoadConditionEnabled(env = process.env) {
  const enabled =
    String(env.TRAFIKVERKET_ROAD_CONDITION_ENABLED || '1').trim() !== '0';
  const key = String(env.TRAFIKVERKET_API_KEY || '').trim();
  return enabled && key.length > 0;
}
