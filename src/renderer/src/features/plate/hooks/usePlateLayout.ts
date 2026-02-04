import { useMemo } from 'react'
import { useCalculatorStore } from '../../../stores/calculatorStore'
import type { WellData, PlateLayout } from '../../../../../shared/types/plate'
import { ROWS, COLS, STANDARD_COLS } from '../../../../../shared/types/plate'
import {
  DUPLICATE_HORIZONTAL_PAIRS,
  DUPLICATE_VERTICAL_COL
} from '../../../../../shared/constants/calculator'

interface UsePlateLayoutResult {
  layouts: PlateLayout[]
  hasOutputs: boolean
}

/**
 * Hook that derives plate layout from calculator store state.
 *
 * Layout rules:
 * - Standards always occupy columns 1-3 (24 wells per plate)
 * - Unknown samples fill columns 4-12
 * - For singles mode: each sample uses 1 well, filled column-first (A4, B4... H4, A5...)
 * - For duplicates mode: horizontal pairs in cols 4-5, 6-7, 8-9, 10-11 (4 pairs x 8 rows = 32)
 *   plus vertical pairs in col 12 (A/E, B/F, C/G, D/H = 4 pairs). Total: 36 samples per plate.
 * - Sample numbering continues across plates
 */
export function usePlateLayout(): UsePlateLayoutResult {
  const { sampleCount, replicateMode, plateCount, getOutputs } = useCalculatorStore()
  const outputs = getOutputs()

  const layouts = useMemo(() => {
    // Defensive checks for invalid values
    if (
      !outputs ||
      !Number.isFinite(sampleCount) ||
      !Number.isFinite(plateCount) ||
      sampleCount <= 0 ||
      plateCount <= 0
    ) {
      return []
    }

    // Unknown columns are 4-12 (standards in 1-3)
    const unknownCols = COLS.filter(
      (col) => !STANDARD_COLS.includes(col as (typeof STANDARD_COLS)[number])
    )

    const plateLayouts: PlateLayout[] = []
    let globalSampleIndex = 1

    for (let p = 0; p < plateCount; p++) {
      // Initialize empty well grid
      const wells: WellData[][] = ROWS.map((row) =>
        COLS.map((col) => ({
          id: `${row}${col}`,
          row,
          col,
          type: STANDARD_COLS.includes(col as (typeof STANDARD_COLS)[number])
            ? ('standard' as const)
            : ('empty' as const)
        }))
      )

      if (replicateMode === 'singles') {
        // Singles: fill down columns first, then across
        // 9 unknown columns (4-12) x 8 rows = 72 wells per plate
        for (const col of unknownCols) {
          for (let rowIndex = 0; rowIndex < ROWS.length; rowIndex++) {
            if (globalSampleIndex > sampleCount) break
            wells[rowIndex][col - 1] = {
              id: `${ROWS[rowIndex]}${col}`,
              row: ROWS[rowIndex],
              col,
              type: 'unknown',
              sampleIndex: globalSampleIndex
            }
            globalSampleIndex++
          }
          if (globalSampleIndex > sampleCount) break
        }
      } else {
        // Duplicates: each sample uses 2 wells
        // Horizontal pairs: cols 4-5, 6-7, 8-9, 10-11 (4 pairs per row x 8 rows = 32 samples)
        // Fill row-by-row for horizontal pairs
        for (let rowIndex = 0; rowIndex < ROWS.length; rowIndex++) {
          for (const [col1, col2] of DUPLICATE_HORIZONTAL_PAIRS) {
            if (globalSampleIndex > sampleCount) break

            wells[rowIndex][col1 - 1] = {
              id: `${ROWS[rowIndex]}${col1}`,
              row: ROWS[rowIndex],
              col: col1,
              type: 'unknown',
              sampleIndex: globalSampleIndex
            }
            wells[rowIndex][col2 - 1] = {
              id: `${ROWS[rowIndex]}${col2}`,
              row: ROWS[rowIndex],
              col: col2,
              type: 'unknown',
              sampleIndex: globalSampleIndex
            }
            globalSampleIndex++
          }
          if (globalSampleIndex > sampleCount) break
        }

        // Vertical pairs in column 12: A/E, B/F, C/G, D/H (4 pairs)
        if (globalSampleIndex <= sampleCount) {
          for (let topRow = 0; topRow < 4; topRow++) {
            if (globalSampleIndex > sampleCount) break
            const bottomRow = topRow + 4

            wells[topRow][DUPLICATE_VERTICAL_COL - 1] = {
              id: `${ROWS[topRow]}${DUPLICATE_VERTICAL_COL}`,
              row: ROWS[topRow],
              col: DUPLICATE_VERTICAL_COL,
              type: 'unknown',
              sampleIndex: globalSampleIndex
            }
            wells[bottomRow][DUPLICATE_VERTICAL_COL - 1] = {
              id: `${ROWS[bottomRow]}${DUPLICATE_VERTICAL_COL}`,
              row: ROWS[bottomRow],
              col: DUPLICATE_VERTICAL_COL,
              type: 'unknown',
              sampleIndex: globalSampleIndex
            }
            globalSampleIndex++
          }
        }
      }

      plateLayouts.push({
        plateNumber: p + 1,
        wells
      })
    }

    return plateLayouts
  }, [sampleCount, replicateMode, plateCount, outputs])

  return {
    layouts,
    hasOutputs: outputs !== null
  }
}
