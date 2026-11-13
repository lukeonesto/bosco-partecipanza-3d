import { CategoryId, Language, PoiFeature } from '../types';

export function haversineDistanceM(
  [lon1, lat1]: [number, number],
  [lon2, lat2]: [number, number]
): number {
  const R = 6371000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function formatDistance(meters: number, lang: Language): string {
  if (meters < 1000) {
    return `${Math.round(meters)} m`;
  }
  const km = (meters / 1000).toFixed(2);
  return lang === 'it' ? `${km.replace('.', ',')} km` : `${km} km`;
}

export function formatDuration(minutes: number, lang: Language): string {
  if (minutes < 60) {
    return `${minutes} min`;
  }
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (lang === 'it') {
    return m > 0 ? `${h} h ${m} min` : `${h} h`;
  }
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

export function findNearestPoi(
  userCoords: [number, number],
  pois: PoiFeature[],
  category?: CategoryId
): { poi: PoiFeature; distanceM: number } | null {
  const candidates = category
    ? pois.filter((p) => p.properties.categoria === category)
    : pois;

  if (candidates.length === 0) return null;

  let best: PoiFeature = candidates[0];
  let bestDist = haversineDistanceM(userCoords, best.geometry.coordinates);

  for (let i = 1; i < candidates.length; i++) {
    const dist = haversineDistanceM(userCoords, candidates[i].geometry.coordinates);
    if (dist < bestDist) {
      bestDist = dist;
      best = candidates[i];
    }
  }

  return { poi: best, distanceM: bestDist };
}
