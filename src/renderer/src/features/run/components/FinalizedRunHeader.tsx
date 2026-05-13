import { useRunStore } from '../../../stores/runStore'
import { useOperatorsStore } from '../../../stores/operatorsStore'
import { usePlatformStore } from '../../../stores/platformStore'
import { useSelectionStore } from '../../../stores/selectionStore'

/**
 * Metadata summary header for the Finalized Run View (step 5).
 *
 * Renders the primary request label ("Request XXXXX — N plate(s)" or
 * "Ad-hoc run — N plate(s)" per D-06 / §Specific Ideas) plus every
 * metadata field stored on the RunRecord. Resolves IDs to display names
 * via the operators / platform / selection stores. Operators store is
 * primed with includeInactive:true at App.tsx mount so historical runs
 * using hidden operators still render the original name.
 *
 * Per-plate labels ("Request XXXXX — Plate N of M") are rendered above
 * each PlateGrid in FinalizedRunView, not here.
 */
export function FinalizedRunHeader(): JSX.Element {
  const currentRun = useRunStore(
    (s) => s.runs.find((r) => r.id === s.currentRunId) ?? null
  )
  const operators = useOperatorsStore((s) => s.operators)
  const platforms = usePlatformStore((s) => s.platforms)
  const speciesList = useSelectionStore((s) => s.speciesList)
  const panels = useSelectionStore((s) => s.panels)

  if (!currentRun) {
    return (
      <div className="p-4 rounded-md border border-[var(--color-border)] bg-gray-50 text-sm text-[var(--color-muted)]">
        No active run.
      </div>
    )
  }

  const record = currentRun

  // Primary label — D-06 / §Specific Ideas. Aggregate header shows total
  // plate count; per-plate "Plate N of M" labels are rendered by
  // FinalizedRunView above each grid.
  const reqDisplay = record.requestOverrideAdHoc
    ? 'Ad-hoc run'
    : `Request ${String(record.requestNumber ?? 0).padStart(5, '0')}`
  const plateCount = record.plateCount
  const headerLabel = `${reqDisplay} — ${plateCount} plate${plateCount === 1 ? '' : 's'}`

  // Resolve display names.
  const operator = operators.find((o) => o.id === record.operatorId)
  const operatorName = operator?.name ?? record.operatorId
  const operatorSuffix = operator && operator.active === false ? ' (hidden)' : ''

  const platform = platforms.find((p) => p.id === record.platformId)
  const platformName = platform?.name ?? record.platformId

  const species = speciesList.find((s) => s.id === record.speciesId)
  const speciesName = species?.name ?? record.speciesId

  const panel = record.panelId ? panels.find((p) => p.id === record.panelId) : null
  const panelName = record.panelId ? (panel?.name ?? record.panelId) : 'Custom'

  const replicateModeLabel = record.replicateMode === 'singles' ? 'Singles' : 'Duplicates'

  return (
    <div className="space-y-4">
      {/* Primary label */}
      <h2 className="text-2xl font-bold text-[var(--color-foreground)]">{headerLabel}</h2>

      {/* Metadata grid — 2-column definition list.
          Every RunRecord field below D-17's "required metadata" list is shown. */}
      <dl className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2 text-sm">
        <div className="flex justify-between gap-4 border-b border-gray-100 py-1">
          <dt className="font-medium text-[var(--color-muted)]">User</dt>
          <dd className="text-[var(--color-foreground)]">{record.userName}</dd>
        </div>
        <div className="flex justify-between gap-4 border-b border-gray-100 py-1">
          <dt className="font-medium text-[var(--color-muted)]">Operator</dt>
          <dd className="text-[var(--color-foreground)]">
            {operatorName}
            {operatorSuffix}
          </dd>
        </div>
        <div className="flex justify-between gap-4 border-b border-gray-100 py-1">
          <dt className="font-medium text-[var(--color-muted)]">Date</dt>
          <dd className="text-[var(--color-foreground)]">{record.runDate}</dd>
        </div>
        <div className="flex justify-between gap-4 border-b border-gray-100 py-1">
          <dt className="font-medium text-[var(--color-muted)]">Platform</dt>
          <dd className="text-[var(--color-foreground)]">{platformName}</dd>
        </div>
        <div className="flex justify-between gap-4 border-b border-gray-100 py-1">
          <dt className="font-medium text-[var(--color-muted)]">Species</dt>
          <dd className="text-[var(--color-foreground)]">{speciesName}</dd>
        </div>
        <div className="flex justify-between gap-4 border-b border-gray-100 py-1">
          <dt className="font-medium text-[var(--color-muted)]">Panel</dt>
          <dd className="text-[var(--color-foreground)]">{panelName}</dd>
        </div>
        <div className="flex justify-between gap-4 border-b border-gray-100 py-1">
          <dt className="font-medium text-[var(--color-muted)]">SAPE Name</dt>
          <dd className="text-[var(--color-foreground)]">{record.sapeName ?? '—'}</dd>
        </div>
        <div className="flex justify-between gap-4 border-b border-gray-100 py-1">
          <dt className="font-medium text-[var(--color-muted)]">Sample Type</dt>
          <dd className="text-[var(--color-foreground)]">{record.sampleType}</dd>
        </div>
        <div className="flex justify-between gap-4 border-b border-gray-100 py-1">
          <dt className="font-medium text-[var(--color-muted)]">Dilution Factor</dt>
          <dd className="text-[var(--color-foreground)]">1:{record.dilutionFactor}</dd>
        </div>
        <div className="flex justify-between gap-4 border-b border-gray-100 py-1">
          <dt className="font-medium text-[var(--color-muted)]">Sample Count</dt>
          <dd className="text-[var(--color-foreground)]">{record.sampleCount}</dd>
        </div>
        <div className="flex justify-between gap-4 border-b border-gray-100 py-1">
          <dt className="font-medium text-[var(--color-muted)]">Replicate Mode</dt>
          <dd className="text-[var(--color-foreground)]">{replicateModeLabel}</dd>
        </div>
        <div className="flex justify-between gap-4 border-b border-gray-100 py-1">
          <dt className="font-medium text-[var(--color-muted)]">Plate Count</dt>
          <dd className="text-[var(--color-foreground)]">{record.plateCount}</dd>
        </div>
        <div className="flex justify-between gap-4 border-b border-gray-100 py-1">
          <dt className="font-medium text-[var(--color-muted)]">Plex</dt>
          <dd className="text-[var(--color-foreground)]">{record.plex}</dd>
        </div>
        <div className="flex justify-between gap-4 border-b border-gray-100 py-1">
          <dt className="font-medium text-[var(--color-muted)]">Hamilton</dt>
          <dd className="text-[var(--color-foreground)]">{record.hamilton}</dd>
        </div>
        <div className="flex justify-between gap-4 border-b border-gray-100 py-1">
          <dt className="font-medium text-[var(--color-muted)]">Run Plate Position</dt>
          <dd className="text-[var(--color-foreground)]">{record.runPlatePosition}</dd>
        </div>
        <div className="flex justify-between gap-4 border-b border-gray-100 py-1">
          <dt className="font-medium text-[var(--color-muted)]">Standard Position</dt>
          <dd className="text-[var(--color-foreground)]">{record.standardPosition}</dd>
        </div>
        <div className="flex justify-between gap-4 border-b border-gray-100 py-1">
          <dt className="font-medium text-[var(--color-muted)]">Trough Position</dt>
          <dd className="text-[var(--color-foreground)]">{record.troughPosition}</dd>
        </div>
      </dl>

      {/* Comments — multi-line block, preserves newlines. */}
      <div>
        <div className="text-sm font-medium text-[var(--color-muted)] mb-1">Comments</div>
        <div className="text-sm text-[var(--color-foreground)] whitespace-pre-wrap border border-gray-100 rounded-md p-3 bg-gray-50 min-h-[2.5rem]">
          {record.comments ?? '—'}
        </div>
      </div>
    </div>
  )
}
