/** Shared Trafikverket Trafikinfo endpoints and defaults (Sweden). */

export const TRAFIKVERKET_DATA_URL =
  'https://api.trafikinfo.trafikverket.se/v2/data.json';

/** Stockholm county — default pack scope (not an API hard limit). */
export const TRAFIKVERKET_STOCKHOLM_COUNTY_NO = 1;

/** Comma-separated CountyNo list env (default Stockholm). Use `*` / `all` for nationwide. */
export const TRAFIKVERKET_COUNTY_NOS_ENV = 'TRAFIKVERKET_COUNTY_NOS';

export const DEFAULT_TRAFIKVERKET_MAX_ROUTES = 250;
export const DEFAULT_TRAFIKVERKET_MAX_SITUATIONS = 400;
export const DEFAULT_TRAFIKVERKET_MAX_TRAFFIC_FLOW = 800;

export const TRAFIKVERKET_FETCH_TIMEOUT_MS = 15_000;
export const TRAFIKVERKET_CACHE_TTL_MS = 60_000;

/** Sweden rough WGS84 box — rejects wild WKT mis-parses without locking to Stockholm. */
export const SWEDEN_BBOX = Object.freeze({
  minLat: 54.8,
  maxLat: 69.2,
  minLon: 10.5,
  maxLon: 24.5,
});

export const STOCKHOLM_CENTER = Object.freeze({ lat: 59.3326, lon: 18.0649 });

export const TRAFIKVERKET_ATTRIBUTION = 'Contains data from Trafikverket';
