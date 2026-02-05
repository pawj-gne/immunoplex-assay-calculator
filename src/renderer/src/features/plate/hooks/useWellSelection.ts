import { useState, useRef, useEffect, useCallback } from 'react'
import { getDuplicatePair } from '../../../../../shared/constants/calculator'

interface UseWellSelectionOptions {
  standardCols: readonly number[] // 1-indexed columns that are standards (not selectable) - [1,2,3]
  replicateMode: 'singles' | 'duplicates'
  filledWells: Set<string> // current state from plateStore
  onSelectionChange: (wellIds: Set<string>, action: 'add' | 'remove') => void
}

interface UseWellSelectionReturn {
  hoveredWells: Set<string> // preview during drag (visual only)
  handleMouseDown: (row: number, col: number, event: React.MouseEvent) => void
  handleMouseEnter: (row: number, col: number) => void
  handleMouseUp: () => void
}

/**
 * Convert 0-indexed row and col to well ID string (e.g., row=0, col=3 -> "A4")
 */
function toWellId(row: number, col: number): string {
  return `${String.fromCharCode(65 + row)}${col + 1}`
}

/**
 * Custom hook for mouse-based grid cell selection with click, drag,
 * Ctrl+click, and Shift+click support for the 96-well plate.
 *
 * Performance: Only `hoveredWells` is React state (triggers re-render for visual preview).
 * All drag tracking uses refs to avoid re-renders during mouse movement.
 *
 * The hook does NOT own the selection state - it calls `onSelectionChange`
 * to delegate to plateStore.
 */
export function useWellSelection({
  standardCols,
  replicateMode,
  filledWells,
  onSelectionChange
}: UseWellSelectionOptions): UseWellSelectionReturn {
  const [hoveredWells, setHoveredWells] = useState<Set<string>>(new Set())

  // Drag state stored in refs to avoid re-renders during mouse movement
  const isDragging = useRef(false)
  const dragStart = useRef<{ row: number; col: number } | null>(null)
  const dragAction = useRef<'add' | 'remove'>('add')
  const lastClicked = useRef<{ row: number; col: number } | null>(null)

  /**
   * Check if a 0-indexed column is a standard column (not selectable).
   */
  const isStandardCol = useCallback(
    (col: number): boolean => {
      return standardCols.includes(col + 1)
    },
    [standardCols]
  )

  /**
   * Get all cells in a rectangle from start to end positions,
   * excluding standard columns. In duplicates mode, includes paired wells.
   */
  const getCellsInRange = useCallback(
    (
      start: { row: number; col: number },
      end: { row: number; col: number }
    ): Set<string> => {
      const cells = new Set<string>()
      const minRow = Math.min(start.row, end.row)
      const maxRow = Math.max(start.row, end.row)
      const minCol = Math.min(start.col, end.col)
      const maxCol = Math.max(start.col, end.col)

      for (let r = minRow; r <= maxRow; r++) {
        for (let c = minCol; c <= maxCol; c++) {
          if (isStandardCol(c)) continue
          cells.add(toWellId(r, c))

          if (replicateMode === 'duplicates') {
            const pair = getDuplicatePair(r, c)
            if (pair) {
              cells.add(toWellId(pair.row, pair.col))
            }
          }
        }
      }

      return cells
    },
    [isStandardCol, replicateMode]
  )

  /**
   * Finalize the current drag operation by calling onSelectionChange
   * with the hovered wells and resetting drag state.
   */
  const finalizeDrag = useCallback(() => {
    // Capture ref values synchronously BEFORE resetting them,
    // because the setState callback runs asynchronously during React's render phase
    const wasDragging = isDragging.current
    const action = dragAction.current
    isDragging.current = false
    dragStart.current = null

    setHoveredWells((currentHovered) => {
      if (wasDragging && currentHovered.size > 0) {
        onSelectionChange(currentHovered, action)
      }
      return new Set()
    })
  }, [onSelectionChange])

  const handleMouseDown = useCallback(
    (row: number, col: number, event: React.MouseEvent) => {
      // Standard columns are not selectable
      if (isStandardCol(col)) return

      // Prevent text selection during drag
      event.preventDefault()

      const wellId = toWellId(row, col)

      if (event.shiftKey && lastClicked.current) {
        // Shift+click: select range from last clicked to current
        const range = getCellsInRange(lastClicked.current, { row, col })
        // Determine action based on whether the clicked well is filled
        const action: 'add' | 'remove' = filledWells.has(wellId)
          ? 'remove'
          : 'add'
        onSelectionChange(range, action)
      } else if (event.ctrlKey || event.metaKey) {
        // Ctrl+click: toggle single well (and pair in duplicates mode)
        const wells = new Set<string>([wellId])
        if (replicateMode === 'duplicates') {
          const pair = getDuplicatePair(row, col)
          if (pair) {
            wells.add(toWellId(pair.row, pair.col))
          }
        }
        const action: 'add' | 'remove' = filledWells.has(wellId)
          ? 'remove'
          : 'add'
        onSelectionChange(wells, action)
      } else {
        // Plain click: start new drag selection
        isDragging.current = true
        dragStart.current = { row, col }
        dragAction.current = filledWells.has(wellId) ? 'remove' : 'add'

        // Set initial hover preview
        const initialWells = new Set<string>([wellId])
        if (replicateMode === 'duplicates') {
          const pair = getDuplicatePair(row, col)
          if (pair) {
            initialWells.add(toWellId(pair.row, pair.col))
          }
        }
        setHoveredWells(initialWells)
      }

      lastClicked.current = { row, col }
    },
    [isStandardCol, getCellsInRange, filledWells, onSelectionChange, replicateMode]
  )

  const handleMouseEnter = useCallback(
    (row: number, col: number) => {
      if (!isDragging.current || !dragStart.current) return

      const range = getCellsInRange(dragStart.current, { row, col })
      setHoveredWells(range)
    },
    [getCellsInRange]
  )

  const handleMouseUp = useCallback(() => {
    if (isDragging.current) {
      finalizeDrag()
    }
  }, [finalizeDrag])

  // Attach window mouseup listener to catch releases outside the grid
  useEffect(() => {
    const onWindowMouseUp = () => {
      if (isDragging.current) {
        finalizeDrag()
      }
    }

    window.addEventListener('mouseup', onWindowMouseUp)
    return () => {
      window.removeEventListener('mouseup', onWindowMouseUp)
    }
  }, [finalizeDrag])

  return {
    hoveredWells,
    handleMouseDown,
    handleMouseEnter,
    handleMouseUp
  }
}
