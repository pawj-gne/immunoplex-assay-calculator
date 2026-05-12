---
phase: 12-smoke-3-calculator-rules
reviewed: 2026-05-11T00:00:00Z
depth: standard
files_reviewed: 17
files_reviewed_list:
  - src/renderer/src/features/calculator/hooks/useCalculator.ts
  - src/renderer/src/features/run/hooks/useRunSnapshot.ts
  - src/renderer/src/lib/__tests__/calculator.integration.test.ts
  - src/renderer/src/lib/__tests__/calculator.test.ts
  - src/renderer/src/lib/__tests__/decimal.test.ts
  - src/renderer/src/lib/__tests__/diluentResolver.test.ts
  - src/renderer/src/lib/calculator.ts
  - src/renderer/src/lib/decimal.ts
  - src/renderer/src/lib/diluentResolver.ts
  - src/renderer/src/stores/calculatorStore.ts
  - src/renderer/src/stores/runStore.ts
  - src/shared/constants/calculator.ts
  - src/shared/types/calculator.ts
  - src/shared/types/diluent.ts
  - src/shared/types/run.ts
  - src/shared/validation/run.ts
findings:
  critical: 0
  warning: 4
  info: 7
  total: 11
status: issues_found
---

# Phase 12: Code Review Report

**Reviewed:** 2026-05-11
**Depth:** standard
**Files Reviewed:** 17 (16 source + 1 project context file)
**Status:** issues_found

## Summary

Phase 12 cleanly migrates the calculator from a 1 mL ceiling rule to a 0.1 mL
ceiling rule (SMK3-06), replaces the `2 mL` dead-volume constant with the
`numberOfSetups × 2 mL` formula (SMK3-05), and adds a well-isolated diluent
resolver module (SMK3-07). The pure-math layer (`calculator.ts`,
`decimal.ts`, `diluentResolver.ts`) is high quality: pure functions,
Decimal.js used consistently, no double-rounding hazards observed, the
discriminated-union `DiluentResult` is exhaustive, and the forcing-function
sanity cap in `createCalculatorInputs` correctly fires above 1000 setups.
Test coverage for the math layer is strong — the PRD worked example
(9.4 mL / 13.4 mL) is locked in at both lib and store levels, rounding
boundary cases exercise the SMK3-06 ceiling, and the diluent resolver has
13 cases across all three union branches plus boundary equality.

However, the wiring of `numberOfSetups` into the persisted-run-load path
(`runStore.loadRun`) does NOT preserve snapshot-frozen volumes the way the
phase contract calls for. Specifically:

1. **`volumePerWell` is never restored on load** — the calculator falls back
   to the 25 µL default, silently rewriting the displayed volume for any
   run saved with a non-default per-well volume. (WR-01)
2. **`deadVolume` is recomputed, not restored** — `setNumberOfSetups(...)`
   triggers `getOutputs()` to rederive deadVolume from the formula, so the
   exact persisted `run.deadVolume` is discarded. For round-trip Smoke 3
   runs this is harmless (the formula reproduces the same value), but for
   pre-Smoke-3 runs with a non-2000-µL legacy deadVolume the displayed
   volume changes silently on reload. (WR-02)
3. **No integration test asserts snapshot-frozen behavior** — Group F
   exercises `setNumberOfSetups` directly on the store, never via
   `runStore.loadRun`, so the regression bar for the snapshot-frozen
   property is currently untested. (WR-03)
4. **`getOutputs()` does not catch the >1000 sanity-cap throw** — the
   store allows arbitrarily large `numberOfSetups` (no upper bound) but
   the pure-math layer throws at >1000, leaving an unguarded exception
   path from the React render. (WR-04)

Remaining items are info-level (magic numbers, missing test for a
correctly-implemented validation-clear, JSDoc gaps, float-equality
fragility in the diluent resolver). No critical-severity issues.

## Warnings

### WR-01: `runStore.loadRun` does not restore `volumePerWell`

