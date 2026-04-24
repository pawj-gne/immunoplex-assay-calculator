import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import path from 'path'
import * as schema from '../schema'

export type TestDb = {
  sqlite: Database.Database
  db: ReturnType<typeof drizzle<typeof schema>>
}

/**
 * Fresh in-memory better-sqlite3 DB with PRAGMA foreign_keys = ON and
 * all drizzle migrations applied (0000 through the latest emitted).
 * Every test gets its own DB — forks pool (vitest.config.ts) ensures isolation.
 */
export function createTestDb(): TestDb {
  const sqlite = new Database(':memory:')
  sqlite.pragma('foreign_keys = ON')
  const db = drizzle(sqlite, { schema })
  migrate(db, {
    migrationsFolder: path.join(__dirname, '../../../../drizzle/migrations')
  })
  return { sqlite, db }
}

/**
 * Minimal seed helper — inserts one platform row and one species row so
 * downstream master_panels / analytes / premix_panels inserts have FK parents.
 * Returns the generated IDs for use by the calling test.
 */
export function seedPlatformAndSpecies(
  sqlite: Database.Database
): { platformId: string; speciesId: string } {
  const platformId = crypto.randomUUID()
  const speciesId = crypto.randomUUID()
  const now = new Date().toISOString()

  sqlite
    .prepare(
      `INSERT INTO platforms (id, name, description, stock_concentration, created_at, updated_at)
       VALUES (?, 'TestPlatform', NULL, 100, ?, ?)`
    )
    .run(platformId, now, now)
  sqlite
    .prepare(
      `INSERT INTO species (id, name, platform_id, created_at, updated_at)
       VALUES (?, 'TestSpecies', ?, ?, ?)`
    )
    .run(speciesId, platformId, now, now)

  return { platformId, speciesId }
}
