import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { app } from 'electron'
import path from 'path'
import * as schema from './schema'

let db: ReturnType<typeof drizzle<typeof schema>> | null = null
let sqlite: Database.Database | null = null

export function initializeDatabase(): void {
  if (db) return // Already initialized

  const dbPath = path.join(app.getPath('userData'), 'immunoplex.db')
  console.log('Database path:', dbPath)

  sqlite = new Database(dbPath)

  // Enable WAL mode for concurrent read/write performance
  sqlite.pragma('journal_mode = WAL')

  // Enable FK constraint enforcement per-connection (D-12, PITFALLS §Pitfall 13).
  // SQLite default is OFF; must be called on every open Database instance.
  sqlite.pragma('foreign_keys = ON')

  db = drizzle(sqlite, { schema })
}

export function getDatabase() {
  if (!db) {
    throw new Error('Database not initialized. Call initializeDatabase() first.')
  }
  return db
}

export function getSqlite() {
  if (!sqlite) {
    throw new Error('Database not initialized. Call initializeDatabase() first.')
  }
  return sqlite
}

export function closeDatabase(): void {
  if (sqlite) {
    sqlite.close()
    sqlite = null
    db = null
  }
}

/**
 * TEST-ONLY helper. Overrides the module-level `db` with a caller-supplied
 * instance (typically from `createTestDb()` in __tests__/testDb.ts). Enables
 * repository tests to target an in-memory DB without refactoring every
 * repository to accept an injected `db` argument.
 *
 * Do NOT call this from production code. Production uses initializeDatabase(dbPath).
 */
export function setDatabaseForTests(testDb: ReturnType<typeof drizzle<typeof schema>>): void {
  db = testDb
}

/**
 * TEST-ONLY helper. Resets the module-level `db` to null.
 */
export function resetDatabaseForTests(): void {
  db = null
}
