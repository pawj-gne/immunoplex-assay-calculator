import { describe, it, expect } from 'vitest'
import Database from 'better-sqlite3'
import fs from 'fs'
import path from 'path'

const MIGRATIONS_DIR = path.join(__dirname, '../../../../drizzle/migrations')

/**
 * Apply a specific subset of migration files (by filename prefix) manually.
 * We can't use drizzle's migrate() because it tracks state in __drizzle_migrations
 * and would apply ALL. This runs raw SQL in filename-sort order.
 */
function applyMigrations(sqlite: Database.Database, prefixes: string[]): void {
  const all = fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort()
  for (const file of all) {
    if (!prefixes.some((p) => file.startsWith(p))) continue
    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf-8')
    // drizzle-kit emits statement-breakpoint tokens; split on them
    const statements = sql
      .split('--> statement-breakpoint')
      .map((s) => s.trim())
      .filter(Boolean)
    for (const stmt of statements) {
      sqlite.exec(stmt)
    }
  }
}

describe('migration 0004 applies against v1 dev DB without data loss (SC #1)', () => {
  it('preserves pre-existing premix_panels + analytes; new columns default correctly', () => {
    const sqlite = new Database(':memory:')
    sqlite.pragma('foreign_keys = ON')

    // --- STAGE 1: "as-of-v1" — apply only migrations 0000-0003 ---
    applyMigrations(sqlite, ['0000_', '0001_', '0002_', '0003_'])

    // Seed a v1-shaped dataset
    const now = new Date().toISOString()
    const platformId = crypto.randomUUID()
    const speciesId = crypto.randomUUID()
    const panelId = crypto.randomUUID()
    const analyteId = crypto.randomUUID()

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
    sqlite
      .prepare(
        `INSERT INTO premix_panels (id, name, description, platform_id, species_id, created_at, updated_at)
         VALUES (?, 'V1Premix', 'pre-v2 row', ?, ?, ?, ?)`
      )
      .run(panelId, platformId, speciesId, now, now)
    sqlite
      .prepare(
        `INSERT INTO analytes (id, name, bead_region, premix_conc, single_conc, platform_id, species_id, created_at, updated_at)
         VALUES (?, 'IL-6', 12, 50, 50, ?, ?, ?, ?)`
      )
      .run(analyteId, platformId, speciesId, now, now)

    const premixCountBefore = (
      sqlite.prepare('SELECT COUNT(*) AS c FROM premix_panels').get() as { c: number }
    ).c
    const analyteCountBefore = (
      sqlite.prepare('SELECT COUNT(*) AS c FROM analytes').get() as { c: number }
    ).c
    expect(premixCountBefore).toBe(1)
    expect(analyteCountBefore).toBe(1)

    // --- STAGE 2: apply migration 0004 + any 0004b supplement ---
    applyMigrations(sqlite, ['0004_', '0004b_'])

    // --- ASSERTIONS: no data loss, new columns default correctly ---
    const premixCountAfter = (
      sqlite.prepare('SELECT COUNT(*) AS c FROM premix_panels').get() as { c: number }
    ).c
    const analyteCountAfter = (
      sqlite.prepare('SELECT COUNT(*) AS c FROM analytes').get() as { c: number }
    ).c
    expect(premixCountAfter).toBe(premixCountBefore)
    expect(analyteCountAfter).toBe(analyteCountBefore)

    const premixRow = sqlite
      .prepare('SELECT master_panel_id, sub_panel_conc FROM premix_panels WHERE id = ?')
      .get(panelId) as { master_panel_id: string | null; sub_panel_conc: number }
    expect(premixRow.master_panel_id).toBeNull()
    expect(premixRow.sub_panel_conc).toBe(1) // D-21 default

    const analyteRow = sqlite
      .prepare('SELECT master_panel_id FROM analytes WHERE id = ?')
      .get(analyteId) as { master_panel_id: string | null }
    expect(analyteRow.master_panel_id).toBeNull()

    // master_panels table exists with composite unique index
    const tables = sqlite
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='master_panels'")
      .all()
    expect(tables.length).toBe(1)

    const indexes = sqlite
      .prepare(
        "SELECT name FROM sqlite_master WHERE type='index' AND name='master_panels_platform_species_uniq'"
      )
      .all()
    expect(indexes.length).toBe(1)
  })
})
