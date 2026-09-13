const ROUTES_URL = '/api/trafikverket/travel-time-routes';
const SITUATIONS_URL = '/api/trafikverket/situations';
const STATUS_URL = '/api/trafikverket/status';

/**
 * Fetch same-origin Trafikverket traffic GeoJSON (key stays on the server).
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

    async getSnapshot({ signal } = {}) {
      signal?.throwIfAborted?.();
      const [routesResp, situationsResp] = await Promise.all([
        fetchImpl(ROUTES_URL, { signal }),
        fetchImpl(SITUATIONS_URL, { signal }),
      ]);
      signal?.throwIfAborted?.();

      if (routesResp.status === 503 && situationsResp.status === 503) {
        return {
          configured: false,
          routes: { type: 'FeatureCollection', features: [] },
          situations: { type: 'FeatureCollection', features: [] },
        };
      }

      const routes = routesResp.ok
        ? await routesResp.json()
        : { type: 'FeatureCollection', features: [], error: routesResp.status };
      const situations = situationsResp.ok
        ? await situationsResp.json()
        : {
            type: 'FeatureCollection',
            features: [],
            error: situationsResp.status,
          };
      signal?.throwIfAborted?.();
      return {
        configured: true,
        routes,
        situations,
      };
    },
  };
}
