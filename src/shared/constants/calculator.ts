/**
 * Plate geometry constants for 96-well microtiter plates
 */

/** Total wells in a standard plate */
export const TOTAL_WELLS = 96

/** Wells reserved for protein standards (never changes) */
export const STANDARD_WELLS = 24

/** Unknown wells available in singles mode */
export const UNKNOWN_WELLS_SINGLES = 72

/** Unknown wells available in duplicates mode */
export const UNKNOWN_WELLS_DUPLICATES = 36

/**
 * Default volumes (in microliters)
 * These can be made configurable in future versions
 */
export const DEFAULT_VOLUME_PER_WELL = 25 // µL
export const DEAD_VOLUME_PER_SETUP_UL = 2000 // µL contributed per setup (Smoke 3 SMK3-05: total dead volume = numberOfSetups × this constant)

/**
 * Single analyte limits
 */
export const MAX_SINGLES_PREMIX = 5
export const MAX_SINGLES_CUSTOM = Infinity

/**
 * Replicate modes
 */
export type ReplicateMode = 'singles' | 'duplicates'

/**
 * Request types
 */
export type RequestType = 'premix' | 'premix_singles' | 'custom'

/**
 * Duplicate pair layout constants (1-indexed columns)
 */

/** Horizontal duplicate pairs: columns 4-5, 6-7, 8-9, 10-11 */
export const DUPLICATE_HORIZONTAL_PAIRS: readonly [number, number][] = [
  [4, 5],
  [6, 7],
  [8, 9],
  [10, 11]
]

/** Column 12 uses vertical pairs: A<->E, B<->F, C<->G, D<->H */
export const DUPLICATE_VERTICAL_COL = 12

/** Unknown columns in singles mode (1-indexed) */
export const UNKNOWN_COLS_SINGLES = [4, 5, 6, 7, 8, 9, 10, 11, 12] as const

/**
 * Get the duplicate pair partner for a given well position.
 *
 * @param row 0-indexed row (0-7, where 0=A, 7=H)
 * @param col 0-indexed column (0-11, where 0=column 1, 11=column 12)
 * @returns The partner well position { row, col } (0-indexed), or null for standard columns
 */
export function getDuplicatePair(
  row: number,
  col: number
): { row: number; col: number } | null {
  // Standard columns (0-indexed 0, 1, 2 = 1-indexed 1, 2, 3) have no pairs
  if (col <= 2) {
    return null
  }

  // Column 12 (0-indexed 11): vertical pairs A<->E, B<->F, C<->G, D<->H
  if (col === 11) {
    return { row: row < 4 ? row + 4 : row - 4, col: 11 }
  }

  // Columns 4-11 (0-indexed 3-10): horizontal pairs
  // 1-indexed columns: 4-5, 6-7, 8-9, 10-11
  const oneIndexedCol = col + 1
  if (oneIndexedCol % 2 === 0) {
    // Even 1-indexed column (4, 6, 8, 10): pair with next column
    return { row, col: col + 1 }
  } else {
    // Odd 1-indexed column (5, 7, 9, 11): pair with previous column
    return { row, col: col - 1 }
  }
}

/**
 * Get unknown wells per plate based on replicate mode
 */
export function getUnknownWellsPerPlate(mode: ReplicateMode): number {
  return mode === 'singles' ? UNKNOWN_WELLS_SINGLES : UNKNOWN_WELLS_DUPLICATES
}

/**
 * Get max singles allowed based on request type
 */
export function getMaxSingles(requestType: RequestType): number {
  switch (requestType) {
    case 'premix':
      return 0
    case 'premix_singles':
      return MAX_SINGLES_PREMIX
    case 'custom':
      return MAX_SINGLES_CUSTOM
  }
}
