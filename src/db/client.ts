import * as SQLite from 'expo-sqlite';
import { drizzle } from 'drizzle-orm/expo-sqlite';
import * as schema from './schema';

const DATABASE_NAME = 'trailhead.db';

export const sqliteDb = SQLite.openDatabaseSync(DATABASE_NAME, { enableChangeListener: true });
export const db = drizzle(sqliteDb, { schema });

/**
 * Creates the schema if it is missing. Drizzle's migration generator needs a
 * bundler plugin to inline .sql files, which is more machinery than a
 * three-table schema warrants, so the DDL lives here directly.
 */
export function initializeDatabase(): void {
  sqliteDb.execSync(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS hikes (
      id TEXT PRIMARY KEY NOT NULL,
      trail_id TEXT,
      title TEXT NOT NULL,
      started_at TEXT NOT NULL,
      duration_seconds INTEGER NOT NULL,
      distance_meters REAL NOT NULL,
      elevation_gain_meters REAL NOT NULL,
      notes TEXT
    );
    CREATE TABLE IF NOT EXISTS hike_points (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      hike_id TEXT NOT NULL,
      latitude REAL NOT NULL,
      longitude REAL NOT NULL,
      elevation REAL,
      timestamp INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS hike_photos (
      id TEXT PRIMARY KEY NOT NULL,
      hike_id TEXT NOT NULL,
      uri TEXT NOT NULL,
      captured_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_hike_points_hike ON hike_points (hike_id);
    CREATE INDEX IF NOT EXISTS idx_hike_photos_hike ON hike_photos (hike_id);
  `);
}

export function resetDatabase(): void {
  sqliteDb.execSync(`
    DROP TABLE IF EXISTS hike_photos;
    DROP TABLE IF EXISTS hike_points;
    DROP TABLE IF EXISTS hikes;
  `);
  initializeDatabase();
}
