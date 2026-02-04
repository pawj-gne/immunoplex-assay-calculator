import { memo } from 'react'
import type { WellData } from '../../../../../shared/types/plate'

interface WellCellProps {
  well: WellData
  isSelected?: boolean // well is filled/assigned (green highlight)
  isHovered?: boolean // well is in drag preview (blue outline)
  isEditable?: boolean // false for standard wells
  onMouseDown?: (event: React.MouseEvent) => void
  onMouseEnter?: () => void
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
  onMouseDown,
  onMouseEnter
}: WellCellProps) {
  const baseClasses =
    'w-7 h-7 rounded-full border-2 flex items-center justify-center text-xs font-medium select-none transition-colors duration-75'

  const getTypeClasses = (): string => {
    // Standard wells always use blue style
    if (well.type === 'standard') {
      return 'bg-blue-100 border-blue-400 text-blue-700'
    }

    // Selected/filled well: green highlight with ring
    if (isSelected) {
      return 'bg-green-200 border-green-500 text-green-800 ring-2 ring-green-300'
    }

    // Hovered well during drag preview (not already selected)
    if (isHovered) {
      return 'bg-blue-50 border-blue-300 ring-2 ring-blue-200'
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
    if (isEditable) return 'cursor-pointer'
    return 'cursor-default'
  }

  const getContent = () => {
    switch (well.type) {
      case 'standard':
        return 'S'
      case 'unknown':
        // In interactive mode, only show sample number for selected wells
        if (isEditable !== undefined && !isSelected) return ''
        return well.sampleIndex?.toString() ?? ''
      case 'empty':
        return ''
    }
  }

  return (
    <div
      className={`${baseClasses} ${getTypeClasses()} ${getCursorClass()}`}
      title={`${well.id} - ${well.type}${well.sampleIndex ? ` (Sample ${well.sampleIndex})` : ''}`}
      onMouseDown={onMouseDown}
      onMouseEnter={onMouseEnter}
    >
      {getContent()}
    </div>
  )
})
