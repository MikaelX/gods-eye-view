import {
  TRAFIKVERKET_STOCKHOLM_COUNTY_NO,
  TRAFIKVERKET_COUNTY_NOS_ENV,
} from './constants.js';

/**
 * Parse TRAFIKVERKET_COUNTY_NOS.
 * unset/empty → [1]; `*`/`all`/`national` → null (nationwide); `1,12` → ints
 */
export function parseTrafikverketCountyNos(env = process.env) {
  const raw = String(env[TRAFIKVERKET_COUNTY_NOS_ENV] ?? '').trim();
  if (!raw) return [TRAFIKVERKET_STOCKHOLM_COUNTY_NO];
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
  return nos.length ? nos : [TRAFIKVERKET_STOCKHOLM_COUNTY_NO];
}

/** CountyNo FILTER fragment (no outer FILTER). Nationwide → ''. */
export function buildCountyNoFilterXml(countyNos) {
  if (countyNos == null) return '';
  const list = Array.isArray(countyNos) ? countyNos : [];
  if (!list.length) {
    return `<EQ name="CountyNo" value="${TRAFIKVERKET_STOCKHOLM_COUNTY_NO}" />`;
  }
  if (list.length === 1) {
    return `<EQ name="CountyNo" value="${list[0]}" />`;
  }
  return (
    `<OR>` +
    list.map((n) => `<EQ name="CountyNo" value="${n}" />`).join('') +
    `</OR>`
  );
}

export function countyNosLabel(countyNos) {
  if (countyNos == null) return 'nationwide';
  if (
    countyNos.length === 1 &&
    countyNos[0] === TRAFIKVERKET_STOCKHOLM_COUNTY_NO
  ) {
    return 'Stockholm county (CountyNo 1)';
  }
  return `CountyNo ${countyNos.join(',')}`;
}
