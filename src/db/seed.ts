import { sql } from 'drizzle-orm';
import { db, sqliteDb } from './client';
import { hikes, hikePoints } from './schema';
import { trails } from '../data/trails';
import { elevationGainMeters, haversineMeters, routeDistanceMeters } from '../lib/geo';

/**
 * Seeds a year of hike history derived from the trail dataset, so History and
 * the stats screens have real data on a fresh install. Deterministic: the same
 * install always produces the same log.
 */
export function seedHikesIfEmpty(): void {
  const existing = sqliteDb.getFirstSync<{ count: number }>('SELECT COUNT(*) as count FROM hikes');
  if (existing && existing.count > 0) return;

  // mulberry32: a naive LCG visibly repeats over the few hundred draws below.
  let state = 424242;
  const rand = () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  const now = Date.now();
  const rows: (typeof hikes.$inferInsert)[] = [];
  const pointRows: (typeof hikePoints.$inferInsert)[] = [];

  for (let i = 0; i < 48; i++) {
    const trail = trails[Math.floor(rand() * trails.length)];
    const daysAgo = Math.floor(rand() * 330) + 1;
    const startedAt = new Date(now - daysAgo * 86400000 - Math.floor(rand() * 6) * 3600000);
    const hikeId = `hike-${String(i + 1).padStart(3, '0')}`;

    // Walk a prefix of the trail so distances vary from the trail's full length.
    const fraction = 0.55 + rand() * 0.45;
    const slice = trail.route.slice(0, Math.max(4, Math.floor(trail.route.length * fraction)));
    const paceSecondsPerKm = 700 + rand() * 500;
    const distanceMeters = routeDistanceMeters(slice);
    const durationSeconds = Math.round((distanceMeters / 1000) * paceSecondsPerKm);

    // Weight each step by how steep it is, plus a little noise, so per-kilometre
    // splits vary the way a real hike's do. Distributing the duration evenly
    // would make every split identical.
    const weights: number[] = [];
    for (let j = 1; j < slice.length; j++) {
      const rise = slice[j].elevation - slice[j - 1].elevation;
      const run = Math.max(haversineMeters(slice[j - 1], slice[j]), 1);
      const grade = rise / run;
      // Uphill costs more than downhill saves; flat is the 1.0 baseline.
      const effort = 1 + Math.max(grade, 0) * 7 + Math.max(-grade, 0) * 1.5;
      weights.push(effort * (0.85 + rand() * 0.3));
    }
    const weightTotal = weights.reduce((a, b) => a + b, 0) || 1;

    let t = startedAt.getTime();
    for (let j = 0; j < slice.length; j++) {
      const p = slice[j];
      pointRows.push({
        hikeId,
        latitude: p.latitude,
        longitude: p.longitude,
        elevation: p.elevation,
        timestamp: Math.round(t),
      });
      if (j < weights.length) t += (weights[j] / weightTotal) * durationSeconds * 1000;
    }

    rows.push({
      id: hikeId,
      trailId: trail.id,
      title: trail.name,
      startedAt: startedAt.toISOString(),
      durationSeconds,
      distanceMeters,
      elevationGainMeters: elevationGainMeters(slice),
      notes: null,
    });
  }

  db.transaction((tx) => {
    tx.insert(hikes).values(rows).run();
    for (let i = 0; i < pointRows.length; i += 400) {
      tx.insert(hikePoints).values(pointRows.slice(i, i + 400)).run();
    }
  });
}

export function hikeCount(): number {
  const row = sqliteDb.getFirstSync<{ count: number }>('SELECT COUNT(*) as count FROM hikes');
  return row?.count ?? 0;
}

export const __sqlHelpers = { sql };
