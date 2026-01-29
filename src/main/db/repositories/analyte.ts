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
      beadStockConc: data.beadStockConc,
      antibodyStockConc: data.antibodyStockConc,
      platformId: data.platformId,
      speciesId: data.speciesId,
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

  createMany(data: AnalyteCreate[]): Analyte[] {
    const created: Analyte[] = []
    for (const item of data) {
      created.push(analyteRepository.create(item))
    }
    return created
  }
}
