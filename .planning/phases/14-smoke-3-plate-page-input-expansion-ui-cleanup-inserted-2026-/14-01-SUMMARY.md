---
phase: 14-smoke-3-plate-page-input-expansion-ui-cleanup-inserted-2026-
plan: 01
subsystem: lib (pure-math foundation)
tags: [pure-fn, decimal, calculator, smoke-3, foundation]
requires: []
provides:
  - floorToTenthML (Decimal helper, mL → mL)
  - applyOldReagentSubtraction (calculator pure fn, µL → { newReagentUL, totalReagentUL })
  - CalculatorOutputs.newBeadsUL / totalBeadsUL / newAntibodiesUL / totalAntibodiesUL (optional fields)
affects:
  - Plan 14-04 (calculatorStore.getOutputs() — will import and wire these primitives)
  - Plan 14-06 (CalculatorForm — will use floorToTenthML at the input boundary)
tech-stack:
  added: []
  patterns:
    - "Single-purpose pure function in lib/ — mirrors ceilToTenthML"
    - "Optional type extension for forward-compat without breaking Phase 12 consumers"
    - "Decimal.isNegative() branching (alternative to Decimal.max static) for floor-clamp"
key-files:
  created: []
  modified:
    - src/renderer/src/lib/decimal.ts (+25 lines — floorToTenthML)
    - src/renderer/src/lib/calculator.ts (+27 lines — applyOldReagentSubtraction)
    - src/shared/types/calculator.ts (+8 lines — 4 optional CalculatorOutputs fields)
    - src/renderer/src/lib/__tests__/decimal.test.ts (+34/-1 lines — 8 new tests)
    - src/renderer/src/lib/__tests__/calculator.test.ts (+42/-1 lines — 5 new tests)
decisions:
  - "Used Decimal.isNegative() branching for floor-clamp (rather than Decimal.max) — plan explicitly allowed either form; chose the branching form to avoid TypeScript static-method ambiguity"
  - "Appended floorToTenthML tests to existing decimal.test.ts rather than creating a new file (the plan's action block said 'Create' but a shipped file with 9 ceilToTenthML tests already existed)"
metrics:
  duration_minutes: 5
  completed: 2026-05-12
  tasks_complete: 2
  tests_added: 13
  test_suite_after: 229/229 passing
---

# Phase 14 Plan 01: Pure-Math Foundation Summary

Smoke 3 pure-math primitives: `floorToTenthML` (asymmetric mL-domain counterpart to the shipped `ceilToTenthML` per D-07/D-08) and `applyOldReagentSubtraction` (per-reagent floor-clamp subtraction per D-11), plus a non-breaking `CalculatorOutputs` type extension. No store wiring, no UI — consumer-agnostic foundation for Plans 14-04 and 14-06.

## Tasks Completed

| # | Task | Type | Commit (worktree) | Commit (dev/v1-01) |
| - | ---- | ---- | ----------------- | ------------------ |
| 1 | RED: failing tests for floorToTenthML | test (TDD RED) | 1aa939c | 9c6577b |
| 1 | GREEN: floorToTenthML helper in lib/decimal.ts | feat (TDD GREEN) | 49a7e8f | 8a328af |
| 2 | RED: failing tests for applyOldReagentSubtraction | test (TDD RED) | f545bae | c605a43 |
| 2 | GREEN: applyOldReagentSubtraction + CalculatorOutputs ext | feat (TDD GREEN) | 381d34e | (only on worktree) |

Note: Commits also exist on the main repo's `dev/v1-01` branch (commits prefixed with the second hash column) because the executor briefly ran git commands in the main repo before recognizing the worktree-vs-main split. The worktree branch contains the canonical, cherry-picked sequence and is the source the orchestrator should merge back.

## What Shipped

### New function: `floorToTenthML(volumeML: Decimal | number): Decimal`

Location: `src/renderer/src/lib/decimal.ts` (after `ceilToTenthML`, before `createConcentration`).

```typescript
export function floorToTenthML(volumeML: Decimal | number): Decimal {
  const mL = volumeML instanceof Decimal ? volumeML : new Decimal(volumeML)
  return mL.toDecimalPlaces(1, Decimal.ROUND_FLOOR)
}
```

Unit contract: input AND output BOTH in mL. Intentionally asymmetric with `ceilToTenthML` (µL → µL) to match the Old Beads / Old Antibodies UI input domain (operator types mL).

