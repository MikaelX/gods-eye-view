import {
  escapeXml,
  parseWktPoint,
  parseWktLineString,
  inBbox,
  capRows,
} from './wkt.js';
import { buildCountyNoFilterXml } from './county.js';
import { extractTrafikinfoRows } from './client.js';
import {
  SWEDEN_BBOX,
  DEFAULT_TRAFIKVERKET_MAX_SITUATIONS,
  TRAFIKVERKET_ATTRIBUTION,
} from './constants.js';

/**
 * Situation REQUEST — schema 1.6 requires namespace="road.trafficinfo".
 */
export function buildSituationRequestXml(apiKey, countyNos) {
  const key = escapeXml(String(apiKey || '').trim());
  const countyFilter = buildCountyNoFilterXml(countyNos);
  const filterInner = countyFilter
    ? `<FILTER>${countyFilter}</FILTER>`
    : `<FILTER></FILTER>`;
  return (
    `<REQUEST>` +
    `<LOGIN authenticationkey="${key}" />` +
    `<QUERY objecttype="Situation" schemaversion="1.6" namespace="road.trafficinfo">` +
    filterInner +
    `<INCLUDE>Id</INCLUDE>` +
    `<INCLUDE>Deviation.Id</INCLUDE>` +
    `<INCLUDE>Deviation.Header</INCLUDE>` +
    `<INCLUDE>Deviation.Message</INCLUDE>` +
    `<INCLUDE>Deviation.SeverityCode</INCLUDE>` +
    `<INCLUDE>Deviation.SeverityText</INCLUDE>` +
    `<INCLUDE>Deviation.IconId</INCLUDE>` +
    `<INCLUDE>Deviation.CountyNo</INCLUDE>` +
    `<INCLUDE>Deviation.Geometry.WGS84</INCLUDE>` +
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

/** Normalize one Deviation → Feature or null. */
export function normalizeSituationDeviation(deviation, situationId = '') {
  if (!deviation || typeof deviation !== 'object') return null;
  const id = String(deviation.Id ?? deviation.id ?? '').trim();
  if (!id) return null;
  const wkt = deviation.Geometry?.WGS84 ?? deviation.geometry?.WGS84 ?? '';
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
  const severityCode = Number(deviation.SeverityCode ?? deviation.severityCode);
  const header =
    String(deviation.Header ?? deviation.header ?? '').trim() ||
    String(deviation.Message ?? deviation.message ?? '').trim() ||
    id;
  return {
    type: 'Feature',
    id: `tv-sit-${situationId || 'x'}-${id}`,
    geometry,
    properties: {
      id,
      situationId: situationId || null,
      header,
      message: String(deviation.Message ?? deviation.message ?? '').trim(),
      severityCode: Number.isFinite(severityCode) ? severityCode : null,
      severityText: String(
        deviation.SeverityText ?? deviation.severityText ?? '',
      ).trim(),
      iconId: String(deviation.IconId ?? deviation.iconId ?? '').trim(),
      countyNo: deviation.CountyNo ?? deviation.countyNo ?? null,
      attribution: TRAFIKVERKET_ATTRIBUTION,
      source: 'trafikverket-situation',
    },
  };
}

export function situationsToGeoJson(
  payload,
  maxFeatures = DEFAULT_TRAFIKVERKET_MAX_SITUATIONS,
) {
  const situations = extractTrafikinfoRows(payload, 'Situation');
  const features = [];
  for (const situation of situations) {
    const situationId = String(situation?.Id ?? situation?.id ?? '').trim();
    let deviations = situation?.Deviation ?? situation?.deviation;
    if (!deviations) continue;
    if (!Array.isArray(deviations)) deviations = [deviations];
    for (const deviation of deviations) {
      const feature = normalizeSituationDeviation(deviation, situationId);
      if (feature) features.push(feature);
    }
  }
  const capped = capRows(features, maxFeatures);
  return {
    type: 'FeatureCollection',
    features: capped,
    truncated: capped.length < features.length,
    totalNormalized: features.length,
  };
}

export function resolveMaxSituations(env = process.env) {
  const raw = Number(
    env.TRAFIKVERKET_SITUATION_MAX_FEATURES ||
      DEFAULT_TRAFIKVERKET_MAX_SITUATIONS,
  );
  if (!Number.isFinite(raw)) return DEFAULT_TRAFIKVERKET_MAX_SITUATIONS;
  return Math.max(8, Math.min(5000, Math.floor(raw)));
}

export function isTrafikverketSituationEnabled(env = process.env) {
  const enabled =
    String(env.TRAFIKVERKET_SITUATION_ENABLED || '1').trim() !== '0';
  const key = String(env.TRAFIKVERKET_API_KEY || '').trim();
  return enabled && key.length > 0;
}
