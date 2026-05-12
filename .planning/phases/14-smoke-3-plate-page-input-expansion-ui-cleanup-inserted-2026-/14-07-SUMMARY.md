---
phase: 14-smoke-3-plate-page-input-expansion-ui-cleanup-inserted-2026-
plan: 07
subsystem: testing

tags: [vitest, zustand, integration-test, smk3-02, smk3-03, smk3-13, decimal-js]

# Dependency graph
requires:
  - phase: 14
    provides: "Plan 14-01 applyOldReagentSubtraction + floorToTenthML; Plan 14-04 calculatorStore.oldBeads/oldAntibodies/getOutputs extension + runStore.loadRun cascade; Plan 14-05 selectionStore.selectPanel D-18/D-20 refinement; Plan 14-02 plateStore vertical-pair geometry (unaffected by these tests but reset cascade exercised)"
  - phase: 12
    provides: "calculator.integration.test.ts harness + Groups A-G (PRD fixture math, numberOfSetups, loadRun cascade IPC stub pattern)"
provides:
  - "Integration test lock-in for Plan 14-04 old-reagent math end-to-end through calculatorStore + plateStore + getOutputs() chain"
  - "Cross-store regression coverage for D-03 (plateStore.setPlateCount bumps calculator.totalWells via getPlateCount())"
  - "D-08 floor-rounding timing locked at the integration layer (state holds raw value; calculator floors at consumption)"
  - "Plan 14-05 SMK3-13 selectPanel preserve/prune contract locked in the shared integration file (alongside Phase 12 fixture math)"
affects: [phase-15, phase-16]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Single-file cross-cutting integration test (Phase 12 calculator + Phase 14 old-reagent + Phase 14 selection) — operators of one file see all store-coordination invariants in one place"
    - "vi.stubGlobal('window', { electronAPI: { panel: { getWithAnalytes } } }) narrow IPC stub for selectionStore.selectPanel — mirrors Group G's Approach A from Plan 12-04"

key-files:
  created: []
  modified:
    - "src/renderer/src/lib/__tests__/calculator.integration.test.ts — appended 209 lines: import additions (usePlateStore, useSelectionStore, PanelWithAnalytes type), Group K (T-K1..T-K5), Group L (T-L1..T-L2). 840 → 1049 lines."

key-decisions:
  - "T-K3 (override / old > raw) uses computed values from the actual calculator (20 samples × singles × 25 µL/well × setups=1 → raw=3100 µL), NOT the CONTEXT specifics row 3 (which appears to omit standards from the raw-volume calc and lists raw=1.0 mL). The load-bearing assertion is the SHAPE — old > raw → new clamps to 0, total = old + new — not the absolute mL values from the informal CONTEXT table."
  - "T-K4 uses plateStore.setPlateCount(3) directly (not setSampleCount cascade) to prove the D-03 bidirectional contract: a manual plateStore mutation lifts the plate count that calculator.getOutputs() consumes."

patterns-established:
  - "Cross-store integration assertion pattern: drive calculatorStore inputs via store actions, then read derived outputs via getOutputs() — proves the SEAM between calculator and plate stores."

requirements-completed: [SMK3-02, SMK3-03, SMK3-04, SMK3-13]

# Metrics
duration: ~8min
completed: 2026-05-12
---

# Phase 14 Plan 07: Integration Test Lock-In Summary

**Locked Phase 14 old-reagent math E2E (Groups K: 5 tests) and SMK3-13 selectPanel preserve/prune (Group L: 2 tests) at the cross-store integration layer; full suite now 369/369 green, +7 vs the 362 baseline.**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-05-12T21:16:50Z (approximate, plan execution begin)
- **Completed:** 2026-05-12T21:24:14Z
- **Tasks:** 1 (single-task plan)
- **Files modified:** 1 (calculator.integration.test.ts)

## Accomplishments
- Group K (5 tests) — PRD-fixture old-reagent math E2E through the full store chain (calculatorStore + plateStore + extended getOutputs)
  - T-K1 reproduces Phase 12 Group A T-A1 (9.4 mL) and adds the new newBeadsUL/totalBeadsUL/newAntibodiesUL/totalAntibodiesUL extension fields
  - T-K2 covers CONTEXT specifics row 2 (setups=3 → 13.4 mL, oldBeads=2.0 → newBeads=11400 µL)
  - T-K3 locks override clamp (oldBeads=5.0 mL >> raw=3.1 mL → newBeads=0, totalBeads=5000 µL)
  - T-K4 verifies D-03 bidirectional plateCount contract — plateStore.setPlateCount(3) lifts calculator.totalWells to 50 + 24×3 = 122
  - T-K5 verifies D-08 floor-rounding-at-consumption — setOldBeads(1.59) preserves raw 1.59 in state, calculator floors to 1.5 mL (1500 µL) inside getOutputs()
- Group L (2 tests) — selectionStore.selectPanel SMK3-13 D-18 preserve / D-20 prune end-to-end
  - T-L1 selectPanel(null) preserves selectedSingleIds (D-18)
  - T-L2 selectPanel(panel-B) prunes selectedSingleIds members of panel B, preserves non-members (D-20)

## Task Commits

Each task was committed atomically on worktree branch `worktree-agent-af3bb772d2971108d` (base 242842b):

1. **Task 1: Append Group K + L to calculator.integration.test.ts** — `5b20ea1` (test) — 1 file changed, +209 lines

