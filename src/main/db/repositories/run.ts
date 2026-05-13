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

  /**
   * Phase 6 Plan 03 extension: accepts optional `id`, `machineName`, and
   * `isOfflineSave` provenance fields. The transport layer passes these on
   * every create (machineName=os.hostname() always; isOfflineSave=true only
   * when the row was written via the offline queue path). Pre-Phase-6 callers
   * (IPC handlers go through transport now) get the original behavior:
   * generated UUID id, NULL machineName, isOfflineSave=false.
   */
  create(
    data: RunCreate & { id?: string; machineName?: string | null; isOfflineSave?: boolean }
  ): RunRecord {
    const sqlite = getSqlite()
    const db = getDatabase()
    const now = new Date().toISOString()
    const id = data.id ?? crypto.randomUUID()
    const insertAll = sqlite.transaction(() => {
      // Phase 14 Plan 08: build the values literal incrementally so the three
      // new Smoke-3 fields (numberOfSetups / oldBeads / oldAntibodies) only
      // appear in the INSERT when the caller actually supplied them. Omitting
      // them lets the DB DEFAULT (1 / 0 / 0) fire — preserves the no-op
      // contract for pre-Phase-14 callers that round-trip through the legacy
      // RunCreate shape.
      const insertValues: typeof runs.$inferInsert = {
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
        updatedAt: now,
        machineName: data.machineName ?? null,
        isOfflineSave: data.isOfflineSave ?? false
      }
      if (data.numberOfSetups !== undefined) insertValues.numberOfSetups = data.numberOfSetups
      if (data.oldBeads !== undefined) insertValues.oldBeads = data.oldBeads
      if (data.oldAntibodies !== undefined) insertValues.oldAntibodies = data.oldAntibodies
      // Phase 15 SMK3-12/15/16/17 — write the 10 audit-trail snapshot fields
      // only when the caller supplied them; absent → DB DEFAULT (NULL for the
      // master-panel-derived fields, false for overrides) preserves pre-Phase-15
      // payload round-trip.
      if (data.sapeName !== undefined) insertValues.sapeName = data.sapeName
      if (data.sapeConcentration !== undefined) insertValues.sapeConcentration = data.sapeConcentration
      if (data.beadsDiluent !== undefined) insertValues.beadsDiluent = data.beadsDiluent
      if (data.antibodiesDiluent !== undefined) insertValues.antibodiesDiluent = data.antibodiesDiluent
      if (data.beadsVolumePerWell !== undefined) insertValues.beadsVolumePerWell = data.beadsVolumePerWell
      if (data.antibodiesVolumePerWell !== undefined) insertValues.antibodiesVolumePerWell = data.antibodiesVolumePerWell
      if (data.premixConcentration !== undefined) insertValues.premixConcentration = data.premixConcentration
      if (data.oldBeadsOverride !== undefined) insertValues.oldBeadsOverride = data.oldBeadsOverride
      if (data.oldAntibodiesOverride !== undefined) insertValues.oldAntibodiesOverride = data.oldAntibodiesOverride
      if (data.calculationRulesVersion !== undefined) insertValues.calculationRulesVersion = data.calculationRulesVersion
      db.insert(runs).values(insertValues).run()
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
  update(
    id: string,
    data: RunUpdate & { machineName?: string | null; isOfflineSave?: boolean }
  ): RunRecord | null {
    const sqlite = getSqlite()
    const db = getDatabase()
    const existing = runRepository.getById(id)
    if (!existing) return null
    const now = new Date().toISOString()
    const updateAll = sqlite.transaction(() => {
      // Phase 6 Plan 03: machineName + isOfflineSave are written only when the
      // caller (transport layer) provides them. If undefined, leave the existing
      // row's values intact — pre-Phase-6 callers (IPC routes that bypass the
      // transport, none today after this plan) won't accidentally null the
      // provenance of a previously online-saved row.
      const baseSet = {
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
      }
      const setWithProvenance: typeof baseSet & {
        machineName?: string | null
        isOfflineSave?: boolean
        numberOfSetups?: number
        oldBeads?: number
        oldAntibodies?: number
        // Phase 15 audit-trail snapshot fields
        sapeName?: string | null
        sapeConcentration?: number | null
        beadsDiluent?: string | null
        antibodiesDiluent?: string | null
        beadsVolumePerWell?: number | null
        antibodiesVolumePerWell?: number | null
        premixConcentration?: number | null
        oldBeadsOverride?: boolean
        oldAntibodiesOverride?: boolean
        calculationRulesVersion?: string | null
      } = { ...baseSet }
      if (data.machineName !== undefined) setWithProvenance.machineName = data.machineName
      if (data.isOfflineSave !== undefined) setWithProvenance.isOfflineSave = data.isOfflineSave
      // Phase 14 Plan 08: write Smoke-3 fields only when caller supplied them
      // (omit-and-DB-default mirrors the create() shape above).
      if (data.numberOfSetups !== undefined) setWithProvenance.numberOfSetups = data.numberOfSetups
      if (data.oldBeads !== undefined) setWithProvenance.oldBeads = data.oldBeads
      if (data.oldAntibodies !== undefined) setWithProvenance.oldAntibodies = data.oldAntibodies
      // Phase 15 SMK3-12/15/16/17 — same conditional-write idiom in update()
      if (data.sapeName !== undefined) setWithProvenance.sapeName = data.sapeName
      if (data.sapeConcentration !== undefined) setWithProvenance.sapeConcentration = data.sapeConcentration
      if (data.beadsDiluent !== undefined) setWithProvenance.beadsDiluent = data.beadsDiluent
      if (data.antibodiesDiluent !== undefined) setWithProvenance.antibodiesDiluent = data.antibodiesDiluent
      if (data.beadsVolumePerWell !== undefined) setWithProvenance.beadsVolumePerWell = data.beadsVolumePerWell
      if (data.antibodiesVolumePerWell !== undefined) setWithProvenance.antibodiesVolumePerWell = data.antibodiesVolumePerWell
      if (data.premixConcentration !== undefined) setWithProvenance.premixConcentration = data.premixConcentration
      if (data.oldBeadsOverride !== undefined) setWithProvenance.oldBeadsOverride = data.oldBeadsOverride
      if (data.oldAntibodiesOverride !== undefined) setWithProvenance.oldAntibodiesOverride = data.oldAntibodiesOverride
      if (data.calculationRulesVersion !== undefined) setWithProvenance.calculationRulesVersion = data.calculationRulesVersion
      db.update(runs).set(setWithProvenance).where(eq(runs.id, id)).run()
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
