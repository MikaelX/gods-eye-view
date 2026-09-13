import { bboxQueryValue } from './viewport.js';

const ROUTES_URL = '/api/trafikverket/travel-time-routes';
const SITUATIONS_URL = '/api/trafikverket/situations';
const FLOW_URL = '/api/trafikverket/traffic-flow';
const ROAD_URL = '/api/trafikverket/road-conditions';
const WEATHER_URL = '/api/trafikverket/weather-measurepoints';
const ATK_URL = '/api/trafikverket/traffic-safety-cameras';
const STATUS_URL = '/api/trafikverket/status';

function emptyFc() {
  return { type: 'FeatureCollection', features: [] };
}

async function fetchFc(fetchImpl, url, signal) {
  const resp = await fetchImpl(url, { signal });
  if (resp.status === 503) return { ok: false, status: 503, body: emptyFc() };
  if (!resp.ok) return { ok: false, status: resp.status, body: emptyFc() };
  return { ok: true, status: resp.status, body: await resp.json() };
}

/**
 * Same-origin Trafikverket pack (key stays on the server).
 * TravelTimeRoute / Situation / TrafficFlow follow the TomTom pattern: callers
 * should pass the current viewport bbox so the client never asks for all of Sweden.
 * ATK / weather / road use the same bbox clip; CCTV stills stay on the CCTV pack
 * (nearest-N catalog + PhotoUrl only on activation).
 */
export function createTrafikverketTrafficSource({
  fetchImpl = (...args) => globalThis.fetch(...args),
} = {}) {
  return {
    async getStatus({ signal } = {}) {
      const resp = await fetchImpl(STATUS_URL, { signal });
      if (!resp.ok) throw new Error(`Trafikverket status HTTP ${resp.status}`);
      return resp.json();
    },

    async getSnapshot({ signal, bbox } = {}) {
      signal?.throwIfAborted?.();
      const bboxVal = bboxQueryValue(bbox);
      const q = bboxVal ? `?bbox=${bboxVal}` : '';
      const [routes, situations, flow, roads, weather, atk] = await Promise.all([
        fetchFc(fetchImpl, ROUTES_URL + q, signal),
        fetchFc(fetchImpl, SITUATIONS_URL + q, signal),
        fetchFc(fetchImpl, FLOW_URL + q, signal),
        fetchFc(fetchImpl, ROAD_URL + q, signal),
        fetchFc(fetchImpl, WEATHER_URL + q, signal),
        fetchFc(fetchImpl, ATK_URL + q, signal),
      ]);
      signal?.throwIfAborted?.();

      const all503 = [routes, situations, flow, roads, weather, atk].every(
        (r) => r.status === 503,
      );
      if (all503) {
        return {
          configured: false,
          routes: emptyFc(),
          situations: emptyFc(),
          trafficFlow: emptyFc(),
          roadConditions: emptyFc(),
          weatherMeasurepoints: emptyFc(),
          trafficSafetyCameras: emptyFc(),
        };
      }

      return {
        configured: true,
        routes: routes.body,
        situations: situations.body,
        trafficFlow: flow.body,
        roadConditions: roads.body,
        weatherMeasurepoints: weather.body,
        trafficSafetyCameras: atk.body,
      };
    },
  };
}
