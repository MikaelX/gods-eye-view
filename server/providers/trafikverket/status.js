import { parseTrafikverketCountyNos, countyNosLabel } from './county.js';
import { isTrafikverketTrafficEnabled } from './travelTimeRoutes.js';
import { isTrafikverketSituationEnabled } from './situations.js';
import { TRAFIKVERKET_ATTRIBUTION } from './constants.js';

/**
 * Presence-only status — never includes key material.
 * TrafficFlow is stubbed this PR (sensor heatmap follow-up).
 */
export function trafikverketTrafficStatus(env = process.env) {
  const hasKey = String(env.TRAFIKVERKET_API_KEY || '').trim().length > 0;
  const trafficEnabled =
    String(env.TRAFIKVERKET_TRAFFIC_ENABLED || '1').trim() !== '0';
  const situationEnabled =
    String(env.TRAFIKVERKET_SITUATION_ENABLED || '1').trim() !== '0';
  const trafficFlowEnabled =
    String(env.TRAFIKVERKET_TRAFFIC_FLOW_ENABLED || '0').trim() === '1';
  const countyNos = parseTrafikverketCountyNos(env);
  return {
    configured: hasKey && trafficEnabled,
    hasKey,
    trafficEnabled,
    situationEnabled,
    trafficFlowEnabled,
    trafficFlowAvailable: false,
    trafficFlowNote:
      'TrafficFlow (sensor density) is reserved for a follow-up; TravelTimeRoute + Situation ship in this pack.',
    countyNos: countyNos == null ? 'all' : countyNos,
    countyLabel: countyNosLabel(countyNos),
    travelTimeRoutes: isTrafikverketTrafficEnabled(env),
    situations: isTrafikverketSituationEnabled(env) && situationEnabled,
    attribution: TRAFIKVERKET_ATTRIBUTION,
  };
}
