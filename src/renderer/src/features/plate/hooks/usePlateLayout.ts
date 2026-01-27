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
 * - Standards always occupy columns 1-3 (24 wells per plate)
 * - Unknown samples fill from column 4 onwards, row by row
 * - For singles mode: each sample uses 1 well
 * - For duplicates mode: each sample uses 2 adjacent wells in the same row
 * - Sample numbering continues across plates
 */
export function usePlateLayout(): UsePlateLayoutResult {
  const { sampleCount, replicateMode, plateCount } = useCalculatorStore()
  const outputs = useCalculatorStore((state) => state.getOutputs())

  const layouts = useMemo(() => {
    if (!outputs || sampleCount <= 0 || plateCount <= 0) {
      return []
    }

    let sampleIndex = 1

    const plateLayouts: PlateLayout[] = []

    for (let p = 0; p < plateCount; p++) {
      const wells: WellData[][] = []

      for (let rowIndex = 0; rowIndex < ROWS.length; rowIndex++) {
        const row = ROWS[rowIndex]
        const rowWells: WellData[] = []

        for (let colIndex = 0; colIndex < COLS.length; colIndex++) {
          const col = COLS[colIndex]
          const wellId = `${row}${col}`

          // Standards occupy columns 1-3
          if (STANDARD_COLS.includes(col as typeof STANDARD_COLS[number])) {
            rowWells.push({
              id: wellId,
              row,
              col,
              type: 'standard'
            })
            continue
          }

          // Unknown wells in columns 4-12
          // For singles: 1 well per sample
          // For duplicates: 2 adjacent wells per sample (same row)

          if (replicateMode === 'singles') {
            // Each sample uses 1 well
            if (sampleIndex <= sampleCount) {
              rowWells.push({
                id: wellId,
                row,
                col,
                type: 'unknown',
                sampleIndex
              })
              sampleIndex++
            } else {
              rowWells.push({
                id: wellId,
                row,
                col,
                type: 'empty'
              })
            }
          } else {
            // Duplicates: each sample uses 2 wells
            // Wells are filled in pairs: columns 4-5, 6-7, 8-9, 10-11
            // Column 12 is unpaired, treat as empty

            // Determine position within unknown columns (0-indexed)
            const unknownColIndex = col - 4

            // Handle the last column (12) which doesn't have a pair
            if (unknownColIndex === 8) {
              rowWells.push({
                id: wellId,
                row,
                col,
                type: 'empty'
              })
              continue
            }

            // Calculate which pair this column belongs to (0-indexed)
            const pairIndex = Math.floor(unknownColIndex / 2)

            // Calculate sample number for this pair
            // 4 complete pairs per row (columns 4-11)
            const pairsPerRow = 4
            const pairsInPreviousPlates = p * pairsPerRow * ROWS.length
            const pairsInPreviousRows = rowIndex * pairsPerRow
            const currentPairSample = pairsInPreviousPlates + pairsInPreviousRows + pairIndex + 1

            if (currentPairSample <= sampleCount) {
              rowWells.push({
                id: wellId,
                row,
                col,
                type: 'unknown',
                sampleIndex: currentPairSample
              })
            } else {
              rowWells.push({
                id: wellId,
                row,
                col,
                type: 'empty'
              })
            }
          }
        }

        wells.push(rowWells)
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
