---
phase: 12-smoke-3-calculator-rules
plan: 04
subsystem: store
tags: [calculator, store, gap-closure, smoke-3, integration-tests, snapshot-freeze, wr-01, wr-03, wr-04]
requires:
  - "12-03 (calculatorStore numberOfSetups plumbing + runStore.loadRun cascade with setNumberOfSetups)"
provides:
  - "src/renderer/src/stores/calculatorStore.ts: public setVolumePerWell(volumeUL) action (finite + > 0 validation, validationError on reject)"
  - "src/renderer/src/stores/calculatorStore.ts: setNumberOfSetups bound tightened to [1, 1000] inclusive (aligns with createCalculatorInputs sanity cap at calculator.ts:158–162)"
  - "src/renderer/src/stores/runStore.ts: loadRun cascade restores run.volumePerWell BETWEEN setSampleCount and setNumberOfSetups so the PRD-worked-example 50 µL/well round-trips correctly (no silent rewrite to 25 µL default)"
  - "src/renderer/src/lib/__tests__/calculator.integration.test.ts: Group G (T-G1 + T-G2, vi.stubGlobal-driven useRunStore.getState().loadRun(…) end-to-end) + Group F bounds/setVolumePerWell tests T-F4..T-F12 (9 new)"
affects:
  - "13 (Panel XLSX Parser v3 will produce per-reagent rows that eventually feed runStore; snapshot-freeze contract from this plan must not regress)"
  - "14 (Plate page Number of Setups UI input — SMK3-04 — inherits the [1, 1000] store-action bound; UI need not enforce its own upper cap)"
  - "15 (Run document audit trail — SMK3-16 advisory marker — inherits the volumePerWell round-trip fidelity guarantee)"
tech-stack:
  added: []
  patterns:
    - "vi.stubGlobal('window', { electronAPI: ... }) in beforeEach + vi.unstubAllGlobals() in afterEach — Approach A for environment: 'node' vitest projects needing window.electronAPI. Minimum blast radius: doesn't force re-validation of pre-existing tests under a different env directive"
    - "Store-action bound alignment with pure-math sanity caps — reject invalid input at the action layer so the downstream throw path is unreachable from in-store callers; defensive throw stays in place as belt-and-braces for direct-import callers"
    - "Gap-closure plans: one atomic feat(<phase>-<NN>): commit at the end of the plan covering all task file changes — tighter audit trail when fixes are surgical and tightly-scoped"

key-files:
  created:
    - ".planning/phases/12-smoke-3-calculator-rules/12-04-SUMMARY.md (this file)"
  modified:
    - "src/renderer/src/stores/calculatorStore.ts (new setVolumePerWell action, tightened setNumberOfSetups bound to [1, 1000], updated numberOfSetups field JSDoc to cite WR-04)"
    - "src/renderer/src/stores/runStore.ts (loadRun cascade gains calculator.setVolumePerWell(run.volumePerWell) BETWEEN setSampleCount and setNumberOfSetups, with WR-01 audit-trail comment)"
    - "src/renderer/src/lib/__tests__/calculator.integration.test.ts (imports afterEach + vi + useRunStore + RunRecord; T-F3 renamed in place; 11 new tests added: T-F4–T-F12 in Group F + T-G1–T-G2 in new Group G)"

key-decisions:
  - "Adopted Approach A (vi.stubGlobal in beforeEach + vi.unstubAllGlobals in afterEach) over Approach B (// @vitest-environment happy-dom directive) for Group G — minimum blast radius; doesn't force re-validation of the existing 20 Group A–F tests under a different test environment. window.electronAPI stub mirrors src/preload/index.ts exactly (species.getByPlatformId, panel.getByPlatformAndSpecies, panel.getWithAnalytes, analyte.getByPlatformAndSpecies)."
  - "T-F3 renamed in place (body unchanged) rather than deleted — the original title 'store does not enforce upper bound' was factually wrong after Task 2 tightened the bound, but the test body at n=100 still has independent mid-range diagnostic value (far from both edges). T-F4 covers the explicit upper-boundary case."
  - "[1, 1000] bound enforced at the store ACTION layer (not by wrapping getOutputs() in try/catch) — keeps validationError as the single error-reporting surface for user input. The lib-layer throw at createCalculatorInputs (calculator.ts:158–162) stays in place as a defensive backstop for any future direct-import caller bypassing the store."
  - "No setVolumePerWell propagation cascade (no usePlateStore.setVolumePerWell call inside the action) — plateStore does not own this field. setVolumePerWell is a thin setter, by design; the JSDoc characterizes 'primary caller is runStore.loadRun' to set the expectation."
  - "RunRecord mock helper (makeMockRun) defined inline in calculator.integration.test.ts rather than extracted to a fixture file — only Group G uses it; extraction would create premature shared infrastructure with no second consumer yet."