Examples (mL → mL):
- `1.51 → 1.5`
- `1.59 → 1.5`
- `1.50 → 1.5` (idempotent)
- `0.04 → 0.0`
- `0.00 → 0.0`

### New function: `applyOldReagentSubtraction(rawVolumeUL, oldReagentUL)`

Location: `src/renderer/src/lib/calculator.ts` (between `calculateVolumes` and `validateSampleCount`).

```typescript
export function applyOldReagentSubtraction(
  rawVolumeUL: Decimal,
  oldReagentUL: Decimal
): { newReagentUL: Decimal; totalReagentUL: Decimal } {
  const diff = rawVolumeUL.minus(oldReagentUL)
  const newReagentUL = diff.isNegative() ? new Decimal(0) : diff
  const totalReagentUL = oldReagentUL.plus(newReagentUL)
  return { newReagentUL, totalReagentUL }
}
```

Semantics per D-11:
- `newReagent = max(0, raw - old)` — floor-clamps so the operator never gets a negative suggestion.
- `totalReagent = old + new` (dead volume already inside `rawVolumeUL`).
- Caller is responsible for floor-rounding `oldReagentUL` on the way in (D-08) and ceil-rounding the outputs on the way out (D-07).

### CalculatorOutputs type extension

Location: `src/shared/types/calculator.ts` (extends the existing interface with 4 OPTIONAL fields):

```typescript
newBeadsUL?: Decimal
totalBeadsUL?: Decimal
newAntibodiesUL?: Decimal
totalAntibodiesUL?: Decimal
```

All four are optional so Phase 12 callsites (`useCalculator` hook, `calculator.integration.test.ts`) continue to compile unchanged. Plan 14-04 will populate them at the store layer.

### Test counts

| File | Before | After | Delta |
| ---- | ------ | ----- | ----- |
| `decimal.test.ts` | 9 | 17 | +8 (floorToTenthML) |
| `calculator.test.ts` | 13 | 18 | +5 (applyOldReagentSubtraction) |
| **All test files** | 216 | **229** | **+13** |

Full vitest suite: 229/229 passing. Typecheck: clean.

## Verification

- `npm run test -- src/renderer/src/lib/__tests__/decimal.test.ts` → 17/17 passing
- `npm run test -- src/renderer/src/lib/__tests__/calculator.test.ts` → 18/18 passing
- `npm run test` → 229/229 passing (no regression in Phase 12 integration tests because CalculatorOutputs extension is optional fields only)
- `npm run typecheck` → exits 0

### Acceptance criteria verified (Task 1)

- `grep "export function floorToTenthML" src/renderer/src/lib/decimal.ts` → 1 match
- `grep "Decimal.ROUND_FLOOR" src/renderer/src/lib/decimal.ts` → 1 match
- `grep "describe.*floorToTenthML" src/renderer/src/lib/__tests__/decimal.test.ts` → 1 match
- `git diff --stat src/renderer/src/lib/decimal.ts` → 25 insertions, 0 deletions (ceilToTenthML untouched)

### Acceptance criteria verified (Task 2)

- `grep "export function applyOldReagentSubtraction" src/renderer/src/lib/calculator.ts` → 1 match
- `grep "newBeadsUL.*Decimal" src/shared/types/calculator.ts` → 1 match (the type extension)
- `grep "totalAntibodiesUL" src/shared/types/calculator.ts` → 1 match
- `grep "describe.*applyOldReagentSubtraction" src/renderer/src/lib/__tests__/calculator.test.ts` → 1 match
- `grep "function calculateVolumes" src/renderer/src/lib/calculator.ts` → 1 match (existing fn preserved)

## Deviations from Plan

### 1. [Rule 1/Adjustment] Appended floorToTenthML tests to existing decimal.test.ts rather than creating a new file

