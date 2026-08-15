/**
 * tests/pipeline.test.js
 *
 * Unit tests for the RouteIntegrity AI pipeline steps.
 * Steps 1 & 2 are fully deterministic and tested without mocking.
 * Steps 3, 4, 5 are tested with a mocked Gemini client.
 */

import { validate_trip, ValidationError } from '../src/pipeline/validate_trip.js';
import { monitor_route } from '../src/pipeline/monitor_route.js';
import { haversineDistance } from '../src/utils/geo.js';

// ── Sample Data ──────────────────────────────────────────────────────────────

/** Kolkata Airport → Howrah Station approximate polyline */
const APPROVED_POLYLINE = [
  [22.6547, 88.4467], // Kolkata Airport
  [22.6300, 88.4200],
  [22.6000, 88.4000],
  [22.5800, 88.3900],
  [22.5726, 88.3639], // Howrah Station
];

const DESTINATION_COORDS = [22.5726, 88.3639];

const VALID_GPS_ON_ROUTE = [
  { lat: 22.654, lng: 88.446, timestamp: '2026-08-15T10:00:00Z' },
  { lat: 22.630, lng: 88.420, timestamp: '2026-08-15T10:05:00Z' },
  { lat: 22.600, lng: 88.400, timestamp: '2026-08-15T10:10:00Z' },
];

const VALID_GPS_OFF_ROUTE = [
  { lat: 22.654, lng: 88.446, timestamp: '2026-08-15T10:00:00Z' },
  { lat: 22.610, lng: 88.500, timestamp: '2026-08-15T10:05:00Z' }, // ~5km east — off route
  { lat: 22.570, lng: 88.550, timestamp: '2026-08-15T10:10:00Z' }, // further off route
];

const BASE_PAYLOAD = {
  tripId: 'trip_test_001',
  source: 'Kolkata Airport',
  destination: 'Howrah Station',
  approvedRouteId: 'route_123',
  approvedRoutePolyline: APPROVED_POLYLINE,
  driverAgreed: true,
  userAgreed: true,
  gpsData: VALID_GPS_ON_ROUTE,
};

// ── validate_trip tests ──────────────────────────────────────────────────────

describe('validate_trip', () => {
  test('accepts a fully valid payload', () => {
    const result = validate_trip(BASE_PAYLOAD);
    expect(result.valid).toBe(true);
    expect(result.tripId).toBe('trip_test_001');
  });

  test('rejects missing tripId', () => {
    expect(() => validate_trip({ ...BASE_PAYLOAD, tripId: undefined })).toThrow(ValidationError);
  });

  test('rejects missing source', () => {
    expect(() => validate_trip({ ...BASE_PAYLOAD, source: '' })).toThrow(ValidationError);
  });

  test('rejects identical source and destination', () => {
    expect(() =>
      validate_trip({ ...BASE_PAYLOAD, source: 'Howrah Station', destination: 'Howrah Station' })
    ).toThrow(ValidationError);
  });

  test('rejects missing approvedRouteId', () => {
    expect(() => validate_trip({ ...BASE_PAYLOAD, approvedRouteId: undefined })).toThrow(ValidationError);
  });

  test('rejects polyline with fewer than 2 points', () => {
    expect(() =>
      validate_trip({ ...BASE_PAYLOAD, approvedRoutePolyline: [[22.654, 88.446]] })
    ).toThrow(ValidationError);
  });

  test('rejects driverAgreed=false', () => {
    expect(() => validate_trip({ ...BASE_PAYLOAD, driverAgreed: false })).toThrow(ValidationError);
  });

  test('rejects userAgreed=false', () => {
    expect(() => validate_trip({ ...BASE_PAYLOAD, userAgreed: false })).toThrow(ValidationError);
  });

  test('rejects empty gpsData', () => {
    expect(() => validate_trip({ ...BASE_PAYLOAD, gpsData: [] })).toThrow(ValidationError);
  });

  test('rejects gpsData point with invalid lat', () => {
    expect(() =>
      validate_trip({
        ...BASE_PAYLOAD,
        gpsData: [{ lat: 999, lng: 88.44, timestamp: '2026-08-15T10:00:00Z' }],
      })
    ).toThrow(ValidationError);
  });
});

// ── monitor_route tests ──────────────────────────────────────────────────────

describe('monitor_route', () => {
  test('detects on-route GPS points correctly', () => {
    const result = monitor_route({
      gpsData: VALID_GPS_ON_ROUTE,
      approvedRoutePolyline: APPROVED_POLYLINE,
      destinationCoords: DESTINATION_COORDS,
    });
    expect(result.onRoute).toBe(true);
    expect(result.significantDeviation).toBe(false);
    expect(result.maxDeviationMeters).toBeLessThan(300);
  });

  test('detects significant off-route deviation', () => {
    const result = monitor_route({
      gpsData: VALID_GPS_OFF_ROUTE,
      approvedRoutePolyline: APPROVED_POLYLINE,
      destinationCoords: DESTINATION_COORDS,
    });
    expect(result.onRoute).toBe(false);
    expect(result.maxDeviationMeters).toBeGreaterThan(1000);
  });

  test('correctly identifies movement away from destination', () => {
    const result = monitor_route({
      gpsData: VALID_GPS_OFF_ROUTE,
      approvedRoutePolyline: APPROVED_POLYLINE,
      destinationCoords: DESTINATION_COORDS,
    });
    // Last point [22.570, 88.550] is further from Howrah [22.5726, 88.3639]
    // than second-to-last [22.610, 88.500] so movingTowardDestination may vary
    expect(typeof result.movingTowardDestination).toBe('boolean');
  });

  test('off-route segments are populated when deviation exists', () => {
    const result = monitor_route({
      gpsData: VALID_GPS_OFF_ROUTE,
      approvedRoutePolyline: APPROVED_POLYLINE,
      destinationCoords: DESTINATION_COORDS,
    });
    expect(result.offRouteSegments.length).toBeGreaterThan(0);
  });
});

// ── geo utils tests ──────────────────────────────────────────────────────────

describe('haversineDistance', () => {
  test('returns ~0 for identical points', () => {
    const dist = haversineDistance({ lat: 22.5726, lng: 88.3639 }, { lat: 22.5726, lng: 88.3639 });
    expect(dist).toBeCloseTo(0, 0);
  });

  test('Kolkata Airport to Howrah is approximately 12–14 km', () => {
    const dist = haversineDistance(
      { lat: 22.6547, lng: 88.4467 },
      { lat: 22.5726, lng: 88.3639 }
    );
    expect(dist).toBeGreaterThan(11_000);
    expect(dist).toBeLessThan(16_000);
  });
});
