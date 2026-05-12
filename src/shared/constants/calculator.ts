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

/** Unknown columns in singles mode (1-indexed) */
export const UNKNOWN_COLS_SINGLES = [4, 5, 6, 7, 8, 9, 10, 11, 12] as const

/**
 * Get the duplicate pair partner for a given well position.
 *
 * Smoke 3 SMK3-RPL-02 geometry (Phase 14 D-23): adjacent-row partner
 * within the SAME column for every unknown column (1-indexed 4-12).
 * Row 0 (A) ↔ Row 1 (B); Row 2 (C) ↔ Row 3 (D); Row 4 (E) ↔ Row 5 (F);
 * Row 6 (G) ↔ Row 7 (H). Standard columns (1-3) have no pair.
 *
 * Supersedes the Phase-3.3 horizontal-pair + col-12-vertical-special-case
 * geometry — uniform geometry across cols 4-12 simplifies the operator's
 * mental model and matches the PRD §Hierarchy Third Step duplicate layout.
 *
 * @param row 0-indexed row (0-7, where 0=A, 7=H)
 * @param col 0-indexed column (0-11, where 0=column 1, 11=column 12)
 * @returns The partner well position { row, col } (0-indexed) — adjacent
 *          row in the same column — or null for standard columns (col ≤ 2).
 */
export function getDuplicatePair(
  row: number,
  col: number
): { row: number; col: number } | null {
  // Standard columns (0-indexed 0/1/2 = 1-indexed 1/2/3) have no pairs.
  if (col <= 2) {
    return null
  }
  // Unknown columns 0-indexed 3-11 (1-indexed 4-12): adjacent-row pair in SAME column.
  const partnerRow = row % 2 === 0 ? row + 1 : row - 1
  return { row: partnerRow, col }
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
