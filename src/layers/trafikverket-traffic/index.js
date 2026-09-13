import * as Cesium from 'cesium';
import {
  TRAFIKVERKET_TRAFFIC_LAYER_ID,
  TRAFIKVERKET_BUCKET_RGBA,
  degreesArrayFromGeometry,
  situationPointRadiusM,
} from './model.js';
export * from './model.js';
export { createTrafikverketTrafficSource } from './source.js';
export {
  viewerViewportBbox,
  padBbox,
  clampBboxAroundCenter,
  bboxQueryValue,
  TRAFIKVERKET_BBOX_PAD_DEG,
  TRAFIKVERKET_BBOX_MAX_SPAN_DEG,
} from './viewport.js';
import { viewerViewportBbox } from './viewport.js';

function rgbaToColor(rgba) {
  const [r, g, b, a] = rgba;
  return Cesium.Color.fromBytes(r, g, b, Math.round((a ?? 1) * 255));
}

/**
 * Swedish street traffic overlay: TravelTimeRoute + Situation + TrafficFlow
 * (viewport-scoped like TomTom). Independent of TomTom BYOK. Key never reaches
 * the browser.
 */
export function createTrafikverketTrafficLayer({ source } = {}) {
  if (typeof source?.getSnapshot !== 'function') {
    throw new TypeError('Trafikverket traffic requires a snapshot source');
  }

  let _viewer = null;
  let _request = null;
  let _dataSource = null;
  let _count = 0;
  let _lastUpdate = null;
  let _lastError = null;
  let _enabled = false;
  let _configured = false;

  const layer = {
    id: TRAFIKVERKET_TRAFFIC_LAYER_ID,
    name: 'Sweden traffic (Trafikverket)',
    icon: '🇸🇪',
    source: 'Trafikverket',
    updateInterval: 90_000,

    init(viewer) {
      if (_viewer) throw new Error('Trafikverket traffic already initialized');
      _viewer = viewer;
      _dataSource = new Cesium.CustomDataSource('trafikverket-traffic');
      _dataSource.show = false;
      viewer.dataSources.add(_dataSource);
      _count = 0;
      _lastUpdate = null;
      _lastError = null;
      _enabled = false;
      _configured = false;
      console.log('[Data:TrafikverketTraffic] Initialized');
    },

    enable() {
      _enabled = true;
      if (_dataSource) _dataSource.show = true;
    },

    disable() {
      _request?.abort();
      _request = null;
      _enabled = false;
      if (_dataSource) {
        _dataSource.show = false;
        _dataSource.entities.removeAll();
      }
      _count = 0;
    },

    async update() {
      if (!_enabled || !_dataSource || !_viewer) return false;
      _request?.abort();
      const request = new AbortController();
      _request = request;
      try {
        // TomTom-style: only request the clamped current viewport, never all Sweden.
        const bbox = viewerViewportBbox(_viewer, { Cesium });
        if (!bbox) {
          _dataSource.entities.removeAll();
          _count = 0;
          return false;
        }
        const snap = await source.getSnapshot({
          signal: request.signal,
          bbox,
        });
        if (request.signal.aborted || _request !== request || !_enabled) {
          return false;
        }
        _configured = snap?.configured !== false;
        const routeFeatures = Array.isArray(snap?.routes?.features)
          ? snap.routes.features
          : [];
        const situationFeatures = Array.isArray(snap?.situations?.features)
          ? snap.situations.features
          : [];
        const flowFeatures = Array.isArray(snap?.trafficFlow?.features)
          ? snap.trafficFlow.features
          : [];
        const roadFeatures = Array.isArray(snap?.roadConditions?.features)
          ? snap.roadConditions.features
          : [];
        const weatherFeatures = Array.isArray(
          snap?.weatherMeasurepoints?.features,
        )
          ? snap.weatherMeasurepoints.features
          : [];
        const atkFeatures = Array.isArray(
          snap?.trafficSafetyCameras?.features,
        )
          ? snap.trafficSafetyCameras.features
          : [];

        const next = [];
        for (const feature of routeFeatures) {
          const degrees = degreesArrayFromGeometry(feature?.geometry);
          if (!degrees) continue;
          const bucket = feature?.properties?.bucket || 'free';
          const rgba =
            TRAFIKVERKET_BUCKET_RGBA[bucket] || TRAFIKVERKET_BUCKET_RGBA.free;
          const id = String(
            feature.id || feature?.properties?.id || next.length,
          );
          next.push(
            new Cesium.Entity({
              id: `tv-route:${id}`,
              name: feature?.properties?.name || id,
              polyline: {
                positions: Cesium.Cartesian3.fromDegreesArray(degrees),
                width: bucket === 'jam' ? 5 : bucket === 'slow' ? 4 : 3,
                material: rgbaToColor(rgba),
                clampToGround: true,
              },
              properties: {
                kind: 'travel-time-route',
                trafficStatus: feature?.properties?.trafficStatus || '',
                bucket,
                name: feature?.properties?.name || '',
              },
            }),
          );
        }

        for (const feature of situationFeatures) {
          const geom = feature?.geometry;
          const id = String(
            feature.id || feature?.properties?.id || next.length,
          );
          if (geom?.type === 'Point') {
            const lon = Number(geom.coordinates?.[0]);
            const lat = Number(geom.coordinates?.[1]);
            if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
            const radius = situationPointRadiusM(
              feature?.properties?.severityCode,
            );
            next.push(
              new Cesium.Entity({
                id: `tv-sit:${id}`,
                name: feature?.properties?.header || id,
                position: Cesium.Cartesian3.fromDegrees(lon, lat),
                point: {
                  pixelSize: Math.max(8, Math.min(18, radius / 8)),
                  color: Cesium.Color.fromCssColorString('#f0b23e').withAlpha(
                    0.95,
                  ),
                  outlineColor: Cesium.Color.BLACK,
                  outlineWidth: 1,
                  heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
                  disableDepthTestDistance: Number.POSITIVE_INFINITY,
                },
                properties: {
                  kind: 'situation',
                  header: feature?.properties?.header || '',
                  message: feature?.properties?.message || '',
                  severityCode: feature?.properties?.severityCode ?? null,
                },
              }),
            );
          } else if (geom?.type === 'LineString') {
            const degrees = degreesArrayFromGeometry(geom);
            if (!degrees) continue;
            next.push(
              new Cesium.Entity({
                id: `tv-sit:${id}`,
                name: feature?.properties?.header || id,
                polyline: {
                  positions: Cesium.Cartesian3.fromDegreesArray(degrees),
                  width: 3,
                  material: Cesium.Color.fromCssColorString('#f0b23e').withAlpha(
                    0.85,
                  ),
                  clampToGround: true,
                },
                properties: {
                  kind: 'situation',
                  header: feature?.properties?.header || '',
                  message: feature?.properties?.message || '',
                  severityCode: feature?.properties?.severityCode ?? null,
                },
              }),
            );
          }
        }

        for (const feature of flowFeatures) {
          const lon = Number(feature?.geometry?.coordinates?.[0]);
          const lat = Number(feature?.geometry?.coordinates?.[1]);
          if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
          const id = String(
            feature.id || feature?.properties?.id || next.length,
          );
          const speed = Number(feature?.properties?.averageVehicleSpeed);
          const color =
            Number.isFinite(speed) && speed < 30
              ? Cesium.Color.fromCssColorString('#e05252')
              : Number.isFinite(speed) && speed < 70
                ? Cesium.Color.fromCssColorString('#f0b23e')
                : Cesium.Color.fromCssColorString('#2ecc71');
          next.push(
            new Cesium.Entity({
              id: `tv-flow:${id}`,
              name: `Flow ${id}`,
              position: Cesium.Cartesian3.fromDegrees(lon, lat),
              point: {
                pixelSize: 6,
                color: color.withAlpha(0.85),
                outlineColor: Cesium.Color.BLACK,
                outlineWidth: 1,
                heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
                disableDepthTestDistance: Number.POSITIVE_INFINITY,
              },
              properties: {
                kind: 'traffic-flow',
                averageVehicleSpeed: feature?.properties?.averageVehicleSpeed,
                vehicleFlowRate: feature?.properties?.vehicleFlowRate,
              },
            }),
          );
        }

        for (const feature of roadFeatures) {
          const geom = feature?.geometry;
          const id = String(
            feature.id || feature?.properties?.id || next.length,
          );
          if (geom?.type === 'Point') {
            const lon = Number(geom.coordinates?.[0]);
            const lat = Number(geom.coordinates?.[1]);
            if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
            next.push(
              new Cesium.Entity({
                id: `tv-road:${id}`,
                name: feature?.properties?.conditionText || id,
                position: Cesium.Cartesian3.fromDegrees(lon, lat),
                point: {
                  pixelSize: 8,
                  color: Cesium.Color.fromCssColorString('#c0392b').withAlpha(
                    0.9,
                  ),
                  outlineColor: Cesium.Color.WHITE,
                  outlineWidth: 1,
                  heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
                  disableDepthTestDistance: Number.POSITIVE_INFINITY,
                },
                properties: {
                  kind: 'road-condition',
                  conditionText: feature?.properties?.conditionText || '',
                },
              }),
            );
          } else if (geom?.type === 'LineString') {
            const degrees = degreesArrayFromGeometry(geom);
            if (!degrees) continue;
            next.push(
              new Cesium.Entity({
                id: `tv-road:${id}`,
                name: feature?.properties?.conditionText || id,
                polyline: {
                  positions: Cesium.Cartesian3.fromDegreesArray(degrees),
                  width: 3,
                  material: Cesium.Color.fromCssColorString('#c0392b').withAlpha(
                    0.8,
                  ),
                  clampToGround: true,
                },
                properties: {
                  kind: 'road-condition',
                  conditionText: feature?.properties?.conditionText || '',
                },
              }),
            );
          }
        }

        for (const feature of weatherFeatures) {
          const lon = Number(feature?.geometry?.coordinates?.[0]);
          const lat = Number(feature?.geometry?.coordinates?.[1]);
          if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
          const id = String(
            feature.id || feature?.properties?.id || next.length,
          );
          next.push(
            new Cesium.Entity({
              id: `tv-wx:${id}`,
              name: feature?.properties?.name || id,
              position: Cesium.Cartesian3.fromDegrees(lon, lat),
              point: {
                pixelSize: 7,
                color: Cesium.Color.fromCssColorString('#3498db').withAlpha(0.9),
                outlineColor: Cesium.Color.WHITE,
                outlineWidth: 1,
                heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
                disableDepthTestDistance: Number.POSITIVE_INFINITY,
              },
              properties: {
                kind: 'weather-measurepoint',
                name: feature?.properties?.name || '',
                airTemperatureC: feature?.properties?.airTemperatureC,
              },
            }),
          );
        }

        for (const feature of atkFeatures) {
          const lon = Number(feature?.geometry?.coordinates?.[0]);
          const lat = Number(feature?.geometry?.coordinates?.[1]);
          if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
          const id = String(
            feature.id || feature?.properties?.id || next.length,
          );
          next.push(
            new Cesium.Entity({
              id: `tv-atk:${id}`,
              name: feature?.properties?.label
                ? `${feature.properties.label}: ${feature.properties.name || id}`
                : feature?.properties?.name || `ATK ${id}`,
              position: Cesium.Cartesian3.fromDegrees(lon, lat),
              point: {
                pixelSize: 9,
                color: Cesium.Color.fromCssColorString('#9b59b6').withAlpha(0.95),
                outlineColor: Cesium.Color.BLACK,
                outlineWidth: 1,
                heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
                disableDepthTestDistance: Number.POSITIVE_INFINITY,
              },
              properties: {
                kind: 'traffic-safety-camera-atk',
                label: 'ATK (speed camera)',
                name: feature?.properties?.name || '',
                roadNumber: feature?.properties?.roadNumber || '',
              },
            }),
          );
        }

        _dataSource.entities.removeAll();
        for (const entity of next) _dataSource.entities.add(entity);
        _count = next.length;
        _lastUpdate = Date.now();
        _lastError = null;
        if (!_configured) {
          console.log(
            '[Data:TrafikverketTraffic] No TRAFIKVERKET_API_KEY — layer idle',
          );
        } else {
          console.log(
            `[Data:TrafikverketTraffic] Updated: ${routeFeatures.length} routes, ${situationFeatures.length} situations, ${flowFeatures.length} flow, ${roadFeatures.length} road, ${weatherFeatures.length} weather, ${atkFeatures.length} ATK`,
          );
        }
        return true;
      } catch (e) {
        if (request.signal.aborted || _request !== request || !_enabled) {
          return false;
        }
        console.warn('[Data:TrafikverketTraffic] Fetch error:', e);
        _lastError = e?.message || 'Trafikverket traffic unavailable';
        return false;
      } finally {
        if (_request === request) _request = null;
      }
    },

    getStats() {
      return {
        count: _count,
        lastUpdate: _lastUpdate,
        lastError: _lastError,
        configured: _configured,
        available: _configured,
      };
    },

    destroy(viewer = _viewer) {
      _request?.abort();
      _request = null;
      _enabled = false;
      if (_dataSource && viewer) {
        viewer.dataSources.remove(_dataSource, true);
      }
      _dataSource = null;
      _viewer = null;
      _count = 0;
      _lastUpdate = null;
      _lastError = null;
    },
  };

  return layer;
}
