import { useMemo, useState, useCallback, useRef, useEffect } from 'react'
import { usePlateLayout } from '../hooks/usePlateLayout'
import { usePlateStore } from '../../../stores/plateStore'
import { useWellSelection } from '../hooks/useWellSelection'
import { PlateGrid } from './PlateGrid'
import { PlateToolbar } from './PlateToolbar'
import { ROWS, STANDARD_COLS } from '../../../../../shared/types/plate'
import { getDuplicatePair } from '../../../../../shared/constants/calculator'

/**
 * Compute dynamic sample indices from plateStore selections.
 * Numbers wells sequentially across all plates in column-first order,
 * so indices stay correct regardless of manual selection changes.
 */
function computeSampleIndexMap(
  plates: Record<number, Set<string>>,
  replicateMode: 'singles' | 'duplicates'
): Map<string, number> {
  const indexMap = new Map<string, number>()
  const plateNumbers = Object.keys(plates)
    .map(Number)
    .sort((a, b) => a - b)

  // Sort wells in column-first order: A4, B4... H4, A5, B5...
  const sortWells = (wells: Set<string>): string[] =>
    [...wells].sort((a, b) => {
      const aCol = parseInt(a.slice(1))
      const bCol = parseInt(b.slice(1))
      if (aCol !== bCol) return aCol - bCol
      return a.charCodeAt(0) - b.charCodeAt(0)
    })

  let sampleIndex = 1

  for (const plateNum of plateNumbers) {
    const wells = plates[plateNum]
    if (!wells || wells.size === 0) continue
    const sorted = sortWells(wells)

    if (replicateMode === 'singles') {
      for (const wId of sorted) {
        indexMap.set(`${plateNum}:${wId}`, sampleIndex)
        sampleIndex++
      }
    } else {
      // Duplicates: each pair shares a sample index
      const seen = new Set<string>()
      for (const wId of sorted) {
        if (seen.has(wId)) continue
        seen.add(wId)

        const row = wId.charCodeAt(0) - 65
        const col = parseInt(wId.slice(1)) - 1
        const pair = getDuplicatePair(row, col)

        indexMap.set(`${plateNum}:${wId}`, sampleIndex)
        if (pair) {
          const pairId = `${String.fromCharCode(65 + pair.row)}${pair.col + 1}`
          seen.add(pairId)
          indexMap.set(`${plateNum}:${pairId}`, sampleIndex)
        }
        sampleIndex++
      }
    }
  }

  return indexMap
}

/**
 * Panel displaying interactive plate layout with multi-plate support.
 * Uses PlateToolbar for plate navigation and management.
 * Wires useWellSelection hook to plateStore for interactive well click/drag.
 * Renders empty state when calculator has no outputs.
 */
export function PlatePanel() {
  const { layouts, hasOutputs } = usePlateLayout()
  const {
    plates,
    activePlate,
    replicateMode,
    setActivePlate,
    addPlate,
    removePlate,
    clearPlate,
    getPlateCount,
    getSamplesRemaining,
    getPlateWells,
    setWellRange
  } = usePlateStore()

  const plateCount = getPlateCount()
  const samplesRemaining = getSamplesRemaining()
  const filledWells = getPlateWells(activePlate)

  // Compute dynamic sample indices from actual plateStore selections
  const sampleIndexMap = useMemo(
    () => computeSampleIndexMap(plates, replicateMode),
    [plates, replicateMode]
  )

  // Column header drag state
  const [highlightedColumn, setHighlightedColumn] = useState<number | null>(null)
  const columnDragRef = useRef<{ action: 'add' | 'remove' } | null>(null)

  const applyColumnAction = useCallback(
    (col: number, action: 'add' | 'remove') => {
      const columnWellIds = ROWS.map((row) => `${row}${col}`)
      if (action === 'add') {
        if (getSamplesRemaining() <= 0) return
        setWellRange(activePlate, new Set(columnWellIds), true)
      } else {
        setWellRange(activePlate, new Set(columnWellIds), false)
      }
    },
    [activePlate, setWellRange, getSamplesRemaining]
  )

  const handleColumnMouseDown = useCallback(
    (col: number) => {
      const columnWellIds = ROWS.map((row) => `${row}${col}`)
      const allFilled = columnWellIds.every((id) => filledWells.has(id))
      const action = allFilled ? 'remove' : 'add'

      columnDragRef.current = { action }
      applyColumnAction(col, action)
      setHighlightedColumn(col)
    },
    [filledWells, applyColumnAction]
  )

  const handleColumnMouseEnter = useCallback(
    (col: number) => {
      setHighlightedColumn(col)
      if (columnDragRef.current) {
        applyColumnAction(col, columnDragRef.current.action)
      }
    },
    [applyColumnAction]
  )

  const handleColumnMouseLeave = useCallback(() => {
    if (!columnDragRef.current) {
      setHighlightedColumn(null)
    }
  }, [])

  const endColumnDrag = useCallback(() => {
    columnDragRef.current = null
    setHighlightedColumn(null)
  }, [])

  // End column drag on mouseUp anywhere in the window
  useEffect(() => {
    const onMouseUp = () => {
      if (columnDragRef.current) {
        endColumnDrag()
      }
    }
    window.addEventListener('mouseup', onMouseUp)
    return () => window.removeEventListener('mouseup', onMouseUp)
  }, [endColumnDrag])

  const { hoveredWells, handleMouseDown, handleMouseEnter, handleMouseUp } =
    useWellSelection({
      standardCols: STANDARD_COLS,
      replicateMode,
      filledWells,
      onSelectionChange: (wellIds, action) => {
        if (action === 'add') {
          if (getSamplesRemaining() <= 0) return // All samples assigned
          setWellRange(activePlate, wellIds, true)
        } else {
          setWellRange(activePlate, wellIds, false)
        }
      }
    })

  if (!hasOutputs || layouts.length === 0) {
    return (
      <div className="text-center py-8 text-[var(--color-muted)]">
        Enter sample count and other inputs to see plate layout
      </div>
    )
  }

  const currentLayout = layouts[activePlate - 1]

  // Safety check: if activePlate is out of range, show first plate
  const layout = currentLayout ?? layouts[0]
  if (!layout) {
    return null
  }

  const handleRemovePlate = () => {
    removePlate(activePlate)
  }

  const handleClearPlate = () => {
    clearPlate(activePlate)
  }

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-medium text-[var(--color-foreground)]">Plate Layout</h3>

      <PlateToolbar
        activePlate={activePlate}
        plateCount={plateCount}
        samplesRemaining={samplesRemaining}
        onSetActivePlate={setActivePlate}
        onAddPlate={addPlate}
        onRemovePlate={handleRemovePlate}
        onClearPlate={handleClearPlate}
      />

      <PlateGrid
        wells={layout.wells}
        selectedWells={filledWells}
        hoveredWells={hoveredWells}
        standardCols={STANDARD_COLS}
        sampleIndexMap={sampleIndexMap}
        activePlate={activePlate}
        onCellMouseDown={handleMouseDown}
        onCellMouseEnter={handleMouseEnter}
        onCellMouseUp={handleMouseUp}
        highlightedColumn={highlightedColumn}
        onColumnMouseDown={handleColumnMouseDown}
        onColumnMouseEnter={handleColumnMouseEnter}
        onColumnMouseLeave={handleColumnMouseLeave}
      />

      <p className="text-xs text-[var(--color-muted)]">
        Click a well to toggle it. Click and drag to select a range. Click or drag across column headers (4-12) to toggle entire columns.
      </p>
    </div>
  )
}
