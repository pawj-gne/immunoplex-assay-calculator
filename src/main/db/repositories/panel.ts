import { eq, and } from 'drizzle-orm'
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
  }
}
