import {
  TRAFIKVERKET_CAMERA_URL,
  TRAFIKVERKET_STOCKHOLM_COUNTY_NO,
  DEFAULT_TRAFIKVERKET_MAX_SOURCES,
  STOCKHOLM_CENTER,
  CCTV_SOURCE_FETCH_TIMEOUT_MS,
} from './constants.js';
import {
  parseTrafikverketCountyNos,
  buildCountyNoFilterXml,
} from '../trafikverket/county.js';
import { SWEDEN_BBOX } from '../trafikverket/constants.js';
import {
  toFiniteNumber,
  parsePointString,
  fallbackHeadingFromId,
  prioritizeSources,
  escapeXml,
} from './normalize.js';
import { directionToHeading } from '../../../src/data/directionText.js';

/** True when a TRAFIKVERKET_API_KEY is present and the pack is not disabled. */
export function isTrafikverketCctvEnabled(env = process.env) {
  const enabled = String(env.CCTV_TRAFIKVERKET_ENABLED || '1').trim() !== '0';
  const key = String(env.TRAFIKVERKET_API_KEY || '').trim();
  return enabled && key.length > 0;
}

/** Presence-only status payload — never includes the key material. */
export function trafikverketCctvStatus(env = process.env) {
  const enabled = String(env.CCTV_TRAFIKVERKET_ENABLED || '1').trim() !== '0';
  const hasKey = String(env.TRAFIKVERKET_API_KEY || '').trim().length > 0;
  return {
    configured: enabled && hasKey,
    enabled,
    hasKey,
  };
}

/**
 * Build the Trafikinfo REQUEST XML for Stockholm county road cameras.
 * Content-Type must be text/xml or text/plain (application/xml can flake auth).
 *
 * @param {string} apiKey
 * @param {number} [countyNo=1]
 * @returns {string}
 */
export function buildTrafikverketCameraRequestXml(
  apiKey,
  countyNos = TRAFIKVERKET_STOCKHOLM_COUNTY_NO,
) {
  const key = escapeXml(String(apiKey || '').trim());
  // Accept legacy single CountyNo number OR array/null from parseTrafikverketCountyNos.
  let counties = countyNos;
  if (counties == null) {
    counties = null;
  } else if (typeof counties === 'number' || typeof counties === 'string') {
    const n = Number(counties);
    counties = Number.isFinite(n) && n > 0
      ? [Math.floor(n)]
      : [TRAFIKVERKET_STOCKHOLM_COUNTY_NO];
  }
  const countyFilter = buildCountyNoFilterXml(counties);
  const countyClause = countyFilter ? countyFilter : '';
  return (
    `<REQUEST>` +
    `<LOGIN authenticationkey="${key}" />` +
    `<QUERY objecttype="Camera" schemaversion="1">` +
    `<FILTER>` +
    `<AND>` +
    `<EQ name="Active" value="true" />` +
    countyClause +
    `</AND>` +
    `</FILTER>` +
    `<INCLUDE>Name</INCLUDE>` +
    `<INCLUDE>Id</INCLUDE>` +
    `<INCLUDE>PhotoUrl</INCLUDE>` +
    `<INCLUDE>Direction</INCLUDE>` +
    `<INCLUDE>Geometry.WGS84</INCLUDE>` +
    `</QUERY>` +
    `</REQUEST>`
  );
}

/**
 * Map Trafikverket Direction (degrees or cardinal text) → headingDeg.
 * 360 wraps to 0. Non-finite / empty → NaN (caller uses id-hash fallback).
 *
 * @param {unknown} direction
 * @returns {number}
 */
export function trafikverketDirectionToHeading(direction) {
  if (direction == null || direction === '') return NaN;
  const numeric = toFiniteNumber(direction);
  if (Number.isFinite(numeric)) {
    const wrapped = ((numeric % 360) + 360) % 360;
    return wrapped;
  }
  return directionToHeading(String(direction), true);
}

/** Official Trafikverket still hosts only (defense-in-depth catalog pin). */
export function isTrafikverketPhotoUrl(url) {
  try {
    const parsed = new URL(String(url || ''));
    if (parsed.protocol !== 'https:') return false;
    const host = parsed.hostname.toLowerCase();
    return host === 'trafikverket.se' || host.endsWith('.trafikverket.se');
  } catch {
    return false;
  }
}

/**
 * Normalize one Trafikinfo Camera record into a GEV CCTV source object.
 * Uses Geometry.WGS84 WKT POINT (lon lat) only — never SWEREF99TM.
 *
 * @param {object} record
 * @returns {object|null}
 */
