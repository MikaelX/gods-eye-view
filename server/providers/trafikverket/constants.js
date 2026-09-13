/** Shared Trafikverket Trafikinfo endpoints and defaults (Sweden-wide pack). */

export const TRAFIKVERKET_DATA_URL =
  'https://api.trafikinfo.trafikverket.se/v2/data.json';

/** Stockholm county number — optional narrow filter only (not the default). */
export const TRAFIKVERKET_STOCKHOLM_COUNTY_NO = 1;

/**
 * Optional CountyNo filter env. Empty / unset → nationwide (null).
 * Comma list narrows; `*` / `all` also nationwide.
 */
export const TRAFIKVERKET_COUNTY_NOS_ENV = 'TRAFIKVERKET_COUNTY_NOS';

/** Nationwide defaults — catalogs are large; nearest-N / env caps apply after fetch. */
export const DEFAULT_TRAFIKVERKET_MAX_ROUTES = 500;
export const DEFAULT_TRAFIKVERKET_MAX_SITUATIONS = 1500;
export const DEFAULT_TRAFIKVERKET_MAX_TRAFFIC_FLOW = 1500;
export const DEFAULT_TRAFIKVERKET_MAX_ROAD_CONDITIONS = 800;
export const DEFAULT_TRAFIKVERKET_MAX_WEATHER_POINTS = 400;
export const DEFAULT_TRAFIKVERKET_MAX_SAFETY_CAMERAS = 400;
export const DEFAULT_TRAFIKVERKET_MAX_CCTV = 500;

export const TRAFIKVERKET_FETCH_TIMEOUT_MS = 30_000;
/** Align with TomTom tile cache (~120s) — national TRV catalog reuse. */
export const TRAFIKVERKET_CACHE_TTL_MS = 120_000;

/** Pad applied when clipping responses to a client viewport bbox. */
export const TRAFIKVERKET_BBOX_PAD_DEG = 0.02;

/** Sweden rough WGS84 box — rejects wild WKT mis-parses. */
export const SWEDEN_BBOX = Object.freeze({
  minLat: 54.8,
  maxLat: 69.2,
  minLon: 10.5,
  maxLon: 24.5,
});

/** Metro anchors for nearest-N caps across a Sweden-wide catalog. */
export const SWEDEN_METRO_ANCHORS = Object.freeze([
  Object.freeze({ lat: 59.3326, lon: 18.0649, name: 'Stockholm' }),
  Object.freeze({ lat: 57.7089, lon: 11.9746, name: 'Gothenburg' }),
  Object.freeze({ lat: 55.605, lon: 13.0038, name: 'Malmo' }),
  Object.freeze({ lat: 59.8586, lon: 17.6389, name: 'Uppsala' }),
  Object.freeze({ lat: 58.4108, lon: 15.6214, name: 'Linkoping' }),
  Object.freeze({ lat: 63.8258, lon: 20.263, name: 'Umea' }),
  Object.freeze({ lat: 59.2741, lon: 15.2066, name: 'Orebro' }),
  Object.freeze({ lat: 62.3908, lon: 17.3069, name: 'Sundsvall' }),
]);

export const STOCKHOLM_CENTER = SWEDEN_METRO_ANCHORS[0];

export const TRAFIKVERKET_ATTRIBUTION = 'Contains data from Trafikverket';
