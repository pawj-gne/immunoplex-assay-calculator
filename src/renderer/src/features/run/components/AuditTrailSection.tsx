import type { ReactNode } from 'react'
import { Decimal } from 'decimal.js'
import { useRunStore } from '../../../stores/runStore'
import { useSelectionStore } from '../../../stores/selectionStore'
import {
  computePeVolumeML,
  deriveDiluentBranchLabel,
  computeRawReagentVolumeML,
  computeNewReagentVolumeML,
  computeTotalReagentVolumeML
} from '../lib/auditTrail'
import { resolveDiluent } from '../../../lib/diluentResolver'
import {
  calculateTotalWells,
  calculateRawVolume,
  calculateFinalVolume
} from '../../../lib/calculator'

/**
 * Phase 15 SMK3-15 (D-15-01..16): Calculation Audit Trail rendered beneath
 * the FinalizedRunHeader on the run document. Four labeled blocks:
 *
 *   1. Inputs         — operator selections + override flags snapshotted at save
 *   2. Intermediates  — derived wells + per-well volumes + dead volume breakdown
 *   3. Outputs        — totals + PE volume (computed via computePeVolumeML)
 *   4. Diluent decision — branch label + per-reagent diluent strings
 *
 * Reads exclusively from RunRecord (D-15-01) — no calculatorStore reads. The
 * em-dash placeholder (D-15-12) is used for every nullable / undefined field
 * so pre-Phase-15 runs render without crashes. Derived rows that require
 * composing the existing calculator helpers (Total wells, Raw bead volume,
 * etc.) recompute against snapshotted fields and gracefully fall back to '—'
 * when any input is missing. Override badge (D-15-08) renders inline beside
 * Old Beads / Old Antibodies value cells when the corresponding *Override
 * flag is true.
 *
 * Visual rendering correctness routes to Phase 16 UAT per VALIDATION.md
 * Manual-Only Verifications table — vitest is Node-only (no jsdom).
 */
