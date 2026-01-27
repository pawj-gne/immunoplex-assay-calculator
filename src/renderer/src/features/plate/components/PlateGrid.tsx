import type { WellData } from '../../../../../shared/types/plate'
import { ROWS, COLS } from '../../../../../shared/types/plate'
import { WellCell } from './WellCell'

interface PlateGridProps {
  wells: WellData[][]
  plateNumber?: number
}

/**
 * 96-well plate grid visualization.
 * Displays an 8x12 grid with row labels (A-H) and column labels (1-12).
 * Wells are color-coded by type using WellCell component.
 */
export function PlateGrid({ wells, plateNumber }: PlateGridProps) {
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
          className="grid gap-1"
          style={{
            gridTemplateColumns: `auto repeat(${COLS.length}, minmax(0, 1fr))`
          }}
        >
          {/* Empty corner cell */}
          <div className="w-7 h-7" />

          {/* Column headers (1-12) */}
          {COLS.map((col) => (
            <div
              key={`col-${col}`}
              className="w-7 h-7 flex items-center justify-center text-xs font-medium text-[var(--color-muted)]"
            >
              {col}
            </div>
          ))}

          {/* Rows with labels and wells */}
          {ROWS.map((row, rowIndex) => (
            <>
              {/* Row label */}
              <div
                key={`row-${row}`}
                className="w-7 h-7 flex items-center justify-center text-xs font-medium text-[var(--color-muted)]"
              >
                {row}
              </div>

              {/* Wells in this row */}
              {wells[rowIndex]?.map((well) => (
                <WellCell key={well.id} well={well} />
              ))}
            </>
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
