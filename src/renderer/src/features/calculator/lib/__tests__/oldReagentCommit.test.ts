import { describe, it, expect } from 'vitest'
import {
  evaluateOldReagentCommit,
  type OldReagentCommitDecision
} from '../oldReagentCommit'

/**
 * WR-01 regression coverage for the Old-Beads / Old-Antibodies commit
 * decision in CalculatorForm.tsx.
 *
 * The component itself cannot be rendered under the current vitest config
 * (environment: 'node', include: 'src/**\/*.test.ts' — no .tsx, no jsdom),
 * so the decision logic is extracted to evaluateOldReagentCommit() and
 * tested here. The component delegates 1:1 to this helper, so a green
 * test here proves the regression scenario described in 14-REVIEW.md
 * WR-01 ("override-accept-then-retype-larger") now re-opens the modal.
 *
 * The historical bug: the in-component handler reset the override flag
 * via setBeadsOverrideAccepted(false) and then read the closure-captured
 * `beadsOverrideAccepted` in the SAME callback — React setters are
 * asynchronous so the read saw the stale `true`, and the modal failed
 * to re-open on the second over-cap retype. The fix uses
 * `overrideStillValid = previouslyAccepted && !valueChanged`, computed
 * from inputs only, so a value change always counts as an override
 * reset for THIS evaluation.
 */
