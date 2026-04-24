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
      beadsVolumePerWell: 25,
      abVolumePerWell: 25,
      sapeVolumePerWell: 25,
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
      beadsVolumePerWell: 10,
      abVolumePerWell: 10,
      sapeVolumePerWell: 10,
      vendorSinglesTerm: null
    })
    const second = masterPanelRepository.upsertByPlatformAndSpecies({
      name: 'UpdatedName',
      platformId,
      speciesId,
      beadsVolumePerWell: 50,
      abVolumePerWell: 50,
      sapeVolumePerWell: 50,
      vendorSinglesTerm: 'Mapmates'
    })

    expect(second.action).toBe('updated')
    expect(second.id).toBe(first.id) // same row, id preserved

    const row = masterPanelRepository.getById(first.id)
    expect(row).not.toBeNull()
    expect(row?.name).toBe('UpdatedName')
    expect(row?.beadsVolumePerWell).toBe(50)
    expect(row?.abVolumePerWell).toBe(50)
    expect(row?.sapeVolumePerWell).toBe(50)
    expect(row?.vendorSinglesTerm).toBe('Mapmates')
    // created_at stays original; updated_at advances
    expect(row?.createdAt).toBeDefined()
    expect(row?.updatedAt).toBeDefined()
  })
})

describe('master_panels composite UNIQUE INDEX enforcement (SC #3)', () => {
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

  it('rejects a direct INSERT of a second row with identical (platform_id, species_id)', () => {
    const now = new Date().toISOString()
    sqlite
      .prepare(
        `INSERT INTO master_panels
         (id, name, platform_id, species_id, beads_volume_per_well, ab_volume_per_well, sape_volume_per_well, vendor_singles_term, created_at, updated_at)
         VALUES (?, 'First', ?, ?, 25, 25, 25, NULL, ?, ?)`
      )
      .run(crypto.randomUUID(), platformId, speciesId, now, now)

    expect(() =>
      sqlite
        .prepare(
          `INSERT INTO master_panels
           (id, name, platform_id, species_id, beads_volume_per_well, ab_volume_per_well, sape_volume_per_well, vendor_singles_term, created_at, updated_at)
           VALUES (?, 'Duplicate', ?, ?, 25, 25, 25, NULL, ?, ?)`
        )
        .run(crypto.randomUUID(), platformId, speciesId, now, now)
    ).toThrow(/UNIQUE constraint failed/)
  })

  it('upsertByPlatformAndSpecies is idempotent — second call with same (platform, species) updates rather than throws', () => {
    masterPanelRepository.upsertByPlatformAndSpecies({
      name: 'First',
      platformId,
      speciesId,
      beadsVolumePerWell: 25,
      abVolumePerWell: 25,
      sapeVolumePerWell: 25,
      vendorSinglesTerm: null
    })
    // Second call MUST NOT throw — it's the idempotent update path
    expect(() =>
      masterPanelRepository.upsertByPlatformAndSpecies({
        name: 'Second',
        platformId,
        speciesId,
        beadsVolumePerWell: 50,
        abVolumePerWell: 50,
        sapeVolumePerWell: 50,
        vendorSinglesTerm: 'Mapmates'
      })
    ).not.toThrow()
  })
})
