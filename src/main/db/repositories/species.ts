import { eq } from 'drizzle-orm'
import { getDatabase } from '../client'
import { species } from '../schema'
import type { Species, SpeciesCreate } from '../../../shared/types/species'

export const speciesRepository = {
  getByPlatformId(platformId: string): Species[] {
    const db = getDatabase()
    return db.select().from(species).where(eq(species.platformId, platformId)).all()
  },

  getById(id: string): Species | null {
    const db = getDatabase()
    const result = db.select().from(species).where(eq(species.id, id)).get()
    return result ?? null
  },

  create(data: SpeciesCreate): Species {
    const db = getDatabase()
    const now = new Date().toISOString()
    const id = crypto.randomUUID()

    const speciesRecord: Species = {
      id,
      name: data.name,
      platformId: data.platformId,
      createdAt: now,
      updatedAt: now
    }

    db.insert(species).values(speciesRecord).run()
    return speciesRecord
  }
}
