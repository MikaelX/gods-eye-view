import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import {
  buildTrafikverketCameraRequestXml,
  extractTrafikverketCameras,
  isTrafikverketCctvEnabled,
  isTrafikverketPhotoUrl,
  loadTrafikverketSourcesFromOpenData,
  normalizeTrafikverketCamera,
  trafikverketCctvStatus,
  trafikverketDirectionToHeading,
} from '../../server/providers/cctv/trafikverket.js';

const here = dirname(fileURLToPath(import.meta.url));
const fixture = JSON.parse(
  readFileSync(
    join(
      here,
      '../../server/providers/cctv/fixtures/trafikverket-cameras-stockholm.json',
    ),
    'utf8',
  ),
);

test('trafikverket status is presence-only and respects the disable flag', () => {
  assert.deepEqual(trafikverketCctvStatus({}), {
    configured: false,
    enabled: true,
    hasKey: false,
  });
  assert.deepEqual(
    trafikverketCctvStatus({ TRAFIKVERKET_API_KEY: 'secret-key' }),
    { configured: true, enabled: true, hasKey: true },
  );
  assert.deepEqual(
    trafikverketCctvStatus({
      TRAFIKVERKET_API_KEY: 'secret-key',
      CCTV_TRAFIKVERKET_ENABLED: '0',
    }),
    { configured: false, enabled: false, hasKey: true },
  );
  const blob = JSON.stringify(
    trafikverketCctvStatus({ TRAFIKVERKET_API_KEY: 'secret-key' }),
  );
  assert.equal(blob.includes('secret-key'), false);
});

test('trafikverketDirectionToHeading maps 360→0 and accepts cardinals', () => {
  assert.equal(trafikverketDirectionToHeading(360), 0);
  assert.equal(trafikverketDirectionToHeading(90), 90);
  assert.equal(trafikverketDirectionToHeading('South'), 180);
  assert.ok(Number.isNaN(trafikverketDirectionToHeading('')));
});

test('isTrafikverketPhotoUrl pins https trafikverket.se hosts', () => {
  assert.equal(
    isTrafikverketPhotoUrl(
      'https://api.trafikinfo.trafikverket.se/v2/Images/x.jpg',
    ),
    true,
  );
  assert.equal(isTrafikverketPhotoUrl('https://evil.example/x.jpg'), false);
  assert.equal(
    isTrafikverketPhotoUrl('http://api.trafikinfo.trafikverket.se/x.jpg'),
    false,
  );
});

test('buildTrafikverketCameraRequestXml is nationwide by default (no CountyNo)', () => {
  const xml = buildTrafikverketCameraRequestXml('k<ey&');
  assert.match(xml, /authenticationkey="k&lt;ey&amp;"/);
  assert.match(xml, /objecttype="Camera"/);
  assert.match(xml, /EQ name="Active" value="true"/);
  assert.doesNotMatch(xml, /CountyNo/);
  assert.match(xml, /INCLUDE>PhotoUrl</);
  assert.match(xml, /INCLUDE>Geometry\.WGS84</);
  assert.equal(xml.includes('SWEREF'), false);

  const stockholmOnly = buildTrafikverketCameraRequestXml('k', [1]);
  assert.match(stockholmOnly, /EQ name="CountyNo" value="1"/);
});

test('fixture cameras normalize; bad geometry/host rows are dropped', () => {
  const rows = extractTrafikverketCameras(fixture);
  assert.equal(rows.length, 5);
  const cams = rows.map(normalizeTrafikverketCamera).filter(Boolean);
  assert.equal(cams.length, 3);
  assert.equal(cams[0].id, 'tv-SE_STA_CAMERA_Pacific_581');
  assert.equal(cams[0].feedType, 'image');
  assert.equal(cams[0].cityId, 'sweden');
  assert.equal(cams[0].headingDeg, 95);
  assert.equal(cams[0].rangeM, 600);
  assert.equal(cams[0].mountHeightM, 28);
  assert.equal(cams[0].pitchDeg, -12);
  assert.equal(cams[0].fovDeg, 72);
  assert.match(cams[0].license, /Trafikverket/);
  const stocksund = cams.find((c) => c.id.includes('Orion'));
  assert.equal(stocksund.headingDeg, 0);
  assert.equal(stocksund.headingConfidence, 'high');
  assert.equal(stocksund.rangeM, 600);
});

