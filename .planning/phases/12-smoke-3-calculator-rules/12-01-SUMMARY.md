---
phase: 12-smoke-3-calculator-rules
plan: 01
subsystem: calculator
tags: [calculator, rounding, dead-volume, smoke-3, tdd, breaking-rename]
requires:
  - decimal.js (^10.4.3, already in tree)
provides:
  - "src/renderer/src/lib/decimal.ts exports ceilToTenthML(volumeUL: Decimal): Decimal — round UP to 0.1 mL (SMK3-06)"
  - "src/renderer/src/lib/calculator.ts: calculateFinalVolume now uses 0.1-mL ceiling; createCalculatorInputs takes numberOfSetups (default 1) and derives dead volume as setups × DEAD_VOLUME_PER_SETUP_UL"
  - "src/shared/constants/calculator.ts: DEAD_VOLUME_PER_SETUP_UL = 2000 (renamed from DEFAULT_DEAD_VOLUME)"
  - "src/shared/types/calculator.ts: CalculatorInputs.numberOfSetups: number; CalculatorState.numberOfSetups: number"
affects:
  - "src/renderer/src/stores/calculatorStore.ts (import rename only — runtime behavior unchanged until Plan 12-03 reworks store)"
tech-stack:
  added: []
  patterns:
    - "Decimal.toDecimalPlaces(n, Decimal.ROUND_CEIL) for precision-aware ceiling rounding"
    - "Defensive sanity cap on function input to detect legacy-caller miscompilation"
    - "TDD RED → GREEN per task (failing test commit not separated; tests + impl shipped together per plan instruction)"
key-files:
  created:
    - "src/renderer/src/lib/__tests__/decimal.test.ts (9 tests)"
    - "src/renderer/src/lib/__tests__/calculator.test.ts (13 tests across 3 groups)"
    - ".planning/phases/12-smoke-3-calculator-rules/12-01-SUMMARY.md"
  modified:
    - "src/renderer/src/lib/decimal.ts (add ceilToTenthML; delete roundUpToNearestML)"
    - "src/renderer/src/lib/calculator.ts (import swap; calculateFinalVolume swap; createCalculatorInputs signature + validation + sanity cap)"
    - "src/shared/constants/calculator.ts (rename DEFAULT_DEAD_VOLUME → DEAD_VOLUME_PER_SETUP_UL)"
    - "src/shared/types/calculator.ts (add numberOfSetups to CalculatorInputs + CalculatorState)"
    - "src/renderer/src/stores/calculatorStore.ts (import rename only)"
decisions:
  - "0.1-mL ceiling implemented via Decimal.toDecimalPlaces(1, ROUND_CEIL) — keeps decimal.js precision math intact rather than handrolled scaling"
  - "Old roundUpToNearestML deleted in Task 2 (no remaining callers); kept deprecated-in-place during Task 1 only as a transition aid"
  - "Defensive sanity cap (numberOfSetups > 1000 → throws) is the deliberate forcing function preventing Plan 12-03 from being silently skipped — calculatorStore.getOutputs() will throw at runtime until 12-03 ships"
  - "calculatorStore.ts touched (import rename only) despite plan's no-touch directive, because the rename is grep-verifiable and breaks the import. Documented as Rule-3 deviation; runtime semantics unchanged"
  - "CalculatorInputs keeps both numberOfSetups (operator input) and deadVolume (computed Decimal) — dual-field design preserves useRunSnapshot.ts:101 read of inputs.deadVolume unchanged for Plan 12-03's snapshot work"
metrics:
  duration: "4m 17s"
  date_completed: "2026-05-12"
  tasks_completed: 2
  files_changed: 7
  tests_added: 22
  commits:
    - "bce17a5: feat(12-01): add ceilToTenthML helper for 0.1-mL ceiling rounding"
    - "547d89a: feat(12-01): swap calculator to 0.1-mL ceiling + setups-scaled dead volume"
---

# Phase 12 Plan 01: Calculator Rules — 0.1-mL Ceiling + Setups-Scaled Dead Volume Summary

Pure-math layer (decimal.ts + calculator.ts + shared types) now speaks Smoke 3 rules: final volumes round UP to nearest 0.1 mL (SMK3-06, supersedes STATE 02-01), and dead volume scales with `numberOfSetups × 2 mL` (SMK3-05, extends CALC-03). createCalculatorInputs gains a backwards-compatible `numberOfSetups: number = 1` 5th parameter; a defensive sanity cap rejects > 1000 to catch legacy callers passing the old µL deadVolume value. 22 new vitest cases land green; full suite 60/60.

## Objective Recap