## Files Created/Modified
- `src/renderer/src/lib/__tests__/calculator.integration.test.ts` — extended with Groups K (T-K1..T-K5) + L (T-L1..T-L2); imports added for `usePlateStore`, `useSelectionStore`, and the `PanelWithAnalytes` type. Final line count: 1049 (was 840).

## Decisions Made

- **T-K3 fixture deviates from CONTEXT specifics row 3 by design.** The CONTEXT table row "sampleCount=20, beadVPW=0.05, setups=1, oldBeads=5.0 → raw=1.0 mL" cannot be reproduced by the actual `calculateRawVolume` (which always includes standard wells). T-K3 uses 20 samples × singles × 25 µL/well × setups=1 → raw = (20+24)×25 + 2000 = 3100 µL = 3.1 mL, then keeps oldBeads=5.0 mL (still > raw) to lock the clamp-to-0 SHAPE. This is documented as a test-discipline call in the test comment + the plan's `<interfaces>` block explicitly anticipated and approved it.
- **T-K4 drives plateStore.setPlateCount(3) directly** (not via setSampleCount cascade) so the test is unambiguous about the D-03 bidirectional contract. After setSampleCount(50) the plate count is 1 (50 ≤ UNKNOWN_WELLS_SINGLES=72); then a manual setPlateCount(3) bumps it to 3 — proving the Plate-page Number-of-Plates input UI surface drives the same value the calculator reads.

## Deviations from Plan

### Worktree-Isolation Recovery

**1. [Operational] Initial commit landed on the main repo's dev/v1-01 instead of the worktree branch**
- **Found during:** Task 1 (commit step)
- **Issue:** The Bash tool's CWD reset between tool calls dropped to `/Users/pawj/Lab_Dev/immunoplex-assay-calculator` (main repo) instead of the worktree path. The first commit (since-reverted hash `0afebed`) was created on `dev/v1-01` rather than on `worktree-agent-af3bb772d2971108d`.
- **Fix:**
  1. `git -C /Users/pawj/Lab_Dev/immunoplex-assay-calculator reset HEAD~1` — undid the mistaken commit on dev/v1-01 (mixed reset, preserves working tree).
  2. `git -C /Users/pawj/Lab_Dev/immunoplex-assay-calculator checkout -- src/renderer/src/lib/__tests__/calculator.integration.test.ts` — restored the test file in the main repo to its dev/v1-01 baseline (specific-file checkout per the worktree rules; no `git clean`, no blanket reset).
  3. Re-applied the same edits inside the worktree path using the `Edit` tool with the absolute worktree-prefixed file path.
  4. Re-ran targeted test, typecheck, full suite — all green.
  5. Committed via `git -C "$WT" commit ...` with explicit `-C` flag so the operation could not silently drift back to the main repo.
- **Verification:** `git -C "$WT" log --oneline -3` shows `5b20ea1` (the test commit) on top of base `242842b` on branch `worktree-agent-af3bb772d2971108d`. Main repo `dev/v1-01` HEAD is back at `242842b` — unchanged from the start-of-session state aside from existing untracked/staged files.
- **Committed in:** `5b20ea1` (correctly on the worktree branch)

---

**Total deviations:** 1 operational (worktree-isolation recovery)
**Impact on plan:** No scope change; identical test code shipped, just on the correct branch.

## Issues Encountered

- See "Deviations from Plan / Worktree-Isolation Recovery" above. The mistaken commit was reverted cleanly; no rework needed beyond re-applying the edit inside the worktree directory.

## User Setup Required

None — test-only change. No env vars, no schema changes, no IPC additions.

## Cross-Phase Regression Status

- **Phase 12 Group A (PRD canonical fixture, T-A1 → 9.4 mL):** ✓ still green
- **Phase 12 Group B (setups=3, T-B1 → 13.4 mL):** ✓ still green
- **Plan 14-04 Group J T-J1/T-J2/T-J3 (SMK3-16 snapshot fidelity — oldBeads/oldAntibodies round-trip through runStore.loadRun):** ✓ still green
- **Plan 14-04 Group H/I (oldBeads/oldAntibodies setters + getOutputs subtraction):** ✓ still green
- **Plan 14-05 selectionStore.test.ts (D-18/D-20 unit-level):** ✓ still green (5/5)
- **Full suite:** 369/369 (+7 = K1-K5 + L1-L2 vs the 362 baseline noted in the worktree warning)

## Self-Check: PASSED

Files claimed:
- `.planning/phases/14-smoke-3-plate-page-input-expansion-ui-cleanup-inserted-2026-/14-07-SUMMARY.md` — FOUND
- `src/renderer/src/lib/__tests__/calculator.integration.test.ts` — FOUND (1049 lines, was 840)

Commits claimed:
- `5b20ea1` (test(14-07): add Groups K + L …) — FOUND in `git log` on branch `worktree-agent-af3bb772d2971108d`

## Next Phase Readiness

- Phase 14 plans 01-08 are now backed by both unit tests AND cross-store integration tests for the SMK3-02/03/04/13 surfaces. Phase 15 (PE volume / SAPE name display / run-document audit) can extend either layer without re-authoring fixtures.
- No blockers.

---
*Phase: 14-smoke-3-plate-page-input-expansion-ui-cleanup-inserted-2026-*
*Completed: 2026-05-12*
