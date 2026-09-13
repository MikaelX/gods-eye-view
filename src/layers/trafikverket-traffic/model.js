import { FLOW_BUCKET_RGBA } from '../../data/trafficFlowStyle.js';

export const TRAFIKVERKET_TRAFFIC_LAYER_ID = 'trafikverket-traffic';

/** @type {Record<'free'|'slow'|'jam', number[]>} */
export const TRAFIKVERKET_BUCKET_RGBA = FLOW_BUCKET_RGBA;

/**
 * Flatten degrees from a GeoJSON LineString / Point for Cesium.fromDegreesArray.
 * @param {object} geometry
 * @returns {number[]|null}
 */
export function degreesArrayFromGeometry(geometry) {
  if (!geometry || typeof geometry !== 'object') return null;
  if (geometry.type === 'LineString' && Array.isArray(geometry.coordinates)) {
    const out = [];
    for (const pair of geometry.coordinates) {
      if (!Array.isArray(pair) || pair.length < 2) continue;
      const lon = Number(pair[0]);
      const lat = Number(pair[1]);
      if (!Number.isFinite(lon) || !Number.isFinite(lat)) continue;
      out.push(lon, lat);
    }
    return out.length >= 4 ? out : null;
  }
  if (geometry.type === 'Point' && Array.isArray(geometry.coordinates)) {
    const lon = Number(geometry.coordinates[0]);
    const lat = Number(geometry.coordinates[1]);
    if (!Number.isFinite(lon) || !Number.isFinite(lat)) return null;
    return [lon, lat];
  }
  return null;
}

/**
 * Severity code → point pixel size hint.
 * @param {number|null} severityCode
 * @returns {number}
 */
export function situationPointRadiusM(severityCode) {
  const code = Number(severityCode);
  if (!Number.isFinite(code)) return 60;
  if (code >= 4) return 120;
  if (code >= 3) return 90;
  return 60;
}
