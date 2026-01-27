import { useMemo } from 'react'
import { useCalculatorStore } from '../../../stores/calculatorStore'
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
 * - Standards always occupy columns 10-12 (24 wells per plate)
 * - Unknown samples fill from A1, going down column first, then across
 * - For singles mode: each sample uses 1 well
 * - For duplicates mode: each sample uses 2 adjacent wells in the same row
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

    // Unknown columns are 1-9 (standards in 10-12)
    const unknownCols = COLS.filter(
      (col) => !STANDARD_COLS.includes(col as (typeof STANDARD_COLS)[number])
    )

    const plateLayouts: PlateLayout[] = []

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
        // 9 unknown columns × 8 rows = 72 wells per plate
        const wellsPerPlate = unknownCols.length * ROWS.length
        const startSample = p * wellsPerPlate + 1

        let wellIndex = 0
        for (const col of unknownCols) {
          for (let rowIndex = 0; rowIndex < ROWS.length; rowIndex++) {
            const currentSample = startSample + wellIndex
            if (currentSample <= sampleCount) {
              wells[rowIndex][col - 1] = {
                id: `${ROWS[rowIndex]}${col}`,
                row: ROWS[rowIndex],
                col,
                type: 'unknown',
                sampleIndex: currentSample
              }
            }
            wellIndex++
          }
        }
      } else {
        // Duplicates: each sample uses 2 wells horizontally (same row)
        // Pairs: columns 1-2, 3-4, 5-6, 7-8 (column 9 unpaired, left empty)
        // 4 pairs per row × 8 rows = 32 samples per plate
        const pairsPerRow = 4
        const samplesPerPlate = pairsPerRow * ROWS.length
        const startSample = p * samplesPerPlate + 1

        for (let rowIndex = 0; rowIndex < ROWS.length; rowIndex++) {
          for (let pairIndex = 0; pairIndex < pairsPerRow; pairIndex++) {
            const currentSample = startSample + rowIndex * pairsPerRow + pairIndex
            const col1 = pairIndex * 2 + 1 // 1, 3, 5, 7
            const col2 = col1 + 1 // 2, 4, 6, 8

            if (currentSample <= sampleCount) {
              wells[rowIndex][col1 - 1] = {
                id: `${ROWS[rowIndex]}${col1}`,
                row: ROWS[rowIndex],
                col: col1,
                type: 'unknown',
                sampleIndex: currentSample
              }
              wells[rowIndex][col2 - 1] = {
                id: `${ROWS[rowIndex]}${col2}`,
                row: ROWS[rowIndex],
                col: col2,
                type: 'unknown',
                sampleIndex: currentSample
              }
            }
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
