---
phase: 14-smoke-3-plate-page-input-expansion-ui-cleanup
reviewed: 2026-05-12T00:00:00Z
depth: standard
files_reviewed: 38
files_reviewed_list:
  - drizzle/migrations/0008_runs_setups_and_old_reagents.sql
  - drizzle/migrations/meta/0008_snapshot.json
  - drizzle/migrations/meta/_journal.json
  - src/main/db/__tests__/migration.test.ts
  - src/main/db/repositories/__tests__/run.test.ts
  - src/main/db/repositories/run.ts
  - src/main/db/schema.ts
  - src/renderer/src/features/calculator/components/CalculatorForm.tsx
  - src/renderer/src/features/calculator/components/CalculatorPanel.tsx
  - src/renderer/src/features/calculator/hooks/useCalculator.ts
  - src/renderer/src/features/plate/__tests__/usePlateLayout.test.ts
  - src/renderer/src/features/plate/components/OldReagentCapModal.tsx
  - src/renderer/src/features/plate/hooks/usePlateLayout.ts
  - src/renderer/src/features/platform/components/PlatformCard.tsx
  - src/renderer/src/features/platform/components/PlatformSelector.tsx
  - src/renderer/src/features/run/hooks/useRunSnapshot.ts
  - src/renderer/src/features/selection/components/AnalyteSelectionPanel.tsx
  - src/renderer/src/features/selection/components/SelectedAnalytesList.tsx
  - src/renderer/src/features/selection/lib/__tests__/sortAnalytes.test.ts
  - src/renderer/src/features/selection/lib/sortAnalytes.ts
  - src/renderer/src/lib/__tests__/calculator.integration.test.ts
  - src/renderer/src/lib/__tests__/calculator.test.ts
  - src/renderer/src/lib/__tests__/decimal.test.ts
  - src/renderer/src/lib/calculator.ts
  - src/renderer/src/lib/decimal.ts
  - src/renderer/src/stores/__tests__/calculatorStore.capPaused.test.ts
  - src/renderer/src/stores/__tests__/plateStore.test.ts
  - src/renderer/src/stores/__tests__/selectionStore.test.ts
  - src/renderer/src/stores/calculatorStore.ts
  - src/renderer/src/stores/plateStore.ts
  - src/renderer/src/stores/runStore.ts
  - src/renderer/src/stores/selectionStore.ts
  - src/shared/constants/__tests__/getDuplicatePair.test.ts
  - src/shared/constants/calculator.ts
  - src/shared/types/calculator.ts
  - src/shared/types/run.ts
  - src/shared/validation/run.ts
findings:
  critical: 0
  warning: 3
  info: 6
  total: 9
status: issues_found
---

# Phase 14: Code Review Report

**Reviewed:** 2026-05-12T00:00:00Z
**Depth:** standard
**Files Reviewed:** 38
**Status:** issues_found

## Summary

Phase 14 ("Smoke 3 — Plate page input expansion / UI cleanup") implements the
Plate-page input expansion (Old Beads, Old Antibodies, Number of Setups),
20%-cap override modal, premix-deselect refinement (preserve singles per D-18,
prune-by-membership per D-20), flat bead-region list, vertical-pair plate
geometry, stock-conc label cleanup, and the DB-persistence patch for the three
new numeric fields. Domain math, the Decimal floor/ceiling asymmetry (D-07/D-08),
the migration (additive `ALTER TABLE ADD COLUMN ... NOT NULL DEFAULT ...`), and
snapshot round-trip through `useRunSnapshot` → `runRepository.create/update` →
`runStore.loadRun` are all correctly wired and exercised by exhaustive tests
(calculator.test, calculator.integration.test Groups H/I/J/K, migration.test
14-08 block, run.test T-1..T-6, getDuplicatePair symmetry tests, plateStore
duplicate-geometry tests).

The findings below concentrate on the 20%-cap override UX state machine
(`CalculatorForm.tsx`), which has one genuine React stale-closure bug
(WR-01) and two ancillary precision / dead-volume concerns (WR-02, WR-03).
No security or data-loss issues identified. No critical findings.

## Warnings

### WR-01: `commitOldBeads`/`commitOldAntibodies` reads stale React state when re-typing an over-cap value after override was previously accepted

**File:** `src/renderer/src/features/calculator/components/CalculatorForm.tsx:126-153`
**Issue:** The commit handler resets the override flag and then immediately reads it in the same function body:

```ts
if (n !== oldBeads) setBeadsOverrideAccepted(false)   // schedules update
setOldBeads(n)
if (capML > 0 && n > capML && !beadsOverrideAccepted) {  // STILL reads OLD value
  setPendingTypedValue(n)
  setActiveModal('beads')
}
```

React state setters are asynchronous — `setBeadsOverrideAccepted(false)` does
not update the closed-over `beadsOverrideAccepted` variable until the next
render. Scenario:

