/**
 * Step 3 — analyze_deviation
 *
 * LLM-assisted deviation analysis.
 * Called ONLY when monitor_route reports significantDeviation === true.
 *
 * Asks Gemini to consider whether the detected deviation could be explained by:
 *  - Traffic congestion
 *  - Road closures
 *  - One-way road restrictions
 *  - Alternative valid route
 *  - Construction or temporary road changes
 *  - Driver stopping for fuel/bathroom (short stop)
 *
 * Returns:
 *  {
 *    hasLegitimateExplanation: boolean,
 *    explanation: string,
 *    suspicionFactors: string[],
 *    confidence: number (0.0–1.0),
 *    skipped: boolean   — true if called without significantDeviation
 *  }
 */

import { callGemini } from '../llm/gemini.js';

const RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    hasLegitimateExplanation: { type: 'boolean' },
    explanation: { type: 'string' },
    suspicionFactors: {
      type: 'array',
      items: { type: 'string' },
    },
    confidence: { type: 'number' },
  },
  required: ['hasLegitimateExplanation', 'explanation', 'suspicionFactors', 'confidence'],
};

/**
 * @param {object} params
 * @param {object} params.tripInfo    — { tripId, source, destination }
 * @param {object} params.routeStatus — output of monitor_route
 * @returns {Promise<object>}
 */
export async function analyze_deviation({ tripInfo, routeStatus }) {
  // Short-circuit: no significant deviation detected → skip LLM call
  if (!routeStatus.significantDeviation) {
    return {
      skipped: true,
      hasLegitimateExplanation: true,
      explanation: 'No significant deviation detected — analysis not required.',
      suspicionFactors: [],
      confidence: 1.0,
    };
  }

  const prompt = `
You are a route integrity analyst for a ride-sharing safety system.

## Trip Context
- Trip ID: ${tripInfo.tripId}
- Source: ${tripInfo.source}
- Destination: ${tripInfo.destination}

## Detected Route Deviation
- Maximum distance from approved route: ${routeStatus.maxDeviationMeters} meters
- Average deviation: ${routeStatus.avgDeviationMeters} meters
- Time spent off-route: ${routeStatus.deviationDurationSeconds} seconds
- Driver moving toward destination: ${routeStatus.movingTowardDestination ?? 'unknown'}
- Number of off-route segments: ${routeStatus.offRouteSegments.length}
- Off-route segments: ${JSON.stringify(routeStatus.offRouteSegments, null, 2)}

## Your Task
Analyze whether this deviation could have a legitimate, innocent explanation such as:
1. Traffic congestion forcing a detour
2. Road closure or construction
3. One-way road restrictions
4. Taking an alternate valid route to the same destination
5. Brief stop for fuel, restroom, or emergency
6. Navigation app rerouting

Consider the magnitude and duration of the deviation:
- A deviation of <500m for <120 seconds is very likely legitimate
- A deviation of >800m for >180 seconds moving AWAY from destination is suspicious
- A deviation of >1500m moving away with no return is highly suspicious

Evaluate ALL the evidence and return your analysis as structured JSON.
Be objective. The safety of a passenger may depend on this.
`.trim();

  const result = await callGemini(prompt, RESPONSE_SCHEMA);
  return { skipped: false, ...result };
}
