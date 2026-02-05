import { Fragment } from 'react'
import type { WellData } from '../../../../../shared/types/plate'
import { ROWS, COLS } from '../../../../../shared/types/plate'
import { WellCell } from './WellCell'

interface PlateGridProps {
  wells: WellData[][]
  plateNumber?: number
  // Interactive mode (optional - all props below)
  selectedWells?: Set<string>
  hoveredWells?: Set<string>
  standardCols?: readonly number[] // 1-indexed cols that are standards
  sampleIndexMap?: Map<string, number> // "plateNum:wellId" -> sample index
  activePlate?: number // current plate number for index lookup
  onCellMouseDown?: (row: number, col: number, event: React.MouseEvent) => void
  onCellMouseEnter?: (row: number, col: number) => void
  onCellMouseUp?: () => void
  // Column header interaction (optional)
  highlightedColumn?: number | null // 1-indexed column being hovered
  onColumnMouseDown?: (col: number) => void // 1-indexed column drag start
  onColumnMouseEnter?: (col: number) => void // 1-indexed column entered (drag or hover)
  onColumnMouseLeave?: (col: number) => void // 1-indexed column left
}

/**
 * 96-well plate grid visualization.
 * Displays an 8x12 grid with row labels (A-H) and column labels (1-12).
 * Wells are color-coded by type using WellCell component.
 *
 * When interactive props are provided, enables selection behavior:
 * - Each WellCell receives isSelected, isHovered, isEditable props
 * - Mouse events are wired through to the parent's handlers
 * - Grid container has select-none and mouseUp handler
 *
 * When interactive props are NOT provided (backward compatibility):
 * - Renders exactly as the original read-only grid
 * - No mouse handlers, no selection states
 */
export function PlateGrid({
  wells,
  plateNumber,
  selectedWells,
  hoveredWells,
  standardCols,
  sampleIndexMap,
  activePlate,
  onCellMouseDown,
  onCellMouseEnter,
  onCellMouseUp,
  highlightedColumn,
  onColumnMouseDown,
  onColumnMouseEnter,
  onColumnMouseLeave
}: PlateGridProps) {
  // Determine if we're in interactive mode (any interactive prop provided)
  const isInteractive = selectedWells !== undefined || hoveredWells !== undefined

  return (
    <div className="space-y-4">
      {plateNumber !== undefined && (
        <h3 className="text-sm font-semibold text-[var(--color-foreground)]">
          Plate {plateNumber}
        </h3>
      )}

      <div className="inline-block">
        {/* Grid container */}
        <div
          className={`grid gap-1${isInteractive ? ' select-none' : ''}`}
          style={{
            gridTemplateColumns: `auto repeat(${COLS.length}, minmax(0, 1fr))`
          }}
          onMouseUp={isInteractive ? onCellMouseUp : undefined}
        >
          {/* Empty corner cell */}
          <div className="w-7 h-7" />

          {/* Column headers (1-12) */}
          {COLS.map((col) => {
            const isClickable =
              isInteractive && standardCols && !standardCols.includes(col)
            return (
              <div
                key={`col-${col}`}
                className={`w-7 h-7 flex items-center justify-center text-xs font-medium ${
                  isClickable
                    ? 'cursor-pointer text-[var(--color-muted)] hover:text-blue-600 hover:font-semibold'
                    : 'text-[var(--color-muted)]'
                }`}
                onMouseDown={isClickable ? () => onColumnMouseDown?.(col) : undefined}
                onMouseEnter={
                  isClickable ? () => onColumnMouseEnter?.(col) : undefined
                }
                onMouseLeave={
                  isClickable ? () => onColumnMouseLeave?.(col) : undefined
                }
              >
                {col}
              </div>
            )
          })}

          {/* Rows with labels and wells */}
          {ROWS.map((row, rowIndex) => (
            <Fragment key={`row-${row}`}>
              {/* Row label */}
              <div className="w-7 h-7 flex items-center justify-center text-xs font-medium text-[var(--color-muted)]">
                {row}
              </div>

              {/* Wells in this row */}
              {wells[rowIndex]?.map((well) => {
                // Convert 1-indexed well.col to 0-indexed for event handlers
                const colIndex = well.col - 1

                if (isInteractive) {
                  const isEditable = standardCols
                    ? !standardCols.includes(well.col)
                    : false

                  // Look up dynamic sample index from plateStore selections
                  const dynamicIndex = sampleIndexMap?.get(`${activePlate}:${well.id}`)

                  return (
                    <WellCell
                      key={well.id}
                      well={well}
                      isSelected={selectedWells?.has(well.id) ?? false}
                      isHovered={hoveredWells?.has(well.id) ?? false}
                      isEditable={isEditable}
                      isColumnHighlighted={
                        highlightedColumn != null && well.col === highlightedColumn
                      }
                      dynamicIndex={dynamicIndex}
                      onMouseDown={(e) => onCellMouseDown?.(rowIndex, colIndex, e)}
                      onMouseEnter={() => onCellMouseEnter?.(rowIndex, colIndex)}
                    />
                  )
                }

                // Non-interactive (backward-compatible) rendering
                return <WellCell key={well.id} well={well} />
              })}
            </Fragment>
          ))}
        </div>
      </div>

      {/* Legend */}
      <div className="flex gap-4 text-xs">
        <div className="flex items-center gap-1">
          <div className="w-4 h-4 rounded-full bg-blue-100 border-2 border-blue-400" />
          <span className="text-[var(--color-muted)]">Standard</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-4 h-4 rounded-full bg-green-100 border-2 border-green-400" />
          <span className="text-[var(--color-muted)]">Unknown</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-4 h-4 rounded-full bg-gray-100 border-2 border-gray-300" />
          <span className="text-[var(--color-muted)]">Empty</span>
        </div>
      </div>
    </div>
  )
}
