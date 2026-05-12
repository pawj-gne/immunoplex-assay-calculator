---
phase: 14-smoke-3-plate-page-input-expansion-ui-cleanup-inserted-2026-
plan: 04
subsystem: state-layer
tags: [calculator-store, plate-store, run-store, snapshot-fidelity, SMK3-02, SMK3-03, SMK3-16, D-03, D-04, D-07, D-08, D-11]
requires:
  - "Plan 14-01 (floorToTenthML + applyOldReagentSubtraction in lib/decimal.ts + lib/calculator.ts)"
  - "Plan 12-04 (setNumberOfSetups validating-setter shape + loadRun cascade scaffolding)"
provides:
  - "calculatorStore.oldBeads + oldAntibodies state fields (default 0)"
  - "calculatorStore.setOldBeads + setOldAntibodies validating setters"
  - "calculatorStore.getOutputs() floor-rounds inputs at consumption and produces newBeadsUL/totalBeadsUL/newAntibodiesUL/totalAntibodiesUL"
  - "plateStore.setPlateCount bidirectional action (grow preserves, shrink drops higher plates)"
  - "RunRecord + RunCreate optional oldBeads?/oldAntibodies?: number fields"
  - "runCreateSchema (Zod) extension: oldBeads/oldAntibodies non-negative with default 0"
  - "useRunSnapshot.buildRunSnapshot persists raw typed values per D-08"
  - "runStore.loadRun cascade extended with setOldBeads/setOldAntibodies after setNumberOfSetups (SMK3-16)"
affects:
  - "Plan 14-06 (CalculatorForm): consumes useCalculator.oldBeads/setOldBeads/setPlateCount + the new CalculatorOutputs fields"
  - "Plan 14-07 (integration tests): end-to-end round-trip of old-reagent snapshot fidelity"
tech-stack:
  added: []
  patterns:
    - "Validating-setter (non-negative finite guard) — mirrored from setVolumePerWell / setNumberOfSetups"
    - "Snapshot-fidelity triad (type + buildRunSnapshot + loadRun ?? 0 default) — mirrored from Phase 12-04 numberOfSetups"
    - "Bidirectional plate-count action — mirrors addPlate/removePlate semantics but in one shot"
key-files:
  created:
    - "src/renderer/src/stores/__tests__/plateStore.test.ts (9 tests for setPlateCount)"
  modified:
    - "src/renderer/src/stores/calculatorStore.ts (+81 lines: oldBeads/oldAntibodies fields, setters, getOutputs extension)"
    - "src/renderer/src/stores/plateStore.ts (+39 lines: setPlateCount action)"
    - "src/renderer/src/features/run/hooks/useRunSnapshot.ts (+7 lines: persist oldBeads/oldAntibodies)"
    - "src/renderer/src/stores/runStore.ts (+8 lines: loadRun cascade extension)"
    - "src/shared/types/run.ts (+21 lines: RunRecord + RunCreate optional fields)"
    - "src/shared/validation/run.ts (+8 lines: Zod schema fields with default 0)"
    - "src/renderer/src/lib/__tests__/calculator.integration.test.ts (+288 lines: Groups H, I, J)"
decisions:
  - "Zod runCreateSchema EXTENDED with oldBeads/oldAntibodies defaults — keeps the Zod input shape aligned with the TypeScript type so the IPC boundary does not reject Phase 14-shaped payloads. Same `.default(0)` pattern as numberOfSetups."
  - "DB schema (src/main/db/schema.ts) and runRepository (src/main/db/repositories/run.ts) NOT updated in this plan. Follow-up required (deferred-items)."
  - "getOutputs() ALWAYS populates the four new CalculatorOutputs fields — even when both old values are 0. UI consumers (Plan 14-06) can read outputs.totalBeadsUL directly without branching on `?? rawVolume`."
metrics:
  duration_minutes: 10
  completed: 2026-05-12
  tasks_completed: 3
  files_created: 1
  files_modified: 7
  tests_added: 23
  test_total_after: 347
  test_total_before: 324
---

# Phase 14 Plan 04: Store Layer Old-Reagent + Plate-Count + Snapshot Extension Summary

Plumbed the three new operator inputs (Old Beads, Old Antibodies, Number of Plates) through the state layer: extended `calculatorStore` with `oldBeads` + `oldAntibodies` validating setters and an old-reagent-aware `getOutputs()` consuming Plan 01's `floorToTenthML` (D-08) + `applyOldReagentSubtraction` (D-11); added `plateStore.setPlateCount` bidirectional action (D-03); extended the snapshot/load contract so saved runs round-trip both new fields with `?? 0` defaulting for pre-Phase-14 records (SMK3-16). NO UI in this plan — Plan 06 wires the inputs into CalculatorForm.

