/**
 * Pure decision helper for the Old-Beads / Old-Antibodies commit handlers
 * in CalculatorForm.tsx.
 *
 * EXTRACTED FROM CalculatorForm.tsx to make the WR-01 fix unit-testable.
 * The vitest config (vitest.config.ts) runs under environment: 'node' and
 * only includes `*.test.ts` files — no jsdom, no .tsx — so the surrounding
 * React component cannot be rendered in a test. By extracting the
 * decision logic into a pure function we can exercise the WR-01 regression
 * scenario (override-accept → retype-larger → re-prompt) in a plain unit
 * test, and the component delegates to this helper.
 *
 * ---------------------------------------------------------------------------
 * WR-01 background (Phase 14 REVIEW.md):
 * ---------------------------------------------------------------------------
 * The previous in-component handler read the `beadsOverrideAccepted`
 * React-state variable AFTER calling its setter in the same function
 * body:
 *
 *   if (n !== oldBeads) setBeadsOverrideAccepted(false)   // schedules update
 *   setOldBeads(n)
 *   if (capML > 0 && n > capML && !beadsOverrideAccepted) {  // STALE
 *     setActiveModal('beads')
 *   }
 *
 * React state setters are asynchronous — the closure-captured
 * `beadsOverrideAccepted` reflects the pre-setter render and stays `true`
 * for the rest of this callback, so the modal does NOT re-open on the
 * second over-cap retype. The calculator pauses (via capExceeded effect)
 * but no override prompt is shown, breaking the D-10 "re-prompts when
 * value changes" contract.
 *
 * The fix is to treat a value change as an override reset for THIS
 * evaluation: compute `overrideStillValid = previouslyAccepted && !valueChanged`
 * from inputs only, without re-reading the React state that was just
 * set.
 */

export interface OldReagentCommitInputs {
  /** Raw operator-typed string from the input (e.g. "1.5", "5.0abc", ""). */
  raw: string
  /** Current store value for this reagent (mL). */
  currentValue: number
  /** Live 20%-cap in mL (0 means cap not yet established — no gate). */
  capML: number
  /**
   * Override flag captured from React state at the START of the commit
   * handler — i.e. the value committed by a previous render. Reading
   * this directly after calling setBeadsOverrideAccepted in the same
   * function is what WR-01 forbids; this helper instead uses the
   * pre-setter value plus the `valueChanged` signal to decide.
   */
  previouslyAccepted: boolean
}

export type OldReagentCommitDecision =
  /** Input was malformed (NaN, negative, etc.) — caller should snap display back. */
  | { kind: 'reject' }
  /**
   * Valid input. Caller should:
   *   - call setOldBeads/setOldAntibodies(parsedValue)
   *   - if resetOverride is true, call setBeadsOverrideAccepted(false)
   *   - if openModal is true, set pendingTypedValue = parsedValue and
   *     activeModal = 'beads' | 'antibodies'
   */
  | {
      kind: 'commit'
      parsedValue: number
      resetOverride: boolean
      openModal: boolean
    }

/**
 * Decide what the CalculatorForm commit handler should do for a single
 * Old-Beads or Old-Antibodies blur/Enter event.
 *
 * Uses `Number()` instead of `parseFloat()` so trailing garbage
 * ("1.5abc") parses to NaN and is rejected, closing IN-04 informally —
 * but IN-04 itself is out of scope for this WR-01 fix, so leave the
 * permissive behaviour to the caller (caller passes raw → we use
 * parseFloat for parity with pre-WR-01 behaviour).
 *
 * KEY WR-01 RULE: `overrideStillValid = previouslyAccepted && !valueChanged`.
 * If the operator retypes a different value, the override is treated as
 * dropped for THIS evaluation (matches D-10 "re-prompts when value
 * changes"), independent of when React commits the setter call.
 */
export function evaluateOldReagentCommit(
  inputs: OldReagentCommitInputs
): OldReagentCommitDecision {
  const { raw, currentValue, capML, previouslyAccepted } = inputs
  const parsedValue = parseFloat(raw)
  if (!Number.isFinite(parsedValue) || parsedValue < 0) {
    return { kind: 'reject' }
  }

  const valueChanged = parsedValue !== currentValue

  // WR-01: do not read the React-state override flag after the setter has
  // been called in the same callback. Instead, treat any value-change as
  // a same-tick override reset.
  const overrideStillValid = previouslyAccepted && !valueChanged

  const openModal = capML > 0 && parsedValue > capML && !overrideStillValid

  return {
    kind: 'commit',
    parsedValue,
    resetOverride: valueChanged,
    openModal
  }
}
