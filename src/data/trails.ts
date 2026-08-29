import raw from './trails.json';

export interface TrailRoutePoint {
  latitude: number;
  longitude: number;
  elevation: number;
  distanceKm: number;
}

export type Difficulty = 'easy' | 'moderate' | 'hard' | 'expert';

export interface Trail {
  id: string;
  name: string;
  region: string;
  distanceKm: number;
  elevationGainM: number;
  difficulty: Difficulty;
  rating: number;
  reviewCount: number;
  estimatedMinutes: number;
  description: string;
  tags: string[];
  photoSeed: number;
  route: TrailRoutePoint[];
}

export const trails = raw as Trail[];

export function getTrail(id: string): Trail | undefined {
  return trails.find((t) => t.id === id);
}

export const regions = Array.from(new Set(trails.map((t) => t.region))).sort();

/** Stable remote photo for a trail, so the grid has real images to decode. */
export function trailPhotoUrl(trail: Trail, width = 600): string {
  return `https://picsum.photos/seed/${trail.photoSeed}/${width}/${Math.round(width * 0.66)}`;
}
