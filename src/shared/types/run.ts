export const SAMPLE_TYPES = ['Supernatant', 'Lysate', 'Lavage', 'Plasma', 'Serum'] as const
export type SampleType = (typeof SAMPLE_TYPES)[number]

export type ReplicateMode = 'singles' | 'duplicates'
export type RequestType = 'premix' | 'premix_singles' | 'custom'

// Hydrated read shape: platesJson parsed, singleAnalyteIds joined
export interface RunRecord {
  id: string
  requestNumber: number | null
  requestOverrideAdHoc: boolean
  userName: string
  operatorId: string
  runDate: string
  sampleType: SampleType
  dilutionFactor: number
  sampleCount: number
  replicateMode: ReplicateMode
  requestType: RequestType
  platformId: string
  speciesId: string
  panelId: string | null
  volumePerWell: number
  deadVolume: number
  /**
   * Smoke 3 SMK3-05 input: number of plate setups that drove the computed
   * deadVolume above. Optional — pre-Smoke-3 saved runs lack this field
   * and round-trip with `?? 1` defaulting (equivalent to v1.0 behavior).
   * Loading a Smoke 3 run with `numberOfSetups = 3` reapplies the setups
   * count to the calculatorStore so getOutputs() recomputes the same
   * 6000 µL dead volume the run was saved with (SMK3-16 enabler;
   * advisory marker UI is Phase 15).
   */
  numberOfSetups?: number
  /**
   * Smoke 3 SMK3-02 input: operator-entered Old Beads volume in mL.
   * Default 0; optional — pre-Phase-14 saved runs lack this field and
   * round-trip with `?? 0` defaulting (equivalent to v1.0 behavior).
   * Stored as the raw typed value per D-08; floor-rounded at consumption
   * inside calculatorStore.getOutputs (SMK3-16 snapshot fidelity).
   */
  oldBeads?: number
  /**
   * Smoke 3 SMK3-03 input: mirror of oldBeads for antibodies. Same
   * SMK3-16 contract (optional + `?? 0` default on reload).
   */
  oldAntibodies?: number
  // Phase 15 — SMK3-12/15/16/17 audit-trail snapshot fields. All 8 master-panel-
  // derived fields are nullable so pre-Phase-15 saved runs tolerate the migration
  // without backfill (D-15-04); the 2 override booleans mirror Phase 6 isOfflineSave
  // shape; calculationRulesVersion is the marker that drives the historical-run
  // banner ('smoke3' for Phase-15-and-later saves, NULL for pre-Phase-15 rows).
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
  hamilton: number // 1-5
  runPlatePosition: number // 1-4
  standardPosition: number // 1-2
  troughPosition: number // 1-2
  comments: string | null
  plex: number
  plateCount: number
  plates: Record<number, string[]> // deserialized from platesJson
  singleAnalyteIds: string[] // from runSingleAnalytes join
  createdAt: string
  updatedAt: string
  // Phase 6: provenance — set by transport layer at save time, NOT in RunCreate/RunUpdate
  machineName: string | null // os.hostname() at save time; null for pre-Phase-6 rows
  isOfflineSave: boolean // true if saved while server was unreachable
}

// Create input — matches runCreateSchema
export interface RunCreate {
  requestNumber: number | null
  requestOverrideAdHoc: boolean
  userName: string
  operatorId: string
  runDate: string
  sampleType: SampleType
  dilutionFactor: number
  sampleCount: number
  replicateMode: ReplicateMode
  requestType: RequestType
  platformId: string
  speciesId: string
  panelId: string | null
  volumePerWell: number
  deadVolume: number
  /**
   * Smoke 3 SMK3-05 input: number of plate setups that drove the computed
   * deadVolume above. Optional — pre-Smoke-3 callers can omit it and the
   * Zod schema defaults to 1 (backwards-compatible with v1.0 saves).
   */
  numberOfSetups?: number
  /**
   * Smoke 3 SMK3-02/03 inputs: pre-Phase-14 callers can omit; the persist
   * pipeline defaults absent values to 0 on reload (SMK3-16 snapshot
   * fidelity). Raw typed values per D-08; calculator floor-rounds at
   * consumption.
   */
  oldBeads?: number
  oldAntibodies?: number
  // Phase 15 — SMK3-12/15/16/17 audit-trail snapshot fields. All 8 master-panel-
  // derived fields are nullable so pre-Phase-15 saved runs tolerate the migration
  // without backfill (D-15-04); the 2 override booleans mirror Phase 6 isOfflineSave
  // shape; calculationRulesVersion is the marker that drives the historical-run
  // banner ('smoke3' for Phase-15-and-later saves, NULL for pre-Phase-15 rows).
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
  hamilton: number
  runPlatePosition: number
  standardPosition: number
  troughPosition: number
  comments: string | null
  plex: number
  plateCount: number
  plates: Record<number, string[]>
  singleAnalyteIds: string[]
}

/**
 * Update input is an alias of RunCreate — the type, Zod schema, IPC handler, and preload signature
 * must stay internally consistent (ISSUE 3 from plan-checker).
 *
 * requestType, platformId, speciesId are immutable after creation; the runRepository.update()
 * method explicitly omits these keys from its Drizzle set() call so the create-time values win.
 * Callers may pass them in the payload — they are ignored at the repo layer.
 */
export type RunUpdate = RunCreate
