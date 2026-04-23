import { create } from 'zustand'
import {
  UNKNOWN_WELLS_SINGLES,
  UNKNOWN_WELLS_DUPLICATES,
  getDuplicatePair,
  DUPLICATE_HORIZONTAL_PAIRS,
  DUPLICATE_VERTICAL_COL
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
    const { sampleCount, replicateMode } = get()

    if (sampleCount <= 0) {
      set({ plates: { 1: new Set<string>() }, activePlate: 1 })
      return
    }

    const wellsPerPlate =
      replicateMode === 'singles' ? UNKNOWN_WELLS_SINGLES : UNKNOWN_WELLS_DUPLICATES
    const minPlates = Math.ceil(sampleCount / wellsPerPlate)

    const newPlates: Record<number, Set<string>> = {}
    let samplesAssigned = 0

    for (let p = 1; p <= minPlates; p++) {
      const plateWells = new Set<string>()

      if (replicateMode === 'singles') {
        // Fill column-first: A4, B4, C4... H4, A5, B5... for columns 4-12
        for (const col of UNKNOWN_COLS_ORDERED) {
          for (let rowIndex = 0; rowIndex < ROWS.length; rowIndex++) {
            if (samplesAssigned >= sampleCount) break
            plateWells.add(wellId(rowIndex, col))
            samplesAssigned++
          }
          if (samplesAssigned >= sampleCount) break
        }
      } else {
        // Duplicates mode: horizontal pairs (cols 4-5, 6-7, 8-9, 10-11), then
        // vertical pairs in col 12. Per D-4.1-01 (Phase 4.1), fill COLUMN-MAJOR:
        // each column-pair fills top-to-bottom before moving to the next pair.
        // This matches how Hamilton liquid handlers pipette (column-by-column).
        for (const [col1, col2] of DUPLICATE_HORIZONTAL_PAIRS) {
          for (let rowIndex = 0; rowIndex < ROWS.length; rowIndex++) {
            if (samplesAssigned >= sampleCount) break
            plateWells.add(wellId(rowIndex, col1))
            plateWells.add(wellId(rowIndex, col2))
            samplesAssigned++
          }
          if (samplesAssigned >= sampleCount) break
        }

        // Vertical pairs in column 12: A/E, B/F, C/G, D/H (4 pairs)
        if (samplesAssigned < sampleCount) {
          for (let topRow = 0; topRow < 4; topRow++) {
            if (samplesAssigned >= sampleCount) break
            plateWells.add(wellId(topRow, DUPLICATE_VERTICAL_COL))
            plateWells.add(wellId(topRow + 4, DUPLICATE_VERTICAL_COL))
            samplesAssigned++
          }
        }
      }

      newPlates[p] = plateWells
    }

    // Ensure activePlate is within range
    const { activePlate } = get()
    const validActivePlate = activePlate > minPlates ? 1 : activePlate

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
