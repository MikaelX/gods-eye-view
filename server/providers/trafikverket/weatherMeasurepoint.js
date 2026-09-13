import { escapeXml, parseWktPoint, inBbox } from './wkt.js';
import { buildCountyNoFilterXml } from './county.js';
import { extractTrafikinfoRows } from './client.js';
import { prioritizeFeatures } from './geo.js';
import {
  SWEDEN_BBOX,
  DEFAULT_TRAFIKVERKET_MAX_WEATHER_POINTS,
  TRAFIKVERKET_ATTRIBUTION,
} from './constants.js';

/**
 * WeatherMeasurepoint REQUEST XML (schema 2.0).
 * Observations are included when present on the measurepoint payload.
 * @param {string} apiKey
 * @param {number[]|null} countyNos
 */
export function buildWeatherMeasurepointRequestXml(apiKey, countyNos) {
  const key = escapeXml(String(apiKey || '').trim());
  const countyFilter = buildCountyNoFilterXml(countyNos);
  const filterInner = countyFilter
    ? `<FILTER>${countyFilter}</FILTER>`
    : `<FILTER></FILTER>`;
  return (
    `<REQUEST>` +
    `<LOGIN authenticationkey="${key}" />` +
    `<QUERY objecttype="WeatherMeasurepoint" schemaversion="2.0">` +
    filterInner +
    `<INCLUDE>Id</INCLUDE>` +
    `<INCLUDE>Name</INCLUDE>` +
    `<INCLUDE>Active</INCLUDE>` +
    `<INCLUDE>CountyNo</INCLUDE>` +
    `<INCLUDE>Observation.Sample</INCLUDE>` +
    `<INCLUDE>Observation.Air.Temperature.Value</INCLUDE>` +
    `<INCLUDE>Observation.Air.RelativeHumidity.Value</INCLUDE>` +
    `<INCLUDE>Observation.Wind.Speed.Value</INCLUDE>` +
    `<INCLUDE>Observation.Precipitation.Amount.Value</INCLUDE>` +
    `<INCLUDE>Geometry.WGS84</INCLUDE>` +
    `</QUERY>` +
    `</REQUEST>`
  );
}

function readObs(record, ...path) {
  let cur = record?.Observation ?? record?.observation;
  for (const key of path) {
    if (cur == null || typeof cur !== 'object') return null;
    cur = cur[key];
  }
  const n = Number(cur);
  return Number.isFinite(n) ? n : null;
}

export function normalizeWeatherMeasurepoint(record) {
  if (!record || typeof record !== 'object') return null;
  if (record.Active === false || record.active === false) return null;
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
  const name = String(record.Name ?? record.name ?? '').trim() || id;
  return {
    type: 'Feature',
    id: `tv-wx-${id}`,
    geometry: { type: 'Point', coordinates: [point.lon, point.lat] },
    properties: {
      id,
      name,
      airTemperatureC: readObs(record, 'Air', 'Temperature', 'Value'),
      relativeHumidityPct: readObs(record, 'Air', 'RelativeHumidity', 'Value'),
      windSpeedMs: readObs(record, 'Wind', 'Speed', 'Value'),
      precipitationMm: readObs(record, 'Precipitation', 'Amount', 'Value'),
      sample: record.Observation?.Sample ?? record.observation?.Sample ?? null,
      countyNo: record.CountyNo ?? record.countyNo ?? null,
      attribution: TRAFIKVERKET_ATTRIBUTION,
      source: 'trafikverket-weather-measurepoint',
    },
  };
}

export function weatherMeasurepointsToGeoJson(
  payload,
  maxFeatures = DEFAULT_TRAFIKVERKET_MAX_WEATHER_POINTS,
) {
  const rows = extractTrafikinfoRows(payload, 'WeatherMeasurepoint');
  const features = [];
  for (const row of rows) {
    const feature = normalizeWeatherMeasurepoint(row);
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

export function resolveMaxWeatherMeasurepoints(env = process.env) {
  const raw = Number(
    env.TRAFIKVERKET_WEATHER_MAX_FEATURES ||
      DEFAULT_TRAFIKVERKET_MAX_WEATHER_POINTS,
  );
  if (!Number.isFinite(raw)) return DEFAULT_TRAFIKVERKET_MAX_WEATHER_POINTS;
  return Math.max(8, Math.min(3000, Math.floor(raw)));
}

export function isTrafikverketWeatherEnabled(env = process.env) {
  const enabled =
    String(env.TRAFIKVERKET_WEATHER_ENABLED || '1').trim() !== '0';
  const key = String(env.TRAFIKVERKET_API_KEY || '').trim();
  return enabled && key.length > 0;
}
