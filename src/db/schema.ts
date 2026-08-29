import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';

export const hikes = sqliteTable('hikes', {
  id: text('id').primaryKey(),
  trailId: text('trail_id'),
  title: text('title').notNull(),
  /** ISO-8601 UTC timestamp of when the hike started. */
  startedAt: text('started_at').notNull(),
  durationSeconds: integer('duration_seconds').notNull(),
  distanceMeters: real('distance_meters').notNull(),
  elevationGainMeters: real('elevation_gain_meters').notNull(),
  notes: text('notes'),
});

export const hikePoints = sqliteTable('hike_points', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  hikeId: text('hike_id').notNull(),
  latitude: real('latitude').notNull(),
  longitude: real('longitude').notNull(),
  elevation: real('elevation'),
  timestamp: integer('timestamp').notNull(),
});

export const hikePhotos = sqliteTable('hike_photos', {
  id: text('id').primaryKey(),
  hikeId: text('hike_id').notNull(),
  uri: text('uri').notNull(),
  capturedAt: integer('captured_at').notNull(),
});

export type Hike = typeof hikes.$inferSelect;
export type NewHike = typeof hikes.$inferInsert;
export type HikePoint = typeof hikePoints.$inferSelect;
export type HikePhoto = typeof hikePhotos.$inferSelect;