describe('evaluateOldReagentCommit (WR-01 fix)', () => {
  // Shared cap for most cases — 2.0 mL cap.
  const cap = 2.0

  describe('input validation', () => {
    it('rejects empty input', () => {
      const r = evaluateOldReagentCommit({
        raw: '',
        currentValue: 0,
        capML: cap,
        previouslyAccepted: false
      })
      expect(r.kind).toBe('reject')
    })

    it('rejects negative input', () => {
      const r = evaluateOldReagentCommit({
        raw: '-1.5',
        currentValue: 0,
        capML: cap,
        previouslyAccepted: false
      })
      expect(r.kind).toBe('reject')
    })

    it('rejects NaN input (non-numeric)', () => {
      const r = evaluateOldReagentCommit({
        raw: 'abc',
        currentValue: 0,
        capML: cap,
        previouslyAccepted: false
      })
      expect(r.kind).toBe('reject')
    })

    it('accepts zero', () => {
      const r = evaluateOldReagentCommit({
        raw: '0',
        currentValue: 1.0,
        capML: cap,
        previouslyAccepted: false
      })
      expect(r.kind).toBe('commit')
      expect((r as Extract<OldReagentCommitDecision, { kind: 'commit' }>).parsedValue).toBe(0)
    })
  })

  describe('cap-not-yet-established (capML === 0)', () => {
    it('never opens the modal when capML is 0 even if value is large', () => {
      const r = evaluateOldReagentCommit({
        raw: '99',
        currentValue: 0,
        capML: 0,
        previouslyAccepted: false
      })
      expect(r.kind).toBe('commit')
      expect((r as Extract<OldReagentCommitDecision, { kind: 'commit' }>).openModal).toBe(false)
    })
  })

  describe('under-cap path', () => {
    it('commits without opening the modal', () => {
      const r = evaluateOldReagentCommit({
        raw: '1.5',
        currentValue: 0,
        capML: cap,
        previouslyAccepted: false
      }) as Extract<OldReagentCommitDecision, { kind: 'commit' }>
      expect(r.kind).toBe('commit')
      expect(r.parsedValue).toBe(1.5)
      expect(r.openModal).toBe(false)
      expect(r.resetOverride).toBe(true) // value changed from 0 to 1.5
    })

    it('value unchanged → no override reset', () => {
      const r = evaluateOldReagentCommit({
        raw: '1.5',
        currentValue: 1.5,
        capML: cap,
        previouslyAccepted: false
      }) as Extract<OldReagentCommitDecision, { kind: 'commit' }>
      expect(r.kind).toBe('commit')
      expect(r.resetOverride).toBe(false)
      expect(r.openModal).toBe(false)
    })
  })

  describe('over-cap, no prior override', () => {
    it('opens the modal on first over-cap value', () => {
      const r = evaluateOldReagentCommit({
        raw: '5.0',
        currentValue: 0,
        capML: cap,
        previouslyAccepted: false
      }) as Extract<OldReagentCommitDecision, { kind: 'commit' }>
      expect(r.kind).toBe('commit')
      expect(r.parsedValue).toBe(5.0)
      expect(r.openModal).toBe(true)
      expect(r.resetOverride).toBe(true)
    })
  })

  describe('over-cap, override previously accepted (D-10)', () => {
    it('does NOT re-open the modal when value is UNCHANGED', () => {
      // Operator already clicked "Yes, override" for 5.0 mL. They re-blur
      // the same input without changing the value. No re-prompt.
      const r = evaluateOldReagentCommit({
        raw: '5.0',
        currentValue: 5.0,
        capML: cap,
        previouslyAccepted: true
      }) as Extract<OldReagentCommitDecision, { kind: 'commit' }>
      expect(r.kind).toBe('commit')
      expect(r.openModal).toBe(false)
      expect(r.resetOverride).toBe(false)
    })

    /**
     * THE LOAD-BEARING WR-01 REGRESSION.
     *
     * Scenario from 14-REVIEW.md:
     *   1. Operator types 5.0 mL (cap=2.0), modal opens, "Yes, override"
     *      → previouslyAccepted = true, currentValue = 5.0.
     *   2. Operator re-types 6.0 mL and blurs.
     *
     * BEFORE THE FIX (broken):
     *   - The in-component handler set beadsOverrideAccepted(false) and
     *     then read `beadsOverrideAccepted` in the same callback. The
     *     read saw the stale `true`, so the `!beadsOverrideAccepted`
     *     gate evaluated false → modal did NOT open. Result: calculator
     *     paused (via capExceeded effect) but no override prompt — broken
     *     D-10 "re-prompts when value changes" contract.
     *
     * AFTER THE FIX (this test asserts the green path):
     *   - openModal === true on the second (larger) over-cap entry.
     */
    it('WR-01: re-opens the modal when value INCREASES after override (load-bearing)', () => {
      const r = evaluateOldReagentCommit({
        raw: '6.0',
        currentValue: 5.0,
        capML: cap,
        previouslyAccepted: true
      }) as Extract<OldReagentCommitDecision, { kind: 'commit' }>
      expect(r.kind).toBe('commit')
      expect(r.parsedValue).toBe(6.0)
      expect(r.openModal).toBe(true) // <— THE FIX
      expect(r.resetOverride).toBe(true)
    })

    it('WR-01 mirror: re-opens the modal when value DECREASES but is still over-cap', () => {
      // 5.0 → 4.0, still over the 2.0 cap. Same re-prompt rule per D-10.
      const r = evaluateOldReagentCommit({
        raw: '4.0',
        currentValue: 5.0,
        capML: cap,
        previouslyAccepted: true
      }) as Extract<OldReagentCommitDecision, { kind: 'commit' }>
      expect(r.kind).toBe('commit')
      expect(r.openModal).toBe(true)
      expect(r.resetOverride).toBe(true)
    })

    it('WR-01 corollary: dropping to UNDER-cap does NOT open the modal but DOES reset the override flag', () => {
      // 5.0 → 1.5 (under the 2.0 cap). No prompt, but reset so a future
      // re-entry to over-cap triggers the modal again.
      const r = evaluateOldReagentCommit({
        raw: '1.5',
        currentValue: 5.0,
        capML: cap,
        previouslyAccepted: true
      }) as Extract<OldReagentCommitDecision, { kind: 'commit' }>
      expect(r.kind).toBe('commit')
      expect(r.openModal).toBe(false)
      expect(r.resetOverride).toBe(true)
    })
  })
})
