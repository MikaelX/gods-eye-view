import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  parseTrafikverketCountyNos,
  buildCountyNoFilterXml,
  countyNosLabel,
} from '../../server/providers/trafikverket/county.js';
import {
  trafficStatusToBucket,
  buildTravelTimeRouteRequestXml,
  normalizeTravelTimeRoute,
  travelTimeRoutesToGeoJson,
  isTrafikverketTrafficEnabled,
} from '../../server/providers/trafikverket/travelTimeRoutes.js';
import {
  buildSituationRequestXml,
  normalizeSituationDeviation,
  situationsToGeoJson,
} from '../../server/providers/trafikverket/situations.js';
import { trafikverketTrafficStatus } from '../../server/providers/trafikverket/status.js';
import {
  parseWktLineString,
  parseWktPoint,
} from '../../server/providers/trafikverket/wkt.js';
import { degreesArrayFromGeometry } from '../layers/trafikverket-traffic/model.js';

const here = dirname(fileURLToPath(import.meta.url));
const routesFixture = JSON.parse(
  readFileSync(
    join(
      here,
      '../../server/providers/trafikverket/fixtures/travel-time-routes-stockholm.json',
    ),
    'utf8',
  ),
);
const situationsFixture = JSON.parse(
  readFileSync(
    join(
      here,
      '../../server/providers/trafikverket/fixtures/situations-stockholm.json',
    ),
    'utf8',
  ),
);

test('county nos default to Stockholm; * is nationwide; lists parse', () => {
  assert.deepEqual(parseTrafikverketCountyNos({}), [1]);
  assert.equal(
    parseTrafikverketCountyNos({ TRAFIKVERKET_COUNTY_NOS: '*' }),
    null,
  );
  assert.deepEqual(
    parseTrafikverketCountyNos({ TRAFIKVERKET_COUNTY_NOS: '1,12,14' }),
    [1, 12, 14],
  );
  assert.match(countyNosLabel([1]), /Stockholm/);
  assert.equal(countyNosLabel(null), 'nationwide');
  assert.match(buildCountyNoFilterXml([1]), /CountyNo" value="1"/);
  assert.match(buildCountyNoFilterXml([1, 12]), /<OR>/);
  assert.equal(buildCountyNoFilterXml(null), '');
});

test('trafficStatusToBucket maps freeflow/heavy/congested', () => {
  assert.equal(trafficStatusToBucket('freeflow'), 'free');
  assert.equal(trafficStatusToBucket('freeFlow'), 'free');
  assert.equal(trafficStatusToBucket('heavy'), 'slow');
  assert.equal(trafficStatusToBucket('congested'), 'jam');
  assert.equal(trafficStatusToBucket(''), 'free');
});

test('TravelTimeRoute XML uses CountyNo + Geometry.WGS84; Situation requires namespace', () => {
  const routeXml = buildTravelTimeRouteRequestXml('secret&key', [1]);
  assert.match(routeXml, /authenticationkey="secret&amp;key"/);
  assert.match(routeXml, /objecttype="TravelTimeRoute"/);
  assert.match(routeXml, /schemaversion="1\.5"/);
  assert.match(routeXml, /Geometry\.WGS84/);
  assert.match(routeXml, /CountyNo" value="1"/);
  assert.doesNotMatch(routeXml, /secret&key/);

  const sitXml = buildSituationRequestXml('k', [1]);
  assert.match(sitXml, /objecttype="Situation"/);
  assert.match(sitXml, /schemaversion="1\.6"/);
  assert.match(sitXml, /namespace="road\.trafficinfo"/);
});

test('WKT parsers + degreesArrayFromGeometry', () => {
  assert.deepEqual(parseWktPoint('POINT (18.06 59.33)'), {
    lon: 18.06,
    lat: 59.33,
  });
  assert.equal(parseWktLineString('LINESTRING (18 59, 18.1 59.1)').length, 2);
  assert.deepEqual(
    degreesArrayFromGeometry({
      type: 'LineString',
      coordinates: [
        [18, 59],
        [18.1, 59.1],
      ],
    }),
    [18, 59, 18.1, 59.1],
  );
});

test('fixture TravelTimeRoutes normalize; bad geometry dropped; buckets set', () => {
  const geo = travelTimeRoutesToGeoJson(routesFixture, 250);
  assert.equal(geo.features.length, 3);
  const byId = Object.fromEntries(
    geo.features.map((f) => [f.properties.id, f]),
  );
  assert.equal(byId['route-freeflow-1'].properties.bucket, 'free');
  assert.equal(byId['route-heavy-1'].properties.bucket, 'slow');
  assert.equal(byId['route-congested-1'].properties.bucket, 'jam');
  assert.equal(byId['route-freeflow-1'].geometry.type, 'LineString');
  assert.match(
    byId['route-freeflow-1'].properties.attribution,
    /Trafikverket/,
  );
  assert.equal(normalizeTravelTimeRoute(null), null);
});

test('fixture Situations flatten deviations; missing geom skipped', () => {
  const geo = situationsToGeoJson(situationsFixture, 400);
  assert.equal(geo.features.length, 2);
  assert.equal(geo.features[0].geometry.type, 'Point');
  assert.equal(geo.features[1].geometry.type, 'LineString');
  assert.match(geo.features[0].properties.header, /Bergshamra/);
  assert.equal(
    normalizeSituationDeviation({ Id: 'x', Geometry: { WGS84: '' } }),
    null,
  );
});

test('status is presence-only and notes TrafficFlow follow-up', () => {
  const bare = trafikverketTrafficStatus({});
  assert.equal(bare.configured, false);
  assert.equal(bare.hasKey, false);
  assert.equal(bare.trafficFlowAvailable, false);
  assert.match(bare.trafficFlowNote, /follow-up/i);
  assert.equal('apiKey' in bare, false);
  assert.equal('key' in bare, false);

  const on = trafikverketTrafficStatus({
    TRAFIKVERKET_API_KEY: 'secret',
  });
  assert.equal(on.configured, true);
  assert.equal(on.travelTimeRoutes, true);
  assert.equal(on.situations, true);
  assert.equal(isTrafikverketTrafficEnabled({}), false);
  assert.equal(
    isTrafikverketTrafficEnabled({ TRAFIKVERKET_API_KEY: 'x' }),
    true,
  );
});

test('CCTV camera XML accepts multi-county and nationwide', async () => {
  const { buildTrafikverketCameraRequestXml } = await import(
    '../../server/providers/cctv/trafikverket.js'
  );
  const multi = buildTrafikverketCameraRequestXml('k', [1, 12]);
  assert.match(multi, /<OR>/);
  assert.match(multi, /CountyNo" value="12"/);
  const nation = buildTrafikverketCameraRequestXml('k', null);
  assert.doesNotMatch(nation, /CountyNo/);
  assert.match(nation, /Active" value="true"/);
});