patterns-established:
  - "Gap-closure plan structure: <gap_evidence> block in plan frontmatter quotes verbatim from the verification report so the closure rationale is self-contained; per-task <read_first> blocks point at the specific lines being fixed; <acceptance_criteria> uses grep commands with exact-match counts to make completion mechanically verifiable"
  - "Snapshot-freeze restore order (replicateMode → sampleCount → volumePerWell → numberOfSetups) is load-bearing: any future useEffect subscriber on sampleCount that calls getOutputs() must see the run's persisted per-well volume, not the default"

duration: ~5min
completed: 2026-05-12
---

# Phase 12 Plan 04: Gap Closure (setVolumePerWell + setNumberOfSetups Bounds) Summary

*Closes the two `partial` truths from 12-VERIFICATION.md (Score 9/11 → 11/11): runStore.loadRun now restores volumePerWell so the PRD 50 µL/well round-trips faithfully, and setNumberOfSetups rejects n > 1000 at the action layer so the createCalculatorInputs sanity-cap throw is unreachable from production code paths.*

## Performance

- **Duration:** ~5 minutes
- **Started:** 2026-05-12 (executor spawn)
- **Completed:** 2026-05-12
- **Tasks:** 6 (per plan)
- **Files modified:** 3 source files + 1 SUMMARY (this file)
- **Tests added:** 11 (Group F: T-F4–T-F12 = 9; Group G: T-G1, T-G2 = 2)
- **Test count:** 94 → 105 (+11)

## Accomplishments

### Gap 1 — Snapshot-frozen loadRun closure (WR-01 + WR-03)

- `calculatorStore.setVolumePerWell(volumeUL: number)` action added — public, validates `Number.isFinite && > 0`, rejects with `validationError` and leaves state unchanged on reject. Mirrors the existing `setNumberOfSetups` validation shape.
- `runStore.loadRun` cascade now restores `run.volumePerWell` BETWEEN `setSampleCount` and `setNumberOfSetups`. A run saved with the PRD worked-example 50 µL/well + setups=3 now reloads with `finalVolumeML === 13.4` (previously silently rewrote to 25 µL on reload).
- Group G integration tests prove the round-trip end-to-end:
  - **T-G1:** Smoke 3 run (`volumePerWell: 50, numberOfSetups: 3`) → 13.4 mL after `useRunStore.getState().loadRun(mockRun.id)` via `vi.stubGlobal('window', { electronAPI: … })`.
  - **T-G2:** Pre-Smoke-3 legacy run (`numberOfSetups: undefined`) → setups falls back to 1 via `?? 1`; 9.4 mL.
  - Both tests assert `validationError === null` BEFORE the math assertions — hardens against silent validation-cascade regressions.

### Gap 2 — setNumberOfSetups upper-bound alignment (WR-04)

- `setNumberOfSetups` now rejects `n > 1000` with the message `"Number of setups must be an integer between 1 and 1000 (got N)"` — verbatim, load-bearing for T-F5/T-F6 regex assertions.
- The bound mirrors the `createCalculatorInputs` sanity cap at `calculator.ts:158–162`. A `setNumberOfSetups(1500)` → `getOutputs()` sequence no longer throws uncaught inside React render; T-F6 explicitly asserts `expect(() => getOutputs()).not.toThrow()`.
- T-F3's title was factually wrong after this change (claimed "store does not enforce upper bound"); renamed in place to `"within the [1, 1000] bound"` — body unchanged.

### Test coverage delta

- **Group F (existing setNumberOfSetups + setVolumePerWell):** +9 tests (T-F4 1000-accepted, T-F5 1001-rejected, T-F6 1500-rejected + getOutputs-not-throw, T-F7 valid, T-F8 zero-rejected, T-F9 negative-rejected, T-F10 NaN-rejected, T-F11 Infinity-rejected, T-F12 validationError-clears-on-recovery).
- **Group G (new — loadRun cascade end-to-end):** +2 tests (T-G1 Smoke 3 round-trip, T-G2 legacy fallback).
- **Total:** 94 → 105 passing across 12 files; typecheck clean (node + web).

## Task Commits

