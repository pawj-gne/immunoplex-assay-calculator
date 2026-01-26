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
export const DEFAULT_DEAD_VOLUME = 2000 // µL (2 mL)

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