Migrate the calculator's rounding and dead-volume rules to the Smoke 3 PRD spec, in **pure calculator logic only** (no store, no UI, no parser). Plan 12-03 will rework `calculatorStore` to surface `numberOfSetups` as a first-class field and remove the legacy `deadVolume: number` runtime store field.

## What Shipped

### Task 1 — ceilToTenthML helper (commit `bce17a5`)
- Added `ceilToTenthML(volumeUL: Decimal): Decimal` to `src/renderer/src/lib/decimal.ts`. Implementation: `volumeUL.dividedBy(1000).toDecimalPlaces(1, Decimal.ROUND_CEIL).times(1000)`. Keeps everything in µL at the function boundary; uses decimal.js's precision-aware rounding so no intermediate floating-point error.
- Marked the legacy `roundUpToNearestML` `@deprecated` in place. Deleted entirely in Task 2.
- Wrote `src/renderer/src/lib/__tests__/decimal.test.ts` with 9 vitest cases covering: PRD worked-example boundaries (7400, 3700 — already at 0.1 mL, pass through unchanged), upward rounding (7401/7410/7499 → 7500), sub-0.1-mL inputs (41/50 → 100), and the critical zero-stays-zero case (0 → 0, no upward bump).

### Task 2 — Calculator swap + rename + setups parameter (commit `547d89a`)
- `src/shared/constants/calculator.ts`: renamed `DEFAULT_DEAD_VOLUME` (2000 µL = 2 mL total) → `DEAD_VOLUME_PER_SETUP_UL` (2000 µL contributed per setup). Same value, semantically different.
- `src/shared/types/calculator.ts`:
  - Added `numberOfSetups: number` to `CalculatorInputs` (required field; `createCalculatorInputs` always supplies it).
  - Added `numberOfSetups: number` to `CalculatorState` (advertises the field for Plan 12-03; nothing reads it from this interface yet).
- `src/renderer/src/lib/calculator.ts`:
  - Import line swapped `roundUpToNearestML` → `ceilToTenthML`; added `DEAD_VOLUME_PER_SETUP_UL` to the constants import.
  - `calculateFinalVolume` body changed to `return ceilToTenthML(rawVolumeUL)`. JSDoc updated to reference SMK3-06 and call out the supersedence of CALC-06 / STATE 02-01.
  - `createCalculatorInputs` signature: 5th positional arg renamed from `deadVolumeUL: number = 500` to `numberOfSetups: number = 1`. Body validates integer ≥ 1 with descriptive error containing the string `numberOfSetups`, then derives `deadVolumeUL = numberOfSetups * DEAD_VOLUME_PER_SETUP_UL`. **Defensive sanity cap:** rejects `numberOfSetups > 1000` with a different error message also containing `numberOfSetups` — protects against legacy callers passing the old µL `deadVolume` runtime value (typically 2000) as the 5th positional arg.
- `src/renderer/src/lib/decimal.ts`: deleted the deprecated `roundUpToNearestML` function entirely (no callers remain).
- `src/renderer/src/lib/__tests__/calculator.test.ts`: 13 vitest cases in three groups:
  - **Group A (3):** `calculateFinalVolume` 0.1-mL ceiling on 7400 / 7401 / 0.
  - **Group B (8):** `createCalculatorInputs` numberOfSetups → deadVolume math (defaults to 1; 1/3/5 produce 2000/6000/10000 µL); validation rejects 0, -1, 1.5, and the 2000 sanity-cap case; `inputs.numberOfSetups` echoes back the supplied value.
  - **Group C (2):** end-to-end PRD worked example via `calculateVolumes`: `100 samples × singles × 2 plates × 50 µL/well` → 148 wells, raw 9400 µL, final 9400 µL, finalVolumeML 9.4. Same inputs with `setups=3` → raw 13400 µL, finalVolumeML 13.4. **These fixture values are the downstream reuse target for Plans 12-02 + 12-03.**

### Task 2 — additional touch (Rule-3 deviation)
- `src/renderer/src/stores/calculatorStore.ts`: import rename `DEFAULT_DEAD_VOLUME` → `DEAD_VOLUME_PER_SETUP_UL` (and the corresponding `initialState.deadVolume` reference). **Runtime behavior unchanged** — the store still passes its `deadVolume: number` field (= 2000) as the 5th positional arg to `createCalculatorInputs`. After this plan, `getOutputs()` will **throw** at runtime via the sanity cap (2000 > 1000). This is the **intended forcing function** so Plan 12-03 cannot be silently skipped; runtime sanity validates the design.

## PRD Worked-Example Fixture (downstream reuse target)

For Plans 12-02 and 12-03 to verify continuity, these are the exact values from the new `calculator.test.ts` Group C:

