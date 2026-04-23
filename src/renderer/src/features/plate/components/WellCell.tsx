import { memo } from 'react'
import type { WellData } from '../../../../../shared/types/plate'

interface WellCellProps {
  well: WellData
  isSelected?: boolean // well is filled/assigned (green highlight)
  isHovered?: boolean // well is in drag preview (blue outline)
  isEditable?: boolean // false for standard wells
  isColumnHighlighted?: boolean // column header hover highlight
  dynamicIndex?: number // sample index computed from plateStore selections
  onMouseDown?: (event: React.MouseEvent) => void
  onMouseEnter?: () => void
  /**
   * Read-only rendering flag (Plan 04-04 D-06).
   * When `interactive === false`:
   *   - no cursor-pointer class (even if isEditable is true)
   *   - no hover-based classes (isHovered / isColumnHighlighted are ignored)
   *   - no selection ring (the flashy `ring-2 ring-green-300` is dropped)
   *     — filled wells still render in green with their sample number so
   *     the finalized bench sheet clearly shows the saved layout.
   * Defaults to true for backward compatibility with step-3 consumers.
   */
  interactive?: boolean
}

/**
 * Individual well cell for plate visualization.
 * Displays different colors based on well type and interactive state.
 *
 * Visual states:
 * - Standard well (type === 'standard'): blue, not editable, shows "S"
 * - Selected/filled well (isSelected): green highlight with ring
 * - Hovered well (isHovered, during drag preview): blue outline
 * - Empty editable well: gray with pointer cursor
 * - Empty non-editable well: gray (default, no interactive props)
 *
 * All new props are optional for backward compatibility.
 * When called without interactive props, behaves exactly as the original.
 */
export const WellCell = memo(function WellCell({
  well,
  isSelected,
  isHovered,
  isEditable,
  isColumnHighlighted,
  dynamicIndex,
  onMouseDown,
  onMouseEnter,
  interactive = true
}: WellCellProps) {
  const baseClasses =
    'w-7 h-7 rounded-full border-2 flex items-center justify-center text-xs font-medium select-none transition-colors duration-75'

  const getTypeClasses = (): string => {
    // Standard wells always use blue style
    if (well.type === 'standard') {
      return 'bg-blue-100 border-blue-400 text-blue-700'
    }

    // Selected/filled well: green highlight. In interactive mode we add a
    // bright ring to signal interaction affordance; in read-only mode the
    // ring is suppressed (D-06 "no selection indicator rendered") but the
    // base green still communicates the saved layout on the bench sheet.
    if (isSelected) {
      return interactive
        ? 'bg-green-200 border-green-500 text-green-800 ring-2 ring-green-300'
        : 'bg-green-200 border-green-500 text-green-800'
    }

    // Hovered well during drag preview (not already selected) — interactive only.
    if (interactive && isHovered) {
      return 'bg-blue-50 border-blue-300 ring-2 ring-blue-200'
    }

    // Column header hover highlight (not selected, not standard) — interactive only.
    if (interactive && isColumnHighlighted) {
      return 'bg-blue-50 border-blue-300'
    }

    // Unknown well (from read-only usePlateLayout flow only)
    // In interactive mode, unselected wells should be gray — fill state comes from isSelected
    if (well.type === 'unknown' && isEditable === undefined) {
      return 'bg-green-100 border-green-400 text-green-700'
    }

    // Empty well (default)
    return 'bg-gray-100 border-gray-300 text-gray-400'
  }

  const getCursorClass = (): string => {
    // Read-only mode: never show the pointer affordance.
    if (!interactive) return 'cursor-default'
    if (isEditable) return 'cursor-pointer'
    return 'cursor-default'
  }

  const getContent = () => {
    // Standards always show "S"
    if (well.type === 'standard') return 'S'

    // In interactive mode, content is driven by selection state + dynamicIndex,
    // not by the static well.type from usePlateLayout
    if (isEditable !== undefined) {
      if (!isSelected) return ''
      return dynamicIndex?.toString() ?? ''
    }

    // Non-interactive: use static layout type/index
    if (well.type === 'unknown') return well.sampleIndex?.toString() ?? ''
    return ''
  }

  return (
    <div
      className={`${baseClasses} ${getTypeClasses()} ${getCursorClass()}`}
      title={`${well.id} - ${well.type}${well.sampleIndex ? ` (Sample ${well.sampleIndex})` : ''}`}
      onMouseDown={interactive ? onMouseDown : undefined}
      onMouseEnter={interactive ? onMouseEnter : undefined}
    >
      {getContent()}
    </div>
  )
})
