import { create } from 'zustand'
import { Decimal } from 'decimal.js'
import {
  calculateVolumes,
  calculateSingleAdditions,
  canAddSingle,
  getRemainingSingles,
  validateSampleCount,
  createCalculatorInputs
} from '../lib/calculator'
import {
  DEFAULT_VOLUME_PER_WELL,
  // Plan 12-01 renamed the legacy dead-volume constant to DEAD_VOLUME_PER_SETUP_UL (Smoke 3 SMK3-05).
  // This store still uses it as a raw default for the legacy `deadVolume` runtime field;
  // Plan 12-03 will replace this entirely with a `numberOfSetups` field. Until then, this
  // store's `getOutputs()` will throw at runtime because it passes deadVolume=2000 as the
  // 5th `numberOfSetups` arg, which exceeds the sanity cap. That is the intended forcing
  // function — see Plan 12-01 SUMMARY for rationale.
  DEAD_VOLUME_PER_SETUP_UL,
  type ReplicateMode,
  type RequestType
} from '../../../shared/constants/calculator'
import type { SingleAnalyte, CalculatorOutputs } from '../../../shared/types/calculator'
import { usePlateStore } from './plateStore'

// Late-bound hook so runStore can participate in the Reset cascade without
// creating an import cycle (runStore -> useRunSnapshot -> calculatorStore).
// runStore calls registerRunStoreResetHook(() => useRunStore.getState().clearCurrentRun())
// exactly once on module load.
let runStoreResetHook: (() => void) | null = null
export function registerRunStoreResetHook(fn: () => void): void {
  runStoreResetHook = fn
}

interface CalculatorState {
  // Inputs
  sampleCount: number
  replicateMode: ReplicateMode
  requestType: RequestType
  volumePerWell: number
  deadVolume: number

  // Singles
  singles: SingleAnalyte[]

  // Validation
  validationError: string | null

  // Actions
  setSampleCount: (count: number) => void
  setReplicateMode: (mode: ReplicateMode) => void
  setRequestType: (type: RequestType) => void
  addSingle: (analyte: Omit<SingleAnalyte, 'id'>) => void
  removeSingle: (id: string) => void
  clearSingles: () => void
  reset: () => void

  // Computed (call these to get derived values)
  getOutputs: () => CalculatorOutputs | null
  getSinglesWithVolumes: () => Array<SingleAnalyte & { additionVolume: Decimal }> | null
  canAddMoreSingles: () => boolean
  getRemainingSinglesCount: () => number
}

const initialState = {
  sampleCount: 1,
  replicateMode: 'singles' as ReplicateMode,
  requestType: 'premix' as RequestType,
  volumePerWell: DEFAULT_VOLUME_PER_WELL,
  deadVolume: DEAD_VOLUME_PER_SETUP_UL,
  singles: [] as SingleAnalyte[],
  validationError: null as string | null
}

export const useCalculatorStore = create<CalculatorState>((set, get) => ({
  ...initialState,

  setSampleCount: (count: number) => {
    set({ sampleCount: count })

    // Propagate to plateStore FIRST so it recalculates plate count
    usePlateStore.getState().setSampleCount(count)

    // Validate with updated plate count
    const { replicateMode } = get()
    const plateCount = usePlateStore.getState().getPlateCount()
    const validation = validateSampleCount(count, replicateMode, plateCount)
    set({ validationError: validation.valid ? null : validation.message ?? null })
  },

  setReplicateMode: (mode: ReplicateMode) => {
    set({ replicateMode: mode })

    // Propagate to plateStore FIRST so it recalculates plate count
    usePlateStore.getState().setReplicateMode(mode)

    // Validate with updated plate count
    const { sampleCount } = get()
    const plateCount = usePlateStore.getState().getPlateCount()
    const validation = validateSampleCount(sampleCount, mode, plateCount)
    set({ validationError: validation.valid ? null : validation.message ?? null })
  },

  setRequestType: (type: RequestType) => {
    const { singles } = get()

    // Clear singles if switching to premix
    if (type === 'premix') {
      set({ requestType: type, singles: [] })
      return
    }

    // Trim singles if switching to premix_singles and over limit
    if (type === 'premix_singles' && singles.length > 5) {
      set({ requestType: type, singles: singles.slice(0, 5) })
      return
    }

    set({ requestType: type })
  },

  addSingle: (analyte) => {
    const { requestType, singles } = get()

    if (!canAddSingle(requestType, singles.length)) {
      return // Silently fail - UI should prevent this
    }

    const newSingle: SingleAnalyte = {
      ...analyte,
      id: crypto.randomUUID()
    }

    set({ singles: [...singles, newSingle] })
  },

  removeSingle: (id: string) => {
    const { singles } = get()
    set({ singles: singles.filter((s) => s.id !== id) })
  },

  clearSingles: () => {
    set({ singles: [] })
  },

  reset: () => {
    set(initialState)
    usePlateStore.getState().reset()
    // Clear the loaded-run pointer + dirty baseline so a Reset from the
    // calculator behaves like a truly fresh run (no loaded run persists
    // across a reset, per Plan 04-02 §"On Reset ... dirty tracker is also
    // re-synced and currentRunId is cleared").
    //
    // runStore wires itself into the calculator Reset cascade via
    // registerRunStoreResetHook below — we delegate to the hook rather
    // than importing runStore directly to break the import cycle
    // (runStore -> useRunSnapshot -> calculatorStore -> runStore).
    runStoreResetHook?.()
  },

  getOutputs: () => {
    const { sampleCount, replicateMode, volumePerWell, deadVolume, validationError } = get()
    const plateCount = usePlateStore.getState().getPlateCount()

    if (validationError || sampleCount <= 0) {
      return null
    }

    const inputs = createCalculatorInputs(
      sampleCount,
      replicateMode,
      plateCount,
      volumePerWell,
      deadVolume
    )

    return calculateVolumes(inputs)
  },

  getSinglesWithVolumes: () => {
    const { singles } = get()
    const outputs = get().getOutputs()

    if (!outputs || singles.length === 0) {
      return null
    }

    return calculateSingleAdditions(outputs.finalVolume, singles)
  },

  canAddMoreSingles: () => {
    const { requestType, singles } = get()
    return canAddSingle(requestType, singles.length)
  },

  getRemainingSinglesCount: () => {
    const { requestType, singles } = get()
    return getRemainingSingles(requestType, singles.length)
  }
}))
