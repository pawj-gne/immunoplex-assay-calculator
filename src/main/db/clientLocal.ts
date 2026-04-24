import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { app } from 'electron'
import path from 'path'
import * as schema from './schema'

// Phase 6 (D-07): Client-mode local fallback DB. Distinct filename from
// `immunoplex.db` so a client machine can be promoted to server later
// without colliding with the central DB.

let db: ReturnType<typeof drizzle<typeof schema>> | null = null
let sqlite: Database.Database | null = null

export function initializeLocalDatabase(): void {
  if (db) return // Already initialized

  const dbPath = path.join(app.getPath('userData'), 'immunoplex-local.db')
  console.log('Local database path:', dbPath)

  sqlite = new Database(dbPath)

  // Enable WAL mode for concurrent read/write performance
  sqlite.pragma('journal_mode = WAL')

  // Enable FK constraint enforcement per-connection (D-12, PITFALLS §Pitfall 13).
  // SQLite default is OFF; must be called on every open Database instance.
  sqlite.pragma('foreign_keys = ON')

  db = drizzle(sqlite, { schema })
}

export function getLocalDatabase() {
  if (!db) {
    throw new Error('Local database not initialized. Call initializeLocalDatabase() first.')
  }
  return db
}

export function getLocalSqlite() {
  if (!sqlite) {
    throw new Error('Local database not initialized. Call initializeLocalDatabase() first.')
  }
  return sqlite
}

export function closeLocalDatabase(): void {
  if (sqlite) {
    sqlite.close()
    sqlite = null
    db = null
  }
}

/**
 * TEST-ONLY helper. Overrides the module-level `db` with a caller-supplied
 * instance (typically from `createTestDb()` in __tests__/testDb.ts).
 *
 * Do NOT call this from production code.
 */
export function setLocalDatabaseForTests(testDb: ReturnType<typeof drizzle<typeof schema>>): void {
  db = testDb
}

/**
 * TEST-ONLY helper. Resets the module-level `db` to null.
 */
export function resetLocalDatabaseForTests(): void {
  db = null
}