test('loadTrafikverketSourcesFromOpenData no-ops without a key and when disabled', async () => {
  const prevKey = process.env.TRAFIKVERKET_API_KEY;
  const prevEn = process.env.CCTV_TRAFIKVERKET_ENABLED;
  try {
    delete process.env.TRAFIKVERKET_API_KEY;
    delete process.env.CCTV_TRAFIKVERKET_ENABLED;
    assert.equal(isTrafikverketCctvEnabled(), false);
    assert.deepEqual(await loadTrafikverketSourcesFromOpenData(), []);

    process.env.TRAFIKVERKET_API_KEY = 'fixture-key';
    process.env.CCTV_TRAFIKVERKET_ENABLED = '0';
    assert.equal(isTrafikverketCctvEnabled(), false);
    assert.deepEqual(await loadTrafikverketSourcesFromOpenData(), []);
  } finally {
    if (prevKey === undefined) delete process.env.TRAFIKVERKET_API_KEY;
    else process.env.TRAFIKVERKET_API_KEY = prevKey;
    if (prevEn === undefined) delete process.env.CCTV_TRAFIKVERKET_ENABLED;
    else process.env.CCTV_TRAFIKVERKET_ENABLED = prevEn;
  }
});

test('loadTrafikverketSourcesFromOpenData posts text/xml nationwide and caps nearest sources', async () => {
  const prevKey = process.env.TRAFIKVERKET_API_KEY;
  const prevEn = process.env.CCTV_TRAFIKVERKET_ENABLED;
  const prevMax = process.env.CCTV_TRAFIKVERKET_MAX_SOURCES;
  const prevFetch = globalThis.fetch;
  try {
    process.env.TRAFIKVERKET_API_KEY = 'fixture-key';
    process.env.CCTV_TRAFIKVERKET_ENABLED = '1';
    process.env.CCTV_TRAFIKVERKET_MAX_SOURCES = '8';
    let saw = null;
    globalThis.fetch = async (url, init = {}) => {
      saw = { url: String(url), init };
      const many = [];
      for (let i = 0; i < 12; i += 1) {
        many.push({
          Id: `SE_STA_CAMERA_Bulk_${i}`,
          Name: `Bulk ${i}`,
          PhotoUrl: `https://api.trafikinfo.trafikverket.se/v2/Images/bulk-${i}.jpg`,
          Direction: (i * 30) % 360,
          Geometry: { WGS84: `POINT (${18.06 + i * 0.01} ${59.33 + i * 0.01})` },
        });
      }
      return {
        ok: true,
        async json() {
          return { RESPONSE: { RESULT: [{ Camera: many }] } };
        },
      };
    };
    const cams = await loadTrafikverketSourcesFromOpenData();
    assert.equal(cams.length, 8);
    assert.match(String(saw.url), /trafikinfo\.trafikverket\.se/);
    assert.equal(saw.init.method, 'POST');
    assert.equal(saw.init.headers['Content-Type'], 'text/xml');
    assert.match(String(saw.init.body), /authenticationkey="fixture-key"/);
    assert.doesNotMatch(String(saw.init.body), /CountyNo/);
    assert.equal(
      cams.every((c) => c.sourceKind === 'trafikverket-open-data'),
      true,
    );
    assert.equal(cams[0].id, 'tv-SE_STA_CAMERA_Bulk_0');
  } finally {
    globalThis.fetch = prevFetch;
    if (prevKey === undefined) delete process.env.TRAFIKVERKET_API_KEY;
    else process.env.TRAFIKVERKET_API_KEY = prevKey;
    if (prevEn === undefined) delete process.env.CCTV_TRAFIKVERKET_ENABLED;
    else process.env.CCTV_TRAFIKVERKET_ENABLED = prevEn;
    if (prevMax === undefined) delete process.env.CCTV_TRAFIKVERKET_MAX_SOURCES;
    else process.env.CCTV_TRAFIKVERKET_MAX_SOURCES = prevMax;
  }
});