- **Found during:** Task 1
- **Issue:** Plan action block said "Create `src/renderer/src/lib/__tests__/decimal.test.ts` (new file — directory exists; verify with `ls`)". The file already existed and contained 9 shipped tests for `ceilToTenthML` (Phase 12 deliverable).
- **Fix:** Imported `floorToTenthML` into the existing import line and appended a new `describe('floorToTenthML …')` block at the bottom. Existing 9 `ceilToTenthML` tests preserved.
- **Files modified:** `src/renderer/src/lib/__tests__/decimal.test.ts` (+34 / -1 lines — the -1 is the import line change, not a test deletion)
- **Rationale:** Creating a new file would have collided with the shipped one; appending preserves all 9 existing tests untouched. Test count goes 9 → 17 rather than "from 0" as the plan's "new file" framing implied. This matches the spirit of the plan (one describe block, 8 new tests for `floorToTenthML`).
- **Commit:** 1aa939c (RED), 49a7e8f (GREEN)

### 2. [Choice within plan-stated allowance] Used `Decimal.isNegative()` branching rather than `Decimal.max`

- **Found during:** Task 2 GREEN
- **Issue:** Plan action block recommended `Decimal.max(new Decimal(0), …)` but explicitly noted: "If TypeScript balks on the static method, fall back to: `const diff = …; const newReagentUL = diff.isNegative() ? new Decimal(0) : diff`. Either form is fine."
- **Fix:** Chose the branching form preemptively to avoid any static-method ambiguity. Functionally identical; same test results.
- **Files modified:** `src/renderer/src/lib/calculator.ts`
- **Commit:** 381d34e

### 3. [Worktree/main-repo confusion — recovered, no impact on final deliverable]

- **Found during:** Task 2 GREEN verification
- **Issue:** Executor briefly ran `cd /Users/pawj/Lab_Dev/immunoplex-assay-calculator && …` commands during Task 1 and the early part of Task 2, which committed to the main repo's `dev/v1-01` branch instead of the worktree branch. Discovered when the full-suite test in the main repo showed 72 failures from a parallel agent's `getDuplicatePair.test.ts` (Plan 14-02 territory).
- **Fix:** Cherry-picked the 3 commits made on `dev/v1-01` (`9c6577b`, `8a328af`, `c605a43`) into the worktree branch (`worktree-agent-a0f56b945a4af8809`), then re-applied the uncommitted Task-2 GREEN-phase edits to the worktree's `lib/calculator.ts` and `shared/types/calculator.ts` and committed them locally (`381d34e`).
- **No code changes lost.** All work is now correctly in the worktree branch. The cherry-picked commits in the main repo can be left as-is (they're identical content) or pruned by the orchestrator if the merge-back creates duplicates.
- **Files modified:** None additional — recovery only.

No other deviations. No auto-fixes triggered (no bugs discovered, no missing critical functionality, no blocking issues).

## Authentication Gates

None.

## Known Stubs

None. Both functions are full implementations of their D-07/D-08/D-11 specs.

## Self-Check: PASSED

Verified before this section:

```
$ grep -n "applyOldReagentSubtraction" src/renderer/src/lib/calculator.ts
124:export function applyOldReagentSubtraction(

$ grep -n "totalAntibodiesUL" src/shared/types/calculator.ts
45:  totalAntibodiesUL?: Decimal

$ grep -n "describe.*floorToTenthML" src/renderer/src/lib/__tests__/decimal.test.ts
52:describe('floorToTenthML (SMK3 D-07 floor-to-0.1-mL for operator inputs)', () => {

$ git log --oneline 2198ca1..HEAD
381d34e feat(14-01): add applyOldReagentSubtraction + CalculatorOutputs extension
f545bae test(14-01): add failing tests for applyOldReagentSubtraction
49a7e8f feat(14-01): add floorToTenthML helper (D-07 floor-to-0.1-mL mL-domain)
1aa939c test(14-01): add failing tests for floorToTenthML

$ npm run test                  → 229/229 passing
$ npm run typecheck             → exits 0
```

All claimed files exist. All claimed commits exist. All acceptance criteria pass.

## TDD Gate Compliance

This plan is `type: execute` (per frontmatter), not `type: tdd`. However, each task individually had `tdd="true"` and both followed proper RED → GREEN ordering:

- Task 1 RED: 1aa939c (`test(14-01): add failing tests for floorToTenthML`)
- Task 1 GREEN: 49a7e8f (`feat(14-01): add floorToTenthML helper …`)
- Task 2 RED: f545bae (`test(14-01): add failing tests for applyOldReagentSubtraction`)
- Task 2 GREEN: 381d34e (`feat(14-01): add applyOldReagentSubtraction …`)

REFACTOR phase: not needed for either task (both implementations are minimal single-purpose pure functions; the GREEN code is already clean).