1. Operator types `5.0` mL (capML=2.0), modal opens, "Yes, override" → `beadsOverrideAccepted = true`, store = 5.0.
2. Operator re-types `6.0` mL and blurs.
3. Inside `commitOldBeads("6.0")`: `n=6.0 !== oldBeads=5.0` → `setBeadsOverrideAccepted(false)` queues. Closure-captured `beadsOverrideAccepted` is **still true**.
4. The if-guard `!beadsOverrideAccepted` evaluates to `false` → modal does NOT open.
5. Next render: `beadsOverrideAccepted=false`, so `beadsExceedsCap=true` → `useEffect` calls `setCapPaused(true)` → CalculatorPanel renders the amber "Cap exceeded" placeholder.

Result: the calculator output pauses but no override prompt is shown.
Operator's only recovery is to edit the input again (which re-fires the
commit with a still-stale-but-now-correct-by-coincidence flag). This breaks
the documented D-10 contract "re-prompts when value changes."

**Fix:** Use a local variable for the decision instead of reading the React state:

```ts
const commitOldBeads = (raw: string) => {
  const n = parseFloat(raw)
  if (!Number.isFinite(n) || n < 0) {
    setOldBeadsDisplay(oldBeads === 0 ? '0' : String(oldBeads))
    return
  }
  const valueChanged = n !== oldBeads
  if (valueChanged) setBeadsOverrideAccepted(false)
  setOldBeads(n)
  // Treat a value-change as an override reset for THIS evaluation;
  // do not read beadsOverrideAccepted because the setter above has not
  // committed yet in the current render.
  const overrideStillValid = beadsOverrideAccepted && !valueChanged
  if (capML > 0 && n > capML && !overrideStillValid) {
    setPendingTypedValue(n)
    setActiveModal('beads')
  }
}
```

Apply the identical fix to `commitOldAntibodies`. Add a regression test
in `calculatorStore.capPaused.test.ts` (or a sibling component test) that
exercises the "override-accept-then-retype-larger" sequence and asserts
`setActiveModal('beads')` fires the second time.

### WR-02: `handleCancel` snaps the input to a binary-floating-point `capML`, producing display flicker

**File:** `src/renderer/src/features/calculator/components/CalculatorForm.tsx:162-172`
**Issue:** `capML = 0.2 * totalReactionVolumeML` is a JS number, so values like
`0.2 * 9.4 === 1.8800000000000001`. On Cancel:

```ts
setOldBeads(capML)                     // store: 1.8800000000000001
setOldBeadsDisplay(capML.toFixed(1))  // display: "1.9"
```

The next render's sync effect `setOldBeadsDisplay(oldBeads === 0 ? '0' : String(oldBeads))`
overwrites the "1.9" display string with `String(1.8800000000000001)` →
input visibly snaps from "1.9" to "1.8800000000000001". Worse, the rounded
display can ALSO exceed the cap when the binary float lands slightly above
(e.g., `0.2 * 7.4 = 1.4800000000000002`), so `beadsExceedsCap` could
immediately re-trigger.

**Fix:** Floor-round the cap to 0.1 mL precision before writing to the store
and the display, mirroring the calculator's consumption rule (D-07):

```ts
import { floorToTenthML } from '../../../lib/decimal'
// inside handleCancel:
const flooredCap = floorToTenthML(capML).toNumber()
if (activeModal === 'beads') {
  setOldBeads(flooredCap)
  setOldBeadsDisplay(flooredCap.toFixed(1))
}
```

Same patch in the antibodies branch. Also consider rounding `capML` itself
when it's displayed in the helper text (lines 277, 314) so the operator sees
a consistent "Max 1.9 mL" rather than the floored-then-re-rendered string.

### WR-03: `buildRunSnapshot` duplicates the `DEAD_VOLUME_PER_SETUP_UL` magic number instead of importing it

**File:** `src/renderer/src/features/run/hooks/useRunSnapshot.ts:105`
**Issue:** `deadVolume: calculator.numberOfSetups * 2000` hardcodes `2000`
where every other call site uses `DEAD_VOLUME_PER_SETUP_UL` from
`shared/constants/calculator`. If the dead-volume-per-setup constant is ever
tuned (very plausible — the PRD calls this an "operator setup overhead" and
hardware/protocol changes are likely), this site silently desynchronizes
from the rest of the codebase. The Drizzle test snapshot and Group A/B
integration tests would still pass (they also hardcode 2000), so the bug
would surface only at PRD-verification time on Windows.

**Fix:**

```ts
import { DEAD_VOLUME_PER_SETUP_UL } from '../../../../../shared/constants/calculator'
// ...
deadVolume: calculator.numberOfSetups * DEAD_VOLUME_PER_SETUP_UL,
```

