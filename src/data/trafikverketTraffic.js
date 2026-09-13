import {
  createTrafikverketTrafficLayer as createLayer,
  createTrafikverketTrafficSource,
} from '../layers/trafikverket-traffic/index.js';

export * from '../layers/trafikverket-traffic/index.js';

/** Wire the standalone Trafikverket Swedish street-traffic layer. */
export function createTrafikverketTrafficLayer({
  source = createTrafikverketTrafficSource(),
} = {}) {
  return createLayer({ source });
}

export default createTrafikverketTrafficLayer();
