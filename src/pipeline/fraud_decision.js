/**
 * Step 4 — fraud_decision
 *
 * Core LLM fraud classification step.
 *
 * Takes all pipeline context (trip info + route status + deviation analysis)
 * and asks Gemini to make a final classification:
 *
 *   LEGITIMATE  — Normal trip, no concerning behavior
 *   SUSPICIOUS  — Unusual but not conclusively fraudulent
 *   FRAUD       — Strong evidence of route manipulation or dangerous behavior
 *
 * Returns:
 *  {
 *    status: "LEGITIMATE" | "SUSPICIOUS" | "FRAUD",
 *    confidence: number (0.0–1.0),
 *    evidence: string[],
 *    recommendedAction: "NONE" | "MONITOR" | "INVESTIGATE" | "ESCALATE",
 *    reasoning: string,
 *  }
 */

import { callGemini } from '../llm/gemini.js';

const RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    status: {
      type: 'string',
      enum: ['LEGITIMATE', 'SUSPICIOUS', 'FRAUD'],
    },
    confidence: { type: 'number' },
    evidence: {
      type: 'array',
      items: { type: 'string' },
    },
    recommendedAction: {
      type: 'string',
      enum: ['NONE', 'MONITOR', 'INVESTIGATE', 'ESCALATE'],
    },
    reasoning: { type: 'string' },
  },
  required: ['status', 'confidence', 'evidence', 'recommendedAction', 'reasoning'],
};

/**
 * @param {object} params
 * @param {object} params.tripInfo        — { tripId, source, destination, metadata }
 * @param {object} params.routeStatus     — output of monitor_route
 * @param {object} params.deviationAnalysis — output of analyze_deviation
 * @returns {Promise<object>}
 */
export async function fraud_decision({ tripInfo, routeStatus, deviationAnalysis }) {
  const prompt = `
You are a senior fraud detection AI for a ride-sharing safety platform called RouteIntegrity AI.

Your job is to make a final, authoritative fraud classification for a trip. This decision may be used to escalate to emergency services, so you must be accurate, measured, and evidence-based.

## Trip Information
- Trip ID: ${tripInfo.tripId}
- Source: ${tripInfo.source}
- Destination: ${tripInfo.destination}
- Vehicle ID: ${tripInfo.metadata?.vehicleId ?? 'N/A'}
- Driver ID: ${tripInfo.metadata?.driverId ?? 'N/A'}

## Route Monitoring Results
- Currently on approved route: ${routeStatus.onRoute}
- Maximum deviation from route: ${routeStatus.maxDeviationMeters} meters
- Average deviation: ${routeStatus.avgDeviationMeters} meters
- Time spent off-route: ${routeStatus.deviationDurationSeconds} seconds
- Moving toward destination: ${routeStatus.movingTowardDestination ?? 'unknown'}
- Significant deviation detected: ${routeStatus.significantDeviation}
- Off-route segments: ${routeStatus.offRouteSegments.length}

## Deviation Analysis (AI-assessed)
- Analysis skipped (no significant deviation): ${deviationAnalysis.skipped}
- Has legitimate explanation: ${deviationAnalysis.hasLegitimateExplanation}
- Explanation: ${deviationAnalysis.explanation}
- Suspicion factors: ${JSON.stringify(deviationAnalysis.suspicionFactors)}
- Deviation analysis confidence: ${deviationAnalysis.confidence}

## Classification Guidelines

### LEGITIMATE
- Driver is on or near the approved route
- Any deviation has a plausible, innocent explanation
- Driver is generally moving toward the destination
- No patterns of route manipulation

### SUSPICIOUS
- Significant deviation without a clear explanation
- Driver moving away from destination for extended time
- Multiple unexplained off-route segments
- Deviation magnitude and duration is concerning but not conclusive
→ Recommended action: MONITOR or INVESTIGATE

### FRAUD
- Clear, intentional route deviation with no legitimate explanation
- Driver consistently moving away from destination
- Extreme deviation (>1km) over extended time (>3 min) with no return
- Multiple suspicious indicators converging
→ Recommended action: ESCALATE

## Important Notes
- Do NOT classify as FRAUD based on a single minor GPS blip
- Consider that GPS accuracy can introduce 10–50m of natural error
- A deviation classified as FRAUD should have confidence ≥ 0.80
- Evidence must list specific, concrete observations from the data above
- Be proportionate: a 200m, 45-second deviation should not be FRAUD

Provide your classification as structured JSON.
`.trim();

  return await callGemini(prompt, RESPONSE_SCHEMA);
}