**File:** `src/renderer/src/stores/runStore.ts:128-138`
**Issue:** The rehydration sequence calls `calculator.setReplicateMode(run.replicateMode)`,
`calculator.setSampleCount(run.sampleCount)`, and
`calculator.setNumberOfSetups(run.numberOfSetups ?? 1)`, but never restores
`run.volumePerWell`. The calculator falls back to `DEFAULT_VOLUME_PER_WELL`
(25 µL). For any run saved with a non-default per-well volume (e.g., the
PRD worked example uses 50 µL/well), reloading produces a different displayed
volume than was originally persisted. This breaks the snapshot-frozen
contract for the persisted-run-load path that the phase context explicitly
calls out.

The contrast with `runStore.saveCurrentRun`'s snapshot path makes it sharper:
`useRunSnapshot.buildRunSnapshot` correctly reads
`calculator.volumePerWell` (line 100 of `useRunSnapshot.ts`) and persists
it in the `RunCreate` payload — so the save side preserves the field, but
the load side drops it.

**Fix:**
```typescript
// 6. Calculator — replicateMode FIRST, sampleCount SECOND, volumePerWell
//    BEFORE the setups apply (so getOutputs() — even if called between
//    the actions — uses the run's persisted volumePerWell, not the 25 µL
//    default).
calculator.setReplicateMode(run.replicateMode)
calculator.setSampleCount(run.sampleCount)
// SMK3-16: restore volumePerWell so the displayed volume matches what
// was persisted (snapshot-frozen — calculator must not silently rewrite).
useCalculatorStore.setState({ volumePerWell: run.volumePerWell })
// SMK3-05/16: reapply numberOfSetups so getOutputs() recomputes the
// same dead volume the run was saved with.
calculator.setNumberOfSetups(run.numberOfSetups ?? 1)
```
Note: there's no public `setVolumePerWell` action on `calculatorStore`. The
fix either uses `setState` directly (as above — internal, but Zustand
supports it) or — preferably — adds a `setVolumePerWell` action to the
store for parity with `setSampleCount` / `setNumberOfSetups`.

### WR-02: `loadRun` silently recomputes `deadVolume` instead of preserving the persisted value

**File:** `src/renderer/src/stores/runStore.ts:133`
**Issue:** After `setNumberOfSetups(run.numberOfSetups ?? 1)`, any subsequent
`getOutputs()` call derives `deadVolume = numberOfSetups × 2000` via
`createCalculatorInputs`. The persisted `run.deadVolume` is never read or
applied. This is correct for Smoke 3 runs (the formula reproduces the
saved value bit-for-bit), but it silently rewrites legacy / pre-Smoke-3
runs where the persisted `deadVolume` might be 500 µL (legacy default
mentioned in `calculator.ts:142`) and `numberOfSetups` is undefined.

The phase context flags this exact concern: "Snapshot-frozen runs
(`runStore.loadRun`) — persisted volumes must NOT be silently recomputed;
the setNumberOfSetups call there should be additive metadata only."
Currently `setNumberOfSetups` is the ONLY source of dead-volume restoration,
which means it's not additive — it's authoritative.

**Fix (two options):**

Option A — Accept the recompute as intentional but assert the invariant
explicitly (cheapest fix; relies on Phase 13 reparse to retire legacy runs):
```typescript
// SMK3-05/16: reapply numberOfSetups so getOutputs() recomputes the same
// dead volume the run was saved with. For pre-Smoke-3 runs with
// run.numberOfSetups === undefined and run.deadVolume !== 2000, this DOES
// silently rewrite the displayed dead volume to 2000 µL. That's accepted
// because Phase 13 SMK3-08 reparses all legacy panels; until then, surface
// the drift via the Phase 15 advisory marker UI (SMK3-16).
calculator.setNumberOfSetups(run.numberOfSetups ?? 1)
```

