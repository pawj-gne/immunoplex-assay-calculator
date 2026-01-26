import { useCalculator } from '../hooks/useCalculator'

// Reagent configuration - per-well volumes will be configurable later
const REAGENTS = [
  { id: 'beads', name: 'Beads', volumePerWell: 25, color: 'brown' },
  { id: 'antibodies', name: 'Antibodies', volumePerWell: 25, color: 'green' },
  { id: 'sape', name: 'SA-PE', volumePerWell: 25, color: 'magenta' }
] as const

export function VolumeDisplay() {
  const { outputs, isValid, deadVolume } = useCalculator()

  if (!isValid || !outputs) {
    return (
      <div className="p-4 bg-gray-50 border border-[var(--color-border)] rounded-lg">
        <p className="text-sm text-[var(--color-muted)]">
          Enter valid inputs to see calculated volumes
        </p>
      </div>
    )
  }

  // Calculate volumes for each reagent
  const calculateReagentVolume = (volumePerWell: number) => {
    const rawVolume = outputs.totalWells * volumePerWell + deadVolume
    const finalVolumeML = Math.ceil(rawVolume / 1000)
    return { rawVolume, finalVolumeML }
  }

  const colorClasses = {
    brown: {
      bg: 'bg-amber-50',
      border: 'border-amber-300',
      text: 'text-amber-700',
      textDark: 'text-amber-900',
      borderInner: 'border-amber-300'
    },
    green: {
      bg: 'bg-green-50',
      border: 'border-green-200',
      text: 'text-green-700',
      textDark: 'text-green-900',
      borderInner: 'border-green-200'
    },
    magenta: {
      bg: 'bg-pink-50',
      border: 'border-pink-200',
      text: 'text-pink-600',
      textDark: 'text-pink-800',
      borderInner: 'border-pink-200'
    }
  }

  return (
    <div className="space-y-4">
      <h3 className="font-medium text-[var(--color-foreground)]">Calculated Volumes</h3>

      {/* Well Summary */}
      <div className="grid grid-cols-3 gap-4">
        <div className="p-3 bg-gray-50 border border-[var(--color-border)] rounded-lg text-center">
          <div className="text-2xl font-bold text-[var(--color-foreground)]">
            {outputs.totalWells}
          </div>
          <div className="text-xs text-[var(--color-muted)] uppercase tracking-wide">
            Total Wells
          </div>
        </div>
        <div className="p-3 bg-gray-50 border border-[var(--color-border)] rounded-lg text-center">
          <div className="text-2xl font-bold text-[var(--color-foreground)]">
            {outputs.unknownWells}
          </div>
          <div className="text-xs text-[var(--color-muted)] uppercase tracking-wide">
            Unknown Wells
          </div>
        </div>
        <div className="p-3 bg-gray-50 border border-[var(--color-border)] rounded-lg text-center">
          <div className="text-2xl font-bold text-[var(--color-foreground)]">
            {outputs.standardWells}
          </div>
          <div className="text-xs text-[var(--color-muted)] uppercase tracking-wide">
            Standard Wells
          </div>
        </div>
      </div>

      {/* Reagent Volume Calculations */}
      <div className="space-y-3">
        {REAGENTS.map((reagent) => {
          const { rawVolume, finalVolumeML } = calculateReagentVolume(reagent.volumePerWell)
          const colors = colorClasses[reagent.color]

          return (
            <div
              key={reagent.id}
              className={`p-4 ${colors.bg} border ${colors.border} rounded-lg space-y-3`}
            >
              <div className={`text-sm ${colors.text}`}>
                <span className="font-medium">{reagent.name}:</span>
                <div className={`font-mono ${colors.textDark} mt-1`}>
                  ({outputs.totalWells} wells × {reagent.volumePerWell} µL) + {deadVolume} µL ={' '}
                  {rawVolume} µL
                </div>
              </div>

              <div
                className={`flex justify-between items-center pt-3 border-t ${colors.borderInner}`}
              >
                <span className={`text-sm font-medium ${colors.text}`}>Final Volume:</span>
                <span className={`text-xl font-bold font-mono ${colors.textDark}`}>
                  {finalVolumeML} mL
                </span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