export function normalizeTrafikverketCamera(record) {
  if (!record || typeof record !== 'object') return null;
  const rawId = String(record.Id ?? record.id ?? '').trim();
  if (!rawId) return null;

  const photoUrl = String(record.PhotoUrl ?? record.photoUrl ?? '').trim();
  if (!isTrafikverketPhotoUrl(photoUrl)) return null;

  const wgs84 = record.Geometry?.WGS84 ?? record.geometry?.WGS84 ?? '';
  const { lat, lon } = parsePointString(wgs84);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  // Sweden rough sanity box (CountyNo filter is the real scope; not Stockholm-hard-locked).
  if (
    lat < SWEDEN_BBOX.minLat ||
    lat > SWEDEN_BBOX.maxLat ||
    lon < SWEDEN_BBOX.minLon ||
    lon > SWEDEN_BBOX.maxLon
  ) {
    return null;
  }

  const cameraId = `tv-${rawId}`;
  const extractedHeading = trafikverketDirectionToHeading(
    record.Direction ?? record.direction,
  );
  const hasHeading = Number.isFinite(extractedHeading);
  const name = String(record.Name ?? record.name ?? '').trim() || `Camera ${rawId}`;

  return {
    id: cameraId,
    name,
    city: 'Stockholm',
    cityId: 'stockholm',
    provider: 'Trafikverket',
    lat,
    lon,
    headingDeg: hasHeading ? extractedHeading : fallbackHeadingFromId(cameraId),
    headingConfidence: hasHeading ? 'high' : 'low',
    // Stockholm road-cam priors (longer throw / higher mount than Austin city cams).
    pitchDeg: hasHeading ? -12 : -10,
    fovDeg: hasHeading ? 72 : 64,
    rangeM: hasHeading ? 600 : 480,
    mountHeightM: hasHeading ? 28 : 22,
    groundElevationM: 25, // Mälaren basin prior; client one-shot snap corrects.
    feedType: 'image',
    url: photoUrl,
    snapshotUrl: photoUrl,
    sourceKind: 'trafikverket-open-data',
    license: 'Contains data from Trafikverket',
  };
}

/**
 * Extract Camera records from a Trafikinfo JSON RESPONSE body.
 * @param {object} payload
 * @returns {Array<object>}
 */
export function extractTrafikverketCameras(payload) {
  const results = payload?.RESPONSE?.RESULT;
  if (!Array.isArray(results)) return [];
  const cameras = [];
  for (const result of results) {
    const rows = result?.Camera;
    if (Array.isArray(rows)) cameras.push(...rows);
    else if (rows && typeof rows === 'object') cameras.push(rows);
  }
  return cameras;
}

/**
 * Fetch Trafikverket road cameras for Stockholm county (CountyNo 1).
 * Requires TRAFIKVERKET_API_KEY. Disabled with CCTV_TRAFIKVERKET_ENABLED=0.
 * Caps to CCTV_TRAFIKVERKET_MAX_SOURCES (default 200) nearest Stockholm centre.
 *
 * @returns {Promise<Array<object>>}
 */
export async function loadTrafikverketSourcesFromOpenData() {
  if (!isTrafikverketCctvEnabled()) return [];
  const apiKey = String(process.env.TRAFIKVERKET_API_KEY || '').trim();
  try {
    const countyNos = parseTrafikverketCountyNos(process.env);
    const body = buildTrafikverketCameraRequestXml(apiKey, countyNos);
    const resp = await fetch(TRAFIKVERKET_CAMERA_URL, {
      method: 'POST',
      // text/xml (not application/xml) — Trafikinfo auth can flake on the latter.
      headers: {
        'Content-Type': 'text/xml',
        Accept: 'application/json',
      },
      body,
      signal: AbortSignal.timeout(CCTV_SOURCE_FETCH_TIMEOUT_MS),
    });
    if (!resp.ok) {
      console.warn('[CCTV] Trafikverket Camera download failed:', resp.status);
      return [];
    }
    const payload = await resp.json();
    const rows = extractTrafikverketCameras(payload);
    const cameras = [];
    for (const row of rows) {
      const normalized = normalizeTrafikverketCamera(row);
      if (normalized) cameras.push(normalized);
    }

    const unique = Array.from(
      new Map(cameras.map((camera) => [camera.id, camera])).values(),
    );
    const maxRaw = Number(
      process.env.CCTV_TRAFIKVERKET_MAX_SOURCES ||
        DEFAULT_TRAFIKVERKET_MAX_SOURCES,
    );
    const maxCount = Number.isFinite(maxRaw)
      ? Math.max(8, Math.min(600, Math.floor(maxRaw)))
      : DEFAULT_TRAFIKVERKET_MAX_SOURCES;
    const prioritized = prioritizeSources(unique, maxCount, [STOCKHOLM_CENTER]);
    console.log(
      `[CCTV] Loaded Trafikverket camera sources: ${unique.length} active for configured counties (using nearest ${prioritized.length})`,
    );
    return prioritized;
  } catch (error) {
    console.warn(
      '[CCTV] Trafikverket Camera download error:',
      error?.message || error,
    );
    return [];
  }
}
