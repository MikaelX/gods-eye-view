import { SWEDEN_METRO_ANCHORS } from './constants.js';

/** Haversine distance in km. */
export function haversineKm(lat1, lon1, lat2, lon2) {
  const toRad = (d) => (d * Math.PI) / 180;
  const r = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * r * Math.asin(Math.min(1, Math.sqrt(a)));
}

/**
 * Representative lon/lat for a GeoJSON geometry.
 * @param {object} geometry
 * @returns {{lat:number, lon:number}|null}
 */
export function featureAnchor(geometry) {
  if (!geometry || typeof geometry !== 'object') return null;
  if (geometry.type === 'Point' && Array.isArray(geometry.coordinates)) {
    const lon = Number(geometry.coordinates[0]);
    const lat = Number(geometry.coordinates[1]);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
    return { lat, lon };
  }
  if (geometry.type === 'LineString' && Array.isArray(geometry.coordinates)) {
    const mid = geometry.coordinates[Math.floor(geometry.coordinates.length / 2)];
    if (!Array.isArray(mid) || mid.length < 2) return null;
    const lon = Number(mid[0]);
    const lat = Number(mid[1]);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
    return { lat, lon };
  }
  return null;
}

/**
 * Keep nearest-N GeoJSON features to Sweden metro anchors (or custom anchors).
 * @param {object[]} features
 * @param {number} max
 * @param {Array<{lat:number, lon:number}>} [anchors]
 * @returns {object[]}
 */
export function prioritizeFeatures(features, max, anchors = SWEDEN_METRO_ANCHORS) {
  const list = Array.isArray(features) ? features : [];
  const n = Number.isFinite(max) ? Math.max(1, Math.floor(max)) : list.length;
  const anchorList = (Array.isArray(anchors) ? anchors : []).filter(
    (a) => Number.isFinite(a?.lat) && Number.isFinite(a?.lon),
  );
  if (list.length <= n || !anchorList.length) return list.slice(0, n);

  const scored = list.map((feature, idx) => {
    const pt = featureAnchor(feature?.geometry);
    const distKm = pt
      ? Math.min(
          ...anchorList.map((a) => haversineKm(pt.lat, pt.lon, a.lat, a.lon)),
        )
      : Number.POSITIVE_INFINITY;
    return { feature, idx, distKm };
  });
  scored.sort((a, b) => {
    if (a.distKm !== b.distKm) return a.distKm - b.distKm;
    return a.idx - b.idx;
  });
  return scored.slice(0, n).map((entry) => entry.feature);
}

/**
 * Parse ?bbox=west,south,east,north
 * @param {string|null|undefined} raw
 * @returns {{west:number,south:number,east:number,north:number}|null}
 */
export function parseBboxParam(raw) {
  if (!raw) return null;
  const parts = String(raw)
    .split(',')
    .map((p) => Number(p.trim()));
  if (parts.length !== 4 || parts.some((n) => !Number.isFinite(n))) return null;
  const [west, south, east, north] = parts;
  if (west >= east || south >= north) return null;
  return { west, south, east, north };
}

/**
 * Filter GeoJSON features that intersect a bbox (point-in / line midpoint-in).
 * @param {object[]} features
 * @param {{west:number,south:number,east:number,north:number}|null} bbox
 * @returns {object[]}
 */
export function filterFeaturesByBbox(features, bbox) {
  if (!bbox) return Array.isArray(features) ? features : [];
  const list = Array.isArray(features) ? features : [];
  return list.filter((feature) => {
    const pt = featureAnchor(feature?.geometry);
    if (!pt) return false;
    return (
      pt.lon >= bbox.west &&
      pt.lon <= bbox.east &&
      pt.lat >= bbox.south &&
      pt.lat <= bbox.north
    );
  });
}
