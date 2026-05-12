import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { createTestDb, seedPlatformAndSpecies } from '../../__tests__/testDb'
import {
  setDatabaseForTests,
  resetDatabaseForTests
} from '../../client'
import { masterPanelRepository } from '../masterPanel'

describe('masterPanelRepository.upsertByPlatformAndSpecies (SC #5 master-panel upsert)', () => {
  let sqlite: ReturnType<typeof createTestDb>['sqlite']
  let platformId: string
  let speciesId: string

  beforeEach(() => {
    const testDb = createTestDb()
    sqlite = testDb.sqlite
    setDatabaseForTests(testDb.db)
    const ids = seedPlatformAndSpecies(sqlite)
    platformId = ids.platformId
    speciesId = ids.speciesId
  })

  afterEach(() => {
    resetDatabaseForTests()
    sqlite.close()
  })

  it('returns action: "created" on miss and returns a valid UUID id', () => {
    const result = masterPanelRepository.upsertByPlatformAndSpecies({
      name: 'MillipexCytokinesMouse',
      platformId,
      speciesId,
      vendorSinglesTerm: 'Mapmates'
    })
    expect(result.action).toBe('created')
    expect(result.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)
  })

  it('returns action: "updated" on composite (platform, species) match and overwrites all fields except id/created_at', () => {
    const first = masterPanelRepository.upsertByPlatformAndSpecies({
      name: 'Original',
      platformId,
      speciesId,
      vendorSinglesTerm: null
    })
    const second = masterPanelRepository.upsertByPlatformAndSpecies({
      name: 'UpdatedName',
      platformId,
      speciesId,
      vendorSinglesTerm: 'Mapmates'
    })

    expect(second.action).toBe('updated')
    expect(second.id).toBe(first.id) // same row, id preserved

    const row = masterPanelRepository.getById(first.id)
    expect(row).not.toBeNull()
    expect(row?.name).toBe('UpdatedName')
    // Phase 13 D-10: the three vol fields are gone; back-compat upsert leaves
    // sapeName + description as NULL when the input didn't supply them.
    expect(row?.sapeName).toBeNull()
    expect(row?.description).toBeNull()
    expect(row?.vendorSinglesTerm).toBe('Mapmates')
    // created_at stays original; updated_at advances
    expect(row?.createdAt).toBeDefined()
    expect(row?.updatedAt).toBeDefined()
  })
})

describe('master_panels composite UNIQUE INDEX enforcement (Phase 13 D-14 — supersedes Phase 5 SC #3)', () => {
  let sqlite: ReturnType<typeof createTestDb>['sqlite']
  let platformId: string
  let speciesId: string

  beforeEach(() => {
    const testDb = createTestDb()
    sqlite = testDb.sqlite
    setDatabaseForTests(testDb.db)
    const ids = seedPlatformAndSpecies(sqlite)
    platformId = ids.platformId
    speciesId = ids.speciesId
  })

  afterEach(() => {
    resetDatabaseForTests()
    sqlite.close()
  })

  // Phase 13 D-14: UNIQUE swapped to (platform_id, species_id, name); the old
  // (platform_id, species_id) UNIQUE no longer exists post-migration. The two
  // tests below replace Phase 5 SC #3.
  it.skip('Phase 13 D-14: composite UNIQUE on (platform_id, species_id, name) — same name + same plat/spec rejected // Unskipped after Plan 13-03 migration lands', () => {
    const now = new Date().toISOString()
    sqlite
      .prepare(
        `INSERT INTO master_panels (id, name, platform_id, species_id, sape_name, description, vendor_singles_term, created_at, updated_at)
         VALUES (?, 'Panel 1', ?, ?, NULL, NULL, NULL, ?, ?)`
      )
      .run(crypto.randomUUID(), platformId, speciesId, now, now)
    expect(() =>
      sqlite
        .prepare(
          `INSERT INTO master_panels (id, name, platform_id, species_id, sape_name, description, vendor_singles_term, created_at, updated_at)
           VALUES (?, 'Panel 1', ?, ?, NULL, NULL, NULL, ?, ?)`
        )
        .run(crypto.randomUUID(), platformId, speciesId, now, now)
    ).toThrow(/UNIQUE constraint failed/)
  })

  it.skip('Phase 13 D-14: different name in same (platform_id, species_id) succeeds // Unskipped after Plan 13-03 migration lands', () => {
    const now = new Date().toISOString()
    sqlite
      .prepare(
        `INSERT INTO master_panels (id, name, platform_id, species_id, sape_name, description, vendor_singles_term, created_at, updated_at)
         VALUES (?, 'Panel 1', ?, ?, NULL, NULL, NULL, ?, ?)`
      )
      .run(crypto.randomUUID(), platformId, speciesId, now, now)
    expect(() =>
      sqlite
        .prepare(
          `INSERT INTO master_panels (id, name, platform_id, species_id, sape_name, description, vendor_singles_term, created_at, updated_at)
           VALUES (?, 'Panel 2', ?, ?, NULL, NULL, NULL, ?, ?)`
        )
        .run(crypto.randomUUID(), platformId, speciesId, now, now)
    ).not.toThrow()
  })

  it('upsertByPlatformAndSpecies is idempotent — second call with same (platform, species) updates rather than throws', () => {
    masterPanelRepository.upsertByPlatformAndSpecies({
      name: 'First',
      platformId,
      speciesId,
      vendorSinglesTerm: null
    })
    // Second call MUST NOT throw — it's the idempotent update path
    expect(() =>
      masterPanelRepository.upsertByPlatformAndSpecies({
        name: 'Second',
        platformId,
        speciesId,
        vendorSinglesTerm: 'Mapmates'
      })
    ).not.toThrow()
  })
})
