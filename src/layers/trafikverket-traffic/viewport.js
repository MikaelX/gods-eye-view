/**
 * Viewport bbox helpers for Trafikverket traffic fetches (TomTom-style).
 * Cesium-free pure math so node:test can cover clamps without a viewer.
 */

/** Pad around the visible box so edges don't flicker (~2 km). */
export const TRAFIKVERKET_BBOX_PAD_DEG = 0.02;

/**
 * Max span per axis for a traffic fetch (~0.1° ≈ 11 km).
 * Mirrors TomTom's clamped fetch window (~0.05°–few tiles at z12), slightly
 * larger so corridor segments still appear.
 */
export const TRAFIKVERKET_BBOX_MAX_SPAN_DEG = 0.1;

/**
 * @param {{west:number,south:number,east:number,north:number}} bbox
 * @param {number} [padDeg]
 */
export function padBbox(bbox, padDeg = TRAFIKVERKET_BBOX_PAD_DEG) {
  if (!bbox) return null;
  const pad = Number.isFinite(padDeg) ? Math.max(0, padDeg) : 0;
  return {
    west: bbox.west - pad,
    south: bbox.south - pad,
    east: bbox.east + pad,
    north: bbox.north + pad,
  };
}

/**
 * Recenter + clamp spans so country-scale views never pull the whole catalog.
 * @param {{west:number,south:number,east:number,north:number}} bbox
 * @param {{lat:number,lon:number}} center
 * @param {number} [maxSpanDeg]
 */
export function clampBboxAroundCenter(
  bbox,
  center,
  maxSpanDeg = TRAFIKVERKET_BBOX_MAX_SPAN_DEG,
) {
  if (!bbox || !center) return null;
  if (!Number.isFinite(center.lat) || !Number.isFinite(center.lon)) return null;
  const maxSpan = Number.isFinite(maxSpanDeg) ? Math.max(0.01, maxSpanDeg) : 0.1;
  const latSpan = Math.min(Math.max(0, bbox.north - bbox.south), maxSpan);
  const lonSpan = Math.min(Math.max(0, bbox.east - bbox.west), maxSpan);
  return {
    west: center.lon - lonSpan / 2,
    south: center.lat - latSpan / 2,
    east: center.lon + lonSpan / 2,
    north: center.lat + latSpan / 2,
  };
}

/**
 * Serialize bbox for ?bbox=west,south,east,north
 * @param {{west:number,south:number,east:number,north:number}|null} bbox
 */
export function bboxQueryValue(bbox) {
  if (!bbox) return '';
  const { west, south, east, north } = bbox;
  if (
    ![west, south, east, north].every((n) => Number.isFinite(n)) ||
    west >= east ||
    south >= north
  ) {
    return '';
  }
  return `${west},${south},${east},${north}`;
}

/**
 * Build a TomTom-like fetch bbox from a Cesium viewer.
 * Uses computeViewRectangle when available, recenters on look-at/nadir, clamps
 * span, then pads. Returns null when the globe isn't framed (space view).
 *
 * @param {object|null|undefined} viewer Cesium Viewer
 * @param {{padDeg?:number, maxSpanDeg?:number, Cesium?:object}} [opts]
 * @returns {{west:number,south:number,east:number,north:number}|null}
 */
export function viewerViewportBbox(viewer, opts = {}) {
  const CesiumApi = opts.Cesium || globalThis.Cesium;
  if (!viewer?.camera || !CesiumApi?.Math) return null;

  const rect = viewer.camera.computeViewRectangle?.(
    CesiumApi.Ellipsoid?.WGS84,
  );
  if (!rect) return null;

  const toDeg = CesiumApi.Math.toDegrees.bind(CesiumApi.Math);
  let bbox = {
    west: toDeg(rect.west),
    south: toDeg(rect.south),
    east: toDeg(rect.east),
    north: toDeg(rect.north),
  };
  if (bbox.west >= bbox.east || bbox.south >= bbox.north) return null;

  const carto = viewer.camera.positionCartographic;
  let center = {
    lat: (bbox.south + bbox.north) / 2,
    lon: (bbox.west + bbox.east) / 2,
  };
  if (carto) {
    center = {
      lat: toDeg(carto.latitude),
      lon: toDeg(carto.longitude),
    };
    const canvas = viewer.scene?.canvas;
    const w = canvas?.clientWidth || canvas?.width || 0;
    const h = canvas?.clientHeight || canvas?.height || 0;
    if (w > 0 && h > 0 && viewer.camera.pickEllipsoid) {
      const hit = viewer.camera.pickEllipsoid(
        new CesiumApi.Cartesian2(w / 2, h / 2),
        CesiumApi.Ellipsoid.WGS84,
      );
      if (hit) {
        const hitCarto = CesiumApi.Cartographic.fromCartesian(hit);
        center = {
          lat: toDeg(hitCarto.latitude),
          lon: toDeg(hitCarto.longitude),
        };
      }
    }
  }

  const clamped = clampBboxAroundCenter(bbox, center, opts.maxSpanDeg);
  return padBbox(clamped, opts.padDeg);
}
