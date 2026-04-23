import { ConfirmModal } from './ConfirmModal'

interface Props {
  open: boolean
  onKeepViewing: () => void
  onEditAnyway: () => void
}

/**
 * Fired on wizard Back from step 5 (Finalized Run View) when a run is
 * currently loaded (runStore.currentRunId !== null). Per D-12:
 *   - "Keep viewing" is the primary (default style) and stays on step 5.
 *   - "Edit anyway" is the secondary, rendered in destructive style per
 *     §Specific Ideas — signals that going back will modify the saved
 *     record on next Save.
 *
 * Top-level mode changes (Calculator ↔ Manage) do NOT trigger this modal
 * per D-12; the modal fires only from the wizard Back button.
 */
export function EditWarningModal({
  open,
  onKeepViewing,
  onEditAnyway
}: Props): JSX.Element {
  return (
    <ConfirmModal
      open={open}
      title="Edit saved run?"
      body="This run is saved. Going back to edit will modify the saved record. Continue?"
      primaryLabel="Keep viewing"
      secondaryLabel="Edit anyway"
      primaryStyle="default"
      secondaryStyle="destructive"
      onPrimary={onKeepViewing}
      onSecondary={onEditAnyway}
    />
  )
}
