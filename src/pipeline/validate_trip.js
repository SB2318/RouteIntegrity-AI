/**
 * Step 1 — validate_trip
 *
 * Deterministic validation. No LLM involved.
 *
 * Checks:
 *  - source and destination are non-empty strings
 *  - approvedRouteId is present
 *  - approvedRoutePolyline has at least 2 points
 *  - driverAgreed and userAgreed are both true
 *  - gpsData has at least 1 valid {lat, lng, timestamp} entry
 *
 * Returns: { valid: true, tripId }
 * Throws:  ValidationError with a descriptive message on failure
 */

export class ValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ValidationError';
    this.statusCode = 400;
  }
}

/**
 * @param {object} tripPayload — The raw request body
 * @returns {{ valid: true, tripId: string }}
 */
export function validate_trip(tripPayload) {
  const {
    tripId,
    source,
    destination,
    approvedRouteId,
    approvedRoutePolyline,
    driverAgreed,
    userAgreed,
    gpsData,
  } = tripPayload;

  // --- Trip identity ---
  if (!tripId || typeof tripId !== 'string') {
    throw new ValidationError('Missing or invalid field: tripId (string required)');
  }

  // --- Source & Destination ---
  if (!source || typeof source !== 'string' || source.trim() === '') {
    throw new ValidationError('Missing or invalid field: source');
  }
  if (!destination || typeof destination !== 'string' || destination.trim() === '') {
    throw new ValidationError('Missing or invalid field: destination');
  }
  if (source.trim().toLowerCase() === destination.trim().toLowerCase()) {
    throw new ValidationError('source and destination must be different locations');
  }

  // --- Approved route ---
  if (!approvedRouteId || typeof approvedRouteId !== 'string') {
    throw new ValidationError('Missing or invalid field: approvedRouteId');
  }
  if (
    !Array.isArray(approvedRoutePolyline) ||
    approvedRoutePolyline.length < 2
  ) {
    throw new ValidationError(
      'approvedRoutePolyline must be an array of at least 2 [lat, lng] coordinate pairs'
    );
  }
  for (let i = 0; i < approvedRoutePolyline.length; i++) {
    const point = approvedRoutePolyline[i];
    if (
      !Array.isArray(point) ||
      point.length < 2 ||
      typeof point[0] !== 'number' ||
      typeof point[1] !== 'number'
    ) {
      throw new ValidationError(
        `approvedRoutePolyline[${i}] is invalid — expected [lat, lng] number pair`
      );
    }
  }

  // --- Agreement checks ---
  if (driverAgreed !== true) {
    throw new ValidationError(
      'Trip cannot be monitored without driver agreement (driverAgreed must be true)'
    );
  }
  if (userAgreed !== true) {
    throw new ValidationError(
      'Trip cannot be monitored without user agreement (userAgreed must be true)'
    );
  }

  // --- GPS data ---
  if (!Array.isArray(gpsData) || gpsData.length === 0) {
    throw new ValidationError('gpsData must be a non-empty array of GPS points');
  }
  for (let i = 0; i < gpsData.length; i++) {
    const pt = gpsData[i];
    if (
      typeof pt.lat !== 'number' ||
      typeof pt.lng !== 'number' ||
      !pt.timestamp
    ) {
      throw new ValidationError(
        `gpsData[${i}] is invalid — each point must have { lat: number, lng: number, timestamp: string }`
      );
    }
    if (pt.lat < -90 || pt.lat > 90) {
      throw new ValidationError(`gpsData[${i}].lat is out of range (-90 to 90)`);
    }
    if (pt.lng < -180 || pt.lng > 180) {
      throw new ValidationError(`gpsData[${i}].lng is out of range (-180 to 180)`);
    }
  }

  return { valid: true, tripId };
}
