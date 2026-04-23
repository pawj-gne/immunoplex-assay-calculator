import { usePlatformStore } from '../../../stores/platformStore'
import { useSelectionStore } from '../../../stores/selectionStore'
import { useCalculatorStore } from '../../../stores/calculatorStore'
import { usePlateStore } from '../../../stores/plateStore'

interface RowProps {
  label: string
  value: string
}

function Row({ label, value }: RowProps): JSX.Element {
  return (
    <div className="flex items-center justify-between text-sm py-1">
      <span className="text-[var(--color-muted)]">{label}</span>
      <span className="text-[var(--color-foreground)] font-medium">{value}</span>
    </div>
  )
}

const REQUEST_TYPE_LABELS: Record<string, string> = {
  premix: 'Premix only',
  premix_singles: 'Premix + singles',
  custom: 'Custom (singles only)'
}

/**
 * Bordered "Run Source" card rendered at the top of the Document & Save
 * page (D-05). Shows Platform / Species / Panel (or 'Custom') / Sample
 * count / Replicate mode / Plate count / Request type so operators can
 * sanity-check the upstream selections before saving.
 */
export function RunSourceCard(): JSX.Element {
  const platforms = usePlatformStore((s) => s.platforms)
  const selectedPlatformId = usePlatformStore((s) => s.selectedPlatformId)
  const speciesList = useSelectionStore((s) => s.speciesList)
  const selectedSpeciesId = useSelectionStore((s) => s.selectedSpeciesId)
  const panels = useSelectionStore((s) => s.panels)
  const selectedPanelId = useSelectionStore((s) => s.selectedPanelId)
  const sampleCount = useCalculatorStore((s) => s.sampleCount)
  const replicateMode = useCalculatorStore((s) => s.replicateMode)
  const requestType = useCalculatorStore((s) => s.requestType)
  const plateCount = usePlateStore((s) => Object.keys(s.plates).length)

  const platformName = platforms.find((p) => p.id === selectedPlatformId)?.name ?? '—'
  const speciesName = speciesList.find((s) => s.id === selectedSpeciesId)?.name ?? '—'
  const panelLabel = selectedPanelId
    ? (panels.find((p) => p.id === selectedPanelId)?.name ?? '—')
    : 'Custom'

  return (
    <div className="rounded-lg border border-[var(--color-border)] bg-white p-4">
      <h3 className="text-sm font-semibold text-[var(--color-foreground)] mb-2">Run Source</h3>
      <div className="divide-y divide-[var(--color-border)]">
        <Row label="Platform" value={platformName} />
        <Row label="Species" value={speciesName} />
        <Row label="Panel" value={panelLabel} />
        <Row label="Sample count" value={String(sampleCount)} />
        <Row
          label="Replicate mode"
          value={replicateMode === 'duplicates' ? 'Duplicates' : 'Singles'}
        />
        <Row label="Plate count" value={String(plateCount)} />
        <Row label="Request type" value={REQUEST_TYPE_LABELS[requestType] ?? requestType} />
      </div>
    </div>
  )
}
