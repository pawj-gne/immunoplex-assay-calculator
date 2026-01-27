import type { ItemizedVolumes, ReagentLine } from '../../../../../shared/types/calculator'
import { volumeToDisplay } from '../../../lib/decimal'

interface ItemizedVolumeDisplayProps {
  itemizedVolumes: ItemizedVolumes
  totalWells: number
  unknownWells: number
  standardWells: number
}

function ReagentSection({
  title,
  lines,
  colorClasses
}: {
  title: string
  lines: ReagentLine[]
  colorClasses: {
    bg: string
    border: string
    text: string
    textDark: string
    headerBg: string
  }
}) {
  if (lines.length === 0) return null

  return (
    <div className={`${colorClasses.bg} border ${colorClasses.border} rounded-lg overflow-hidden`}>
      <div className={`px-4 py-2 ${colorClasses.headerBg} border-b ${colorClasses.border}`}>
        <h4 className={`text-sm font-medium ${colorClasses.text}`}>{title}</h4>
      </div>
      <div className="divide-y divide-opacity-50" style={{ borderColor: 'inherit' }}>
        {lines.map((line, idx) => {
          const volumeDisplay =
            line.volumeUL.greaterThanOrEqualTo(1000)
              ? `${volumeToDisplay(line.volumeUL, 'mL', 1)} mL`
              : `${volumeToDisplay(line.volumeUL, 'uL', 0)} µL`

          return (
            <div
              key={`${line.name}-${idx}`}
              className={`px-4 py-2 flex items-center justify-between ${line.isPremix ? '' : 'bg-white bg-opacity-50'}`}
            >
              <div className="flex items-center gap-2">
                <span className={`text-sm ${colorClasses.textDark}`}>{line.name}</span>
                {line.beadRegion !== undefined && (
                  <span className="text-xs text-[var(--color-muted)] bg-gray-100 px-1.5 py-0.5 rounded">
                    Region {line.beadRegion}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-[var(--color-muted)]">({line.stockConc}x)</span>
                <span className={`font-mono text-sm font-medium ${colorClasses.textDark}`}>
                  {volumeDisplay}
                </span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export function ItemizedVolumeDisplay({
  itemizedVolumes,
  totalWells,
  unknownWells,
  standardWells
}: ItemizedVolumeDisplayProps) {
  const { captureBeads, detectionAntibodies, saPEVolumeML } = itemizedVolumes

  return (
    <div className="space-y-4">
      <h3 className="font-medium text-[var(--color-foreground)]">Calculated Volumes</h3>

      {/* Well Summary */}
      <div className="grid grid-cols-3 gap-4">
        <div className="p-3 bg-gray-50 border border-[var(--color-border)] rounded-lg text-center">
          <div className="text-2xl font-bold text-[var(--color-foreground)]">{totalWells}</div>
          <div className="text-xs text-[var(--color-muted)] uppercase tracking-wide">
            Total Wells
          </div>
        </div>
        <div className="p-3 bg-gray-50 border border-[var(--color-border)] rounded-lg text-center">
          <div className="text-2xl font-bold text-[var(--color-foreground)]">{unknownWells}</div>
          <div className="text-xs text-[var(--color-muted)] uppercase tracking-wide">
            Unknown Wells
          </div>
        </div>
        <div className="p-3 bg-gray-50 border border-[var(--color-border)] rounded-lg text-center">
          <div className="text-2xl font-bold text-[var(--color-foreground)]">{standardWells}</div>
          <div className="text-xs text-[var(--color-muted)] uppercase tracking-wide">
            Standard Wells
          </div>
        </div>
      </div>

      {/* Reagent Volumes */}
      <div className="space-y-3">
        {/* Capture Beads */}
        <ReagentSection
          title="Capture Beads"
          lines={captureBeads}
          colorClasses={{
            bg: 'bg-amber-50',
            border: 'border-amber-200',
            text: 'text-amber-700',
            textDark: 'text-amber-900',
            headerBg: 'bg-amber-100'
          }}
        />

        {/* Detection Antibodies */}
        <ReagentSection
          title="Detection Antibodies"
          lines={detectionAntibodies}
          colorClasses={{
            bg: 'bg-green-50',
            border: 'border-green-200',
            text: 'text-green-700',
            textDark: 'text-green-900',
            headerBg: 'bg-green-100'
          }}
        />

        {/* SA-PE - Total only */}
        <div className="bg-pink-50 border border-pink-200 rounded-lg overflow-hidden">
          <div className="px-4 py-2 bg-pink-100 border-b border-pink-200">
            <h4 className="text-sm font-medium text-pink-700">SA-PE</h4>
          </div>
          <div className="px-4 py-3 flex items-center justify-between">
            <span className="text-sm text-pink-800">Total</span>
            <span className="font-mono text-lg font-bold text-pink-900">
              {Math.ceil(saPEVolumeML)} mL
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