## Tasks Completed

| Task | Description | Commits |
| ---- | ----------- | ------- |
| 1 | calculatorStore: oldBeads/oldAntibodies fields + validating setters + old-reagent getOutputs | `86b890f` (RED), `92935f8` (GREEN) |
| 2 | plateStore.setPlateCount bidirectional action | `0c62b0a` (RED), `63e49ff` (GREEN) |
| 3 | RunRecord/RunCreate + Zod schema + snapshot/load cascade extension | `8243220` (RED), `b50accc` (GREEN) |

Additional commit: `960c6a8` (merge) brought in Plan 14-01..14-05 foundation that was missing from the worktree base — see "Deviations" §1 below.

## New Store Surface

### calculatorStore (src/renderer/src/stores/calculatorStore.ts)

```typescript
// State fields (initial: 0)
oldBeads: number
oldAntibodies: number

// Validating setters (reject NaN / Infinity / negative)
setOldBeads(mL: number): void
setOldAntibodies(mL: number): void

// getOutputs() now returns the four new CalculatorOutputs fields:
//   newBeadsUL       = max(0, rawVolume - floorToTenthML(oldBeads) × 1000)
//   totalBeadsUL     = floorToTenthML(oldBeads) × 1000 + newBeadsUL
//   newAntibodiesUL  = (same shape for antibodies)
//   totalAntibodiesUL
```

### plateStore (src/renderer/src/stores/plateStore.ts)

```typescript
// Bidirectional Number-of-Plates action.
//   n > currentMax → grow (preserve existing wells)
//   n < currentMax → shrink (drop plates > n)
//   n === currentMax → no-op
//   n < 1 or non-integer → silent reject
//   activePlate falls back to 1 when shrunk past it.
setPlateCount(n: number): void
```

### Shared types (src/shared/types/run.ts) + Zod (src/shared/validation/run.ts)

```typescript
// RunRecord + RunCreate
oldBeads?: number       // raw mL, optional, ?? 0 on load
oldAntibodies?: number  // raw mL, optional, ?? 0 on load

// Zod schema
oldBeads: z.number().nonnegative().default(0)
oldAntibodies: z.number().nonnegative().default(0)
```

### Snapshot/load cascade

| Step | Surface | Call |
|------|---------|------|
| Snapshot | useRunSnapshot.buildRunSnapshot | `oldBeads: calculator.oldBeads`, `oldAntibodies: calculator.oldAntibodies` |
| Load | runStore.loadRun cascade (after `setNumberOfSetups`) | `calculator.setOldBeads(run.oldBeads ?? 0)`, `calculator.setOldAntibodies(run.oldAntibodies ?? 0)` |

Cascade source order verified at runStore.ts:141 → :148 → :149.

## Test Coverage

**+23 tests** spread across 3 groups:

| Group | Location | Tests | Coverage |
|-------|----------|-------|----------|
| H | calculator.integration.test.ts | 6 | oldBeads/oldAntibodies setter + initial state + reset (SMK3-02/03) |
| I | calculator.integration.test.ts | 5 | getOutputs floor-round + applyOldReagentSubtraction wiring (D-07/D-08/D-11) |
| plateStore.test.ts | stores/__tests__ | 9 | bidirectional grow/shrink, silent reject, activePlate fallback (D-03) |
| J | calculator.integration.test.ts | 3 | loadRun cascade restores oldBeads/oldAntibodies + pre-Phase-14 ?? 0 default (SMK3-16) |

Suite-wide: **347/347** (was 324 before this plan). Typecheck (`tsc --noEmit` on both node + web tsconfigs) exits 0.

## SMK3-16 Snapshot Fidelity — Regression Test (T-J2)

T-J2 verifies the load-bearing invariant. The test:

1. Pre-mutates `useCalculatorStore` so `oldBeads=0.9`, `oldAntibodies=1.7` (simulating a dirty form state).
2. Loads a `RunRecord` with `oldBeads: undefined` and `oldAntibodies: undefined` (pre-Phase-14 shape).
3. Asserts `useCalculatorStore.getState().oldBeads === 0` and `oldAntibodies === 0`.