| Input | Value |
|---|---|
| `sampleCount` | 100 |
| `replicateMode` | `singles` |
| `plateCount` | 2 |
| `volumePerWellUL` | 50 |
| `numberOfSetups` | 1 |

| Output | Value |
|---|---|
| `totalWells` | 148 (= 100 unknown + 24 × 2 standard) |
| `rawVolume` | 9400 µL (= 148 × 50 + 1 × 2000) |
| `finalVolume` | 9400 µL (already at 0.1 mL) |
| `finalVolumeML` | 9.4 |

Same inputs with `numberOfSetups = 3` → `rawVolume = 13400 µL`, `finalVolumeML = 13.4`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking issue] calculatorStore.ts import rename**

- **Found during:** Task 2 typecheck step
- **Issue:** Renaming `DEFAULT_DEAD_VOLUME` → `DEAD_VOLUME_PER_SETUP_UL` broke `src/renderer/src/stores/calculatorStore.ts:13` (the import) and `:64` (the `initialState.deadVolume` reference), causing `npm run typecheck:web` to error: `Module ... has no exported member 'DEFAULT_DEAD_VOLUME'`. This violated plan success criterion 7 (typecheck must exit 0).
- **Fix:** Renamed the import + one usage site to `DEAD_VOLUME_PER_SETUP_UL`. **No runtime semantics changed** — the store still uses the constant as the default `deadVolume: number` runtime field (value 2000), and still passes that runtime value as the 5th positional arg to `createCalculatorInputs`. The plan explicitly anticipated this scenario in Task 2 §<action> step 5 ("**CRITICAL — caller break detection**") — the sanity cap > 1000 is designed to throw at runtime here, deliberately. Plan 12-03 fixes the store properly.
- **Files modified:** `src/renderer/src/stores/calculatorStore.ts` (lines 13 and 64)
- **Commit:** `547d89a` (folded into Task 2 commit since both edits are part of the same conceptual rename wave)

### Plan-allowed scope expansion

The plan's `<files>` for Task 2 listed 4 files; the actual commit touches 5 (added `calculatorStore.ts`). This is the Rule-3 deviation above, not new functionality.

## Known Stubs

None.

## Threat Flags

None — Phase 12 is pure offline math; no I/O, no user-supplied strings touch SQL/HTML/IPC. Input validation (`numberOfSetups` integer ≥ 1, ≤ 1000) protects against caller bugs, not adversaries.

## Important Notes for Plan 12-03

The Plan-12-01 → Plan-12-03 handoff carries one **runtime regression that the test suite cannot catch** (calculatorStore.ts is not vitest-tested):

- `useCalculatorStore.getState().getOutputs()` will throw the sanity-cap error on every call until Plan 12-03 swaps the runtime field. Vitest stays green because nothing in the test suite exercises the store; the renderer app itself will surface this immediately on the calculator page.
- Plan 12-03 must:
  1. Replace `deadVolume: number` in the store state with `numberOfSetups: number` (default 1).
  2. Update the `getOutputs()` call site to pass `numberOfSetups` (not `deadVolume`) as the 5th positional arg.
  3. Decide whether to keep the `useRunSnapshot.ts:101` read of `inputs.deadVolume` (still valid — that field stays on `CalculatorInputs`) or migrate snapshot serialization to also persist `numberOfSetups`.

## Verification Evidence

- `npm test` (full vitest): 10 files, **60 passed (60)**.
- `npm run typecheck` (node + web): **clean exit**.
- `grep -rn "DEFAULT_DEAD_VOLUME\|roundUpToNearestML" src/ --include="*.ts" --include="*.tsx"`: **zero hits**.
- `grep -E "^export function ceilToTenthML" src/renderer/src/lib/decimal.ts`: 1 hit.
- `grep -E "numberOfSetups.*=\s*1" src/renderer/src/lib/calculator.ts`: 3 hits (JSDoc + default + error message).
- `grep -c "numberOfSetups" src/renderer/src/lib/calculator.ts`: 11.
- `grep -c "numberOfSetups" src/shared/types/calculator.ts`: 4.
- `grep -n "DEAD_VOLUME_PER_SETUP_UL" src/shared/constants/calculator.ts`: 1 hit (the export).
- `grep -E "exceeds sanity cap|numberOfSetups.*1000" src/renderer/src/lib/calculator.ts`: 2 hits (cap branch + error message).

## Self-Check: PASSED

Files created (verified present):
- FOUND: `src/renderer/src/lib/__tests__/decimal.test.ts`
- FOUND: `src/renderer/src/lib/__tests__/calculator.test.ts`
- FOUND: `.planning/phases/12-smoke-3-calculator-rules/12-01-SUMMARY.md`

Commits (verified in git log):
- FOUND: `bce17a5` (Task 1)
- FOUND: `547d89a` (Task 2)
