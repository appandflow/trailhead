export interface GeoPoint {
  latitude: number;
  longitude: number;
  elevation?: number;
  timestamp?: number;
}

const EARTH_RADIUS_M = 6371000;
const toRad = (deg: number) => (deg * Math.PI) / 180;

/** Great-circle distance between two points, in meters. */
export function haversineMeters(a: GeoPoint, b: GeoPoint): number {
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.sin(dLon / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h));
}

export function routeDistanceMeters(points: GeoPoint[]): number {
  let total = 0;
  for (let i = 1; i < points.length; i++) total += haversineMeters(points[i - 1], points[i]);
  return total;
}

/** Sum of positive elevation deltas, ignoring jitter below `thresholdM`. */
export function elevationGainMeters(points: GeoPoint[], thresholdM = 3): number {
  let gain = 0;
  let reference: number | undefined;
  for (const p of points) {
    if (p.elevation == null) continue;
    if (reference == null) {
      reference = p.elevation;
      continue;
    }
    const delta = p.elevation - reference;
    if (delta >= thresholdM) {
      gain += delta;
      reference = p.elevation;
    } else if (delta <= -thresholdM) {
      reference = p.elevation;
    }
  }
  return Math.round(gain);
}

export function boundingRegion(points: GeoPoint[], paddingRatio = 0.25) {
  if (points.length === 0) {
    return { latitude: 46.8, longitude: -71.2, latitudeDelta: 1, longitudeDelta: 1 };
  }
  let minLat = Infinity, maxLat = -Infinity, minLon = Infinity, maxLon = -Infinity;
  for (const p of points) {
    minLat = Math.min(minLat, p.latitude);
    maxLat = Math.max(maxLat, p.latitude);
    minLon = Math.min(minLon, p.longitude);
    maxLon = Math.max(maxLon, p.longitude);
  }
  const latDelta = Math.max((maxLat - minLat) * (1 + paddingRatio), 0.01);
  const lonDelta = Math.max((maxLon - minLon) * (1 + paddingRatio), 0.01);
  return {
    latitude: (minLat + maxLat) / 2,
    longitude: (minLon + maxLon) / 2,
    latitudeDelta: latDelta,
    longitudeDelta: lonDelta,
  };
}

/** Per-kilometer splits from a recorded route, using point timestamps. */
export function computeSplits(points: GeoPoint[]): { km: number; seconds: number }[] {
  const splits: { km: number; seconds: number }[] = [];
  let accumulated = 0;
  let kmIndex = 1;
  let kmStartTime = points[0]?.timestamp;
  for (let i = 1; i < points.length; i++) {
    accumulated += haversineMeters(points[i - 1], points[i]);
    if (accumulated >= 1000) {
      const now = points[i].timestamp;
      if (kmStartTime != null && now != null) {
        splits.push({ km: kmIndex, seconds: Math.round((now - kmStartTime) / 1000) });
        kmStartTime = now;
      }
      accumulated -= 1000;
      kmIndex++;
    }
  }
  return splits;
}
