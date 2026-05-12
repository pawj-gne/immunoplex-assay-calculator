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
  /**
   * Number of plate setups; drives dead volume in the calculator (Smoke 3
   * SMK3-05: deadVolume = numberOfSetups × 2 mL). Integer ≥ 1, default 1.
   * No upper bound enforced at the store; calculator pure-math layer caps
   * at 1000 as a sanity check.
   */
  numberOfSetups: number

  // Singles
  singles: SingleAnalyte[]

  // Validation
  validationError: string | null

  // Actions
  setSampleCount: (count: number) => void
  setReplicateMode: (mode: ReplicateMode) => void
  setRequestType: (type: RequestType) => void
  setNumberOfSetups: (n: number) => void
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
  numberOfSetups: 1,
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

  setNumberOfSetups: (n: number) => {
    // SMK3-05: setups must be an integer ≥ 1 (no upper bound at the store;
    // calculator pure-math layer caps > 1000 as a defensive sanity check).
    // Invalid input is rejected — state stays unchanged, validationError set.
    if (!Number.isInteger(n) || n < 1) {
      set({
        validationError: `Number of setups must be an integer >= 1 (got ${n})`
      })
      return
    }
    set({ numberOfSetups: n, validationError: null })
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
    const { sampleCount, replicateMode, volumePerWell, numberOfSetups, validationError } = get()
    const plateCount = usePlateStore.getState().getPlateCount()

    if (validationError || sampleCount <= 0) {
      return null
    }

    // SMK3-05: pass numberOfSetups as the 5th arg; createCalculatorInputs
    // derives deadVolume = numberOfSetups × DEAD_VOLUME_PER_SETUP_UL internally.
    const inputs = createCalculatorInputs(
      sampleCount,
      replicateMode,
      plateCount,
      volumePerWell,
      numberOfSetups
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
