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
