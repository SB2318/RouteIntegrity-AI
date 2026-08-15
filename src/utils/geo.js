/**
 * geo.js — Geospatial utility helpers
 * Haversine distance, nearest point on segment, bearing calculation
 */

const EARTH_RADIUS_METERS = 6_371_000;

/**
 * Convert degrees to radians.
 * @param {number} deg
 * @returns {number}
 */
export function toRad(deg) {
  return (deg * Math.PI) / 180;
}

/**
 * Haversine distance between two lat/lng points (in meters).
 * @param {{ lat: number, lng: number }} a
 * @param {{ lat: number, lng: number }} b
 * @returns {number} distance in meters
 */
export function haversineDistance(a, b) {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);

  const sinDLat = Math.sin(dLat / 2);
  const sinDLng = Math.sin(dLng / 2);

  const h =
    sinDLat * sinDLat +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * sinDLng * sinDLng;

  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.sqrt(h));
}

/**
 * Compute the minimum distance (meters) from a point P to a polyline segment A→B.
 * Uses the perpendicular foot if it falls within the segment, otherwise the
 * closer endpoint.
 *
 * @param {{ lat: number, lng: number }} p
 * @param {{ lat: number, lng: number }} a
 * @param {{ lat: number, lng: number }} b
 * @returns {number} distance in meters
 */
export function distanceToSegment(p, a, b) {
  // Work in a flat approximation (accurate enough for short road segments)
  const dx = b.lng - a.lng;
  const dy = b.lat - a.lat;
  const lenSq = dx * dx + dy * dy;

  if (lenSq === 0) return haversineDistance(p, a);

  let t = ((p.lng - a.lng) * dx + (p.lat - a.lat) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));

  const nearest = { lat: a.lat + t * dy, lng: a.lng + t * dx };
  return haversineDistance(p, nearest);
}

/**
 * Minimum distance (meters) from a GPS point to an entire polyline.
 * @param {{ lat: number, lng: number }} point
 * @param {Array<[number, number]>} polyline  — array of [lat, lng] pairs
 * @returns {number} distance in meters
 */
export function distanceToPolyline(point, polyline) {
  if (!polyline || polyline.length === 0) return Infinity;
  if (polyline.length === 1) {
    return haversineDistance(point, { lat: polyline[0][0], lng: polyline[0][1] });
  }

  let minDist = Infinity;
  for (let i = 0; i < polyline.length - 1; i++) {
    const a = { lat: polyline[i][0], lng: polyline[i][1] };
    const b = { lat: polyline[i + 1][0], lng: polyline[i + 1][1] };
    const dist = distanceToSegment(point, a, b);
    if (dist < minDist) minDist = dist;
  }

  return minDist;
}

/**
 * Bearing (degrees, 0–360) from point A to point B.
 * @param {{ lat: number, lng: number }} a
 * @param {{ lat: number, lng: number }} b
 * @returns {number}
 */
export function bearing(a, b) {
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const dLng = toRad(b.lng - a.lng);

  const y = Math.sin(dLng) * Math.cos(lat2);
  const x =
    Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);

  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

/**
 * Returns true if the driver's last known position is moving
 * toward the destination compared to an earlier position.
 * (Compares distance to destination from current vs. previous point)
 *
 * @param {{ lat: number, lng: number }} prev
 * @param {{ lat: number, lng: number }} current
 * @param {{ lat: number, lng: number }} destination
 * @returns {boolean}
 */
export function isMovingTowardDestination(prev, current, destination) {
  const prevDist = haversineDistance(prev, destination);
  const currentDist = haversineDistance(current, destination);
  return currentDist < prevDist;
}
