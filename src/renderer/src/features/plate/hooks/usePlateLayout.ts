import { useMemo } from 'react'
import { useCalculatorStore } from '../../../stores/calculatorStore'
import { usePlateStore } from '../../../stores/plateStore'
import type { WellData, PlateLayout } from '../../../../../shared/types/plate'
import { ROWS, COLS, STANDARD_COLS } from '../../../../../shared/types/plate'

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
 * - For duplicates mode (SMK3-RPL-02): vertical pairs (A,B)(C,D)(E,F)(G,H) within
 *   each unknown column 4-12. 9 cols × 4 pairs/col = 36 samples per plate.
 * - Sample numbering continues across plates
 */
export function usePlateLayout(): UsePlateLayoutResult {
  const { sampleCount, replicateMode, getOutputs } = useCalculatorStore()
  const plateCount = usePlateStore().getPlateCount()
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
        // Duplicates: vertical pairs (A,B)(C,D)(E,F)(G,H) within each
        // unknown column 4-12 (SMK3-RPL-02). 9 cols × 4 pairs/col = 36
        // samples per plate (= UNKNOWN_WELLS_DUPLICATES cap).
        const PAIR_TOP_ROWS = [0, 2, 4, 6] as const // A pairs with B; C with D; E with F; G with H
        for (const col of unknownCols) {
          for (const topRow of PAIR_TOP_ROWS) {
            if (globalSampleIndex > sampleCount) break
            const bottomRow = topRow + 1
            wells[topRow][col - 1] = {
              id: `${ROWS[topRow]}${col}`,
              row: ROWS[topRow],
              col,
              type: 'unknown',
              sampleIndex: globalSampleIndex
            }
            wells[bottomRow][col - 1] = {
              id: `${ROWS[bottomRow]}${col}`,
              row: ROWS[bottomRow],
              col,
              type: 'unknown',
              sampleIndex: globalSampleIndex
            }
            globalSampleIndex++
          }
          if (globalSampleIndex > sampleCount) break
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