Option B — True snapshot-freeze: derive `numberOfSetups` from the persisted
`deadVolume` when the field is missing, so the displayed volume is exactly
what was saved:
```typescript
const setups =
  run.numberOfSetups ??
  Math.max(1, Math.round(run.deadVolume / DEAD_VOLUME_PER_SETUP_UL))
calculator.setNumberOfSetups(setups)
```
Option B preserves the 1 mL ceiling result for legacy runs that had
`deadVolume` rounded to a multiple of 2000; it loses fidelity only for
runs that had genuinely off-formula deadVolumes (e.g., the legacy 500 µL).
At minimum, the phase needs a written decision on which option is in
effect; today the code silently picks A without acknowledgement.

### WR-03: No integration test exercises `runStore.loadRun` end-to-end for snapshot-freeze

**File:** `src/renderer/src/lib/__tests__/calculator.integration.test.ts:225-289`
**Issue:** Group F is documented as the SMK3-16 enabler test ("Snapshot-frozen
historical-run preservation") but it calls `setNumberOfSetups` directly on
the calculatorStore, never via the `runStore.loadRun` → calculator cascade.
The test cannot catch WR-01 (volumePerWell not restored) and cannot catch
WR-02 (no test asserts that a pre-Smoke-3 run with persisted
`deadVolume: 500` round-trips to `deadVolume: 500`).

**Fix:** Add a test that exercises the full reload path. Sketch (requires
mocking `window.electronAPI.run.getById` — see existing Phase-4 patterns):
```typescript
it('T-F4: runStore.loadRun preserves persisted volumePerWell and deadVolume', async () => {
  // Mock a saved Smoke 3 run with non-default volumePerWell
  const mockRun: RunRecord = makeMockRun({
    sampleCount: 100,
    replicateMode: 'singles',
    volumePerWell: 50, // NOT the 25 µL default
    deadVolume: 6000,
    numberOfSetups: 3,
    // ... other required fields
  })
  vi.spyOn(window.electronAPI.run, 'getById').mockResolvedValue(mockRun)

  await useRunStore.getState().loadRun(mockRun.id)

  const outputs = useCalculatorStore.getState().getOutputs()
  expect(useCalculatorStore.getState().volumePerWell).toBe(50)
  expect(useCalculatorStore.getState().numberOfSetups).toBe(3)
  expect(outputs!.rawVolume.equals(new Decimal(13400))).toBe(true)
  expect(outputs!.finalVolumeML).toBeCloseTo(13.4, 1)
})

it('T-F5: pre-Smoke-3 runs (no numberOfSetups) default to setups=1', async () => {
  const legacyRun: RunRecord = makeMockRun({
    sampleCount: 100, replicateMode: 'singles', volumePerWell: 50,
    deadVolume: 2000, numberOfSetups: undefined, // simulating pre-SMK3
  })
  vi.spyOn(window.electronAPI.run, 'getById').mockResolvedValue(legacyRun)
  await useRunStore.getState().loadRun(legacyRun.id)
  expect(useCalculatorStore.getState().numberOfSetups).toBe(1)
})
```

### WR-04: `getOutputs()` propagates the >1000 sanity-cap throw uncaught

**File:** `src/renderer/src/stores/calculatorStore.ts:122-133, 184-192`
**Issue:** `setNumberOfSetups` enforces a lower bound (`>= 1`, integer) but
NO upper bound at the store layer. The pure-math layer
`createCalculatorInputs` throws when `numberOfSetups > 1000`
(`calculator.ts:158-162`). The path:

1. User sets `numberOfSetups = 1500` via `setNumberOfSetups(1500)` → store
   accepts it, clears validationError.
2. UI calls `getOutputs()` → calls `createCalculatorInputs(...)` →
   **throws synchronously inside a React render**, which surfaces as a
   white-screen unless an ErrorBoundary catches it.

The comment on line 39-40 of `calculatorStore.ts` says "No upper bound
enforced at the store; calculator pure-math layer caps at 1000 as a
sanity check" — but the consequence of that mismatch isn't handled at the
boundary. The forcing-function trap was DESIGNED to catch the legacy
deadVolume-as-5th-arg mistake during 12-03 development; it's no longer
appropriate to let it surface to users post-fix.

**Fix:** Either align the bounds (recommended: enforce `>= 1 && <= 1000`
at the store, matching the math layer), OR catch the throw in
`getOutputs()` and surface it as `validationError`:
```typescript
setNumberOfSetups: (n: number) => {
  if (!Number.isInteger(n) || n < 1 || n > 1000) {
    set({
      validationError: `Number of setups must be an integer between 1 and 1000 (got ${n})`
    })
    return
  }
  set({ numberOfSetups: n, validationError: null })
},
```
If the 1000 cap is intentionally lib-only (defense-in-depth against legacy
callers), at minimum wrap the `getOutputs()` body in try/catch and convert
the thrown Error into `validationError`/`null` return so React doesn't
unmount.

## Info

### IN-01: Magic number `2000` in `useRunSnapshot.ts` duplicates `DEAD_VOLUME_PER_SETUP_UL`

**File:** `src/renderer/src/features/run/hooks/useRunSnapshot.ts:105`
**Issue:** `deadVolume: calculator.numberOfSetups * 2000` hard-codes the
per-setup µL constant rather than importing
`DEAD_VOLUME_PER_SETUP_UL` from `shared/constants/calculator.ts`. If the
constant ever changes (e.g., SMK3 amendment), `calculator.ts:163` updates
but `useRunSnapshot.ts:105` silently drifts and persists wrong values.
**Fix:**
```typescript
import { DEAD_VOLUME_PER_SETUP_UL } from '../../../../../shared/constants/calculator'
// ...
deadVolume: calculator.numberOfSetups * DEAD_VOLUME_PER_SETUP_UL,
```

### IN-02: Diluent resolver uses strict `===` equality on floats

**File:** `src/renderer/src/lib/diluentResolver.ts:49`
**Issue:** `if (premix.concentration === 1)` assumes `concentration` is
exactly the integer 1. If a future CSV importer (Phase 13 SMK3-08) yields
`1.0000000001` from a parse round-trip, the 1× premix is silently missed
and the resolver falls through to `values_table` / `legacy`. Currently
all callers use clean integer values, so this is preventive only.
**Fix:** Either tolerate epsilon (`Math.abs(premix.concentration - 1) < 1e-9`)
or — better — document the contract that callers MUST pass integer-valued
concentrations and assert it:
```typescript
if (!Number.isFinite(premix.concentration)) continue
// Strict equality is intentional: panel imports must produce integer
// concentrations (validated at the importer layer). See SMK3-08 contract.
if (premix.concentration === 1) { ... }
```

### IN-03: Missing test for `validationError` clearing on valid `setNumberOfSetups`

**File:** `src/renderer/src/lib/__tests__/calculator.integration.test.ts:265-282`
**Issue:** T-F2 verifies that `setNumberOfSetups(0)`, `(-1)`, `(1.5)` SET
`validationError`, but no test verifies the error is CLEARED when a
subsequent valid call happens. The code path on line 132 of
`calculatorStore.ts` (`set({ numberOfSetups: n, validationError: null })`)
is currently uncovered.
**Fix:** Add to Group F:
```typescript
it('T-F2b: valid setNumberOfSetups after invalid clears validationError', () => {
  useCalculatorStore.getState().setNumberOfSetups(0)
  expect(useCalculatorStore.getState().validationError).toMatch(/setups/i)
  useCalculatorStore.getState().setNumberOfSetups(2)
  expect(useCalculatorStore.getState().validationError).toBeNull()
  expect(useCalculatorStore.getState().numberOfSetups).toBe(2)
})
```

### IN-04: `useRunSnapshot.useMemo` dep list omits calculator slices that affect `build`

**File:** `src/renderer/src/features/run/hooks/useRunSnapshot.ts:138-144`
**Issue:** The dep list is `[metadata, platformId, speciesId, sampleCount,
validationError, selectedCount]`. `buildRunSnapshot` also reads
`calculator.replicateMode`, `volumePerWell`, `numberOfSetups`, `requestType`,
`singles`, `panelId`, plate state, etc. — none of which are deps. The
disabled `react-hooks/exhaustive-deps` lint hides this. For the `canSave` /
`reason` gates this is fine (gates only depend on the listed deps), but a
caller that reads `result` (which is the cached snapshot object, not the
re-evaluated `build`) gets a stale view. Today no caller reads `result`
that way (they call `build(metadata)` fresh on Save click) — but the
contract is fragile.
**Fix:** Document the contract explicitly:
```typescript
// IMPORTANT: result.build is the source of truth — never inspect
// the memoized payload's body fields. The deps below only capture
// the canSave/reason gates; structural fields (replicateMode,
// volumePerWell, plate layout, etc.) are NOT in the dep list and
// their changes will NOT re-fire this memo.
// eslint-disable-next-line react-hooks/exhaustive-deps
```
Or — preferred — return only `canSave`/`reason` from the memo and call
`build` outside the memo so the caller never sees a stale snapshot:
```typescript
const canSave = !validationError && !!platformId && !!speciesId &&
                sampleCount > 0 && selectedCount > 0
return { canSave, reason: /* derive */ null, build: buildRunSnapshot }
```

### IN-05: `RunCreate.deadVolume` derived from `numberOfSetups`, persisting redundant data

**File:** `src/renderer/src/features/run/hooks/useRunSnapshot.ts:101-106`
**Issue:** `deadVolume` is computed as `numberOfSetups * 2000` at snapshot
time. The DB now stores BOTH fields, so a round-trip can disagree if the
schema's `numberOfSetups` default differs from the saved `deadVolume`. The
Zod schema on `runCreateSchema` (line 24, 28 of `validation/run.ts`)
permits `deadVolume` ≥ 0 and `numberOfSetups` ≥ 1 independently — no
cross-field check that `deadVolume === numberOfSetups × 2000`.
**Fix:** Add a `.superRefine` cross-field check (only for newly-created
Smoke 3 runs — pre-Smoke-3 update flows must remain accepting):
```typescript
.superRefine((data, ctx) => {
  // ... existing checks ...
  // SMK3-05 consistency: when numberOfSetups is supplied, deadVolume
  // must equal numberOfSetups × DEAD_VOLUME_PER_SETUP_UL. (Schema default
  // is 1, so any post-Smoke-3 payload has both fields.)
  const expected = data.numberOfSetups * 2000
  if (data.deadVolume !== expected) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['deadVolume'],
      message: `deadVolume (${data.deadVolume}) must equal numberOfSetups × 2000 (${expected})`
    })
  }
})
```
Or drop the redundancy and compute `deadVolume` at read time only.

### IN-06: `useCalculator` hook comment references "live deadVolume" but the field is fully removed

**File:** `src/renderer/src/features/calculator/hooks/useCalculator.ts:18-19`
**Issue:** The comment "the live deadVolume is derived inside
createCalculatorInputs/getOutputs" describes the new path, but
`CalculatorState` in `shared/types/calculator.ts:86` still declares
`deadVolume: number` as a field. That type appears to be an unused legacy
shape (no consumer in the listed files references `CalculatorState`
directly). Either remove it or update its `deadVolume` field to derived /
computed-only docs.
**Fix:** In `src/shared/types/calculator.ts` either delete the unused
`CalculatorState` interface or drop the `deadVolume: number` field from it
and add a comment that the live calculator state is in `calculatorStore.ts`
(the Zustand store), not this type.

### IN-07: `MAX_SINGLES_CUSTOM = Infinity` works but `Number.isFinite` checks could simplify

**File:** `src/shared/constants/calculator.ts:28` and
`src/renderer/src/lib/calculator.ts:215-219`
**Issue:** Using `Infinity` as a sentinel works (Math.max(0, Infinity-n) is
Infinity, and `canAddSingle`'s `currentCount < Infinity` always true), but
the `getRemainingSingles` special-case `if (maxSingles === Infinity) return
Infinity` is a smell — exposes Infinity to UI display code which then has
to handle it specially. Consider a separate `hasUnlimitedSingles(rt)`
helper or returning `number | 'unlimited'`. This is a v1.0 carry-over,
unchanged in Phase 12 — flagged for future cleanup, not a blocker.

---

_Reviewed: 2026-05-11_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