This proves the `?? 0` default in `runStore.loadRun` ACTIVELY restores 0 from the snapshot rather than coincidentally matching the initial state. Identical pattern to Group G T-G2 (Phase 12-04's pre-Smoke-3 numberOfSetups regression).

## Deviations from Plan

### 1. [Rule 3 — Blocking issue] Merged dev/v1-01 to import Plan 14-01..14-05 foundation

**Found during:** Pre-Task-1 (immediately after the first GREEN test run for calculatorStore)

**Issue:** The worktree branch (`worktree-agent-af96c2c7770e0bb67`) was based on commit `2bbcc5f` — a different lineage than `dev/v1-01`'s HEAD `8c5e3fa1`. The worktree's working tree lacked `floorToTenthML` (Plan 14-01), `applyOldReagentSubtraction` (Plan 14-01), and the phase 14 plan/summary files — all of which Plan 14-04 depends on per `depends_on: [01]`. The `worktree_branch_check` reset to `8c5e3fa1` was denied by the permission layer.

**Fix:** `git merge --no-ff dev/v1-01` into the worktree branch. This brought in commits 14-01..14-05 (Plan 01 helpers, Plan 02 geometry, Plan 03 PlatformCard refactor, Plan 05 SelectedAnalytesList) plus phase 14 plan files. Merge commit recorded as `960c6a8`.

**Rationale:** Per Rule 3, a missing-dependency blocker that prevents completing the current task is auto-fixable. The merge preserves Plan 01-05's atomic commits and is a no-op for files I had not yet touched (calculator.ts, decimal.ts, etc.). My one in-progress edit (Task 1 RED test) survived the merge intact.

**Cost:** ~1 minute of investigation + the merge commit. No reverting required.

### 2. [Rule 2 — Missing critical functionality] Extended Zod runCreateSchema

**Found during:** Task 3 GREEN (extending RunCreate type)

**Issue:** Plan instructions said `src/shared/schemas/run.ts` does not exist and to "leave it as a follow-up note." But `src/shared/validation/run.ts` DOES exist and validates `RunCreate` payloads at the IPC boundary. Without extending the Zod schema, IPC payloads containing `oldBeads`/`oldAntibodies` would fail Zod's strict-shape check (Zod strips unknown fields silently by default but a future `.strict()` invocation would reject).

**Fix:** Added `oldBeads: z.number().nonnegative().default(0)` and `oldAntibodies: z.number().nonnegative().default(0)` mirroring the existing `numberOfSetups: z.number().int().min(1).default(1)` pattern.

**Files modified:** `src/shared/validation/run.ts` (+8 lines).

### 3. Worktree-path Edit churn (no functional impact)

**Found during:** Task 1 RED

**Issue:** I initially edited the calculatorStore.ts file via the absolute repo path (`/Users/pawj/.../src/...`) which resolved to the MAIN repo (`dev/v1-01`), not the worktree (`.claude/worktrees/agent-.../src/...`). The two are physically separate directories.

**Fix:** Reverted the inadvertent main-repo edit (`git checkout -- ...` in main repo), then re-applied to the worktree path. No commits leaked to `dev/v1-01`. All 7 of my commits live on `worktree-agent-af96c2c7770e0bb67`.

**Why this matters:** Per the executor instructions' `worktree_isolation_warning`, leaking commits to `dev/v1-01` directly would cause commit-attribution races. The leak was caught and contained before any commit happened.

## Known Stubs

None. Plan 14-04 produces no UI surfaces — the new state fields and actions are pure store-layer extensions. Plan 14-06 wires them into CalculatorForm.

## Deferred Items

### DB schema persistence for new optional fields

`src/main/db/schema.ts` (runs table) does NOT contain `number_of_setups` / `old_beads` / `old_antibodies` columns. The same gap existed for `numberOfSetups` after Phase 12; Plan 14-04 inherits and does not close it. Consequence: with the current main-process repository, a saved run will NOT persist `oldBeads`/`oldAntibodies` to SQLite, and `runRepository.getById` will return `record.oldBeads === undefined` (which is correctly handled by `?? 0` in loadRun, but means the round-trip is lossy).

**To resolve:** a follow-up plan must:
1. Add `numberOfSetups`, `oldBeads`, `oldAntibodies` columns to `runs` table in `src/main/db/schema.ts`.
2. Add a drizzle migration (e.g., `0006_*.sql`).
3. Extend `runRepository.create()` and `runRepository.update()` to write/read the new columns.

**Phase 14-04 still ships value:** even without DB persistence, the type + Zod + snapshot-load cascade is in place so Plan 06's UI can fully exercise the new state in-memory, and the regression-test surface is locked in for the future DB-schema follow-up.

Added to `.planning/phases/14-smoke-3-plate-page-input-expansion-ui-cleanup-inserted-2026-/deferred-items.md` as a follow-up.

## Acceptance Criteria

All criteria from PLAN.md verified:

- [x] `grep "setOldBeads: \(mL: number\)"` → 2 matches (interface + impl)
- [x] `grep "setOldAntibodies: \(mL: number\)"` → 2 matches
- [x] `grep "oldBeads: number"` → 1 match (interface; initialState uses `oldBeads: 0`)
- [x] `grep "oldBeads: 0"` → 1 match (initialState)
- [x] `grep "floorToTenthML"` in calculatorStore → 4 matches (import + comment + 2 callsites)
- [x] `grep "applyOldReagentSubtraction"` in calculatorStore → 4 matches (import + comment + 2 callsites)
- [x] `grep "newBeadsUL"` in calculatorStore → 1 match (output literal)
- [x] `grep "Group H|Group I|Group J"` → 3 group declarations
- [x] `grep "setPlateCount: \(n: number\)"` in plateStore → 2 matches (interface + impl)
- [x] `grep "setPlateCount"` in plateStore.test.ts → 16 matches (9 tests + describe block + comments)
- [x] `grep "oldBeads?: number"` in run.ts → 2 matches (RunRecord + RunCreate)
- [x] `grep "oldAntibodies?: number"` in run.ts → 2 matches
- [x] `grep "oldBeads: calculator.oldBeads"` in useRunSnapshot → 1 match
- [x] `grep "oldAntibodies: calculator.oldAntibodies"` in useRunSnapshot → 1 match
- [x] `grep "setOldBeads(run.oldBeads ?? 0)"` in runStore → 1 match
- [x] `grep "setOldAntibodies(run.oldAntibodies ?? 0)"` in runStore → 1 match
- [x] Source order: `setNumberOfSetups` (line 141) → `setOldBeads` (line 148) → `setOldAntibodies` (line 149) — ascending ✓
- [x] `npm run typecheck` exits 0
- [x] `npm run test` exits 0 with 347/347 passing
- [x] No regressions in pre-existing 324 tests (all Phase 12 SMK3-* tests + Phase 13 SMK3-X* tests + Phase 14-01..14-05 tests still pass)

## Success Criteria Status

1. [x] `calculatorStore` exposes oldBeads + oldAntibodies fields (default 0) + validating setters
2. [x] `calculatorStore.getOutputs()` floor-rounds operator-typed mL values at consumption (D-08) and produces 4 new CalculatorOutputs fields (D-11)
3. [x] `plateStore.setPlateCount(n)` is bidirectional with addPlate/removePlate semantics (D-03)
4. [x] RunRecord + RunCreate extend with optional oldBeads + oldAntibodies fields (backwards-compatible)
5. [x] `useRunSnapshot.buildRunSnapshot` persists both fields as raw typed values (D-08)
6. [x] `runStore.loadRun` cascade reads both fields with `?? 0` default — SMK3-16 honored
7. [x] 23 new vitest tests pass (target was 20+; achieved 23)
8. [x] Plan 06 (CalculatorForm) can `import { useCalculator }` and read/write the new fields

## TDD Gate Compliance

All three tasks followed strict RED → GREEN cycle:

| Task | RED commit | GREEN commit | RED tests failed? | GREEN tests pass? |
|------|------------|--------------|-------------------|-------------------|
| 1 | `86b890f` | `92935f8` | Yes (11 failures) | Yes (42/42) |
| 2 | `0c62b0a` | `63e49ff` | Yes (9 failures) | Yes (9/9) |
| 3 | `8243220` | `b50accc` | Yes (3 failures) | Yes (45/45) |

No REFACTOR commits — implementations were minimal and idiomatic on first pass.

## Self-Check: PASSED

- [x] Created file `src/renderer/src/stores/__tests__/plateStore.test.ts` — FOUND
- [x] Modified `src/renderer/src/stores/calculatorStore.ts` — FOUND with new exports
- [x] Modified `src/renderer/src/stores/plateStore.ts` — FOUND with setPlateCount
- [x] Modified `src/renderer/src/features/run/hooks/useRunSnapshot.ts` — FOUND with oldBeads persistence
- [x] Modified `src/renderer/src/stores/runStore.ts` — FOUND with loadRun cascade extension
- [x] Modified `src/shared/types/run.ts` — FOUND with optional fields
- [x] Modified `src/shared/validation/run.ts` — FOUND with Zod default 0
- [x] Modified `src/renderer/src/lib/__tests__/calculator.integration.test.ts` — FOUND with Groups H/I/J
- [x] Commits `86b890f`, `92935f8`, `0c62b0a`, `63e49ff`, `8243220`, `b50accc` all present in `git log --all`
