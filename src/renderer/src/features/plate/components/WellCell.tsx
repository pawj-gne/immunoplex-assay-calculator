import type { WellData } from '../../../../../shared/types/plate'

interface WellCellProps {
  well: WellData
}

/**
 * Individual well cell for plate visualization.
 * Displays different colors based on well type:
 * - Standard: blue
 * - Unknown: green
 * - Empty: gray
 */
export function WellCell({ well }: WellCellProps) {
  const baseClasses = 'w-7 h-7 rounded-full border-2 flex items-center justify-center text-xs font-medium'

  const typeClasses = {
    standard: 'bg-blue-100 border-blue-400 text-blue-700',
    unknown: 'bg-green-100 border-green-400 text-green-700',
    empty: 'bg-gray-100 border-gray-300 text-gray-400'
  }

  const getContent = () => {
    switch (well.type) {
      case 'standard':
        return 'S'
      case 'unknown':
        return well.sampleIndex?.toString() ?? ''
      case 'empty':
        return ''
    }
  }

  return (
    <div
      className={`${baseClasses} ${typeClasses[well.type]}`}
      title={`${well.id} - ${well.type}${well.sampleIndex ? ` (Sample ${well.sampleIndex})` : ''}`}
    >
      {getContent()}
    </div>
  )
}
