import {
  TRAFIKVERKET_DATA_URL,
  TRAFIKVERKET_FETCH_TIMEOUT_MS,
} from './constants.js';

/**
 * POST Trafikinfo REQUEST XML. Key stays server-side.
 * Content-Type must be text/xml or text/plain (application/xml can flake auth).
 */
export async function postTrafikinfo(
  requestXml,
  { fetchImpl = fetch, timeoutMs = TRAFIKVERKET_FETCH_TIMEOUT_MS, signal } = {},
) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const onAbort = () => controller.abort();
  signal?.addEventListener('abort', onAbort, { once: true });
  try {
    const resp = await fetchImpl(TRAFIKVERKET_DATA_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/xml',
        Accept: 'application/json',
      },
      body: requestXml,
      signal: controller.signal,
    });
    if (!resp.ok) {
      const err = new Error(`Trafikinfo HTTP ${resp.status}`);
      err.status = resp.status;
      throw err;
    }
    return await resp.json();
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', onAbort);
  }
}

/** Pull typed rows from a Trafikinfo RESPONSE payload. */
export function extractTrafikinfoRows(payload, objectType) {
  const results = payload?.RESPONSE?.RESULT;
  if (!Array.isArray(results)) return [];
  const rows = [];
  for (const result of results) {
    const block = result?.[objectType];
    if (Array.isArray(block)) rows.push(...block);
    else if (block && typeof block === 'object') rows.push(block);
  }
  return rows;
}
