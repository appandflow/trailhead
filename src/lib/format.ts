export type DistanceUnit = 'metric' | 'imperial';

const KM_PER_MILE = 1.609344;
const M_PER_FOOT = 0.3048;

export function formatDistance(meters: number, unit: DistanceUnit = 'metric'): string {
  if (unit === 'imperial') {
    const miles = meters / 1000 / KM_PER_MILE;
    return `${miles.toFixed(miles < 10 ? 1 : 0)} mi`;
  }
  const km = meters / 1000;
  return `${km.toFixed(km < 10 ? 1 : 0)} km`;
}

export function formatElevation(meters: number, unit: DistanceUnit = 'metric'): string {
  if (unit === 'imperial') return `${Math.round(meters / M_PER_FOOT)} ft`;
  return `${Math.round(meters)} m`;
}

export function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function formatPace(seconds: number, meters: number, unit: DistanceUnit = 'metric'): string {
  if (meters <= 0) return '--';
  const perUnit = unit === 'imperial' ? (seconds / (meters / 1000 / KM_PER_MILE)) : seconds / (meters / 1000);
  const rounded = Math.round(perUnit);
  const m = Math.floor(rounded / 60);
  const s = rounded % 60;
  return `${m}:${String(s).padStart(2, '0')} /${unit === 'imperial' ? 'mi' : 'km'}`;
}
