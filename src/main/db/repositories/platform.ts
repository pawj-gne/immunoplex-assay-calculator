import { eq } from 'drizzle-orm'
import { getDatabase } from '../client'
import { platforms } from '../schema'
import type { Platform, PlatformCreate, PlatformUpdate } from '../../../shared/types/platform'

export const platformRepository = {
  getAll(): Platform[] {
    const db = getDatabase()
    return db.select().from(platforms).all()
  },

  getById(id: string): Platform | null {
    const db = getDatabase()
    const result = db.select().from(platforms).where(eq(platforms.id, id)).get()
    return result ?? null
  },

  create(data: PlatformCreate): Platform {
    const db = getDatabase()
    const now = new Date().toISOString()
    const id = crypto.randomUUID()

    const platform: Platform = {
      id,
      name: data.name,
      description: data.description ?? null,
      stockConcentration: data.stockConcentration,
      createdAt: now,
      updatedAt: now
    }

    db.insert(platforms).values(platform).run()
    return platform
  },

  update(data: PlatformUpdate): Platform | null {
    const db = getDatabase()
    const existing = this.getById(data.id)
    if (!existing) return null

    const now = new Date().toISOString()
    const updated: Platform = {
      ...existing,
      name: data.name ?? existing.name,
      description: data.description !== undefined ? data.description : existing.description,
      stockConcentration: data.stockConcentration ?? existing.stockConcentration,
      updatedAt: now
    }

    db.update(platforms).set(updated).where(eq(platforms.id, data.id)).run()
    return updated
  }
}
