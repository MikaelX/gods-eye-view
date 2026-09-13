/** Escape special XML characters for Trafikinfo REQUEST bodies. */
export function escapeXml(text) {
  return String(text || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Parse WKT POINT (lon lat) → {lat, lon}. */
export function parseWktPoint(value) {
  const match = String(value || '').match(
    /POINT\s*\(\s*(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)\s*\)/i,
  );
  if (!match) return { lat: NaN, lon: NaN };
  return { lon: Number(match[1]), lat: Number(match[2]) };
}

/** Parse WKT LINESTRING (lon lat, ...) → [[lon,lat], ...]. */
export function parseWktLineString(value) {
  const match = String(value || '').match(/LINESTRING\s*\(\s*([^)]+?)\s*\)/i);
  if (!match) return [];
  const coords = [];
  for (const part of match[1].split(',')) {
    const nums = part.trim().split(/\s+/);
    if (nums.length < 2) continue;
    const lon = Number(nums[0]);
    const lat = Number(nums[1]);
    if (!Number.isFinite(lon) || !Number.isFinite(lat)) continue;
    coords.push([lon, lat]);
  }
  return coords.length >= 2 ? coords : [];
}

/** True when lon/lat sits inside a rough bbox. */
export function inBbox(lat, lon, bbox) {
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lon) &&
    lat >= bbox.minLat &&
    lat <= bbox.maxLat &&
    lon >= bbox.minLon &&
    lon <= bbox.maxLon
  );
}

/** Cap an array length without sorting. */
export function capRows(rows, max) {
  const list = Array.isArray(rows) ? rows : [];
  const n = Number.isFinite(max) ? Math.max(1, Math.floor(max)) : list.length;
  return list.length > n ? list.slice(0, n) : list;
}
