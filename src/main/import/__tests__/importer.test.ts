/**
 * Phase 13 Plan 05 — importer integration tests.
 *
 * Covers MH-4 (wholesale-replace transaction + FK SET NULL + diluent verbatim
 * + rollback under forced error) and the cross-phase regression case (T-11)
 * that Phase 12 SMK3-16 snapshot-frozen run columns survive a wholesale-replace.
 *
 * NOTE on T-11 column choice: the original plan body cited `number_of_setups`
 * as a runs-table column. The actual Phase 12-03 design persists numberOfSetups
 * via the JSON-serialized `plates_json` snapshot (DB schema untouched per
 * 12-03 SUMMARY). T-11 here asserts on the real DB columns Phase 12 freezes:
 *   - dead_volume  (the derived `numberOfSetups × 2 mL` value at save time)
 *   - volume_per_well
 *   - plates_json  (carries the rest of the run snapshot including the
 *                   numberOfSetups field — encoded into the seed JSON below)
 * Rule 1 deviation: schema vs plan-body mismatch — plan-body documented an
 * intent (`number_of_setups`) that does not exist as a column; the equivalent
 * SMK3-16 invariant on the actual DB columns is what the test guards.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import * as XLSX from 'xlsx'
import * as path from 'path'
import * as os from 'os'
import * as fs from 'fs'
import { createTestDb, seedPlatformAndSpecies } from '../../db/__tests__/testDb'
import {
  setDatabaseForTests,
  setSqliteForTests,
  resetDatabaseForTests
} from '../../db/client'
import { importPanelData } from '../importer'
import { panelRepository } from '../../db/repositories/panel'
import type Database from 'better-sqlite3'

/** Build temp .xlsx + return path. */
function buildTempXlsx(sheets: { name: string; rows: unknown[][] }[]): string {
  const wb = XLSX.utils.book_new()
  for (const s of sheets)
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(s.rows), s.name)
  const tmp = path.join(
    os.tmpdir(),
    `importer-test-${Date.now()}-${Math.random().toString(36).slice(2)}.xlsx`
  )
  XLSX.writeFile(wb, tmp)
  return tmp
}

const VALID_PANEL_ROWS: unknown[][] = [
  ['Criteria'],
  ['Platform', 'TestPlatform'],
  ['Species', 'TestSpecies'],
  ['Panel', 'Panel 1'],
  ['Panel Description', 'Cytokines'],
  [],
  ['Values'],
  ['Reagent Description', 'Concentration', 'Diluent', 'Volume/well (ml)'],
  ['Beads', 'variable', 'L-AB', 0.025],
  ['Antibodies', 'variable', 'L-AB', 0.025],
  ['SAPE', 1, 'n/a', 0.025],
  ['SAPE Name', 'Streptavidin-PE'],
  [],
  ['Category'],
  [null, null, null, null, 'Premix Name', 'Premix A'],
  ['Single Analytes', null, null, null, 'Premix Concentration', 1],
  ['Analyte', 'Bead Region', 'Concentration', null, 'Count', 'Analyte'],
  ['IL-6', 12, 50, null, 1, 'IL-6'],
  ['IL-10', 13, 50, null, 2, 'IL-10']
]