This plan committed atomically rather than per-task (per plan's Task 6 instructions — the surgical scope and shared verification gate make a single commit the cleaner audit trail):

1. **Plan published:** `f32884a` (docs) — `docs(12-04): add Phase 12 gap-closure plan`
2. **All 6 tasks of plan:** `83fa6ed` (feat) — `feat(12-04): close Phase 12 gaps — setVolumePerWell + setNumberOfSetups bounds` (Tasks 1–6)
3. **Post-fix code review:** `892ea26` (docs) — `docs(12): code review after gap closure` (status: clean)
4. **Re-verification:** `0a521b0` (docs) — `docs(12): re-verification after gap closure — 11/11`
5. **Phase tracking advance:** `0aff784` (docs) — `docs(phase-12): complete phase execution after 12-04 gap closure`

## Files Created/Modified

- `src/renderer/src/stores/calculatorStore.ts` (modified) — new `setVolumePerWell` action with JSDoc citing SMK3-16 + WR-01; tightened `setNumberOfSetups` to `[1, 1000]` inclusive with JSDoc citing WR-04; updated `numberOfSetups` field JSDoc.
- `src/renderer/src/stores/runStore.ts` (modified) — `loadRun` cascade gains `calculator.setVolumePerWell(run.volumePerWell)` between `setSampleCount` and `setNumberOfSetups`; JSDoc cites SMK3-16 + WR-01.
- `src/renderer/src/lib/__tests__/calculator.integration.test.ts` (modified) — imports `afterEach`, `vi`, `useRunStore`, `RunRecord`; T-F3 title renamed in place (body unchanged); 11 new `it(…)` blocks added (Group F bounds/setVolumePerWell + Group G loadRun cascade with vi.stubGlobal).
- `.planning/phases/12-smoke-3-calculator-rules/12-04-SUMMARY.md` (created) — this file.

## Decisions Made

**Approach A (vi.stubGlobal) over Approach B (happy-dom directive) for Group G.**
The plan locked Approach A for minimum blast radius. `vitest.config.ts` sets `environment: 'node'`, so there's no `window` global by default. A file-level `// @vitest-environment happy-dom` directive would have switched the environment for ALL 22 tests in the file, forcing re-validation of the existing 20 Group A–F tests under a different env. The narrow `vi.stubGlobal('window', { electronAPI: … })` inside `beforeEach` + `vi.unstubAllGlobals()` in `afterEach` keeps Group G's plumbing local.

**Store-action bound enforcement, not getOutputs try/catch.**
The plan picked the action-layer enforcement path (`n > 1000` rejected with `validationError`) over wrapping `createCalculatorInputs` in try/catch inside `getOutputs()`. The action-layer path keeps `validationError` as the single error-reporting surface for user input, which the UI already binds to (consistent with the rest of the store). The defensive throw in `createCalculatorInputs` stays as a belt-and-braces backstop for any future direct-import caller bypassing the store.

**No setVolumePerWell propagation cascade.**
The new action is a thin setter — it doesn't cascade into plateStore (which doesn't own `volumePerWell`). The JSDoc characterizes the primary caller as `runStore.loadRun` so future contributors know the action is intentionally minimal.

**Atomic commit cadence at Task 6, not per-task.**
The plan's Task 6 explicitly instructed one atomic `feat(12-04):` commit at the end covering all preceding tasks' file changes. With 6 surgical tasks all touching 3 files for a single gap-closure objective, the per-task commit pattern from the standard `execute-plan.md` workflow would have produced 6 commits with the same overall effect but a noisier audit trail.

## Deviations from Plan

**None.** All 6 tasks executed exactly per the plan's `<action>` blocks. Every acceptance criterion (grep counts, error-message verbatims, test count delta) passed on first verification.

## Issues Encountered

The `gsd-sdk query phase.complete 12` CLI introduced stale data when marking the phase complete in tracking files:
- `STATE.md`: dropped `percent: 97 → 43` (catastrophically wrong), reset the Current Position pointer to phase 999.1 (a parking-lot phase), and left `stopped_at` referencing 12-03 instead of 12-04.
- `ROADMAP.md`: marked Phase 12 as `3/4 Complete` (the CLI counts plans by SUMMARY.md presence; 12-04 lacked one at that point per plan instructions), and accidentally overwrote Phase 999.1's `Plans: 0 plans` line with `3/4 plans complete`.

The orchestrator manually corrected both files before committing the tracking advance (`0aff784`). Flagged here so future gap-closure plans can either (a) create their SUMMARY before invoking `phase.complete`, or (b) treat the CLI's tracking updates as a draft and review before commit.

## User Setup Required

None — no external service configuration, env vars, or migrations required.

## Next Phase Readiness

- **Phase 13 (Panel XLSX Parser v3 — SMK3-08–11, SMK3-DIL-01):** unblocked. The calculator math and snapshot-freeze contract are stable; Phase 13 can grow the master_panels schema (per-reagent rows: Concentration / Diluent / Volume per well) without coordinating with calculator-layer changes. Diluent resolver (Plan 12-02) remains consumable but unwired — Phase 13/14/15 will pick that up once per-reagent panel data is available.
- **Phase 14 (Plate page UI — SMK3-01–04, SMK3-13–14):** when the Number of Setups numeric input ships, it can call `useCalculatorStore.getState().setNumberOfSetups(n)` directly — the `[1, 1000]` bound is enforced at the action layer, so the UI does not need its own upper-cap validation. UI need only forward the operator's value; validationError surfaces in the existing store-bound error UI.
- **Phase 15 (Run document audit trail + SMK3-16 advisory marker):** snapshot-freeze contract is now end-to-end-tested. The advisory marker can be added cosmetically on the run-document detail view without needing to re-prove that pre-Smoke-3 runs reload with their persisted per-well volume — T-G2 already locks that.

---

*Phase: 12-smoke-3-calculator-rules*
*Completed: 2026-05-12*
