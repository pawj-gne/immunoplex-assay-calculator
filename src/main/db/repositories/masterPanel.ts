import { eq, and } from 'drizzle-orm'
import { getDatabase } from '../client'
import { masterPanels } from '../schema'
import type {
  MasterPanel,
  MasterPanelUpsertInput,
  UpsertResult
} from '../../../shared/types/masterPanel'
import { masterPanelReagentRepository } from './masterPanelReagent'
import type { MasterPanelReagent } from '../../../shared/types/masterPanelReagent'

export const masterPanelRepository = {
  /**
   * Find a master_panel by exact (platform_id, species_id) composite. IDs are
   * normalized UUIDs — NO case-insensitive matching (D-16). Returns null if
   * no row matches.
   *
   * NOTE (Phase 13 D-14): the underlying composite UNIQUE on master_panels is
   * now (platform_id, species_id, name); the (platform_id, species_id) pair is
   * NO LONGER unique. This method still returns the FIRST matching row for
   * v0.7.0 back-compat callers, but new Smoke 3 paths should call
   * findByPlatformSpeciesName instead.
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
   * Phase 13 D-13 lookup: composite (platform_id, species_id, name).
   * `name` is the NORMALIZED form (D-18) — exact match, not case-insensitive.
   */
  findByPlatformSpeciesName(
    platformId: string,
    speciesId: string,
    normalizedName: string
  ): MasterPanel | null {
    const db = getDatabase()
    const result = db
      .select()
      .from(masterPanels)
      .where(
        and(
          eq(masterPanels.platformId, platformId),
          eq(masterPanels.speciesId, speciesId),
          eq(masterPanels.name, normalizedName)
        )
      )
      .get()
    return (result as MasterPanel | undefined) ?? null
  },

  /**
   * Upsert a master_panel keyed on (platform_id, species_id) composite.
   * - On match => UPDATE name + vendorSinglesTerm + updatedAt; action: 'updated'.
   * - On miss  => INSERT with new crypto.randomUUID() id; action: 'created'.
   *
   * Phase 13 (D-10): the three per-reagent volume columns are gone from
   * master_panels; this method no longer accepts/writes them. v0.7.0
   * back-compat only — new Smoke 3 callers use createWithMetadata / updateMetadata.
   * Does NOT open a transaction — Phase 7 importer owns transaction scope (D-18).
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
          sapeName: input.sapeName ?? null,
          description: input.description ?? null,
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
        sapeName: input.sapeName ?? null,
        description: input.description ?? null,
        vendorSinglesTerm: input.vendorSinglesTerm ?? null,
        createdAt: now,
        updatedAt: now
      })
      .run()
    return { id, action: 'created' }
  },

  /**
   * Phase 13 D-12: create a new master_panel with Smoke 3 metadata.
   * vendorSinglesTerm always null in Phase 13 (D-11); preserved for v0.7.0 callers.
   * Does NOT open a transaction — importer owns scope.
   */
  createWithMetadata(input: {
    platformId: string
    speciesId: string
    name: string
    description: string | null
    sapeName: string | null
    vendorSinglesTerm?: string | null
  }): MasterPanel {
    const db = getDatabase()
    const id = crypto.randomUUID()
    const now = new Date().toISOString()
    const row: MasterPanel = {
      id,
      name: input.name,
      platformId: input.platformId,
      speciesId: input.speciesId,
      sapeName: input.sapeName,
      description: input.description,
      vendorSinglesTerm: input.vendorSinglesTerm ?? null,
      createdAt: now,
      updatedAt: now
    }
    db.insert(masterPanels).values(row).run()
    return row
  },

  /**
   * Phase 13 D-12 wholesale-replace: UPDATE name + description + sapeName + updatedAt;
   * preserves id + createdAt + platformId + speciesId + vendorSinglesTerm.
   */
  updateMetadata(
    id: string,
    input: { name: string; description: string | null; sapeName: string | null }
  ): void {
    const db = getDatabase()
    const now = new Date().toISOString()
    db.update(masterPanels)
      .set({
        name: input.name,
        description: input.description,
        sapeName: input.sapeName,
        updatedAt: now
      })
      .where(eq(masterPanels.id, id))
      .run()
  },

  getById(id: string): MasterPanel | null {
    const db = getDatabase()
    const result = db.select().from(masterPanels).where(eq(masterPanels.id, id)).get()
    return (result as MasterPanel | undefined) ?? null
  },

  /**
   * Phase 15 SMK3-15/16: composed read for the audit-trail snapshot.
   * Returns the master_panels row plus its master_panel_reagents children
   * (0..3 rows: beads, antibodies, sape) in a single call so the renderer's
   * buildRunSnapshot can pack the 6 master-panel-derived fields onto the
   * runs row at save time. Returns null when the master_panel id is unknown
   * (defensive — should not happen in normal flow because selectionStore
   * carries a valid masterPanelId post-selectPanel).
   */
  getByIdWithReagents(id: string): {
    masterPanel: MasterPanel
    reagents: MasterPanelReagent[]
  } | null {
    const masterPanel = masterPanelRepository.getById(id)
    if (!masterPanel) return null
    const reagents = masterPanelReagentRepository.findByMasterPanelId(id)
    return { masterPanel, reagents }
  }
}