Apply the same change in `CalculatorForm.tsx:88` (already correctly imports
the constant — line 5 — but the inline arithmetic on line 88 uses it; no
fix needed there) and double-check `calculator.test.ts:30,40,46` /
`calculator.integration.test.ts:48,75` test fixtures still verify against the
literal 2000 (they should — those are validating the constant itself).

## Info

### IN-01: `numberOfSetups` is persisted as SQLite `REAL` but is semantically a positive integer

**File:** `src/main/db/schema.ts:205`, `drizzle/migrations/0008_runs_setups_and_old_reagents.sql:1`
**Issue:** `numberOfSetups: real('number_of_setups').notNull().default(1)` allows
non-integer values at the SQL layer. The runtime validator
(`setNumberOfSetups` in calculatorStore.ts:165 + the Zod schema in
validation/run.ts:28) rejects non-integers, but a direct SQL INSERT (e.g.,
from a future repair script) could land 1.5 into the column. The other two
`real` columns (`oldBeads`, `oldAntibodies`) are correctly typed because
they are decimal mL values; only `numberOfSetups` is conceptually integer.
**Fix:** Either (a) change to `integer('number_of_setups')` in a follow-up
migration, or (b) add a `CHECK (number_of_setups = CAST(number_of_setups AS INTEGER) AND number_of_setups >= 1)` constraint. Out of scope for Phase 14
since this is forward-compatible — TS layer enforces the invariant today.
Track in a Phase 15+ follow-up.

### IN-02: `OldReagentCapModal` declares `JSX.Element` return type — may break in `@types/react` 19+

**File:** `src/renderer/src/features/plate/components/OldReagentCapModal.tsx:36`
**Issue:** The function signature `): JSX.Element {` depends on the global
`JSX` namespace, which was deprecated in favor of `React.JSX` in
`@types/react` 18.3 and removed in 19. Other components in this codebase
(e.g., `CalculatorForm`, `CalculatorPanel`) omit the return type or use
implicit return inference. **Fix:** Remove the explicit `JSX.Element` and
let TS infer (or switch to `React.JSX.Element`). Not blocking today on
Electron-bundled React 18.

### IN-03: `useRunSnapshot` `eslint-disable-next-line react-hooks/exhaustive-deps` hides a real concern

**File:** `src/renderer/src/features/run/hooks/useRunSnapshot.ts:149`
**Issue:** The `useMemo` dependency list includes `metadata` (an object —
new reference every render) plus four primitive selectors. The disable line
suppresses the lint warning, but the `metadata` dependency means the memo
recomputes on every parent render anyway (object identity changes). The
selectors are then redundant. **Fix:** Either (a) drop the selectors from
the dep list and rely on `metadata`'s object identity, or (b) memoize
`metadata` at the call site and remove the disable. The current state works
but is misleading.

### IN-04: `parseFloat` in commit handlers silently truncates trailing garbage

**File:** `src/renderer/src/features/calculator/components/CalculatorForm.tsx:127,142`
**Issue:** `parseFloat("1.5abc")` returns `1.5` without error. Operator
typing `1.5abc` then Tab → silently committed as 1.5. **Fix:** Use a stricter
parse — `const n = Number(raw)` returns `NaN` for `"1.5abc"`, which the
existing `!Number.isFinite(n)` guard rejects. Same patch for `commitPlates`
(`parseInt` is slightly less permissive but accepts `"5abc"` → 5).

### IN-05: `usePlateLayout.ts` still uses `Number.isFinite` defensive guard on values that come from typed numbers

**File:** `src/renderer/src/features/plate/hooks/usePlateLayout.ts:32-37`
**Issue:** The guard `!Number.isFinite(sampleCount) || !Number.isFinite(plateCount)`
protects against NaN/Infinity, but both values come from typed Zustand
fields that are themselves guarded at the setter layer. The branch is dead
code in practice — useful for defense-in-depth, but worth a comment so a
future cleanup pass doesn't drop the guard thinking it's redundant. Already
the rest of the file is well-commented. Minor.

### IN-06: `selectionStore.toggleSingleAnalyte` uses `MAX_SINGLES_PREMIX` directly instead of `getMaxSingles(requestType)`

**File:** `src/renderer/src/stores/selectionStore.ts:239,300,306`
**Issue:** `const maxSingles = selectedPanelId ? MAX_SINGLES_PREMIX : Infinity`
duplicates the request-type → cap mapping that already lives in
`getMaxSingles()` (shared/constants/calculator.ts:83). The two will agree
today (both map "premix selected" to 5 and "no premix" to Infinity), but
the duplication means a future PRD change that introduces a different cap
for `premix_singles` vs `custom` must be applied in two places. Not a
Phase 14 regression — pre-existing pattern. Suggest extracting to
`getMaxSingles(getRequestType())` in a future refactor pass.

---

_Reviewed: 2026-05-12T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
