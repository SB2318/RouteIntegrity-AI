import { Router } from 'express';
import { generate_routes } from './pipeline/generate_routes.js';
import { monitor_route } from './pipeline/monitor_route.js';
import { analyze_deviation } from './pipeline/analyze_deviation.js';
import { fraud_decision } from './pipeline/fraud_decision.js';

const router = Router();

/**
 * 1. GET ROUTES
 * Generates route options via Gemini.
 */
router.post('/get-routes', async (req, res) => {
  const { source, destination } = req.body;

  if (!source || !destination) {
    return res.status(400).json({ error: 'Missing source or destination' });
  }

  try {
    const result = await generate_routes(source, destination);
    return res.status(200).json(result);
  } catch (err) {
    console.error('[get-routes] Error:', err);
    return res.status(500).json({ error: 'Failed to generate routes', message: err.message });
  }
});

/**
 * 2. ANALYZE LOCATION
 * Analyzes GPS data against the chosen route and returns the final fraud decision.
 */
router.post('/analyze-location', async (req, res) => {
  const { source, destination, approvedRoute, gpsData } = req.body;

  if (!source || !destination || !approvedRoute || !gpsData || !gpsData.length) {
    return res.status(400).json({ error: 'Missing required payload fields' });
  }

  const tripInfo = { source, destination };
  const approvedRoutePolyline = approvedRoute.polyline;
  const destinationCoords = approvedRoutePolyline[approvedRoutePolyline.length - 1];

  try {
    // Step 1: Monitor math (Deterministic)
    const routeStatus = monitor_route({ gpsData, approvedRoutePolyline, destinationCoords });

    // Step 2: Analyze deviation context (Gemini, skipped if not off route)
    const deviationAnalysis = await analyze_deviation({ tripInfo, routeStatus });

    // Step 3: Final fraud decision (Gemini)
    const decision = await fraud_decision({ tripInfo, routeStatus, deviationAnalysis });

    // Return exactly the JSON object requested, plus the indexed agent steps
    return res.status(200).json({
      ...decision,
      agentSteps: [
        {
          index: 1,
          step: "monitor_route",
          description: "Compare current movement against the approved route.",
          details: {
            maxDeviationMeters: routeStatus.maxDeviationMeters,
            deviationDurationSeconds: routeStatus.deviationDurationSeconds,
            significantDeviation: routeStatus.significantDeviation
          }
        },
        {
          index: 2,
          step: "analyze_deviation",
          description: "Determine whether significant deviations have a legitimate explanation.",
          details: {
            hasLegitimateExplanation: deviationAnalysis.hasLegitimateExplanation,
            explanation: deviationAnalysis.explanation,
            skipped: deviationAnalysis.skipped || false
          }
        },
        {
          index: 3,
          step: "fraud_decision",
          description: "Classify as LEGITIMATE, SUSPICIOUS, or FRAUD.",
          details: {
            status: decision.status,
            confidence: decision.confidence,
            recommendedAction: decision.recommendedAction
          }
        }
      ]
    });
  } catch (err) {
    console.error('[analyze-location] Error:', err);
    return res.status(500).json({ error: 'Failed to analyze location', message: err.message });
  }
});

export default router;
