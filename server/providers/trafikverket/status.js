import { parseTrafikverketCountyNos, countyNosLabel } from './county.js';
import { isTrafikverketTrafficEnabled } from './travelTimeRoutes.js';
import { isTrafikverketSituationEnabled } from './situations.js';
import { isTrafikverketTrafficFlowEnabled } from './trafficFlow.js';
import { isTrafikverketRoadConditionEnabled } from './roadCondition.js';
import { isTrafikverketWeatherEnabled } from './weatherMeasurepoint.js';
import { isTrafikverketSafetyCameraEnabled } from './trafficSafetyCamera.js';
import { TRAFIKVERKET_ATTRIBUTION } from './constants.js';

/**
 * Presence-only status — never includes key material.
 * Default scope is nationwide Sweden; CountyNo filter is optional.
 */
export function trafikverketTrafficStatus(env = process.env) {
  const hasKey = String(env.TRAFIKVERKET_API_KEY || '').trim().length > 0;
  const trafficEnabled =
    String(env.TRAFIKVERKET_TRAFFIC_ENABLED || '1').trim() !== '0';
  const situationEnabled =
    String(env.TRAFIKVERKET_SITUATION_ENABLED || '1').trim() !== '0';
  const trafficFlowEnabled =
    String(env.TRAFIKVERKET_TRAFFIC_FLOW_ENABLED || '1').trim() !== '0';
  const roadConditionEnabled =
    String(env.TRAFIKVERKET_ROAD_CONDITION_ENABLED || '1').trim() !== '0';
  const weatherEnabled =
    String(env.TRAFIKVERKET_WEATHER_ENABLED || '1').trim() !== '0';
  const safetyCameraEnabled =
    String(env.TRAFIKVERKET_SAFETY_CAMERA_ENABLED || '1').trim() !== '0';
  const countyNos = parseTrafikverketCountyNos(env);
  return {
    configured: hasKey && trafficEnabled,
    hasKey,
    scope: 'sweden-nationwide',
    trafficEnabled,
    situationEnabled,
    trafficFlowEnabled,
    trafficFlowAvailable: true,
    roadConditionEnabled,
    weatherEnabled,
    safetyCameraEnabled,
    countyNos: countyNos == null ? 'all' : countyNos,
    countyLabel: countyNosLabel(countyNos),
    travelTimeRoutes: isTrafikverketTrafficEnabled(env),
    situations: isTrafikverketSituationEnabled(env) && situationEnabled,
    trafficFlow: isTrafikverketTrafficFlowEnabled(env) && trafficFlowEnabled,
    roadConditions:
      isTrafikverketRoadConditionEnabled(env) && roadConditionEnabled,
    weatherMeasurepoints: isTrafikverketWeatherEnabled(env) && weatherEnabled,
    trafficSafetyCameras:
      isTrafikverketSafetyCameraEnabled(env) && safetyCameraEnabled,
    attribution: TRAFIKVERKET_ATTRIBUTION,
  };
}
