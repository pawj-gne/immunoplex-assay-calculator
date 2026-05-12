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
    masterPanelId?: string | null
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
      // Phase 13 OQ-1: extended create() to accept masterPanelId directly
      // (replaces hard-coded null; new Smoke 3 importer wires the FK at insert time).
      masterPanelId: data.masterPanelId ?? null,
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

  /**
   * Phase 13 D-12: hard-delete all premix_panels rows for a master_panel
   * + their junction rows. Pairs with schema.ts runs.panelId onDelete:'set null'
   * (D-15) so historical runs survive with NULL panel_id. Returns delete count.
   */
  deleteByMasterPanelId(masterPanelId: string): number {
    const db = getDatabase()
    // First gather premix ids so we can cascade-clean junction rows
    const premixIds = db
      .select({ id: premixPanels.id })
      .from(premixPanels)
      .where(eq(premixPanels.masterPanelId, masterPanelId))
      .all()
      .map((r) => r.id)
    if (premixIds.length === 0) return 0
    for (const pid of premixIds) {
      db.delete(panelAnalytes).where(eq(panelAnalytes.panelId, pid)).run()
    }
    const result = db
      .delete(premixPanels)
      .where(eq(premixPanels.masterPanelId, masterPanelId))
      .run()
    return result.changes
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
