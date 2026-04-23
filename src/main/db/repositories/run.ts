import { eq, desc } from 'drizzle-orm'
import { getDatabase, getSqlite } from '../client'
import { runs, runSingleAnalytes } from '../schema'
import type { RunRecord, RunCreate, RunUpdate } from '../../../shared/types/run'

function hydrate(row: typeof runs.$inferSelect): RunRecord {
  const db = getDatabase()
  const singles = db
    .select()
    .from(runSingleAnalytes)
    .where(eq(runSingleAnalytes.runId, row.id))
    .all()
  return {
    ...row,
    plates: JSON.parse(row.platesJson) as Record<number, string[]>,
    singleAnalyteIds: singles.map((s) => s.analyteId)
  } as RunRecord
}

export const runRepository = {
  getAll(): RunRecord[] {
    const db = getDatabase()
    const rows = db.select().from(runs).orderBy(desc(runs.createdAt)).all()
    return rows.map(hydrate)
  },

  getById(id: string): RunRecord | null {
    const db = getDatabase()
    const row = db.select().from(runs).where(eq(runs.id, id)).get()
    return row ? hydrate(row) : null
  },

  create(data: RunCreate): RunRecord {
    const sqlite = getSqlite()
    const db = getDatabase()
    const now = new Date().toISOString()
    const id = crypto.randomUUID()
    const insertAll = sqlite.transaction(() => {
      db.insert(runs)
        .values({
          id,
          requestNumber: data.requestNumber,
          requestOverrideAdHoc: data.requestOverrideAdHoc,
          userName: data.userName,
          operatorId: data.operatorId,
          runDate: data.runDate,
          sampleType: data.sampleType,
          dilutionFactor: data.dilutionFactor,
          sampleCount: data.sampleCount,
          replicateMode: data.replicateMode,
          requestType: data.requestType, // set on create; immutable after
          platformId: data.platformId, // set on create; immutable after
          speciesId: data.speciesId, // set on create; immutable after
          panelId: data.panelId,
          volumePerWell: data.volumePerWell,
          deadVolume: data.deadVolume,
          hamilton: data.hamilton,
          runPlatePosition: data.runPlatePosition,
          standardPosition: data.standardPosition,
          troughPosition: data.troughPosition,
          comments: data.comments,
          plex: data.plex,
          plateCount: data.plateCount,
          platesJson: JSON.stringify(data.plates),
          createdAt: now,
          updatedAt: now
        })
        .run()
      for (const analyteId of data.singleAnalyteIds) {
        db.insert(runSingleAnalytes)
          .values({
            id: crypto.randomUUID(),
            runId: id,
            analyteId,
            createdAt: now
          })
          .run()
      }
    })
    insertAll()
    const created = runRepository.getById(id)
    if (!created) throw new Error(`Failed to create run: ${id}`)
    return created
  },

  /**
   * Update accepts a full RunCreate-shaped payload (RunUpdate = RunCreate alias). The Drizzle
   * set() object literal below intentionally OMITS requestType, platformId, speciesId so those
   * fields are preserved at their create-time values (they are immutable after creation — ISSUE 3).
   * createdAt is also preserved per D-11; only updatedAt is bumped.
   */
  update(id: string, data: RunUpdate): RunRecord | null {
    const sqlite = getSqlite()
    const db = getDatabase()
    const existing = runRepository.getById(id)
    if (!existing) return null
    const now = new Date().toISOString()
    const updateAll = sqlite.transaction(() => {
      db.update(runs)
        .set({
          // NOTE: requestType, platformId, speciesId intentionally omitted — immutable after create.
          requestNumber: data.requestNumber,
          requestOverrideAdHoc: data.requestOverrideAdHoc,
          userName: data.userName,
          operatorId: data.operatorId,
          runDate: data.runDate,
          sampleType: data.sampleType,
          dilutionFactor: data.dilutionFactor,
          sampleCount: data.sampleCount,
          replicateMode: data.replicateMode,
          panelId: data.panelId,
          volumePerWell: data.volumePerWell,
          deadVolume: data.deadVolume,
          hamilton: data.hamilton,
          runPlatePosition: data.runPlatePosition,
          standardPosition: data.standardPosition,
          troughPosition: data.troughPosition,
          comments: data.comments,
          plex: data.plex,
          plateCount: data.plateCount,
          platesJson: JSON.stringify(data.plates),
          updatedAt: now
        })
        .where(eq(runs.id, id))
        .run()
      // Replace singles in the join table
      db.delete(runSingleAnalytes).where(eq(runSingleAnalytes.runId, id)).run()
      for (const analyteId of data.singleAnalyteIds) {
        db.insert(runSingleAnalytes)
          .values({
            id: crypto.randomUUID(),
            runId: id,
            analyteId,
            createdAt: now
          })
          .run()
      }
    })
    updateAll()
    return runRepository.getById(id)
  },

  delete(id: string): void {
    const sqlite = getSqlite()
    const db = getDatabase()
    const deleteAll = sqlite.transaction(() => {
      db.delete(runSingleAnalytes).where(eq(runSingleAnalytes.runId, id)).run()
      db.delete(runs).where(eq(runs.id, id)).run()
    })
    deleteAll()
  }
}
