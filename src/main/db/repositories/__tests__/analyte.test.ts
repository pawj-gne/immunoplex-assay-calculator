import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { createTestDb, seedPlatformAndSpecies } from '../../__tests__/testDb'
import {
  setDatabaseForTests,
  resetDatabaseForTests
} from '../../client'
import { analyteRepository } from '../analyte'
import { masterPanelRepository } from '../masterPanel'

describe('analyteRepository.upsertByNameInMaster (SC #5 — Pitfall-1 critical adoption gate)', () => {
  let sqlite: ReturnType<typeof createTestDb>['sqlite']
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

    const mp = masterPanelRepository.upsertByPlatformAndSpecies({
      name: 'TestPanel',
      platformId,
      speciesId,
      beadsVolumePerWell: 25,
      abVolumePerWell: 25,
      sapeVolumePerWell: 25,
      vendorSinglesTerm: null
    })
    masterPanelId = mp.id
  })

  afterEach(() => {
    resetDatabaseForTests()
    sqlite.close()
  })

  it('action: "created" when no existing row matches (name, platform, species)', () => {
    const result = analyteRepository.upsertByNameInMaster({
      name: 'IL-6',
      platformId,
      speciesId,
      masterPanelId,
      beadRegion: 12,
      concentration: 50
    })
    expect(result.action).toBe('created')
    expect(result.id).toMatch(/^[0-9a-f]{8}-/i)

    const rows = sqlite
      .prepare('SELECT id, name, master_panel_id, premix_conc, single_conc FROM analytes WHERE name = ?')
      .all('IL-6') as Array<{ id: string; name: string; master_panel_id: string; premix_conc: number; single_conc: number }>
    expect(rows.length).toBe(1)
    expect(rows[0].master_panel_id).toBe(masterPanelId)
    // D-22: INSERT path mirrors concentration into BOTH columns
    expect(rows[0].premix_conc).toBe(50)
    expect(rows[0].single_conc).toBe(50)
  })

  it('action: "adopted" — matches existing v1 row with master_panel_id IS NULL, sets FK WITHOUT creating duplicate (Pitfall-1 gate)', () => {
    // Seed a v1-shape analyte row directly (no master_panel_id — that's the v1 adoption target)
    const v1AnalyteId = crypto.randomUUID()
    const now = new Date().toISOString()
    sqlite
      .prepare(
        `INSERT INTO analytes (id, name, bead_region, premix_conc, single_conc, platform_id, species_id, master_panel_id, created_at, updated_at)
         VALUES (?, 'IL-6', 12, 99, 99, ?, ?, NULL, ?, ?)`
      )
      .run(v1AnalyteId, platformId, speciesId, now, now)

    const countBefore = (
      sqlite.prepare('SELECT COUNT(*) AS c FROM analytes').get() as { c: number }
    ).c
    expect(countBefore).toBe(1)

    const result = analyteRepository.upsertByNameInMaster({
      name: 'IL-6',
      platformId,
      speciesId,
      masterPanelId,
      beadRegion: 15, // different from seed
      concentration: 55 // different from seed
    })

    expect(result.action).toBe('adopted')
    expect(result.id).toBe(v1AnalyteId) // NO new row

    const countAfter = (
      sqlite.prepare('SELECT COUNT(*) AS c FROM analytes').get() as { c: number }
    ).c
    expect(countAfter).toBe(1) // critical: no duplicate created (Pitfall-1)

    const adopted = sqlite
      .prepare('SELECT name, master_panel_id, bead_region, premix_conc, single_conc FROM analytes WHERE id = ?')
      .get(v1AnalyteId) as { name: string; master_panel_id: string; bead_region: number; premix_conc: number; single_conc: number }
    expect(adopted.master_panel_id).toBe(masterPanelId)
    expect(adopted.bead_region).toBe(15) // updated
    expect(adopted.single_conc).toBe(55) // updated
    expect(adopted.premix_conc).toBe(99) // D-17: UPDATE path NEVER touches premix_conc — stays at seed value
  })

  it('action: "updated" when matching row already has master_panel_id set (re-import)', () => {
    // First upsert: creates with master_panel_id set
    const first = analyteRepository.upsertByNameInMaster({
      name: 'IL-6',
      platformId,
      speciesId,
      masterPanelId,
      beadRegion: 12,
      concentration: 50
    })
    expect(first.action).toBe('created')

    // Second upsert: same row, already has master_panel_id => 'updated'
    const second = analyteRepository.upsertByNameInMaster({
      name: 'IL-6',
      platformId,
      speciesId,
      masterPanelId,
      beadRegion: 99,
      concentration: 77
    })
    expect(second.action).toBe('updated')
    expect(second.id).toBe(first.id) // same row
  })

  it('case-insensitive match: "IL-6" and "il-6" collapse to one row', () => {
    analyteRepository.upsertByNameInMaster({
      name: 'IL-6',
      platformId,
      speciesId,
      masterPanelId,
      beadRegion: 12,
      concentration: 50
    })
    const second = analyteRepository.upsertByNameInMaster({
      name: 'il-6', // different case
      platformId,
      speciesId,
      masterPanelId,
      beadRegion: 13,
      concentration: 51
    })
    expect(second.action).toBe('updated')

    const count = (
      sqlite.prepare('SELECT COUNT(*) AS c FROM analytes').get() as { c: number }
    ).c
    expect(count).toBe(1) // single row, no duplicate

    // D-17: UPDATE path does NOT overwrite name — original casing wins
    const row = sqlite
      .prepare('SELECT name FROM analytes WHERE id = ?')
      .get(second.id) as { name: string }
    expect(row.name).toBe('IL-6')
  })

  it('UPDATE path never touches premix_conc (D-17 + D-22 regression guard)', () => {
    // Seed v1 row with premix_conc = 999 (sentinel — must survive)
    const v1Id = crypto.randomUUID()
    const now = new Date().toISOString()
    sqlite
      .prepare(
        `INSERT INTO analytes (id, name, bead_region, premix_conc, single_conc, platform_id, species_id, master_panel_id, created_at, updated_at)
         VALUES (?, 'TNF-a', 20, 999, 999, ?, ?, NULL, ?, ?)`
      )
      .run(v1Id, platformId, speciesId, now, now)

    analyteRepository.upsertByNameInMaster({
      name: 'TNF-a',
      platformId,
      speciesId,
      masterPanelId,
      beadRegion: 21,
      concentration: 25
    })

    const row = sqlite
      .prepare('SELECT premix_conc, single_conc FROM analytes WHERE id = ?')
      .get(v1Id) as { premix_conc: number; single_conc: number }
    expect(row.premix_conc).toBe(999) // D-17: untouched
    expect(row.single_conc).toBe(25)  // updated per D-04
  })

  it('INSERT path writes premix_conc = input.concentration (D-22)', () => {
    const result = analyteRepository.upsertByNameInMaster({
      name: 'IFN-g',
      platformId,
      speciesId,
      masterPanelId,
      beadRegion: 30,
      concentration: 42
    })
    expect(result.action).toBe('created')

    const row = sqlite
      .prepare('SELECT premix_conc, single_conc FROM analytes WHERE id = ?')
      .get(result.id) as { premix_conc: number; single_conc: number }
    expect(row.premix_conc).toBe(42)
    expect(row.single_conc).toBe(42)
  })
})
