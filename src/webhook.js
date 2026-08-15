/**
 * webhook.js — POST /webhook/analyze-trip
 *
 * Orchestrates the full 5-step RouteIntegrity AI pipeline:
 *   1. validate_trip
 *   2. monitor_route
 *   3. analyze_deviation
 *   4. fraud_decision
 *   5. escalate_incident
 */

import { Router } from 'express';
import { validate_trip, ValidationError } from './pipeline/validate_trip.js';
import { monitor_route } from './pipeline/monitor_route.js';
import { analyze_deviation } from './pipeline/analyze_deviation.js';
import { fraud_decision } from './pipeline/fraud_decision.js';
import { escalate_incident } from './pipeline/escalate_incident.js';

const router = Router();

router.post('/analyze-trip', async (req, res) => {
  const startTime = Date.now();

  // ── Step 1: Validate Trip ────────────────────────────────────────────────
  let validationResult;
  try {
    validationResult = validate_trip(req.body);
  } catch (err) {
    if (err instanceof ValidationError) {
      return res.status(400).json({
        error: 'VALIDATION_FAILED',
        message: err.message,
        step: 'validate_trip',
      });
    }
    throw err;
  }

  const {
    tripId,
    source,
    destination,
    approvedRoutePolyline,
    gpsData,
    metadata,
  } = req.body;

  // Derive destination coordinates from the last point of the approved polyline
  const destinationCoords = approvedRoutePolyline[approvedRoutePolyline.length - 1];

  const tripInfo = { tripId, source, destination, metadata: metadata ?? {} };

  console.log(`[${tripId}] Step 1 ✅ validate_trip — valid`);

  // ── Step 2: Monitor Route ────────────────────────────────────────────────
  let routeStatus;
  try {
    routeStatus = monitor_route({ gpsData, approvedRoutePolyline, destinationCoords });
  } catch (err) {
    return res.status(500).json({
      error: 'MONITOR_ROUTE_ERROR',
      message: err.message,
      step: 'monitor_route',
    });
  }

  console.log(
    `[${tripId}] Step 2 ✅ monitor_route — max deviation: ${routeStatus.maxDeviationMeters}m, ` +
      `significant: ${routeStatus.significantDeviation}`
  );

  // ── Step 3: Analyze Deviation ────────────────────────────────────────────
  let deviationAnalysis;
  try {
    deviationAnalysis = await analyze_deviation({ tripInfo, routeStatus });
  } catch (err) {
    return res.status(502).json({
      error: 'ANALYZE_DEVIATION_ERROR',
      message: err.message,
      step: 'analyze_deviation',
    });
  }

  console.log(
    `[${tripId}] Step 3 ✅ analyze_deviation — legitimate: ${deviationAnalysis.hasLegitimateExplanation}, ` +
      `skipped: ${deviationAnalysis.skipped}`
  );

  // ── Step 4: Fraud Decision ───────────────────────────────────────────────
  let decision;
  try {
    decision = await fraud_decision({ tripInfo, routeStatus, deviationAnalysis });
  } catch (err) {
    return res.status(502).json({
      error: 'FRAUD_DECISION_ERROR',
      message: err.message,
      step: 'fraud_decision',
    });
  }

  console.log(
    `[${tripId}] Step 4 ✅ fraud_decision — status: ${decision.status}, ` +
      `confidence: ${decision.confidence}, action: ${decision.recommendedAction}`
  );

  // ── Step 5: Escalate Incident ────────────────────────────────────────────
  let escalation;
  try {
    escalation = await escalate_incident({
      tripInfo,
      routeStatus,
      deviationAnalysis,
      decision,
    });
  } catch (err) {
    return res.status(502).json({
      error: 'ESCALATION_ERROR',
      message: err.message,
      step: 'escalate_incident',
    });
  }

  console.log(
    `[${tripId}] Step 5 ✅ escalate_incident — escalated: ${escalation.escalated}, ` +
      `reason: ${escalation.reason}`
  );

  // ── Final Response ───────────────────────────────────────────────────────
  const processingMs = Date.now() - startTime;

  return res.status(200).json({
    tripId,
    finalDecision: decision.status,
    confidence: decision.confidence,
    recommendedAction: decision.recommendedAction,
    escalated: escalation.escalated,
    pipelineSteps: {
      validate_trip: validationResult,
      monitor_route: routeStatus,
      analyze_deviation: deviationAnalysis,
      fraud_decision: decision,
      escalate_incident: escalation,
    },
    timestamp: new Date().toISOString(),
    processingMs,
  });
});

export default router;
