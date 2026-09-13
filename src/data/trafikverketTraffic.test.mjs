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
import {
  buildTrafficFlowRequestXml,
  normalizeTrafficFlow,
  trafficFlowToGeoJson,
} from '../../server/providers/trafikverket/trafficFlow.js';
import {
  buildRoadConditionRequestXml,
  normalizeRoadCondition,
} from '../../server/providers/trafikverket/roadCondition.js';
import {
  buildWeatherMeasurepointRequestXml,
  normalizeWeatherMeasurepoint,
} from '../../server/providers/trafikverket/weatherMeasurepoint.js';
import {
  buildTrafficSafetyCameraRequestXml,
  normalizeTrafficSafetyCamera,
} from '../../server/providers/trafikverket/trafficSafetyCamera.js';
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

test('county nos default nationwide; lists narrow; * stays nationwide', () => {
  assert.equal(parseTrafikverketCountyNos({}), null);
  assert.equal(
    parseTrafikverketCountyNos({ TRAFIKVERKET_COUNTY_NOS: '*' }),
    null,
  );
  assert.deepEqual(
    parseTrafikverketCountyNos({ TRAFIKVERKET_COUNTY_NOS: '1,12,14' }),
    [1, 12, 14],
  );
  assert.match(countyNosLabel([1]), /Stockholm/);
  assert.match(countyNosLabel(null), /nationwide/i);
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

test('TravelTimeRoute XML nationwide omits CountyNo; Situation requires namespace', () => {
  const routeXml = buildTravelTimeRouteRequestXml('secret&key', null);
  assert.match(routeXml, /authenticationkey="secret&amp;key"/);
  assert.match(routeXml, /objecttype="TravelTimeRoute"/);
  assert.match(routeXml, /schemaversion="1\.5"/);
  assert.match(routeXml, /Geometry\.WGS84/);
  // INCLUDE CountyNo is fine; nationwide means no CountyNo EQ filter.
  assert.doesNotMatch(routeXml, /EQ name="CountyNo"/);
  assert.doesNotMatch(routeXml, /secret&key/);

  const narrowed = buildTravelTimeRouteRequestXml('k', [1]);
  assert.match(narrowed, /EQ name="CountyNo" value="1"/);

  const sitXml = buildSituationRequestXml('k', null);
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

test('TrafficFlow / RoadCondition / Weather / ATK XML + normalize', () => {
  assert.match(
    buildTrafficFlowRequestXml('k', null),
    /objecttype="TrafficFlow"/,
  );
  assert.match(
    buildRoadConditionRequestXml('k', null),
    /objecttype="RoadCondition"/,
  );
  assert.match(
    buildWeatherMeasurepointRequestXml('k', null),
    /objecttype="WeatherMeasurepoint"/,
  );
  const atkXml = buildTrafficSafetyCameraRequestXml('k', null);
  assert.match(atkXml, /objecttype="TrafficSafetyCamera"/);
  assert.doesNotMatch(atkXml, /objecttype="Camera"/);

  const flow = normalizeTrafficFlow({
    SiteId: 'F1',
    AverageVehicleSpeed: 42,
    VehicleFlowRate: 800,
    Geometry: { WGS84: 'POINT (18.06 59.33)' },
  });
  assert.equal(flow.geometry.type, 'Point');
  assert.equal(flow.properties.averageVehicleSpeed, 42);
  assert.equal(flow.properties.vehicleFlowRate, 800);

  const road = normalizeRoadCondition({
    Id: 'R1',
    ConditionText: 'Slippery',
    Geometry: { WGS84: 'POINT (18.1 59.3)' },
  });
  assert.equal(road.properties.conditionText, 'Slippery');

  const wx = normalizeWeatherMeasurepoint({
    Id: 'W1',
    Name: 'Station A',
    Geometry: { WGS84: 'POINT (18.2 59.4)' },
    Observation: { Air: { Temperature: { Value: -2 } } },
  });
  assert.equal(wx.properties.airTemperatureC, -2);

  const atk = normalizeTrafficSafetyCamera({
    Id: 'A1',
    Name: 'E4 camera',
    RoadNumber: 'E4',
    Geometry: { WGS84: 'POINT (18.05 59.35)' },
  });
  assert.equal(atk.properties.kind, 'traffic-safety-camera-atk');
  assert.match(atk.properties.label, /ATK/i);

  const flowFc = trafficFlowToGeoJson(
    {
      RESPONSE: {
        RESULT: [
          {
            TrafficFlow: [
              {
                SiteId: 'F2',
                AverageVehicleSpeed: 55,
                VehicleFlowRate: 100,
                Geometry: { WGS84: 'POINT (18.07 59.34)' },
              },
            ],
          },
        ],
      },
    },
    10,
  );
  assert.equal(flowFc.features.length, 1);
});

test('status is presence-only and ships full Sweden pack flags', () => {
  const bare = trafikverketTrafficStatus({});
  assert.equal(bare.configured, false);
  assert.equal(bare.hasKey, false);
  assert.equal(bare.trafficFlowAvailable, true);
  assert.equal(bare.scope, 'sweden-nationwide');
  assert.equal('apiKey' in bare, false);
  assert.equal('key' in bare, false);
  assert.equal('trafficFlowNote' in bare, false);

  const on = trafikverketTrafficStatus({
    TRAFIKVERKET_API_KEY: 'secret',
  });
  assert.equal(on.configured, true);
  assert.equal(on.travelTimeRoutes, true);
  assert.equal(on.situations, true);
  assert.equal(on.trafficFlow, true);
  assert.equal(on.roadConditions, true);
  assert.equal(on.weatherMeasurepoints, true);
  assert.equal(on.trafficSafetyCameras, true);
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
