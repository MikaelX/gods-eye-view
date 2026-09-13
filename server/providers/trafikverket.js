import { parseTrafikverketCountyNos } from './trafikverket/county.js';
import { postTrafikinfo } from './trafikverket/client.js';
import { trafikverketTrafficStatus } from './trafikverket/status.js';
import { parseBboxParam, filterFeaturesByBbox } from './trafikverket/geo.js';
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
import {
  buildTrafficFlowRequestXml,
  trafficFlowToGeoJson,
  resolveMaxTrafficFlow,
  isTrafikverketTrafficFlowEnabled,
} from './trafikverket/trafficFlow.js';
import {
  buildRoadConditionRequestXml,
  roadConditionsToGeoJson,
  resolveMaxRoadConditions,
  isTrafikverketRoadConditionEnabled,
} from './trafikverket/roadCondition.js';
import {
  buildWeatherMeasurepointRequestXml,
  weatherMeasurepointsToGeoJson,
  resolveMaxWeatherMeasurepoints,
  isTrafikverketWeatherEnabled,
} from './trafikverket/weatherMeasurepoint.js';
import {
  buildTrafficSafetyCameraRequestXml,
  trafficSafetyCamerasToGeoJson,
  resolveMaxTrafficSafetyCameras,
  isTrafikverketSafetyCameraEnabled,
} from './trafikverket/trafficSafetyCamera.js';
import { TRAFIKVERKET_CACHE_TTL_MS } from './trafikverket/constants.js';

/**
 * Apply optional bbox query filter to a FeatureCollection body.
 * @param {object} body
 * @param {URL} url
 */
function maybeBbox(body, url) {
  const bbox = parseBboxParam(url.searchParams.get('bbox'));
  if (!bbox || !body?.features) return body;
  const features = filterFeaturesByBbox(body.features, bbox);
  return {
    ...body,
    features,
    bboxFiltered: true,
    bboxTotalBefore: body.features.length,
  };
}

/**
 * Vite middleware: Trafikverket nationwide Sweden pack.
 *
 *   GET /api/trafikverket/status
 *   GET /api/trafikverket/travel-time-routes[?bbox=]
 *   GET /api/trafikverket/situations[?bbox=]
 *   GET /api/trafikverket/traffic-flow[?bbox=]
 *   GET /api/trafikverket/road-conditions[?bbox=]
 *   GET /api/trafikverket/weather-measurepoints[?bbox=]
 *   GET /api/trafikverket/traffic-safety-cameras[?bbox=]  (ATK POIs)
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

  function countyCacheKey() {
    return JSON.stringify(parseTrafikverketCountyNos(process.env));
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
                'Set TRAFIKVERKET_API_KEY (and TRAFIKVERKET_TRAFFIC_ENABLED≠0).',
            });
            return;
          }
          const max = resolveMaxTravelTimeRoutes();
          const body = await cachedFetch(
            `routes:${countyCacheKey()}:${max}`,
            buildTravelTimeRouteRequestXml,
            (payload) => travelTimeRoutesToGeoJson(payload, max),
          );
          sendJson(res, 200, maybeBbox(body, url));
          return;
        }

        if (path === '/situations') {
          if (!isTrafikverketSituationEnabled()) {
            sendJson(res, 503, {
              error: 'not_configured',
              message:
                'Set TRAFIKVERKET_API_KEY (and TRAFIKVERKET_SITUATION_ENABLED≠0).',
            });
            return;
          }
          const max = resolveMaxSituations();
          const body = await cachedFetch(
            `situations:${countyCacheKey()}:${max}`,
            buildSituationRequestXml,
            (payload) => situationsToGeoJson(payload, max),
          );
          sendJson(res, 200, maybeBbox(body, url));
          return;
        }

        if (path === '/traffic-flow') {
          if (!isTrafikverketTrafficFlowEnabled()) {
            sendJson(res, 503, {
              error: 'not_configured',
              message:
                'Set TRAFIKVERKET_API_KEY (and TRAFIKVERKET_TRAFFIC_FLOW_ENABLED≠0).',
            });
            return;
          }
          const max = resolveMaxTrafficFlow();
          const body = await cachedFetch(
            `flow:${countyCacheKey()}:${max}`,
            buildTrafficFlowRequestXml,
            (payload) => trafficFlowToGeoJson(payload, max),
          );
          sendJson(res, 200, maybeBbox(body, url));
          return;
        }

        if (path === '/road-conditions') {
          if (!isTrafikverketRoadConditionEnabled()) {
            sendJson(res, 503, {
              error: 'not_configured',
              message:
                'Set TRAFIKVERKET_API_KEY (and TRAFIKVERKET_ROAD_CONDITION_ENABLED≠0).',
            });
            return;
          }
          const max = resolveMaxRoadConditions();
          const body = await cachedFetch(
            `roadcond:${countyCacheKey()}:${max}`,
            buildRoadConditionRequestXml,
            (payload) => roadConditionsToGeoJson(payload, max),
          );
          sendJson(res, 200, maybeBbox(body, url));
          return;
        }

        if (path === '/weather-measurepoints') {
          if (!isTrafikverketWeatherEnabled()) {
            sendJson(res, 503, {
              error: 'not_configured',
              message:
                'Set TRAFIKVERKET_API_KEY (and TRAFIKVERKET_WEATHER_ENABLED≠0).',
            });
            return;
          }
          const max = resolveMaxWeatherMeasurepoints();
          const body = await cachedFetch(
            `weather:${countyCacheKey()}:${max}`,
            buildWeatherMeasurepointRequestXml,
            (payload) => weatherMeasurepointsToGeoJson(payload, max),
          );
          sendJson(res, 200, maybeBbox(body, url));
          return;
        }

        if (path === '/traffic-safety-cameras') {
          if (!isTrafikverketSafetyCameraEnabled()) {
            sendJson(res, 503, {
              error: 'not_configured',
              message:
                'Set TRAFIKVERKET_API_KEY (and TRAFIKVERKET_SAFETY_CAMERA_ENABLED≠0).',
            });
            return;
          }
          const max = resolveMaxTrafficSafetyCameras();
          const body = await cachedFetch(
            `atk:${countyCacheKey()}:${max}`,
            buildTrafficSafetyCameraRequestXml,
            (payload) => trafficSafetyCamerasToGeoJson(payload, max),
          );
          sendJson(res, 200, maybeBbox(body, url));
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
  buildTrafficFlowRequestXml,
  normalizeTrafficFlow,
  trafficFlowToGeoJson,
} from './trafikverket/trafficFlow.js';
export {
  buildRoadConditionRequestXml,
  normalizeRoadCondition,
  roadConditionsToGeoJson,
} from './trafikverket/roadCondition.js';
export {
  buildWeatherMeasurepointRequestXml,
  normalizeWeatherMeasurepoint,
  weatherMeasurepointsToGeoJson,
} from './trafikverket/weatherMeasurepoint.js';
export {
  buildTrafficSafetyCameraRequestXml,
  normalizeTrafficSafetyCamera,
  trafficSafetyCamerasToGeoJson,
} from './trafikverket/trafficSafetyCamera.js';
export {
  parseTrafikverketCountyNos,
  buildCountyNoFilterXml,
  countyNosLabel,
} from './trafikverket/county.js';
export { escapeXml, parseWktPoint, parseWktLineString } from './trafikverket/wkt.js';
export { prioritizeFeatures, parseBboxParam } from './trafikverket/geo.js';
