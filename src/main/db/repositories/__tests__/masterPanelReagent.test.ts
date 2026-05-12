import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { createTestDb, seedPlatformAndSpecies } from '../../__tests__/testDb'
import { setDatabaseForTests, resetDatabaseForTests } from '../../client'
import { masterPanelReagentRepository } from '../masterPanelReagent'
import type Database from 'better-sqlite3'

/**
 * Phase 13 D-06 repository tests for master_panel_reagents.
 *
 * NOTE: every `it.skip(...)` is intentional and is REQUIRED to be un-skipped
 * by Plan 13-03 Task 3 once the drizzle migration generates the
 * master_panel_reagents table + the master_panels delta. createTestDb()
 * runs migrate() against `drizzle/migrations` — without the new migration
 * the schema in the in-memory DB lacks the table these tests exercise.
 */
describe('masterPanelReagentRepository (Phase 13 D-06)', () => {
  let sqlite: Database.Database
  let platformId: string
  let speciesId: string
  let masterPanelId: string

  beforeEach(() => {
    const testDb = createTestDb()
    sqlite = testDb.sqlite
    setDatabaseForTests(testDb.db)
    const ids = seedPlatformAndSpecies(sqlite)
    platformId = ids.platformId
    speciesId = ids.speciesId

    // Seed one master_panel parent row (Plan 03 migration must already have run via testDb)
    masterPanelId = crypto.randomUUID()
    const now = new Date().toISOString()
    sqlite
      .prepare(
        `INSERT INTO master_panels (id, name, platform_id, species_id, sape_name, description, vendor_singles_term, created_at, updated_at)
         VALUES (?, 'Panel 1', ?, ?, NULL, NULL, NULL, ?, ?)`
      )
      .run(masterPanelId, platformId, speciesId, now, now)
  })

  afterEach(() => {
    resetDatabaseForTests()
    sqlite.close()
  })

  it.skip('T-1: create returns row with UUID id + ISO timestamps // Unskipped after Plan 13-03 migration lands', () => {
    const row = masterPanelReagentRepository.create({
      masterPanelId,
      reagentKind: 'beads',
      concentration: null,
      diluent: 'L-AB',
      volumePerWell: 0.025
    })
    expect(row.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)
    expect(row.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/)
    expect(row.updatedAt).toBe(row.createdAt)
  })

  it.skip('T-2: findByMasterPanelId returns all 3 reagent rows // Unskipped after Plan 13-03 migration lands', () => {
    masterPanelReagentRepository.create({
      masterPanelId,
      reagentKind: 'beads',
      concentration: null,
      diluent: 'L-AB',
      volumePerWell: 0.025
    })
    masterPanelReagentRepository.create({
      masterPanelId,
      reagentKind: 'antibodies',
      concentration: null,
      diluent: 'L-AB',
      volumePerWell: 0.025
    })
    masterPanelReagentRepository.create({
      masterPanelId,
      reagentKind: 'sape',
      concentration: 1,
      diluent: 'n/a',
      volumePerWell: 0.025
    })
    const rows = masterPanelReagentRepository.findByMasterPanelId(masterPanelId)
    expect(rows).toHaveLength(3)
    expect(rows.map((r) => r.reagentKind).sort()).toEqual(['antibodies', 'beads', 'sape'])
  })

  it.skip('T-3: getById returns row or null // Unskipped after Plan 13-03 migration lands', () => {
    const created = masterPanelReagentRepository.create({
      masterPanelId,
      reagentKind: 'beads',
      concentration: null,
      diluent: null,
      volumePerWell: 0.025
    })
    expect(masterPanelReagentRepository.getById(created.id)?.id).toBe(created.id)
    expect(masterPanelReagentRepository.getById('nonexistent-id')).toBeNull()
  })

  it.skip('T-4: deleteByMasterPanelId removes all rows + returns count // Unskipped after Plan 13-03 migration lands', () => {
    masterPanelReagentRepository.create({
      masterPanelId,
      reagentKind: 'beads',
      concentration: null,
      diluent: null,
      volumePerWell: 0.025
    })
    masterPanelReagentRepository.create({
      masterPanelId,
      reagentKind: 'sape',
      concentration: 1,
      diluent: 'n/a',
      volumePerWell: 0.025
    })
    const count = masterPanelReagentRepository.deleteByMasterPanelId(masterPanelId)
    expect(count).toBe(2)
    expect(masterPanelReagentRepository.findByMasterPanelId(masterPanelId)).toHaveLength(0)
    expect(masterPanelReagentRepository.deleteByMasterPanelId(masterPanelId)).toBe(0)
  })

  it.skip('T-5: composite UNIQUE on (master_panel_id, reagent_kind) rejects duplicate kind // Unskipped after Plan 13-03 migration lands', () => {
    masterPanelReagentRepository.create({
      masterPanelId,
      reagentKind: 'beads',
      concentration: null,
      diluent: null,
      volumePerWell: 0.025
    })
    expect(() =>
      masterPanelReagentRepository.create({
        masterPanelId,
        reagentKind: 'beads',
        concentration: null,
        diluent: null,
        volumePerWell: 0.05
      })
    ).toThrow(/UNIQUE constraint failed/)
  })

  it.skip('T-6: CHECK reagent_kind_enum rejects unknown reagent kind // Unskipped after Plan 13-03 migration lands', () => {
    expect(() =>
      masterPanelReagentRepository.create({
        masterPanelId,
        // @ts-expect-error: deliberately invalid kind for runtime CHECK enforcement
        reagentKind: 'foo',
        concentration: null,
        diluent: null,
        volumePerWell: 0.025
      })
    ).toThrow(/CHECK constraint failed/)
  })

  it.skip('T-7: CHECK sape_conc_not_null rejects null concentration on sape // Unskipped after Plan 13-03 migration lands', () => {
    expect(() =>
      masterPanelReagentRepository.create({
        masterPanelId,
        reagentKind: 'sape',
        concentration: null,
        diluent: 'n/a',
        volumePerWell: 0.025
      })
    ).toThrow(/CHECK constraint failed/)
  })

  it.skip('T-8: NULL concentration allowed for beads/antibodies (variable sentinel) // Unskipped after Plan 13-03 migration lands', () => {
    const r = masterPanelReagentRepository.create({
      masterPanelId,
      reagentKind: 'antibodies',
      concentration: null,
      diluent: 'L-AB',
      volumePerWell: 0.025
    })
    expect(r.concentration).toBeNull()
  })

  it.skip('T-9: NULL diluent allowed (open text empty case) // Unskipped after Plan 13-03 migration lands', () => {
    const r = masterPanelReagentRepository.create({
      masterPanelId,
      reagentKind: 'beads',
      concentration: null,
      diluent: null,
      volumePerWell: 0.025
    })
    expect(r.diluent).toBeNull()
  })

  it.skip('T-10: FK cascade — deleting parent master_panels row removes child reagent rows // Unskipped after Plan 13-03 migration lands', () => {
    masterPanelReagentRepository.create({
      masterPanelId,
      reagentKind: 'beads',
      concentration: null,
      diluent: null,
      volumePerWell: 0.025
    })
    masterPanelReagentRepository.create({
      masterPanelId,
      reagentKind: 'sape',
      concentration: 1,
      diluent: 'n/a',
      volumePerWell: 0.025
    })
    sqlite.prepare('DELETE FROM master_panels WHERE id = ?').run(masterPanelId)
    expect(masterPanelReagentRepository.findByMasterPanelId(masterPanelId)).toHaveLength(0)
  })
})
