/**
 * Types for 96-well plate visualization
 */

export type WellType = 'standard' | 'unknown' | 'empty'

export interface WellData {
  id: string // e.g., "A1"
  row: string // e.g., "A"
  col: number // e.g., 1
  type: WellType
  sampleIndex?: number // For unknown wells, which sample number
}

export interface PlateLayout {
  plateNumber: number
  wells: WellData[][]
}

export const ROWS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'] as const
export const COLS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] as const

// Standards occupy columns 10-12 (24 wells per plate)
export const STANDARD_COLS = [10, 11, 12] as const
