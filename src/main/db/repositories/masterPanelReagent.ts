import { eq } from 'drizzle-orm'
import { getDatabase } from '../client'
import { masterPanelReagents } from '../schema'
import type {
  MasterPanelReagent,
  MasterPanelReagentCreate
} from '../../../shared/types/masterPanelReagent'

/**
 * Phase 13 D-06 + Pitfall 27: repository methods NEVER open a transaction.
 * Importer.ts owns transaction scope (carries Phase 5 D-18 convention).
 */
export const masterPanelReagentRepository = {
  create(input: MasterPanelReagentCreate): MasterPanelReagent {
    const db = getDatabase()
    const id = crypto.randomUUID()
    const now = new Date().toISOString()
    const row: MasterPanelReagent = {
      id,
      masterPanelId: input.masterPanelId,
      reagentKind: input.reagentKind,
      concentration: input.concentration,
      diluent: input.diluent,
      volumePerWell: input.volumePerWell,
      createdAt: now,
      updatedAt: now
    }
    db.insert(masterPanelReagents).values(row).run()
    return row
  },

  findByMasterPanelId(masterPanelId: string): MasterPanelReagent[] {
    const db = getDatabase()
    return db
      .select()
      .from(masterPanelReagents)
      .where(eq(masterPanelReagents.masterPanelId, masterPanelId))
      .all() as MasterPanelReagent[]
  },

  deleteByMasterPanelId(masterPanelId: string): number {
    const db = getDatabase()
    const result = db
      .delete(masterPanelReagents)
      .where(eq(masterPanelReagents.masterPanelId, masterPanelId))
      .run()
    return result.changes
  },

  getById(id: string): MasterPanelReagent | null {
    const db = getDatabase()
    const result = db
      .select()
      .from(masterPanelReagents)
      .where(eq(masterPanelReagents.id, id))
      .get()
    return (result as MasterPanelReagent | undefined) ?? null
  }
}
