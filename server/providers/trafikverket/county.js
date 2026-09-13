import {
  TRAFIKVERKET_STOCKHOLM_COUNTY_NO,
  TRAFIKVERKET_COUNTY_NOS_ENV,
} from './constants.js';

/**
 * Parse TRAFIKVERKET_COUNTY_NOS.
 * - unset / empty / `*` / `all` / `national` → null (nationwide — the product default)
 * - `1,12,14` → unique positive ints (optional narrow filter)
 *
 * @param {NodeJS.ProcessEnv} [env]
 * @returns {number[]|null} null = nationwide
 */
export function parseTrafikverketCountyNos(env = process.env) {
  const raw = String(env[TRAFIKVERKET_COUNTY_NOS_ENV] ?? '').trim();
  if (!raw) return null;
  const lower = raw.toLowerCase();
  if (lower === '*' || lower === 'all' || lower === 'national') return null;
  const nos = [];
  const seen = new Set();
  for (const part of raw.split(/[,;\s]+/)) {
    if (!part) continue;
    const n = Number(part);
    if (!Number.isFinite(n) || n <= 0) continue;
    const county = Math.floor(n);
    if (seen.has(county)) continue;
    seen.add(county);
    nos.push(county);
  }
  // Empty garbage → nationwide (do not fall back to Stockholm-only).
  return nos.length ? nos : null;
}

/**
 * CountyNo FILTER fragment (no outer FILTER). Nationwide → ''.
 * @param {number[]|null} countyNos
 * @returns {string}
 */
export function buildCountyNoFilterXml(countyNos) {
  if (countyNos == null) return '';
  const list = Array.isArray(countyNos) ? countyNos : [];
  if (!list.length) return '';
  if (list.length === 1) {
    return `<EQ name="CountyNo" value="${list[0]}" />`;
  }
  return (
    `<OR>` +
    list.map((n) => `<EQ name="CountyNo" value="${n}" />`).join('') +
    `</OR>`
  );
}

/**
 * @param {number[]|null} countyNos
 * @returns {string}
 */
export function countyNosLabel(countyNos) {
  if (countyNos == null || (Array.isArray(countyNos) && !countyNos.length)) {
    return 'nationwide (Sweden)';
  }
  if (
    countyNos.length === 1 &&
    countyNos[0] === TRAFIKVERKET_STOCKHOLM_COUNTY_NO
  ) {
    return 'Stockholm county (CountyNo 1)';
  }
  return `CountyNo ${countyNos.join(',')}`;
}
