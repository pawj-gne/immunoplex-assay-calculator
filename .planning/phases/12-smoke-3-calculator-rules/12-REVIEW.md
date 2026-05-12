---
phase: 12-smoke-3-calculator-rules
reviewed: 2026-05-11T22:30:00Z
depth: standard
files_reviewed: 3
files_reviewed_list:
  - src/renderer/src/stores/calculatorStore.ts
  - src/renderer/src/stores/runStore.ts
  - src/renderer/src/lib/__tests__/calculator.integration.test.ts
findings:
  critical: 0
  warning: 0
  info: 1
  total: 1
status: clean
re_review: true
re_reviews_prior:
  - reviewed: 2026-05-11T00:00:00Z
    closes:
      - WR-01
      - WR-03
      - WR-04
    preserved:
      - WR-02
      - IN-01
      - IN-02
      - IN-03
      - IN-04
      - IN-05
      - IN-06
      - IN-07
---

# Phase 12: Code Review Report (re-review after gap closure 83fa6ed)

**Reviewed:** 2026-05-11T22:30:00Z
**Depth:** standard
**Files Reviewed:** 3 (gap-closure scope from commit 83fa6ed)
**Status:** clean
**Prior review:** 2026-05-11 (16 source files, 4 warnings, 7 info)
**Commit under review:** 83fa6ed (`feat(12-04): close Phase 12 gaps — setVolumePerWell + setNumberOfSetups bounds`)

## Summary

Plan 12-04 closes the three warnings the prior 12-REVIEW.md flagged (WR-01, WR-03, WR-04) cleanly and with high test discipline. The diff is surgical (307 insertions / 10 deletions across 3 files), and the changes verify cleanly:

- **`npm test`:** 12 files, 105 tests passing (+11 from the 94 baseline). Both new groups (Group G T-G1/T-G2) and the Group F additions (T-F4..T-F12) pass on first run.
- **`npm run typecheck`:** clean exit for both `tsconfig.node.json` and `tsconfig.web.json` projects.

### Verification of prior findings

| ID    | Prior severity | Closed by 12-04? | Evidence |
|-------|---------------|------------------|----------|
| WR-01 | Warning | **YES** | `runStore.ts:137` now calls `calculator.setVolumePerWell(run.volumePerWell)` BEFORE `setNumberOfSetups`. New public `setVolumePerWell` action on `calculatorStore.ts:152-160` mirrors the validation shape of `setNumberOfSetups`. T-G1 asserts a 50 µL/well run round-trips through loadRun with no fall-back to 25. |
| WR-02 | Warning | **DEFERRED (by design)** | Plan 12-04 §Out-of-scope does NOT enumerate WR-02; the prior review's WR-02 (loadRun silently recomputes `deadVolume` rather than restoring the persisted value) is intentionally accepted as the Smoke-3 round-trip is bit-for-bit faithful (`numberOfSetups × 2000 = deadVolume` holds for all SMK3 runs). Pre-Smoke-3 drift surfaces in the Phase 15 advisory marker (SMK3-16). Not introduced by 12-04; pre-existing accepted behavior. |
| WR-03 | Warning | **YES** | New Group G (T-G1 + T-G2) drives `useRunStore.getState().loadRun(mockRun.id)` end-to-end via `vi.stubGlobal('window', {electronAPI: ...})`. Both tests assert volumePerWell and numberOfSetups land on the calculator and getOutputs() returns the persisted PRD worked-example values. |
| WR-04 | Warning | **YES** | `setNumberOfSetups` now rejects `n > 1000` (`calculatorStore.ts:131`), matching the lib-layer cap exactly. T-F5 (1001 rejected), T-F6 (1500 rejected with `expect(() => getOutputs()).not.toThrow()`) lock the bound. T-F4 (1000 accepted) covers the inclusive upper boundary. |
| IN-01 .. IN-07 | Info | **NOT addressed** (explicitly out of scope per 12-04-PLAN §Out-of-scope line 77) | All 7 info findings remain. Per plan: "addressable separately via `/gsd-code-review-fix`." |

### Spot-checks on the specific concerns from the review brief

1. **`setVolumePerWell` shape parity with `setNumberOfSetups`** — verified. Both validate inputs, reject by setting `validationError` without mutating state, and clear `validationError` on a subsequent valid call (T-F12 explicitly asserts this). Shape difference is intentional: setups requires `Number.isInteger && [1,1000]`; volumePerWell requires `Number.isFinite && > 0` (no upper bound, no integer constraint — correct, since vol/well is a float µL like 50, 50.7, 50.001 per the SMK3-06 boundary tests).
2. **loadRun cascade order** — verified `replicateMode → sampleCount → setVolumePerWell → setNumberOfSetups`. setVolumePerWell precedes setNumberOfSetups, so any `getOutputs()` call after either step (or after a setNumberOfSetups rejection — see IN-08 below) sees the persisted per-well volume, not the 25 µL fall-back.
3. **`[1, 1000]` bound inclusivity** — `n < 1 || n > 1000` correctly accepts both endpoints. T-F4 (1000), T-F5 (1001), and T-F6 (1500) provide direct boundary coverage.
4. **Error-message verbatim match** — `calculatorStore.ts:133` emits `"Number of setups must be an integer between 1 and 1000 (got ${n})"`. T-F5 + T-F6 grep `/between 1 and 1000/i` matches. ✓
5. **Group G stub endpoint names vs `src/preload/index.ts`** — every endpoint the loadRun cascade actually reaches is correctly stubbed:
   - `run.getById` (runStore.ts:91) ✓
   - `platform.getAll` (platformStore.ts:31, reached when platformStore selects but does not lazy-load — see note) — stub present
   - `species.getByPlatformId` (selectionStore.ts:83) ✓
   - `panel.getByPlatformAndSpecies` (selectionStore.ts:126) ✓
   - `analyte.getByPlatformAndSpecies` (selectionStore.ts:127) ✓
   - `panel.getWithAnalytes` (selectionStore.ts:144 — called per panel; mock returns `[]` panels so this is never reached, but the stub is present defensively) ✓
   - `analyte.getByPanelId` (NOT called by the loadRun cascade — only by main-process or other Phase-4 paths; harmless dead stub key)
   No drift between mock and reality. The plan's revision note ("verified during plan revision 2026-05-11") proved out.
