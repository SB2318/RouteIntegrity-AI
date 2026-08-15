/**
 * Step 4 — fraud_decision
 *
 * Core LLM fraud classification step.
 * Returns exactly the JSON schema requested in the README.
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
    routeDeviation: { type: 'boolean' },
    reason: { type: 'string' },
    recommendedAction: {
      type: 'string',
      enum: ['NONE', 'MONITOR', 'INVESTIGATE', 'ESCALATE'],
    }
  },
  required: ['status', 'confidence', 'routeDeviation', 'reason', 'recommendedAction'],
};

/**
 * @param {object} params
 * @param {object} params.tripInfo        — { source, destination }
 * @param {object} params.routeStatus     — output of monitor_route
 * @param {object} params.deviationAnalysis — output of analyze_deviation
 * @returns {Promise<object>}
 */
export async function fraud_decision({ tripInfo, routeStatus, deviationAnalysis }) {
  const prompt = `
You are a senior fraud detection AI for a ride-sharing safety platform.

## Trip Information
- Source: ${tripInfo.source}
- Destination: ${tripInfo.destination}

## Route Monitoring Results
- Maximum deviation from route: ${routeStatus.maxDeviationMeters} meters
- Time spent off-route: ${routeStatus.deviationDurationSeconds} seconds
- Significant deviation detected: ${routeStatus.significantDeviation}

## Deviation Analysis
- Has legitimate explanation: ${deviationAnalysis.hasLegitimateExplanation}
- Explanation: ${deviationAnalysis.explanation}

Classify this trip as LEGITIMATE, SUSPICIOUS, or FRAUD. 
Provide a clear 'reason' for your decision. 
Set 'routeDeviation' to true if they are significantly off-route.
Provide your response matching the exact JSON schema.
`.trim();

  return await callGemini(prompt, RESPONSE_SCHEMA);
}