export function AuditTrailSection(): JSX.Element | null {
  const currentRun = useRunStore(
    (s) => s.runs.find((r) => r.id === s.currentRunId) ?? null
  )
  const panels = useSelectionStore((s) => s.panels)

  if (!currentRun) return null
  const r = currentRun

  // Panel-name resolution mirrors FinalizedRunHeader.tsx
  const panel = r.panelId ? panels.find((p) => p.id === r.panelId) : null
  const panelName = r.panelId ? (panel?.name ?? r.panelId) : null

  // Em-dash placeholder (D-15-12)
  const dash = (v: unknown): string =>
    v === null || v === undefined || v === '' ? '—' : String(v)

  // ── Diluent decision derivation ───────────────────────────────────────
  // Reads only snapshotted fields. premixConcentration + panelName together
  // describe the (possibly single) selected premix; beadsDiluent /
  // antibodiesDiluent populate the Values-table fallback branch.
  const diluent = resolveDiluent({
    selectedPremixes:
      r.premixConcentration !== null &&
      r.premixConcentration !== undefined &&
      panelName
        ? [{ name: panelName, concentration: r.premixConcentration }]
        : [],
    valuesTable:
      r.beadsDiluent !== null &&
      r.beadsDiluent !== undefined &&
      r.antibodiesDiluent !== null &&
      r.antibodiesDiluent !== undefined
        ? { beads: r.beadsDiluent, antibodies: r.antibodiesDiluent }
        : undefined
  })
  const branchLabel = deriveDiluentBranchLabel(
    diluent,
    r.premixConcentration ?? null
  )

  // ── Intermediates / Outputs derivation from snapshot ──────────────────
  // Total wells: deterministic from (sampleCount, replicateMode, plateCount).
  const totalWells =
    r.sampleCount > 0 && r.plateCount > 0
      ? calculateTotalWells(r.sampleCount, r.replicateMode, r.plateCount)
          .totalWells
      : null

  // Final volume (µL) — recomputed for the PE-volume row only. Requires the
  // snapshotted volumePerWell + deadVolume (both µL). Phase-15-and-later
  // saves carry both; legacy rows do too (Phase 14 backfilled deadVolume).
  const finalVolumeML: number | null =
    totalWells !== null && r.volumePerWell > 0 && r.deadVolume >= 0
      ? calculateFinalVolume(
          calculateRawVolume(
            totalWells,
            new Decimal(r.volumePerWell),
            new Decimal(r.deadVolume)
          )
        )
          .dividedBy(1000)
          .toNumber()
      : null

  const peVolumeML =
    finalVolumeML !== null
      ? computePeVolumeML(finalVolumeML, r.sapeConcentration ?? null)
      : null

  // ── Phase 15.1 WR-06 (D-15.1-05/06/07): derive the 6 previously
  // em-dashed audit-trail rows from the snapshotted RunRecord fields.
  // All inputs read EXCLUSIVELY from `r.*` (D-15-01 invariant — never
  // from useCalculatorStore — so historical runs render their persisted
  // values verbatim per SMK3-16). Helpers return null when any input is
  // missing; render layer falls back to the em-dash placeholder.
  const rawBeadML = computeRawReagentVolumeML(
    r.sampleCount,
    r.replicateMode,
    r.plateCount,
    r.beadsVolumePerWell,
    r.deadVolume
  )
  const rawAntibodyML = computeRawReagentVolumeML(
    r.sampleCount,
    r.replicateMode,
    r.plateCount,
    r.antibodiesVolumePerWell,
    r.deadVolume
  )
  const newBeadsML = computeNewReagentVolumeML(rawBeadML, r.oldBeads ?? null)
  const newAntibodiesML = computeNewReagentVolumeML(
    rawAntibodyML,
    r.oldAntibodies ?? null
  )
  const totalBeadML = computeTotalReagentVolumeML(newBeadsML, r.oldBeads ?? null)
  const totalAntibodyML = computeTotalReagentVolumeML(
    newAntibodiesML,
    r.oldAntibodies ?? null
  )

  // ── Reusable row + chip helpers ────────────────────────────────────────
  const OverrideChip = (): JSX.Element => (
    <span
      className="ml-2 inline-block bg-amber-100 text-amber-900 ring-1 ring-amber-300 px-1.5 py-0.5 rounded text-xs uppercase"
      title="This value exceeded the 20% recommended cap at save time; operator confirmed override."
    >
      OVERRIDE
    </span>
  )

  const Row = ({
    label,
    value,
    badge
  }: {
    label: string
    value: ReactNode
    badge?: ReactNode
  }): JSX.Element => (
    <div className="flex justify-between gap-4 border-b border-gray-100 py-1">
      <dt className="font-medium text-[var(--color-muted)]">{label}</dt>
      <dd className="text-[var(--color-foreground)]">
        {value}
        {badge}
      </dd>
    </div>
  )

  const replicateModeLabel =
    r.replicateMode === 'singles'
      ? 'Singles'
      : r.replicateMode === 'duplicates'
        ? 'Duplicates'
        : '—'

  const premixSelection =
    panelName && r.premixConcentration !== null && r.premixConcentration !== undefined
      ? `${panelName} (${r.premixConcentration}×)`
      : panelName
        ? `${panelName} (—×)`
        : '—'

  const singlesCount = r.singleAnalyteIds?.length ?? 0

  const oldBeadsText =
    r.oldBeads !== undefined && r.oldBeads !== null
      ? `${r.oldBeads.toFixed(1)} mL`
      : '—'
  const oldAntibodiesText =
    r.oldAntibodies !== undefined && r.oldAntibodies !== null
      ? `${r.oldAntibodies.toFixed(1)} mL`
      : '—'

  // Per-well volumes are stored as mL on the audit-trail snapshot.
  const beadsVolPerWellText =
    r.beadsVolumePerWell !== null && r.beadsVolumePerWell !== undefined
      ? `${r.beadsVolumePerWell} mL`
      : '—'
  const antibodiesVolPerWellText =
    r.antibodiesVolumePerWell !== null && r.antibodiesVolumePerWell !== undefined
      ? `${r.antibodiesVolumePerWell} mL`
      : '—'

  // Dead volume: stored as µL on RunRecord (existing). Display in mL.
  const deadVolumeText =
    r.deadVolume > 0
      ? `${(r.deadVolume / 1000).toFixed(1)} mL (= ${r.numberOfSetups ?? '—'} setup × 2 mL)`
      : '—'

  return (
    <section className="space-y-6">
      <h2 className="text-xl font-semibold text-[var(--color-foreground)]">
        Calculation Audit Trail
      </h2>

      {/* 1. Inputs */}
      <div>
        <h3 className="text-lg font-semibold mb-2 text-[var(--color-foreground)]">
          1. Inputs
        </h3>
        <dl className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2 text-sm">
          <Row label="Plates" value={dash(r.plateCount)} />
          <Row label="Sample count" value={dash(r.sampleCount)} />
          <Row label="Replicate mode" value={replicateModeLabel} />
          <Row label="Premix selection" value={premixSelection} />
          <Row label="Singles selection" value={String(singlesCount)} />
          <Row
            label="Old beads"
            value={oldBeadsText}
            badge={r.oldBeadsOverride ? <OverrideChip /> : undefined}
          />
          <Row
            label="Old antibodies"
            value={oldAntibodiesText}
            badge={r.oldAntibodiesOverride ? <OverrideChip /> : undefined}
          />
          <Row label="Number of setups" value={dash(r.numberOfSetups)} />
        </dl>
      </div>

      {/* 2. Intermediates */}
      <div>
        <h3 className="text-lg font-semibold mb-2 text-[var(--color-foreground)]">
          2. Intermediates
        </h3>
        <dl className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2 text-sm">
          <Row label="Total wells" value={dash(totalWells)} />
          <Row label="Beads vol/well" value={beadsVolPerWellText} />
          <Row label="Antibodies vol/well" value={antibodiesVolPerWellText} />
          <Row label="Dead volume" value={deadVolumeText} />
          <Row
            label="Raw bead volume"
            value={rawBeadML !== null ? `${rawBeadML.toFixed(1)} mL` : '—'}
          />
          <Row
            label="Raw antibody volume"
            value={rawAntibodyML !== null ? `${rawAntibodyML.toFixed(1)} mL` : '—'}
          />
        </dl>
      </div>

      {/* 3. Outputs */}
      <div>
        <h3 className="text-lg font-semibold mb-2 text-[var(--color-foreground)]">
          3. Outputs
        </h3>
        <dl className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2 text-sm">
          <Row
            label="New beads"
            value={newBeadsML !== null ? `${newBeadsML.toFixed(1)} mL` : '—'}
          />
          <Row
            label="New antibodies"
            value={newAntibodiesML !== null ? `${newAntibodiesML.toFixed(1)} mL` : '—'}
          />
          <Row
            label="Total bead volume"
            value={totalBeadML !== null ? `${totalBeadML.toFixed(1)} mL` : '—'}
          />
          <Row
            label="Total antibody volume"
            value={totalAntibodyML !== null ? `${totalAntibodyML.toFixed(1)} mL` : '—'}
          />
          <Row
            label="PE volume"
            value={peVolumeML !== null ? `${peVolumeML.toFixed(1)} mL` : '—'}
          />
        </dl>
      </div>

      {/* 4. Diluent decision */}
      <div>
        <h3 className="text-lg font-semibold mb-2 text-[var(--color-foreground)]">
          4. Diluent decision
        </h3>
        <dl className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2 text-sm">
          <Row label="Rule applied:" value={branchLabel} />
          <Row label="Beads diluent" value={dash(r.beadsDiluent)} />
          <Row label="Antibodies diluent" value={dash(r.antibodiesDiluent)} />
        </dl>
      </div>
    </section>
  )
}
