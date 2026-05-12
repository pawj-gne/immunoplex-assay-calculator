---
phase: 14-smoke-3-plate-page-input-expansion-ui-cleanup
fixed_at: 2026-05-12T14:36:00Z
review_path: .planning/phases/14-smoke-3-plate-page-input-expansion-ui-cleanup-inserted-2026-/14-REVIEW.md
iteration: 1
findings_in_scope: 3
fixed: 3
skipped: 0
status: all_fixed
---

# Phase 14: Code Review Fix Report

**Fixed at:** 2026-05-12T14:36:00Z
**Source review:** `.planning/phases/14-smoke-3-plate-page-input-expansion-ui-cleanup-inserted-2026-/14-REVIEW.md`
**Iteration:** 1

**Summary:**
- Findings in scope: 3 (3 Warning; 6 Info skipped per fix_scope=critical_warning)
- Fixed: 3
- Skipped: 0
- Test baseline before: 369 passing
- Test baseline after: 381 passing (+12 new WR-01 regression tests)
- Typecheck: clean before and after

## Fixed Issues

### WR-01: `commitOldBeads`/`commitOldAntibodies` reads stale React state when re-typing an over-cap value after override was previously accepted

**Files modified:**
- `src/renderer/src/features/calculator/components/CalculatorForm.tsx`
- `src/renderer/src/features/calculator/lib/oldReagentCommit.ts` (new)
- `src/renderer/src/features/calculator/lib/__tests__/oldReagentCommit.test.ts` (new)

**Commit:** `3f3e743`

**Applied fix:**
Extracted the decision logic out of the React component into a pure
helper, `evaluateOldReagentCommit()` in
`features/calculator/lib/oldReagentCommit.ts`. The helper computes
`overrideStillValid = previouslyAccepted && !valueChanged` from its
inputs only — it never re-reads the React-state override flag
inside the same callback that just called the setter. The component
delegates to this helper for both `commitOldBeads` and
`commitOldAntibodies`.

This matches the spirit of the fix suggested in REVIEW.md while making
the bug regression-testable under the existing vitest config (see
"Verification gap & coverage" below).

**Verification — Tier 2 (passed):**
- `npm run typecheck` clean
- `npm run test -- --run` → 381 passing (was 369; +12 new tests in
  `oldReagentCommit.test.ts`)
- The load-bearing WR-01 regression case
  ("override-accept-then-retype-larger") is asserted by the test
  `WR-01: re-opens the modal when value INCREASES after override
  (load-bearing)`.

**Verification gap & coverage decision (per orchestrator prompt):**

The orchestrator prompt asked for a vitest case proving the
post-override-retype re-prompt actually triggers, suggesting
extension of Group K integration tests or a component-level test,
with a fallback to documenting the gap.

The vitest config at `/Users/pawj/Lab_Dev/immunoplex-assay-calculator/vitest.config.ts`
runs under `environment: 'node'` and only includes `src/**/*.test.ts`
(NOT `.tsx`). There is no jsdom / happy-dom dependency installed, so a
component-rendering test for `CalculatorForm.tsx` is not feasible
without changing the test environment AND adding render-library deps
— out of scope for a code-review fix iteration.

Group K (`calculator.integration.test.ts`) tests math-through-the-store
contracts but never instantiates `CalculatorForm` or the override
modal state, so the WR-01 closure bug is not naturally reachable from
that surface either — the bug lives in component-local state, not in
any store.

The chosen path: extract the decision logic into a pure helper
co-located with the component (`features/calculator/lib/oldReagentCommit.ts`)
and write a dedicated unit test (`oldReagentCommit.test.ts`, 12
tests). The component now delegates 1:1 to the helper, so the
regression test proves the fix at the level where the bug actually
lives. A future iteration that adds jsdom + @testing-library/react
(noted in package-lock as available types but no devDep) can layer a
component-level integration test on top of this; the helper signature
is stable.

---

### WR-02: `handleCancel` snaps the input to a binary-floating-point `capML`, producing display flicker

**Files modified:**
- `src/renderer/src/features/calculator/components/CalculatorForm.tsx`

**Commit:** `f92c1e6`

**Applied fix:**
Floor-round `capML` to 0.1 mL precision via the existing
`floorToTenthML` helper from `src/renderer/src/lib/decimal.ts` BEFORE
writing to the store and the display:

```ts
const flooredCap = floorToTenthML(capML).toNumber()
if (activeModal === 'beads') {
  setOldBeads(flooredCap)
  setOldBeadsDisplay(flooredCap.toFixed(1))
}
```

Mirrors the calculator's consumption rule (D-07 — calculator
floor-rounds old-reagent inputs at consumption). Store and display
now agree, and the snapped value is guaranteed to be ≤ cap (no edge
case where the binary-float capML lands just above the floored
display).

Did not also apply the optional secondary cleanup in REVIEW.md (round
`capML` itself for the helper-text display on lines 277/314) —
the helper text uses `capML.toFixed(1)`, which already produces the
same string the operator sees, and changing it would expand the
diff beyond the load-bearing display-flicker fix.

**Verification — Tier 2 (passed):**
- `npm run typecheck` clean
- `npm run test -- --run` → 381 passing
- Manual visual / e2e verification of the display flicker remains a
  Windows-only UAT concern (per CLAUDE.md "dev on macOS, test on
  Windows" workflow); the math contract — `flooredCap.toFixed(1)`
  produces the same display as the post-effect re-sync — is
  guaranteed by the `floorToTenthML` Decimal precision contract
  already covered in `decimal.test.ts`.

---

### WR-03: `buildRunSnapshot` duplicates the `DEAD_VOLUME_PER_SETUP_UL` magic number instead of importing it

**Files modified:**
- `src/renderer/src/features/run/hooks/useRunSnapshot.ts`

**Commit:** `9b01465`

**Applied fix:**
Imported `DEAD_VOLUME_PER_SETUP_UL` from
`shared/constants/calculator` and replaced the hardcoded `2000` in
the `deadVolume` field:

```ts
deadVolume: calculator.numberOfSetups * DEAD_VOLUME_PER_SETUP_UL,
```

REVIEW.md also asked to double-check that
`CalculatorForm.tsx:88` already uses the constant (it does — line 5
imports it and line 90 uses it) and that the test fixtures continue
to hardcode `2000` (they do — they are validating the constant
value, which is the correct pattern).

**Verification — Tier 2 (passed):**
- `npm run typecheck` clean
- `npm run test -- --run` → 381 passing
- Group A/B/J integration tests continue to assert `2000`-based
  expected values, which is correct: those tests validate the
  constant's current value, while `useRunSnapshot` now depends on
  the symbol so a future tune of the constant propagates through
  the snapshot in lock-step with the calculator.

---

## Skipped Issues

None — all in-scope (Warning) findings were applied cleanly.

The 6 Info findings (IN-01 through IN-06) were not in scope under
`fix_scope: critical_warning` and were not touched. Per REVIEW.md they
are tracked as forward-compatibility / minor-cleanup items for
Phase 15+ follow-up.

---

_Fixed: 2026-05-12T14:36:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