6. **`vi.unstubAllGlobals()` cleanup** — present in `afterEach` (test file line 482-484). Group G runs after Group F; Group F doesn't read `window`, so even if leakage occurred it would be inert. Cleanup is correct and prevents cross-file leakage (other test files in the suite, e.g., `httpTransport.test.ts`, run in separate vitest forks per `pool: 'forks'` in `vitest.config.ts`).
7. **`RunRecord` mock completeness** — all 26 non-optional fields populated in `makeMockRun()`. `panelId: null` correctly bypasses the `if (run.panelId)` branch in loadRun (line 114). `singleAnalyteIds: []` means the `for (const analyteId of run.singleAnalyteIds)` loop (line 121) is a no-op. `plates: { 1: [], 2: [] }` satisfies the `plateCount: 2` derived field. TypeScript would have caught any missing required field at test compile time; the typecheck pass confirms.
8. **Approach A (vi.stubGlobal) vs Approach B (`environment: 'happy-dom'`)** — verified Approach A was used. `vitest.config.ts` still declares `environment: 'node'` globally; the stub is scoped to Group G's `beforeEach`/`afterEach`. Minimum blast radius — no JSDOM/happy-dom dependency added, no other test files affected.
9. **Race / partial-mutation risk on a setNumberOfSetups rejection mid-cascade** — see IN-08 below. This is an info-level surface, not a blocker.

### New issues introduced by 12-04

Only one info-level observation. No bugs, no security issues, no broken contracts. The gap-closure work is sound and the test bar correctly raises the regression floor for Phase 12's snapshot-frozen contract.

## Info

### IN-08: `loadRun` cascade does not stop on a `setNumberOfSetups` rejection — partial mutation persists

**File:** `src/renderer/src/stores/runStore.ts:130-141`

**Issue:** The loadRun cascade calls `calculator.setVolumePerWell(run.volumePerWell)` immediately before `calculator.setNumberOfSetups(run.numberOfSetups ?? 1)`. If a future code path (or a corrupted DB row) yields `run.numberOfSetups = 1500`, the cascade leaves the calculator in a partially-mutated state:

- `volumePerWell` = 50 (the persisted value — successfully restored)
- `numberOfSetups` = 1 (still at the post-`reset()` default — the rejection left it unchanged)
- `validationError` = `"Number of setups must be an integer between 1 and 1000 (got 1500)"`
- `getOutputs()` returns `null` (validationError gate fires)
- `currentRunId` is set to the loaded run's ID — operator sees a "loaded but broken" view

Today this is unreachable from the in-app save path (`useRunSnapshot.ts` derives `numberOfSetups` from `calculatorStore.numberOfSetups`, which is already bounded). The exposure is to (a) hand-edited DB rows, (b) a Phase 14 UI input that bypasses the store action and writes via the schema directly, or (c) a future migration that doesn't carry forward the [1,1000] bound. Per the prior verification's spirit ("the forcing-function sanity cap was DESIGNED to catch the legacy deadVolume-as-5th-arg mistake during 12-03 development; it's no longer appropriate to let it surface to users post-fix"), the same logic argues for not letting it surface in mid-cascade either.

This is **not introduced by 12-04** — the original loadRun cascade had the same property for sampleCount and replicateMode failure modes — but adding `setVolumePerWell` makes the partial-mutation envelope larger (more state can be successfully written before a downstream reject).

**Fix (optional, defer to Phase 14/15 hardening):** Either (a) validate the run's `numberOfSetups` field at the top of loadRun (before any state mutations) and short-circuit to `error: '...'` if out of range, OR (b) accept the partial mutation as a deliberate "partial restore" and document it. Acceptance variant:

```typescript
// 6. Calculator — replicateMode FIRST, sampleCount SECOND, volumePerWell
//    THIRD (so a setNumberOfSetups reject does not block restoring it),
//    setNumberOfSetups LAST. If a corrupted run has numberOfSetups > 1000
//    or < 1, the cascade leaves volumePerWell restored but numberOfSetups
//    at the calculator's reset() default (1) — getOutputs() returns null
//    via the validationError gate. Operator sees the run as "loaded but
//    blocked"; the Phase 14/15 advisory marker UI is the planned mitigation.
calculator.setReplicateMode(run.replicateMode)
calculator.setSampleCount(run.sampleCount)
calculator.setVolumePerWell(run.volumePerWell)
calculator.setNumberOfSetups(run.numberOfSetups ?? 1)
```

Or pre-validate option:

```typescript
const setups = run.numberOfSetups ?? 1
if (!Number.isInteger(setups) || setups < 1 || setups > 1000) {
  set({ isLoading: false, error: `Run ${id} has invalid numberOfSetups: ${setups}` })
  return
}
// ... existing cascade ...
```

Not a blocker for Phase 12 sign-off — the in-scope code paths cannot reach this state.

---

_Reviewed: 2026-05-11_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
_Scope: gap-closure re-review (commit 83fa6ed); 3 files in WR-01/WR-03/WR-04 closure scope_
