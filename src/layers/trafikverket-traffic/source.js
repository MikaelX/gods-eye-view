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
 * Same-origin Trafikverket nationwide pack (key stays on the server).
 * Optional ?bbox= can be appended by callers for viewport filtering.
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
      const q =
        bbox && Number.isFinite(bbox.west)
          ? `?bbox=${bbox.west},${bbox.south},${bbox.east},${bbox.north}`
          : '';
      const [routes, situations, flow, roads, weather, atk] = await Promise.all(
        [
          fetchFc(fetchImpl, ROUTES_URL + q, signal),
          fetchFc(fetchImpl, SITUATIONS_URL + q, signal),
          fetchFc(fetchImpl, FLOW_URL + q, signal),
          fetchFc(fetchImpl, ROAD_URL + q, signal),
          fetchFc(fetchImpl, WEATHER_URL + q, signal),
          fetchFc(fetchImpl, ATK_URL + q, signal),
        ],
      );
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
