import { ConfirmModal } from '../../run/components/ConfirmModal'

interface OldReagentCapModalProps {
  open: boolean
  reagentLabel: 'Old Beads' | 'Old Antibodies'
  /** Operator-typed value in mL (raw, not floor-rounded) */
  typedValueML: number
  /** Recommended max (20% of totalReactionVolumeML) in mL */
  capValueML: number
  /** Total reaction volume for this reagent (sampleCount × volumePerWell + dead) in mL */
  totalReactionVolumeML: number
  onOverride: () => void
  onCancel: () => void
}

/**
 * Confirm-once override modal for the 20%-per-reagent old-reagent cap
 * (Smoke 3 SMK3-02/03 D-10). Thin wrapper around the shipped ConfirmModal
 * primitive (Phase 4-02). Composed with primaryStyle="destructive" because
 * accepting the override is the affirmative-destructive action — the
 * operator is explicitly accepting that >20% old reagent may affect assay
 * reliability.
 *
 * Body text follows CONTEXT §specifics "Override modal — concrete copy".
 * ConfirmModal renders body as a single <p> — newlines collapse to spaces,
 * which is fine for this surface (the cap details are concise).
 */
export function OldReagentCapModal({
  open,
  reagentLabel,
  typedValueML,
  capValueML,
  totalReactionVolumeML,
  onOverride,
  onCancel
}: OldReagentCapModalProps): JSX.Element {
  const body = `${reagentLabel}: ${typedValueML.toFixed(1)} mL. Recommended max: ${capValueML.toFixed(1)} mL (20% of ${totalReactionVolumeML.toFixed(1)} mL total). Using more than 20% old reagent may affect assay reliability. Are you sure?`

  return (
    <ConfirmModal
      open={open}
      title="Old Reagent Exceeds Recommended Limit"
      body={body}
      primaryLabel="Yes, override"
      secondaryLabel="Cancel"
      primaryStyle="destructive"
      secondaryStyle="default"
      onPrimary={onOverride}
      onSecondary={onCancel}
    />
  )
}
