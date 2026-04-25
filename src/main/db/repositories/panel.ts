import { eq, and, sql } from 'drizzle-orm'
import { getDatabase } from '../client'
import { premixPanels, panelAnalytes, analytes } from '../schema'
import type { PremixPanel, PanelWithAnalytes } from '../../../shared/types/panel'
import type { Analyte } from '../../../shared/types/analyte'

export const panelRepository = {
  getByPlatformAndSpecies(platformId: string, speciesId: string): PremixPanel[] {
    const db = getDatabase()
    return db
      .select()
      .from(premixPanels)
      .where(and(eq(premixPanels.platformId, platformId), eq(premixPanels.speciesId, speciesId)))
      .all()
  },

  getById(id: string): PremixPanel | null {
    const db = getDatabase()
    const result = db.select().from(premixPanels).where(eq(premixPanels.id, id)).get()
    return result ?? null
  },

  getWithAnalytes(id: string): PanelWithAnalytes | null {
    const db = getDatabase()

    const panel = db.select().from(premixPanels).where(eq(premixPanels.id, id)).get()
    if (!panel) return null

    // Get all analytes for this panel through the junction table
    const panelAnalyteLinks = db
      .select()
      .from(panelAnalytes)
      .where(eq(panelAnalytes.panelId, id))
      .all()

    const analyteIds = panelAnalyteLinks.map((link) => link.analyteId)

    const panelAnalytesList: Analyte[] = []
    for (const analyteId of analyteIds) {
      const analyte = db.select().from(analytes).where(eq(analytes.id, analyteId)).get()
      if (analyte) {
        panelAnalytesList.push(analyte)
      }
    }

    return {
      ...panel,
      analytes: panelAnalytesList
    }
  },

  findByNamePlatformSpecies(name: string, platformId: string, speciesId: string): PremixPanel | null {
    const db = getDatabase()
    const result = db
      .select()
      .from(premixPanels)
      .where(
        and(
          sql`lower(${premixPanels.name}) = lower(${name})`,
          eq(premixPanels.platformId, platformId),
          eq(premixPanels.speciesId, speciesId)
        )
      )
      .get()
    return result ?? null
  },

  create(data: {
    name: string
    description?: string | null
    platformId: string
    speciesId: string
    parentPanelId?: string | null
    subPanelConc?: number
  }): PremixPanel {
    const db = getDatabase()
    const now = new Date().toISOString()
    const id = crypto.randomUUID()

    const panel: PremixPanel = {
      id,
      name: data.name,
      description: data.description ?? null,
      platformId: data.platformId,
      speciesId: data.speciesId,
      masterPanelId: null,
      parentPanelId: data.parentPanelId ?? null,
      subPanelConc: data.subPanelConc ?? 1,
      createdAt: now,
      updatedAt: now
    }

    db.insert(premixPanels).values(panel).run()
    return panel
  },

  findChildrenOf(parentPanelId: string): PremixPanel[] {
    const db = getDatabase()
    return db
      .select()
      .from(premixPanels)
      .where(eq(premixPanels.parentPanelId, parentPanelId))
      .all()
  },

  update(id: string, data: Partial<Pick<PremixPanel, 'name' | 'description'>>): PremixPanel {
    const db = getDatabase()
    const now = new Date().toISOString()
    db.update(premixPanels)
      .set({ ...data, updatedAt: now })
      .where(eq(premixPanels.id, id))
      .run()
    const updated = panelRepository.getById(id)
    if (!updated) throw new Error(`Panel not found: ${id}`)
    return updated
  },

  delete(id: string): void {
    const db = getDatabase()
    db.delete(panelAnalytes).where(eq(panelAnalytes.panelId, id)).run()
    db.delete(premixPanels).where(eq(premixPanels.id, id)).run()
  },

  removeAnalyteFromPanel(panelId: string, analyteId: string): void {
    const db = getDatabase()
    db.delete(panelAnalytes)
      .where(and(eq(panelAnalytes.panelId, panelId), eq(panelAnalytes.analyteId, analyteId)))
      .run()
  },

  addAnalyteToPanel(panelId: string, analyteId: string): void {
    const db = getDatabase()

    // Check if link already exists
    const existing = db
      .select()
      .from(panelAnalytes)
      .where(and(eq(panelAnalytes.panelId, panelId), eq(panelAnalytes.analyteId, analyteId)))
      .get()

    if (existing) return

    db.insert(panelAnalytes)
      .values({
        id: crypto.randomUUID(),
        panelId,
        analyteId,
        createdAt: new Date().toISOString()
      })
      .run()
  }
}