describe('importPanelData (Phase 13 wholesale-replace transaction)', () => {
  let sqlite: Database.Database
  let platformId: string
  let speciesId: string
  const tmpPaths: string[] = []

  beforeEach(() => {
    const testDb = createTestDb()
    sqlite = testDb.sqlite
    setDatabaseForTests(testDb.db)
    setSqliteForTests(testDb.sqlite)
    const ids = seedPlatformAndSpecies(sqlite)
    platformId = ids.platformId
    speciesId = ids.speciesId
  })

  afterEach(() => {
    vi.restoreAllMocks()
    resetDatabaseForTests()
    sqlite.close()
    for (const p of tmpPaths) {
      try {
        fs.unlinkSync(p)
      } catch {
        /* ignore */
      }
    }
    tmpPaths.length = 0
  })

  function mkTmp(sheets: { name: string; rows: unknown[][] }[]): string {
    const p = buildTempXlsx(sheets)
    tmpPaths.push(p)
    return p
  }

  it('T-1: insert-fresh creates 1 master_panel + 3 reagents + 2 analytes + 1 premix', () => {
    const tmpPath = mkTmp([{ name: 'TestPlat Panel 1', rows: VALID_PANEL_ROWS }])
    const result = importPanelData(tmpPath)
    expect(result.success).toBe(true)
    expect(result.summaries).toHaveLength(1)
    expect(result.summaries[0].analyteCount).toBe(2)
    expect(result.summaries[0].premixCount).toBe(1)
    expect(result.summaries[0].sapeName).toBe('Streptavidin-PE')
    expect(result.summaries[0].wasUpdate).toBe(false)

    const mpCount = (
      sqlite.prepare('SELECT COUNT(*) AS c FROM master_panels').get() as { c: number }
    ).c
    const reagentCount = (
      sqlite
        .prepare('SELECT COUNT(*) AS c FROM master_panel_reagents')
        .get() as { c: number }
    ).c
    const analyteCount = (
      sqlite.prepare('SELECT COUNT(*) AS c FROM analytes').get() as { c: number }
    ).c
    const premixCount = (
      sqlite.prepare('SELECT COUNT(*) AS c FROM premix_panels').get() as { c: number }
    ).c
    expect(mpCount).toBe(1)
    expect(reagentCount).toBe(3)
    expect(analyteCount).toBe(2)
    expect(premixCount).toBe(1)
  })

  it('T-2: re-upload wholesale-replaces; master_panels row count unchanged; master.id preserved; analytes get new UUIDs', () => {
    const tmpPath = mkTmp([{ name: 'sheetA', rows: VALID_PANEL_ROWS }])
    importPanelData(tmpPath)
    const mp1 = (
      sqlite.prepare('SELECT id FROM master_panels').get() as { id: string }
    ).id
    const analyteIdsBefore = (
      sqlite
        .prepare('SELECT id FROM analytes ORDER BY name')
        .all() as { id: string }[]
    ).map((r) => r.id)

    const result2 = importPanelData(tmpPath)
    expect(result2.success).toBe(true)
    expect(result2.summaries[0].wasUpdate).toBe(true)

    const mp2 = (
      sqlite.prepare('SELECT id FROM master_panels').get() as { id: string }
    ).id
    expect(mp2).toBe(mp1)

    // master_panels row count unchanged (D-12 wholesale-replace, no duplicates)
    const mpCountAfter = (
      sqlite.prepare('SELECT COUNT(*) AS c FROM master_panels').get() as { c: number }
    ).c
    expect(mpCountAfter).toBe(1)

    const analyteIdsAfter = (
      sqlite
        .prepare('SELECT id FROM analytes ORDER BY name')
        .all() as { id: string }[]
    ).map((r) => r.id)
    expect(analyteIdsAfter).toHaveLength(2)
    for (const oldId of analyteIdsBefore) {
      expect(analyteIdsAfter).not.toContain(oldId)
    }
  })

  it('T-3: re-upload with extra analyte adds one row (total = N+1, no orphans from old set)', () => {
    const tmpPath = mkTmp([{ name: 'sheetA', rows: VALID_PANEL_ROWS }])
    importPanelData(tmpPath)
    const extendedRows: unknown[][] = [...VALID_PANEL_ROWS, ['IL-1', 14, 50, null, null, null]]
    const tmpPath2 = mkTmp([{ name: 'sheetA', rows: extendedRows }])
    importPanelData(tmpPath2)
    const analyteCount = (
      sqlite.prepare('SELECT COUNT(*) AS c FROM analytes').get() as { c: number }
    ).c
    expect(analyteCount).toBe(3)
  })

  it('T-4: FK SET NULL on runs.panel_id after wholesale-replace (D-15)', () => {
    const tmpPath = mkTmp([{ name: 'sheetA', rows: VALID_PANEL_ROWS }])
    importPanelData(tmpPath)
    const premixId = (
      sqlite.prepare('SELECT id FROM premix_panels').get() as { id: string }
    ).id

    const now = new Date().toISOString()
    const operatorId = crypto.randomUUID()
    sqlite
      .prepare(
        'INSERT INTO operators (id, name, active, created_at, updated_at) VALUES (?, ?, 1, ?, ?)'
      )
      .run(operatorId, 'Op', now, now)
    const runId = crypto.randomUUID()
    sqlite
      .prepare(
        `INSERT INTO runs (id, request_override_ad_hoc, user_name, operator_id, run_date, sample_type, dilution_factor, sample_count, replicate_mode, request_type, platform_id, species_id, panel_id, volume_per_well, dead_volume, hamilton, run_plate_position, standard_position, trough_position, plex, plate_count, plates_json, is_offline_save, created_at, updated_at)
         VALUES (?, 0, 'tester', ?, '2026-05-12', 'Serum', 1, 24, 'singles', 'premix', ?, ?, ?, 25, 2000, 1, 1, 1, 1, 5, 1, '{}', 0, ?, ?)`
      )
      .run(runId, operatorId, platformId, speciesId, premixId, now, now)

    importPanelData(tmpPath)
    const runAfter = sqlite
      .prepare('SELECT panel_id FROM runs WHERE id = ?')
      .get(runId) as { panel_id: string | null }
    expect(runAfter.panel_id).toBeNull()
  })

  it('T-5: FK SET NULL on run_single_analytes.analyte_id after wholesale-replace (D-17)', () => {
    const tmpPath = mkTmp([{ name: 'sheetA', rows: VALID_PANEL_ROWS }])
    importPanelData(tmpPath)
    const analyteId = (
      sqlite
        .prepare("SELECT id FROM analytes WHERE name = 'IL-6'")
        .get() as { id: string }
    ).id
    const premixId = (
      sqlite.prepare('SELECT id FROM premix_panels').get() as { id: string }
    ).id

    const now = new Date().toISOString()
    const operatorId = crypto.randomUUID()
    sqlite
      .prepare(
        'INSERT INTO operators (id, name, active, created_at, updated_at) VALUES (?, ?, 1, ?, ?)'
      )
      .run(operatorId, 'Op', now, now)
    const runId = crypto.randomUUID()
    sqlite
      .prepare(
        `INSERT INTO runs (id, request_override_ad_hoc, user_name, operator_id, run_date, sample_type, dilution_factor, sample_count, replicate_mode, request_type, platform_id, species_id, panel_id, volume_per_well, dead_volume, hamilton, run_plate_position, standard_position, trough_position, plex, plate_count, plates_json, is_offline_save, created_at, updated_at)
         VALUES (?, 0, 'tester', ?, '2026-05-12', 'Serum', 1, 24, 'singles', 'premix', ?, ?, ?, 25, 2000, 1, 1, 1, 1, 5, 1, '{}', 0, ?, ?)`
      )
      .run(runId, operatorId, platformId, speciesId, premixId, now, now)
    const rsaId = crypto.randomUUID()
    sqlite
      .prepare(
        'INSERT INTO run_single_analytes (id, run_id, analyte_id, created_at) VALUES (?, ?, ?, ?)'
      )
      .run(rsaId, runId, analyteId, now)

    importPanelData(tmpPath)
    const rsaAfter = sqlite
      .prepare('SELECT analyte_id FROM run_single_analytes WHERE id = ?')
      .get(rsaId) as { analyte_id: string | null }
    expect(rsaAfter.analyte_id).toBeNull()
  })

  it('T-6: rolls back all writes if any sheet fails mid-import (MANDATORY rollback gate)', () => {
    // Build a 2-panel xlsx; force the SECOND panel's premix create to throw mid-transaction.
    const panel2Rows: unknown[][] = VALID_PANEL_ROWS.map((r, i) =>
      i === 3 ? ['Panel', 'Panel 2'] : r
    )
    const tmpPath = mkTmp([
      { name: 'sheetA', rows: VALID_PANEL_ROWS },
      { name: 'sheetB', rows: panel2Rows }
    ])

    // Spy: throw on the SECOND panelRepository.create call (the second panel's premix INSERT).
    let createCallCount = 0
    const origCreate = panelRepository.create.bind(panelRepository)
    vi.spyOn(panelRepository, 'create').mockImplementation(
      (...args: Parameters<typeof origCreate>) => {
        createCallCount++
        if (createCallCount === 2) throw new Error('forced failure on second panel')
        return origCreate(...args)
      }
    )

    const result = importPanelData(tmpPath)
    expect(result.success).toBe(false)
    expect(
      result.errors.some((e) => e.issues.some((i) => /forced failure/.test(i)))
    ).toBe(true)

    // Assert NO partial writes: zero master_panels + zero reagents + zero analytes + zero premixes.
    const masterCount = (
      sqlite.prepare('SELECT COUNT(*) AS c FROM master_panels').get() as { c: number }
    ).c
    expect(masterCount).toBe(0)
    const reagentCount = (
      sqlite
        .prepare('SELECT COUNT(*) AS c FROM master_panel_reagents')
        .get() as { c: number }
    ).c
    expect(reagentCount).toBe(0)
    const analyteCount = (
      sqlite.prepare('SELECT COUNT(*) AS c FROM analytes').get() as { c: number }
    ).c
    expect(analyteCount).toBe(0)
    const premixCount = (
      sqlite.prepare('SELECT COUNT(*) AS c FROM premix_panels').get() as { c: number }
    ).c
    expect(premixCount).toBe(0)
  })

  it('T-7: diluent stored verbatim (SMK3-DIL-01)', () => {
    const tmpPath = mkTmp([{ name: 'sheetA', rows: VALID_PANEL_ROWS }])
    importPanelData(tmpPath)
    const rows = sqlite
      .prepare(
        'SELECT reagent_kind, diluent FROM master_panel_reagents ORDER BY reagent_kind'
      )
      .all() as { reagent_kind: string; diluent: string | null }[]
    const beadsDiluent = rows.find((r) => r.reagent_kind === 'beads')?.diluent
    const sapeDiluent = rows.find((r) => r.reagent_kind === 'sape')?.diluent
    expect(beadsDiluent).toBe('L-AB')
    expect(sapeDiluent).toBe('n/a')
  })

  it('T-8: pre-Smoke-3 v0.7.0 premix rows are UNTOUCHED by wholesale-replace', () => {
    const now = new Date().toISOString()
    const legacyPremixId = crypto.randomUUID()
    sqlite
      .prepare(
        `INSERT INTO premix_panels (id, name, platform_id, species_id, master_panel_id, parent_panel_id, sub_panel_conc, created_at, updated_at)
         VALUES (?, 'Legacy Premix', ?, ?, NULL, NULL, 1, ?, ?)`
      )
      .run(legacyPremixId, platformId, speciesId, now, now)

    const tmpPath = mkTmp([{ name: 'sheetA', rows: VALID_PANEL_ROWS }])
    importPanelData(tmpPath)

    const legacyAfter = sqlite
      .prepare('SELECT id, master_panel_id FROM premix_panels WHERE id = ?')
      .get(legacyPremixId) as { id: string; master_panel_id: string | null }
    expect(legacyAfter).toBeDefined()
    expect(legacyAfter.master_panel_id).toBeNull()
  })

  it('T-9: validation failure → zero panel DB writes', () => {
    // Phase 16 (v1.0): unknown platform/species in xlsx is no longer a failure
    // mode — the importer upserts platforms/species from xlsx content so
    // empty-DB launches can populate FK targets on first import. Other
    // validation failures (SAPE non-numeric, premix-member missing,
    // cross-sheet duplicate normalize) still reject + roll back panel writes.
    // This test uses SAPE-non-numeric to trigger validation failure and assert
    // zero rows reach the master_panels table.
    const badRows: unknown[][] = VALID_PANEL_ROWS.map((r, i) =>
      i === 10 ? ['SAPE', 'variable', 'n/a', 0.025] : r
    )
    const tmpPath = mkTmp([{ name: 'sheetA', rows: badRows }])
    const result = importPanelData(tmpPath)
    expect(result.success).toBe(false)
    const mpCount = (
      sqlite.prepare('SELECT COUNT(*) AS c FROM master_panels').get() as { c: number }
    ).c
    expect(mpCount).toBe(0)
  })

  it('T-12: Phase 16 — xlsx-only platform/species upserted to empty DB', () => {
    // App opens with no seeded platforms/species (Phase 16 / v1.0). xlsx import
    // creates them on-the-fly so the operator can go from empty to fully
    // populated in one import action.
    sqlite.exec('DELETE FROM species; DELETE FROM platforms;')
    const beforeP = (
      sqlite.prepare('SELECT COUNT(*) AS c FROM platforms').get() as { c: number }
    ).c
    const beforeS = (
      sqlite.prepare('SELECT COUNT(*) AS c FROM species').get() as { c: number }
    ).c
    expect(beforeP).toBe(0)
    expect(beforeS).toBe(0)

    const tmpPath = mkTmp([{ name: 'TestPlat Panel 1', rows: VALID_PANEL_ROWS }])
    const result = importPanelData(tmpPath)
    expect(result.success).toBe(true)

    const platformRow = sqlite
      .prepare('SELECT name FROM platforms WHERE name = ?')
      .get('TestPlatform') as { name: string } | undefined
    expect(platformRow?.name).toBe('TestPlatform')

    const speciesRow = sqlite
      .prepare('SELECT name FROM species WHERE name = ?')
      .get('TestSpecies') as { name: string } | undefined
    expect(speciesRow?.name).toBe('TestSpecies')
  })

  it('T-10: D-21 cross-sheet collision → zero DB writes + verbatim error', () => {
    const sheet1: unknown[][] = VALID_PANEL_ROWS.map((r, i) =>
      i === 3 ? ['Panel', 'Panel I'] : r
    )
    const sheet2: unknown[][] = VALID_PANEL_ROWS.map((r, i) =>
      i === 3 ? ['Panel', 'Panel 1'] : r
    )
    const tmpPath = mkTmp([
      { name: 'RomanSheet', rows: sheet1 },
      { name: 'ArabicSheet', rows: sheet2 }
    ])
    const result = importPanelData(tmpPath)
    expect(result.success).toBe(false)
    expect(
      result.errors.some((e) =>
        e.issues.some((i) => /normalize to the same/.test(i))
      )
    ).toBe(true)
    const mpCount = (
      sqlite.prepare('SELECT COUNT(*) AS c FROM master_panels').get() as { c: number }
    ).c
    expect(mpCount).toBe(0)
  })

  it('T-11: Phase 12 SMK3-16 cross-phase regression — loadRun-relevant run columns survive wholesale-replace', () => {
    // Seed run → wholesale-replace → assert
    //   (a) panel_id IS NULL (D-15)
    //   (b) Phase 12 snapshot-frozen columns dead_volume + volume_per_well + plates_json
    //       UNCHANGED. plates_json embeds numberOfSetups per Phase 12-03 (the column-level
    //       SMK3-16 invariant — the actual numberOfSetups field round-trips through this
    //       JSON since 12-03 did NOT add a runs.number_of_setups column).
    const tmpPath = mkTmp([{ name: 'sheetA', rows: VALID_PANEL_ROWS }])
    importPanelData(tmpPath)
    const premixId = (
      sqlite.prepare('SELECT id FROM premix_panels').get() as { id: string }
    ).id

    const now = new Date().toISOString()
    const operatorId = crypto.randomUUID()
    sqlite
      .prepare(
        'INSERT INTO operators (id, name, active, created_at, updated_at) VALUES (?, ?, 1, ?, ?)'
      )
      .run(operatorId, 'Op', now, now)
    const runId = crypto.randomUUID()
    // Phase 12 SMK3-16 invariant: dead_volume = numberOfSetups × 2000 µL; numberOfSetups
    // itself rides in plates_json (per useRunSnapshot.ts).
    const SETUPS = 7
    const DEAD_VOLUME = SETUPS * 2000 // 14000 µL
    const VPW = 50
    const PLATES_JSON = JSON.stringify({
      numberOfSetups: SETUPS,
      plates: { 1: ['A1', 'B1', 'C1'] }
    })
    sqlite
      .prepare(
        `INSERT INTO runs (id, request_override_ad_hoc, user_name, operator_id, run_date, sample_type, dilution_factor, sample_count, replicate_mode, request_type, platform_id, species_id, panel_id, volume_per_well, dead_volume, hamilton, run_plate_position, standard_position, trough_position, plex, plate_count, plates_json, is_offline_save, created_at, updated_at)
         VALUES (?, 0, 'tester', ?, '2026-05-12', 'Serum', 1, 24, 'singles', 'premix', ?, ?, ?, ?, ?, 1, 1, 1, 1, 5, 1, ?, 0, ?, ?)`
      )
      .run(
        runId,
        operatorId,
        platformId,
        speciesId,
        premixId,
        VPW,
        DEAD_VOLUME,
        PLATES_JSON,
        now,
        now
      )

    // Re-import wholesale-replaces (D-15 nulls panel_id on the seeded run)
    importPanelData(tmpPath)

    const runAfter = sqlite
      .prepare(
        'SELECT panel_id, dead_volume, volume_per_well, plates_json FROM runs WHERE id = ?'
      )
      .get(runId) as {
      panel_id: string | null
      dead_volume: number
      volume_per_well: number
      plates_json: string
    }

    // D-15: panel_id nulled
    expect(runAfter.panel_id).toBeNull()
    // Phase 12 SMK3-16: snapshot-frozen columns intact (runStore.loadRun would still
    // return identical values; numberOfSetups embedded in plates_json round-trips)
    expect(runAfter.dead_volume).toBe(DEAD_VOLUME)
    expect(runAfter.volume_per_well).toBe(VPW)
    expect(runAfter.plates_json).toBe(PLATES_JSON)
    // Demonstrate the numberOfSetups field actually survives the JSON round-trip
    expect(JSON.parse(runAfter.plates_json).numberOfSetups).toBe(SETUPS)
  })
})
