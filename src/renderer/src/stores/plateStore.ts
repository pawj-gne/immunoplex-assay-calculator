import { create } from 'zustand'
import {
  UNKNOWN_WELLS_SINGLES,
  UNKNOWN_WELLS_DUPLICATES,
  getDuplicatePair
} from '../../../shared/constants/calculator'
import { ROWS, STANDARD_COLS } from '../../../shared/types/plate'

/**
 * Well ID helpers
 */
function wellId(rowIndex: number, colOneIndexed: number): string {
  return `${ROWS[rowIndex]}${colOneIndexed}`
}

/**
 * Generate unknown column order for filling (1-indexed columns 4-12)
 */
const UNKNOWN_COLS_ORDERED = [4, 5, 6, 7, 8, 9, 10, 11, 12] as const

interface PlateState {
  // State
  plates: Record<number, Set<string>> // plateNumber (1-indexed) -> set of filled well IDs (e.g., "A4")
  activePlate: number // currently viewed plate (1-indexed)
  sampleCount: number // committed sample count (0 = blank)
  replicateMode: 'singles' | 'duplicates'

  // Actions
  setSampleCount: (count: number) => void
  setReplicateMode: (mode: 'singles' | 'duplicates') => void
  autoFill: () => void
  toggleWell: (plateNumber: number, wellId: string) => void
  setWellRange: (plateNumber: number, wellIds: Set<string>, filled: boolean) => void
  addPlate: () => void
  removePlate: (plateNumber: number) => void
  clearPlate: (plateNumber: number) => void
  setActivePlate: (plateNumber: number) => void
  reset: () => void
  loadPlates: (plates: Record<number, string[]>) => void

  // Computed
  getPlateCount: () => number
  getTotalAssigned: () => number
  getSamplesRemaining: () => number
  getMinPlatesNeeded: () => number
  getPlateWells: (plateNumber: number) => Set<string>
  getPlatesSnapshot: () => Record<number, string[]>
}

/**
 * Parse a well ID like "A4" into 0-indexed row and 0-indexed column.
 */
function parseWellId(id: string): { row: number; col: number } | null {
  const match = id.match(/^([A-H])(\d{1,2})$/)
  if (!match) return null
  const rowIndex = ROWS.indexOf(match[1] as (typeof ROWS)[number])
  const colOneIndexed = parseInt(match[2], 10)
  if (rowIndex < 0 || colOneIndexed < 1 || colOneIndexed > 12) return null
  return { row: rowIndex, col: colOneIndexed - 1 }
}

/**
 * Check if a 1-indexed column is a standard column
 */
function isStandardCol(colOneIndexed: number): boolean {
  return (STANDARD_COLS as readonly number[]).includes(colOneIndexed)
}

