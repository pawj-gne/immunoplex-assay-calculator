import { describe, it, expect } from 'vitest'
import Database from 'better-sqlite3'
import fs from 'fs'
import path from 'path'
import { createTestDb } from './testDb'

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

describe('migration 0005 — offline_queue + runs machine provenance (NET-01)', () => {
  it('offline_queue table exists with correct schema after createTestDb()', () => {
    const { sqlite } = createTestDb()
    // createTestDb() applies all migrations via drizzle migrate(); 0005 is included.
    const tableInfo = sqlite
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='offline_queue'")
      .get()
    expect(tableInfo).toBeDefined()

    const cols = sqlite.prepare("PRAGMA table_info('offline_queue')").all() as Array<{
      name: string
    }>
    const colNames = cols.map((c) => c.name)
    expect(colNames).toContain('id')
    expect(colNames).toContain('run_id')
    expect(colNames).toContain('operation')
    expect(colNames).toContain('payload')
    expect(colNames).toContain('queued_at')
  })

  it('runs table has machine_name column (nullable) after migration 0005', () => {
    const { sqlite } = createTestDb()
    const cols = sqlite.prepare("PRAGMA table_info('runs')").all() as Array<{
      name: string
      notnull: number
      dflt_value: string | null
    }>
    const machineCol = cols.find((c) => c.name === 'machine_name')
    expect(machineCol).toBeDefined()
    expect(machineCol?.notnull).toBe(0) // nullable
  })

  it('runs table has is_offline_save column (NOT NULL with boolean default) after migration 0005', () => {
    const { sqlite } = createTestDb()
    const cols = sqlite.prepare("PRAGMA table_info('runs')").all() as Array<{
      name: string
      notnull: number
      dflt_value: string | null
    }>
    const offlineCol = cols.find((c) => c.name === 'is_offline_save')
    expect(offlineCol).toBeDefined()
    expect(offlineCol?.notnull).toBe(1) // NOT NULL
    // Drizzle emits `DEFAULT false` (matching established pattern in migration 0003 for
    // request_override_ad_hoc and operators.active). SQLite stores the literal token —
    // accept either the literal `false` or `0` since both evaluate to 0 at INSERT time.
    expect(['false', '0']).toContain(offlineCol?.dflt_value)
  })

  it('inserting a run without machine_name/is_offline_save defaults correctly', () => {
    const { sqlite } = createTestDb()
    const now = new Date().toISOString()

    // Seed FK parents
    const platformId = crypto.randomUUID()
    const speciesId = crypto.randomUUID()
    const operatorId = crypto.randomUUID()
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
        `INSERT INTO operators (id, name, active, created_at, updated_at)
         VALUES (?, 'TestOp', 1, ?, ?)`
      )
      .run(operatorId, now, now)

    const runId = crypto.randomUUID()
    sqlite
      .prepare(
        `INSERT INTO runs (
          id, request_number, request_override_ad_hoc, user_name, operator_id, run_date,
          sample_type, dilution_factor, sample_count, replicate_mode, request_type,
          platform_id, species_id, panel_id, volume_per_well, dead_volume,
          hamilton, run_plate_position, standard_position, trough_position,
          comments, plex, plate_count, plates_json, created_at, updated_at
         ) VALUES (?, 100, 0, 'tester', ?, '2026-04-24',
                   'Plasma', 1, 12, 'singles', 'premix',
                   ?, ?, NULL, 25, 2000,
                   1, 1, 1, 1,
                   NULL, 1, 1, '{}', ?, ?)`
      )
      .run(runId, operatorId, platformId, speciesId, now, now)

    const row = sqlite
      .prepare('SELECT machine_name, is_offline_save FROM runs WHERE id = ?')
      .get(runId) as { machine_name: string | null; is_offline_save: number }
    expect(row.machine_name).toBeNull()
    expect(row.is_offline_save).toBe(0) // DEFAULT false → 0
  })
})
