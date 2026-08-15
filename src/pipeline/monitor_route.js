/**
 * Step 2 — monitor_route
 *
 * Deterministic route monitoring. No LLM involved.
 *
 * Compares each GPS point against the approved route polyline and computes:
 *  - onRoute              — whether the driver is currently on route
 *  - maxDeviationMeters   — peak distance from the approved route
 *  - avgDeviationMeters   — average deviation across all off-route points
 *  - deviationDurationSeconds — total time spent off-route
 *  - movingTowardDestination — direction of travel vs. destination
 *  - significantDeviation — true if deviation exceeds threshold and duration
 *  - offRouteSegments     — list of off-route GPS sub-tracks for analysis
 *
 * Thresholds (configurable via env):
 *  - DEVIATION_DISTANCE_THRESHOLD_METERS  (default: 200m)
 *  - DEVIATION_DURATION_THRESHOLD_SECONDS (default: 60s)
 */

import {
  distanceToPolyline,
  haversineDistance,
  isMovingTowardDestination,
} from '../utils/geo.js';

const DISTANCE_THRESHOLD = parseInt(
  process.env.DEVIATION_DISTANCE_THRESHOLD_METERS ?? '200',
  10
);
const DURATION_THRESHOLD = parseInt(
  process.env.DEVIATION_DURATION_THRESHOLD_SECONDS ?? '60',
  10
);

/**
 * @param {object} params
 * @param {Array<{lat:number,lng:number,timestamp:string}>} params.gpsData
 * @param {Array<[number,number]>} params.approvedRoutePolyline
 * @param {string} params.destination   — human-readable (for logging only)
 * @param {Array<[number,number]>} params.destinationCoords  — [lat, lng] of destination
 * @returns {object} routeStatus
 */
export function monitor_route({
  gpsData,
  approvedRoutePolyline,
  destinationCoords,
}) {
  const perPointResults = gpsData.map((pt, i) => {
    const dist = distanceToPolyline({ lat: pt.lat, lng: pt.lng }, approvedRoutePolyline);
    const offRoute = dist > DISTANCE_THRESHOLD;
    const ts = new Date(pt.timestamp).getTime();
    return { ...pt, distFromRoute: dist, offRoute, ts, index: i };
  });

  // Max and average deviation
  const maxDeviationMeters = Math.max(...perPointResults.map((p) => p.distFromRoute));
  const offRoutePoints = perPointResults.filter((p) => p.offRoute);
  const avgDeviationMeters =
    offRoutePoints.length > 0
      ? offRoutePoints.reduce((s, p) => s + p.distFromRoute, 0) / offRoutePoints.length
      : 0;

  // Off-route duration (sum of gaps between consecutive off-route points)
  let deviationDurationSeconds = 0;
  for (let i = 1; i < perPointResults.length; i++) {
    if (perPointResults[i].offRoute && perPointResults[i - 1].offRoute) {
      const gap = (perPointResults[i].ts - perPointResults[i - 1].ts) / 1000;
      if (gap > 0 && gap < 3600) deviationDurationSeconds += gap; // ignore implausible gaps
    }
  }

  // Direction of travel toward destination
  let movingTowardDestination = null;
  if (destinationCoords && perPointResults.length >= 2) {
    const dest = { lat: destinationCoords[0], lng: destinationCoords[1] };
    const prev = perPointResults[perPointResults.length - 2];
    const curr = perPointResults[perPointResults.length - 1];
    movingTowardDestination = isMovingTowardDestination(
      { lat: prev.lat, lng: prev.lng },
      { lat: curr.lat, lng: curr.lng },
      dest
    );
  }

  // Off-route segments (contiguous sequences of off-route points)
  const offRouteSegments = [];
  let segment = null;
  for (const pt of perPointResults) {
    if (pt.offRoute) {
      if (!segment) {
        segment = { start: pt.timestamp, points: [] };
      }
      segment.points.push({ lat: pt.lat, lng: pt.lng, distFromRoute: Math.round(pt.distFromRoute), timestamp: pt.timestamp });
    } else if (segment) {
      segment.end = perPointResults[pt.index - 1]?.timestamp ?? pt.timestamp;
      offRouteSegments.push(segment);
      segment = null;
    }
  }
  if (segment) {
    segment.end = gpsData[gpsData.length - 1].timestamp;
    offRouteSegments.push(segment);
  }

  const onRoute = offRoutePoints.length === 0;
  const significantDeviation =
    maxDeviationMeters > DISTANCE_THRESHOLD &&
    deviationDurationSeconds >= DURATION_THRESHOLD;

  return {
    onRoute,
    maxDeviationMeters: Math.round(maxDeviationMeters),
    avgDeviationMeters: Math.round(avgDeviationMeters),
    deviationDurationSeconds: Math.round(deviationDurationSeconds),
    movingTowardDestination,
    significantDeviation,
    offRouteSegments,
    thresholds: {
      distanceMeters: DISTANCE_THRESHOLD,
      durationSeconds: DURATION_THRESHOLD,
    },
  };
}
