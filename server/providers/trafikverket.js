import { parseTrafikverketCountyNos } from './trafikverket/county.js';
import { postTrafikinfo } from './trafikverket/client.js';
import { trafikverketTrafficStatus } from './trafikverket/status.js';
import {
  buildTravelTimeRouteRequestXml,
  travelTimeRoutesToGeoJson,
  resolveMaxTravelTimeRoutes,
  isTrafikverketTrafficEnabled,
} from './trafikverket/travelTimeRoutes.js';
import {
  buildSituationRequestXml,
  situationsToGeoJson,
  resolveMaxSituations,
  isTrafikverketSituationEnabled,
} from './trafikverket/situations.js';
import { TRAFIKVERKET_CACHE_TTL_MS } from './trafikverket/constants.js';

/**
 * Vite middleware: Trafikverket Swedish street traffic.
 *
 *   GET /api/trafikverket/status
 *   GET /api/trafikverket/travel-time-routes
 *   GET /api/trafikverket/situations
 *   GET /api/trafikverket/traffic-flow → 501 stub
 *
 * @returns {import('vite').Plugin}
 */
export function trafikverketProxy() {
  /** @type {Map<string, {at:number, body:object}>} */
  const cache = new Map();
  /** @type {Map<string, Promise<object>>} */
  const inflight = new Map();

  function sendJson(res, status, body) {
    if (res.headersSent) return;
    res.writeHead(status, {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    });
    res.end(JSON.stringify(body));
  }

  async function cachedFetch(cacheKey, buildXml, toGeoJson) {
    const now = Date.now();
    const hit = cache.get(cacheKey);
    if (hit && now - hit.at < TRAFIKVERKET_CACHE_TTL_MS) return hit.body;
    if (inflight.has(cacheKey)) return inflight.get(cacheKey);

    const apiKey = String(process.env.TRAFIKVERKET_API_KEY || '').trim();
    const countyNos = parseTrafikverketCountyNos(process.env);
    const promise = (async () => {
      const xml = buildXml(apiKey, countyNos);
      const payload = await postTrafikinfo(xml);
      const body = toGeoJson(payload);
      cache.set(cacheKey, { at: Date.now(), body });
      return body;
    })().finally(() => inflight.delete(cacheKey));

    inflight.set(cacheKey, promise);
    return promise;
  }

  const install = (server) => {
    server.middlewares.use('/api/trafikverket', async (req, res) => {
      try {
        const url = new URL(req.url || '/', 'http://localhost');
        const path = url.pathname;

        if (path === '/status' || path === '/') {
          sendJson(res, 200, trafikverketTrafficStatus(process.env));
          return;
        }

        if (path === '/travel-time-routes') {
          if (!isTrafikverketTrafficEnabled()) {
            sendJson(res, 503, {
              error: 'not_configured',
              message:
                'Set TRAFIKVERKET_API_KEY (and TRAFIKVERKET_TRAFFIC_ENABLED≠0) for Swedish street traffic.',
            });
            return;
          }
          const max = resolveMaxTravelTimeRoutes();
          const countyKey = JSON.stringify(
            parseTrafikverketCountyNos(process.env),
          );
          const body = await cachedFetch(
            `routes:${countyKey}:${max}`,
            buildTravelTimeRouteRequestXml,
            (payload) => travelTimeRoutesToGeoJson(payload, max),
          );
          sendJson(res, 200, body);
          return;
        }

        if (path === '/situations') {
          if (!isTrafikverketSituationEnabled()) {
            sendJson(res, 503, {
              error: 'not_configured',
              message:
                'Set TRAFIKVERKET_API_KEY (and TRAFIKVERKET_SITUATION_ENABLED≠0) for Situation overlay.',
            });
            return;
          }
          const max = resolveMaxSituations();
          const countyKey = JSON.stringify(
            parseTrafikverketCountyNos(process.env),
          );
          const body = await cachedFetch(
            `situations:${countyKey}:${max}`,
            buildSituationRequestXml,
            (payload) => situationsToGeoJson(payload, max),
          );
          sendJson(res, 200, body);
          return;
        }

        if (path === '/traffic-flow') {
          sendJson(res, 501, {
            error: 'not_implemented',
            message:
              'TrafficFlow point sensors are reserved for a follow-up. Use TravelTimeRoute + Situation.',
            ...trafikverketTrafficStatus(process.env),
          });
          return;
        }

        sendJson(res, 404, { error: 'not_found' });
      } catch (err) {
        console.warn('[trafikverket-proxy]', err?.message || err);
        sendJson(res, 502, {
          error: 'upstream',
          message: 'Trafikinfo request failed',
        });
      }
    });
  };

  return {
    name: 'trafikverket-proxy',
    configureServer: install,
    configurePreviewServer: install,
  };
}

export { trafikverketTrafficStatus } from './trafikverket/status.js';
export {
  buildTravelTimeRouteRequestXml,
  normalizeTravelTimeRoute,
  trafficStatusToBucket,
  travelTimeRoutesToGeoJson,
} from './trafikverket/travelTimeRoutes.js';
export {
  buildSituationRequestXml,
  normalizeSituationDeviation,
  situationsToGeoJson,
} from './trafikverket/situations.js';
export {
  parseTrafikverketCountyNos,
  buildCountyNoFilterXml,
  countyNosLabel,
} from './trafikverket/county.js';
export { escapeXml, parseWktPoint, parseWktLineString } from './trafikverket/wkt.js';
