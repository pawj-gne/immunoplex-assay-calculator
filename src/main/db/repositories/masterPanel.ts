import { eq, and } from 'drizzle-orm'
import { getDatabase } from '../client'
import { masterPanels } from '../schema'
import type {
  MasterPanel,
  MasterPanelUpsertInput,
  UpsertResult
} from '../../../shared/types/masterPanel'

export const masterPanelRepository = {
  /**
   * Find a master_panel by exact (platform_id, species_id) composite. IDs are
   * normalized UUIDs — NO case-insensitive matching (D-16). Returns null if
   * no row matches.
   */
  findByPlatformAndSpecies(platformId: string, speciesId: string): MasterPanel | null {
    const db = getDatabase()
    const result = db
      .select()
      .from(masterPanels)
      .where(
        and(eq(masterPanels.platformId, platformId), eq(masterPanels.speciesId, speciesId))
      )
      .get()
    return (result as MasterPanel | undefined) ?? null
  },

  /**
   * Upsert a master_panel keyed on (platform_id, species_id) composite.
   * - On match => UPDATE all fields except id and created_at; action: 'updated'.
   * - On miss  => INSERT with new crypto.randomUUID() id; action: 'created'.
   * Never throws on the 'updated' case; better-sqlite3 surfaces native errors
   * (UNIQUE, FK) on schema violations. Does NOT open a transaction — Phase 7
   * importer owns transaction scope (D-18).
   */
  upsertByPlatformAndSpecies(input: MasterPanelUpsertInput): UpsertResult {
    const db = getDatabase()
    const now = new Date().toISOString()

    const existing = masterPanelRepository.findByPlatformAndSpecies(
      input.platformId,
      input.speciesId
    )

    if (existing) {
      db.update(masterPanels)
        .set({
          name: input.name,
          beadsVolumePerWell: input.beadsVolumePerWell,
          abVolumePerWell: input.abVolumePerWell,
          sapeVolumePerWell: input.sapeVolumePerWell,
          vendorSinglesTerm: input.vendorSinglesTerm ?? null,
          updatedAt: now
        })
        .where(eq(masterPanels.id, existing.id))
        .run()
      return { id: existing.id, action: 'updated' }
    }

    const id = crypto.randomUUID()
    db.insert(masterPanels)
      .values({
        id,
        name: input.name,
        platformId: input.platformId,
        speciesId: input.speciesId,
        beadsVolumePerWell: input.beadsVolumePerWell,
        abVolumePerWell: input.abVolumePerWell,
        sapeVolumePerWell: input.sapeVolumePerWell,
        vendorSinglesTerm: input.vendorSinglesTerm ?? null,
        createdAt: now,
        updatedAt: now
      })
      .run()
    return { id, action: 'created' }
  },

  getById(id: string): MasterPanel | null {
    const db = getDatabase()
    const result = db.select().from(masterPanels).where(eq(masterPanels.id, id)).get()
    return (result as MasterPanel | undefined) ?? null
  }
}
