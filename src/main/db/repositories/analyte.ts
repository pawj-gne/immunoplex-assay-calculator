import { eq, and, sql } from 'drizzle-orm'
import { getDatabase } from '../client'
import { analytes, panelAnalytes } from '../schema'
import type { Analyte, AnalyteCreate } from '../../../shared/types/analyte'

export const analyteRepository = {
  getByPlatformAndSpecies(platformId: string, speciesId: string): Analyte[] {
    const db = getDatabase()
    return db
      .select()
      .from(analytes)
      .where(and(eq(analytes.platformId, platformId), eq(analytes.speciesId, speciesId)))
      .all()
  },

  getByPanelId(panelId: string): Analyte[] {
    const db = getDatabase()

    // Get analyte IDs from junction table
    const links = db.select().from(panelAnalytes).where(eq(panelAnalytes.panelId, panelId)).all()

    const result: Analyte[] = []
    for (const link of links) {
      const analyte = db.select().from(analytes).where(eq(analytes.id, link.analyteId)).get()
      if (analyte) {
        result.push(analyte)
      }
    }

    return result
  },

  getById(id: string): Analyte | null {
    const db = getDatabase()
    const result = db.select().from(analytes).where(eq(analytes.id, id)).get()
    return result ?? null
  },

  create(data: AnalyteCreate): Analyte {
    const db = getDatabase()
    const now = new Date().toISOString()
    const id = crypto.randomUUID()

    const analyte: Analyte = {
      id,
      name: data.name,
      beadRegion: data.beadRegion,
      premixConc: data.premixConc,
      singleConc: data.singleConc,
      platformId: data.platformId,
      speciesId: data.speciesId,
      masterPanelId: data.masterPanelId ?? null,
      createdAt: now,
      updatedAt: now
    }

    db.insert(analytes).values(analyte).run()
    return analyte
  },

  findByNamePlatformSpecies(name: string, platformId: string, speciesId: string): Analyte | null {
    const db = getDatabase()
    const result = db
      .select()
      .from(analytes)
      .where(
        and(
          sql`lower(${analytes.name}) = lower(${name})`,
          eq(analytes.platformId, platformId),
          eq(analytes.speciesId, speciesId)
        )
      )
      .get()
    return result ?? null
  },

  /**
   * Upsert an analyte by case-insensitive name within a (platform, species) scope,
   * associating it with a master_panel. Pitfall-1 critical adoption gate (SC #5).
   *
   * - Miss                             => INSERT new row; action: 'created'
   * - Match && master_panel_id IS NULL => UPDATE in place, set master_panel_id; action: 'adopted'
   * - Match && master_panel_id set     => UPDATE in place, overwrite master_panel_id; action: 'updated'
   *
   * UPDATE path NEVER touches premix_conc or name casing (D-17).
   * INSERT path mirrors input.concentration into BOTH single_conc (D-04) and
   * premix_conc (D-22) — premix_conc is the legacy NOT NULL column kept for v2.1 cleanup.
   *
   * Does NOT open a transaction — Phase 7 importer owns transaction scope (D-18).
   */
  upsertByNameInMaster(input: {
    name: string
    platformId: string
    speciesId: string
    masterPanelId: string
    beadRegion: number
    concentration: number
  }): { id: string; action: 'created' | 'adopted' | 'updated' } {
    const db = getDatabase()
    const now = new Date().toISOString()

    // VERBATIM reuse of findByNamePlatformSpecies lookup — case-insensitive
    const existing = db
      .select()
      .from(analytes)
      .where(
        and(
          sql`lower(${analytes.name}) = lower(${input.name})`,
          eq(analytes.platformId, input.platformId),
          eq(analytes.speciesId, input.speciesId)
        )
      )
      .get()

    if (existing) {
      // Pitfall-1 gate: null master_panel_id => 'adopted'; non-null => 'updated'
      const action: 'adopted' | 'updated' =
        existing.masterPanelId === null ? 'adopted' : 'updated'

      db.update(analytes)
        .set({
          beadRegion: input.beadRegion,
          singleConc: input.concentration,
          masterPanelId: input.masterPanelId,
          updatedAt: now
          // NOTE: premix_conc is NEVER touched on UPDATE (D-17, D-22).
          // NOTE: name is NOT touched — existing row's casing wins (idempotent re-import).
        })
        .where(eq(analytes.id, existing.id))
        .run()
      return { id: existing.id, action }
    }

    // INSERT path — mirror input.concentration into both columns (D-22)
    const id = crypto.randomUUID()
    db.insert(analytes)
      .values({
        id,
        name: input.name,
        beadRegion: input.beadRegion,
        premixConc: input.concentration,   // D-22: legacy column gets the same value on INSERT only
        singleConc: input.concentration,
        platformId: input.platformId,
        speciesId: input.speciesId,
        masterPanelId: input.masterPanelId,
        createdAt: now,
        updatedAt: now
      })
      .run()
    return { id, action: 'created' }
  },

  createMany(data: AnalyteCreate[]): Analyte[] {
    const created: Analyte[] = []
    for (const item of data) {
      created.push(analyteRepository.create(item))
    }
    return created
  },

  update(
    id: string,
    data: Partial<Pick<Analyte, 'name' | 'beadRegion' | 'premixConc' | 'singleConc'>>
  ): Analyte {
    const db = getDatabase()
    const now = new Date().toISOString()
    db.update(analytes)
      .set({ ...data, updatedAt: now })
      .where(eq(analytes.id, id))
      .run()
    const updated = analyteRepository.getById(id)
    if (!updated) throw new Error(`Analyte not found: ${id}`)
    return updated
  },

  delete(id: string): void {
    const db = getDatabase()
    db.delete(panelAnalytes).where(eq(panelAnalytes.analyteId, id)).run()
    db.delete(analytes).where(eq(analytes.id, id)).run()
  }
}