export const usePlateStore = create<PlateState>((set, get) => ({
  // Initial state
  plates: { 1: new Set<string>() },
  activePlate: 1,
  sampleCount: 0,
  replicateMode: 'singles',

  setSampleCount: (count: number) => {
    set({ sampleCount: count })
    get().autoFill()
  },

  setReplicateMode: (mode: 'singles' | 'duplicates') => {
    set({ replicateMode: mode })
    get().autoFill()
  },

  autoFill: () => {
    const { sampleCount, replicateMode, plates: existingPlates, activePlate } = get()

    if (sampleCount <= 0) {
      // sampleCount = 0 is the explicit "wipe" signal — operator zeroed the count.
      set({ plates: { 1: new Set<string>() }, activePlate: 1 })
      return
    }

    const wellsPerPlate =
      replicateMode === 'singles' ? UNKNOWN_WELLS_SINGLES : UNKNOWN_WELLS_DUPLICATES
    const minPlates = Math.ceil(sampleCount / wellsPerPlate)

    // Start from existing plates so operator edits on any non-empty plate are preserved.
    // Per D-4.1-02 (BUG-02 fix): autoFill only writes to plate slots that are missing
    // or empty — it never clobbers a non-empty plate's wells.
    const newPlates: Record<number, Set<string>> = { ...existingPlates }

    // Count samples already represented by existing non-empty plates.
    // In duplicates mode, two wells = one sample, so divide by 2.
    let samplesAssigned = 0
    for (const wells of Object.values(newPlates)) {
      if (wells.size > 0) {
        samplesAssigned +=
          replicateMode === 'duplicates' ? Math.floor(wells.size / 2) : wells.size
      }
    }

    // Helper: fill a single plate's Set<string> up to `sampleCount`, incrementing
    // samplesAssigned. Singles: column-first column-major fill (Phase 4.1 BUG-01).
    // Duplicates (SMK3-RPL-02 / Phase 14): vertical pairs (A,B)(C,D)(E,F)(G,H)
    // within each unknown column 4-12 — uniform geometry, column-first iteration.
    // Returns when samplesAssigned >= sampleCount or the plate is full.
    const fillPlate = (plateWells: Set<string>): void => {
      if (replicateMode === 'singles') {
        // Fill column-first: A4, B4, C4... H4, A5, B5... for columns 4-12
        for (const col of UNKNOWN_COLS_ORDERED) {
          for (let rowIndex = 0; rowIndex < ROWS.length; rowIndex++) {
            if (samplesAssigned >= sampleCount) return
            plateWells.add(wellId(rowIndex, col))
            samplesAssigned++
          }
        }
      } else {
        // Duplicates mode (SMK3-RPL-02): vertical pairs (A,B)(C,D)(E,F)(G,H)
        // within each unknown column 4-12. Column-first iteration matches
        // the singles fill order and the Hamilton liquid-handler pipetting
        // direction (Phase 4.1 BUG-01 fix preserved in spirit).
        const PAIR_TOP_ROWS = [0, 2, 4, 6] as const
        for (const col of UNKNOWN_COLS_ORDERED) {
          for (const topRow of PAIR_TOP_ROWS) {
            if (samplesAssigned >= sampleCount) return
            plateWells.add(wellId(topRow, col))
            plateWells.add(wellId(topRow + 1, col))
            samplesAssigned++
          }
        }
      }
    }

    // Ensure at least `minPlates` plate slots exist (create empty Sets for any missing).
    for (let p = 1; p <= minPlates; p++) {
      if (!newPlates[p]) {
        newPlates[p] = new Set<string>()
      }
    }

    // Fill only plates that are CURRENTLY empty, walking p=1..minPlates.
    // Non-empty plates are preserved (operator or prior auto-fill touched them).
    for (let p = 1; p <= minPlates; p++) {
      if (samplesAssigned >= sampleCount) break
      const plateWells = newPlates[p]
      if (plateWells.size > 0) continue // skip non-empty plates — preserve operator edits
      fillPlate(plateWells)
    }

    // Overflow: if existing non-empty plates meant the main loop skipped slots and
    // samplesAssigned still trails sampleCount, append new plates and fill them
    // until every sample has a home. This handles Scenario D from the plan:
    // plates={1: full, 2: empty}, bump sampleCount 32→33 — sample 33 needs a home
    // and plate 1 is non-empty, so overflow creates/uses plate 2 or plate 3.
    let nextPlate =
      Object.keys(newPlates).length > 0
        ? Math.max(...Object.keys(newPlates).map(Number)) + 1
        : 1
    while (samplesAssigned < sampleCount) {
      // Prefer any existing empty slot (e.g. operator-added empty plate 2)
      // before appending a new one, so we don't pointlessly grow the record.
      const existingEmptySlot = Object.keys(newPlates)
        .map(Number)
        .sort((a, b) => a - b)
        .find((n) => newPlates[n].size === 0)
      const targetPlate = existingEmptySlot !== undefined ? existingEmptySlot : nextPlate++
      if (!newPlates[targetPlate]) newPlates[targetPlate] = new Set<string>()
      fillPlate(newPlates[targetPlate])
    }

    // activePlate stays as-is unless it now points past the last plate slot.
    const maxPlate = Math.max(...Object.keys(newPlates).map(Number))
    const validActivePlate = activePlate > maxPlate ? 1 : activePlate

    set({ plates: newPlates, activePlate: validActivePlate })
  },

  toggleWell: (plateNumber: number, wId: string) => {
    const { plates, replicateMode } = get()
    const plateWells = new Set(plates[plateNumber] ?? new Set<string>())

    const parsed = parseWellId(wId)
    if (!parsed || isStandardCol(parsed.col + 1)) return // Cannot toggle standard wells

    const isFilled = plateWells.has(wId)

    if (isFilled) {
      plateWells.delete(wId)
    } else {
      plateWells.add(wId)
    }

    // In duplicates mode, also toggle the pair
    if (replicateMode === 'duplicates') {
      const pair = getDuplicatePair(parsed.row, parsed.col)
      if (pair) {
        const pairId = wellId(pair.row, pair.col + 1) // convert 0-indexed col back to 1-indexed
        if (isFilled) {
          plateWells.delete(pairId)
        } else {
          plateWells.add(pairId)
        }
      }
    }

    set({
      plates: { ...plates, [plateNumber]: plateWells }
    })
  },

  setWellRange: (plateNumber: number, wellIds: Set<string>, filled: boolean) => {
    const { plates, replicateMode } = get()
    const plateWells = new Set(plates[plateNumber] ?? new Set<string>())

    const allIds = new Set(wellIds)

    // In duplicates mode, include pairs for all wells in the range
    if (replicateMode === 'duplicates') {
      for (const wId of wellIds) {
        const parsed = parseWellId(wId)
        if (!parsed) continue
        const pair = getDuplicatePair(parsed.row, parsed.col)
        if (pair) {
          allIds.add(wellId(pair.row, pair.col + 1))
        }
      }
    }

    for (const wId of allIds) {
      const parsed = parseWellId(wId)
      if (!parsed || isStandardCol(parsed.col + 1)) continue // Skip standard wells

      if (filled) {
        plateWells.add(wId)
      } else {
        plateWells.delete(wId)
      }
    }

    set({
      plates: { ...plates, [plateNumber]: plateWells }
    })
  },

  addPlate: () => {
    const { plates } = get()
    const plateNumbers = Object.keys(plates).map(Number)
    const nextPlate = Math.max(...plateNumbers, 0) + 1
    set({
      plates: { ...plates, [nextPlate]: new Set<string>() },
      activePlate: nextPlate
    })
  },

  removePlate: (plateNumber: number) => {
    const { plates, activePlate } = get()
    const newPlates = { ...plates }
    delete newPlates[plateNumber]

    // Ensure at least one plate exists
    const remaining = Object.keys(newPlates).map(Number)
    if (remaining.length === 0) {
      newPlates[1] = new Set<string>()
    }

    const validActive =
      activePlate === plateNumber
        ? Math.min(...Object.keys(newPlates).map(Number))
        : activePlate

    set({ plates: newPlates, activePlate: validActive })
  },

  clearPlate: (plateNumber: number) => {
    const { plates } = get()
    set({
      plates: { ...plates, [plateNumber]: new Set<string>() }
    })
  },

  setActivePlate: (plateNumber: number) => {
    set({ activePlate: plateNumber })
  },

  reset: () => {
    set({
      sampleCount: 0,
      plates: { 1: new Set<string>() },
      activePlate: 1,
      replicateMode: 'singles'
    })
  },

  // Replace the plates state with an incoming Record<number, string[]> snapshot.
  // Converts each string[] to a Set<string>. Does NOT mutate sampleCount or
  // replicateMode — per D-24, those are set by the caller BEFORE loadPlates
  // runs so the auto-fill cascade has already completed; loadPlates then
  // overwrites the cascade's output with the saved layout. See runStore.loadRun.
  loadPlates: (plates: Record<number, string[]>) => {
    const converted: Record<number, Set<string>> = {}
    for (const [k, v] of Object.entries(plates)) {
      converted[Number(k)] = new Set(v)
    }
    set({ plates: converted })
  },

  // Computed
  getPlateCount: () => {
    return Object.keys(get().plates).length
  },

  getTotalAssigned: () => {
    const { plates } = get()
    let total = 0
    for (const wells of Object.values(plates)) {
      total += wells.size
    }
    return total
  },

  getSamplesRemaining: () => {
    const { sampleCount, replicateMode } = get()
    const totalWells = get().getTotalAssigned()
    const totalSamples =
      replicateMode === 'duplicates' ? Math.floor(totalWells / 2) : totalWells
    return sampleCount - totalSamples
  },

  getMinPlatesNeeded: () => {
    const { sampleCount, replicateMode } = get()
    if (sampleCount <= 0) return 0
    const wellsPerPlate =
      replicateMode === 'singles' ? UNKNOWN_WELLS_SINGLES : UNKNOWN_WELLS_DUPLICATES
    return Math.ceil(sampleCount / wellsPerPlate)
  },

  getPlateWells: (plateNumber: number) => {
    return get().plates[plateNumber] ?? new Set<string>()
  },

  // Snapshot the current plates state as a plain Record<number, string[]>
  // suitable for Zod-serializable IPC transport. Sets cannot traverse the
  // IPC bridge (structured-clone drops them).
  getPlatesSnapshot: () => {
    const { plates } = get()
    const out: Record<number, string[]> = {}
    for (const [k, v] of Object.entries(plates)) {
      out[Number(k)] = Array.from(v)
    }
    return out
  }
}))
