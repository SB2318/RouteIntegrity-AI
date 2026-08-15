/**
 * Step 5 — escalate_incident
 *
 * Conditional escalation step. The AI does NOT contact authorities directly.
 * Instead it POSTs a structured incident payload to the authorized
 * backend/emergency webhook URL configured via ESCALATION_WEBHOOK_URL env var.
 *
 * Escalation triggers when ANY of the following are true:
 *  - decision.status === "FRAUD" AND decision.confidence >= threshold
 *  - decision.recommendedAction === "ESCALATE"
 *
 * Returns:
 *  {
 *    escalated: boolean,
 *    reason: string,
 *    incidentId: string | null,
 *    escalationTarget: string | null,
 *    respondedAt: string | null,
 *    response: object | null,
 *  }
 */

const ESCALATION_URL = process.env.ESCALATION_WEBHOOK_URL;
const CONFIDENCE_THRESHOLD = parseFloat(
  process.env.ESCALATION_CONFIDENCE_THRESHOLD ?? '0.85'
);

/**
 * @param {object} params
 * @param {object} params.tripInfo      — { tripId, source, destination, metadata }
 * @param {object} params.routeStatus   — output of monitor_route
 * @param {object} params.deviationAnalysis — output of analyze_deviation
 * @param {object} params.decision      — output of fraud_decision
 * @returns {Promise<object>}
 */
export async function escalate_incident({
  tripInfo,
  routeStatus,
  deviationAnalysis,
  decision,
}) {
  const shouldEscalate =
    decision.recommendedAction === 'ESCALATE' ||
    (decision.status === 'FRAUD' && decision.confidence >= CONFIDENCE_THRESHOLD);

  if (!shouldEscalate) {
    return {
      escalated: false,
      reason:
        decision.status !== 'FRAUD'
          ? `No escalation — decision is ${decision.status}`
          : `Confidence ${decision.confidence} below threshold ${CONFIDENCE_THRESHOLD}`,
      incidentId: null,
      escalationTarget: null,
      respondedAt: null,
      response: null,
    };
  }

  const incidentId = `INC-${tripInfo.tripId}-${Date.now()}`;

  const incidentPayload = {
    incidentId,
    detectedAt: new Date().toISOString(),
    severity: 'HIGH',
    trip: {
      tripId: tripInfo.tripId,
      source: tripInfo.source,
      destination: tripInfo.destination,
      vehicleId: tripInfo.metadata?.vehicleId ?? null,
      driverId: tripInfo.metadata?.driverId ?? null,
    },
    aiDecision: {
      status: decision.status,
      confidence: decision.confidence,
      evidence: decision.evidence,
      reasoning: decision.reasoning,
      recommendedAction: decision.recommendedAction,
    },
    routeSummary: {
      maxDeviationMeters: routeStatus.maxDeviationMeters,
      deviationDurationSeconds: routeStatus.deviationDurationSeconds,
      movingTowardDestination: routeStatus.movingTowardDestination,
      offRouteSegments: routeStatus.offRouteSegments.length,
    },
    deviationAnalysis: {
      hasLegitimateExplanation: deviationAnalysis.hasLegitimateExplanation,
      explanation: deviationAnalysis.explanation,
      suspicionFactors: deviationAnalysis.suspicionFactors,
    },
    note: 'This incident was flagged by RouteIntegrity AI. Human review is required before taking any action.',
  };

  // If no escalation URL is configured, log and return (safe fallback for dev)
  if (!ESCALATION_URL) {
    console.warn(
      '[escalate_incident] ESCALATION_WEBHOOK_URL not set — logging incident locally.\n',
      JSON.stringify(incidentPayload, null, 2)
    );
    return {
      escalated: true,
      reason: `${decision.status} with confidence ${decision.confidence} (escalation webhook not configured — logged locally)`,
      incidentId,
      escalationTarget: null,
      respondedAt: new Date().toISOString(),
      response: { simulated: true, payload: incidentPayload },
    };
  }

  try {
    const response = await fetch(ESCALATION_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(incidentPayload),
    });

    const responseBody = await response.text();
    let parsedResponse;
    try {
      parsedResponse = JSON.parse(responseBody);
    } catch {
      parsedResponse = { raw: responseBody };
    }

    return {
      escalated: true,
      reason: `${decision.status} with confidence ${decision.confidence}`,
      incidentId,
      escalationTarget: ESCALATION_URL,
      respondedAt: new Date().toISOString(),
      httpStatus: response.status,
      response: parsedResponse,
    };
  } catch (err) {
    console.error('[escalate_incident] Escalation HTTP request failed:', err.message);
    return {
      escalated: true,
      reason: `${decision.status} with confidence ${decision.confidence} (escalation delivery failed)`,
      incidentId,
      escalationTarget: ESCALATION_URL,
      respondedAt: new Date().toISOString(),
      error: err.message,
      response: null,
    };
  }
}
