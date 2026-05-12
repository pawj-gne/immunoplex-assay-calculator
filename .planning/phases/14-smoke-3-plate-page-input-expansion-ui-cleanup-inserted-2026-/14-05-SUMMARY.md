---
phase: 14-smoke-3-plate-page-input-expansion-ui-cleanup-inserted-2026-
plan: 05
subsystem: selection
tags: [smoke-3, smk3-13, smk3-14, selectionStore, SelectedAnalytesList, sortByBeadRegion, ui-cleanup]
requires:
  - selectionStore.selectPanel (existing, refined)
  - SelectedAnalytesList (existing, rewritten)
  - AnalyteSelectionPanel (existing, prop call site updated)
provides:
  - "selectPanel(null) PRESERVES selectedSingleIds; selectPanel(newId) prunes by panel membership"
  - "features/selection/lib/sortAnalytes.ts: exported sortByBeadRegion comparator"
  - "SelectedAnalytesList renders a flat bead-region-sorted list with conditional per-row remove button"
affects:
  - SelectedAnalytesList consumer (AnalyteSelectionPanel) — panelName prop dropped
tech-stack:
  added: []
  patterns:
    - "Refining a zustand action while preserving the existing IPC + error-path contract (D-18/D-20 narrow D-4.1-04)"
    - "Extract a pure helper into lib/ so vitest (.test.ts only) can unit-test it (vitest.config.ts includes only `*.test.ts`)"
    - "vi.stubGlobal to mock window.electronAPI in a zustand-store-driven test"
key-files:
  created:
    - src/renderer/src/features/selection/lib/sortAnalytes.ts
    - src/renderer/src/features/selection/lib/__tests__/sortAnalytes.test.ts
    - src/renderer/src/stores/__tests__/selectionStore.test.ts
  modified:
    - src/renderer/src/stores/selectionStore.ts
    - src/renderer/src/features/selection/components/SelectedAnalytesList.tsx
    - src/renderer/src/features/selection/components/AnalyteSelectionPanel.tsx
decisions:
  - "D-18 narrows D-4.1-04: selectPanel(null) preserves selectedSingleIds — members of the deselected premix return to the singles pool via existing getAvailableSingles (no auto-add, no toast)"
  - "D-20 prunes selectedSingleIds by panel membership when switching A→B — only IDs that are members of the new panel are dropped; non-members survive"
  - "IPC error path on selectPanel(newId) preserves operator state — selectedSingleIds is NOT mutated when the panel-fetch rejects"
  - "sortByBeadRegion lives in lib/sortAnalytes.ts (not inline in .tsx) to satisfy the vitest `include: ['src/**/*.test.ts']` config — extracted helper is unit-tested independently of any React rendering"
  - "panelName prop dropped from SelectedAnalytesList (single caller, no binary-compat concern) — flat list no longer needs a panel-section header"
metrics:
  duration: 336s
  completed: 2026-05-12T20:30:37Z
  tasks-completed: 3
  tasks-total: 3
  tests-added: 9
  commits: 5
---

# Phase 14 Plan 05: Premix-Deselect Refinement + Flat-List Selected Analytes Summary

Refined `selectionStore.selectPanel` per D-18/D-20 so previously-picked singles survive a premix deselect (members return to the pool via existing `getAvailableSingles()`), and switching premix A→B prunes only the singles that are members of premix B. Extracted the bead-region sort comparator into `features/selection/lib/sortAnalytes.ts` for direct vitest coverage (the previous inline definition lived in `.tsx` which `vitest.config.ts` does not include). Rewrote `SelectedAnalytesList` as a single flat bead-region-sorted list (no panel/singles grouping, no expand/collapse, no `panelName` prop, conditional remove button only on standalone-singles rows). Updated the sole caller in `AnalyteSelectionPanel` accordingly.

## Tasks Completed

| # | Task                                                                       | Files                                                                                            | Commits                          |
| - | -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ | -------------------------------- |
| 1 | Refine `selectPanel` (D-18 preserve / D-20 prune) + 5 vitest cases (TDD)   | `selectionStore.ts`, `stores/__tests__/selectionStore.test.ts` (new)                             | `dfd3a86` (RED), `60ac90a` (GREEN) |
| 2 | Extract `sortByBeadRegion` to `lib/sortAnalytes.ts` + 4 vitest cases (TDD) | `lib/sortAnalytes.ts` (new), `lib/__tests__/sortAnalytes.test.ts` (new)                          | `2b47e86` (RED), `b5ed586` (GREEN) |
| 3 | Rewrite `SelectedAnalytesList` flat list + caller drops `panelName`        | `SelectedAnalytesList.tsx`, `AnalyteSelectionPanel.tsx`                                          | `07dc0a8`                        |

All five commits use `--no-verify` per parallel-executor protocol.

## selectionStore.selectPanel — Before / After

**Before (D-4.1-04 implementation):** Both branches wholesale-clear `selectedSingleIds`:
- `panelId === null` → `set({ selectedPanelId: null, selectedPanel: null, selectedSingleIds: [] })`
- `panelId !== null` → `set({ panelLoading: true, panelError: null, selectedSingleIds: [] })` then fetch

**After (D-18/D-20 refinement):**
- `panelId === null` → omits `selectedSingleIds` from the set (preserves prior value). Member analytes of the now-deselected premix automatically appear as singles candidates via the existing `getAvailableSingles()` filter (which returns the full `availableAnalytes` list when `selectedPanel === null`).
- `panelId !== null` → `set({ panelLoading: true, panelError: null })` only; after the IPC fetch resolves, computes `prunedSingles = selectedSingleIds.filter(id => !newPanelMemberIds.has(id))` and atomically writes `selectedPanelId`, `selectedPanel`, `selectedSingleIds`, `panelLoading: false` together.
- On IPC error, `selectedSingleIds` is NOT mutated (the catch branch only writes `panelError` and `panelLoading: false`).

Comment markers `D-18` and `D-20` were added at the relevant control-flow points (4 occurrences total — `grep -n "D-18\|D-20" src/renderer/src/stores/selectionStore.ts`).

## sortByBeadRegion Extraction Rationale

`vitest.config.ts` line 7 declares `include: ['src/**/*.test.ts']` — `.test.tsx` files are NOT picked up by the test runner. The bead-region sort logic was previously inline in `SelectedAnalytesList.tsx`, which meant any unit test for the comparator would have to either (a) live in a `.test.tsx` file that vitest ignores, or (b) extend the vitest include glob and add `@testing-library/react` + `jsdom`. Neither option is in Plan 05's scope.

The plan extracts the comparator into `src/renderer/src/features/selection/lib/sortAnalytes.ts` as a pure function with a `.test.ts` next door. The new lib subdirectory is the natural home for feature-local pure helpers that need test coverage. Both `SelectedAnalytesList.tsx` (Task 3) and the new vitest file import the comparator via the same named export.

The comparator handles three cases:
1. Both bead regions parse as finite numbers AND differ → numeric ascending diff
2. Numeric tie or non-numeric (e.g. `'25a'`) → lexical compare on string form
3. Final tiebreaker → alphabetic by analyte name

## SelectedAnalytesList Rewrite

**Before (134 lines):** Two-zone layout — a blue Panel section (`panel-50` bg, expand/collapse chevron via `useState`) followed by an "Individual Additions" section. Members and singles rendered separately.

**After (103 lines):** Single flat list. The outer shell (sticky `w-72`, white container, gray header, count badge in header, empty state) is preserved byte-for-byte. The list section iterates `flatList = useMemo([...panelAnalytes, ...singleAnalytes].sort(sortByBeadRegion), [...])`. Each row shows name + bead-region badge; the per-row remove button (X icon) is gated by `!panelMemberIds.has(analyte.id)` per D-16 (members are owned by the premix; only standalone singles can be individually removed). `useState` and the `panelName` prop are gone.

Line count change: 134 → 103 (-31 lines, ~23% reduction).

## AnalyteSelectionPanel Caller Update

The single call site at the bottom of the file dropped the `panelName={selectedPanel?.name ?? null}` prop. Other usages of `selectedPanel` in the file (`selectedPanel.analytes` and `selectedPanel.name` passed to `AnalyteGrid`) are unchanged.

## Tests Added (9 total)

`src/renderer/src/stores/__tests__/selectionStore.test.ts` — 5 cases:
- **T-1:** singles=[a1,a2], `selectPanel(null)` → singles preserved as [a1,a2]
- **T-2:** singles=[], `selectPanel(null)` → singles stay []
- **T-3:** panel B contains a2, singles=[a1,a2,a3] → pruned to [a1,a3]
- **T-4:** panel B has no overlap with singles → all survive
- **T-5:** IPC error → singles preserved, `panelError` set, `panelLoading=false`

`src/renderer/src/features/selection/lib/__tests__/sortAnalytes.test.ts` — 4 cases:
- **T-1:** numeric ascending — [33,12,38,25] → [12,25,33,38]
- **T-2:** tied numeric (both 25) — alphabetic tiebreaker IL-A before IL-Z
- **T-3:** non-numeric lexical fallback — `'25'` before `'25a'`, comparator return-sign asserted
- **T-4:** equal bead region AND equal name → comparator returns 0

## Verification

| Check                                                              | Result                |
| ------------------------------------------------------------------ | --------------------- |
| `npm run typecheck`                                                | exits 0               |
| `npm run test` (full suite)                                        | 324/324 passing       |
| `npm run test -- selectionStore`                                   | 5/5 passing           |
| `npm run test -- sortAnalytes`                                     | 4/4 passing           |
| grep `// D-18` and `// D-20` in selectionStore.ts                  | 4 matches (2 + 2)     |
| grep `selectedSingleIds: \[\]` inside selectPanel body             | 0 matches             |
| grep `prunedSingles` in selectionStore.ts                          | 1 match               |
| grep `newPanelMemberIds` in selectionStore.ts                      | 1 match               |
| grep `panelName` in SelectedAnalytesList.tsx                       | 0 matches             |
| grep `panelName` in AnalyteSelectionPanel.tsx                      | 0 matches             |
| grep `sortByBeadRegion` in SelectedAnalytesList.tsx                | 2 matches (import + use) |
| grep `from '../lib/sortAnalytes'` in SelectedAnalytesList.tsx      | 1 match               |
| grep `function sortByBeadRegion` in SelectedAnalytesList.tsx       | 0 matches (extracted) |
| grep `useState` / `panelExpanded` / `Individual Additions` in SelectedAnalytesList.tsx | 0 / 0 / 0 |
| grep `Selected Analytes` in SelectedAnalytesList.tsx               | 1 match (header)      |
| grep `panelMemberIds` in SelectedAnalytesList.tsx                  | 2 matches             |

## Deviations from Plan

### Worktree-state observations (no rework required)

When this executor started, the worktree's base was behind the expected base `2198ca1` (the plan-revisions commit). The first action was a `git merge --ff-only` to advance to the expected base — this is a non-destructive forward move and was required setup.

After the FF advance, the worktree also contained in-flight modifications to files OUTSIDE Plan 14-05's scope (`src/renderer/src/lib/calculator.ts`, `src/shared/types/calculator.ts`, `src/renderer/src/features/plate/hooks/usePlateLayout.ts`, `src/renderer/src/stores/plateStore.ts`, `src/shared/constants/calculator.ts`, `src/renderer/src/features/platform/components/PlatformSelector.tsx`). These were artifacts of other parallel agents working on Plans 14-01/14-02/14-03/14-04 in the same worktree branch and were either already staged in the index or being modified live by sibling agents. The executor staged ONLY Plan 14-05's files for each task commit.

Exception — the first commit (`60ac90a feat(14-05): selectPanel preserves singles…`) inadvertently included the SMK3-01 D-13 deletion in `src/renderer/src/features/platform/components/PlatformSelector.tsx` because that file was already staged in the index when the executor ran `git add` for `selectionStore.ts`. The change itself is consistent with Plan 14-02's intent (D-13 strip of `Stock concentration` and `Ready to proceed` lines from `PlatformSelector.tsx`), so the bleed-through is benign — it lands the correct content in the wrong commit, not the wrong content in the wrong commit. Subsequent commits used `git restore --staged` before `git add` to prevent recurrence. Plan 14-02's executor should be informed that the `PlatformSelector.tsx` D-13 change was already applied in this branch.

### No auto-fix deviations (Rules 1/2/3 within Plan 14-05 scope)

The plan executed exactly as written within scope. No bugs were discovered in the existing code that required Rule 1 fixes; no missing critical functionality was added (Rule 2); no blockers required preemptive fixes (Rule 3) — the only typecheck failures during execution were in files owned by sibling parallel agents (Plan 14-02's `usePlateLayout.ts` / `plateStore.ts` import-of-retired-constants), and those resolved themselves when the sibling agent's commit `cc44b20 feat(14-02): rewrite duplicate plate layout…` landed mid-execution.

### Phase-4.1 D-4.1-04 tests — none found

The plan flagged a candidate risk that Phase 4.1 tests might assert the old `selectedSingleIds = []` clear-on-switch behavior. `grep -rn "selectedSingleIds" src/ | grep "\.test\."` confirmed no existing test exercised the old behavior; the new `selectionStore.test.ts` is the first dedicated test file for `selectPanel`.

## TDD Gate Compliance

This is not a plan-level `type: tdd` plan, but Tasks 1 and 2 were executed with `tdd="true"`. Both followed the RED→GREEN cycle:

- Task 1: `dfd3a86 test(14-05): RED…` → `60ac90a feat(14-05): selectPanel preserves singles…`
- Task 2: `2b47e86 test(14-05): RED…` → `b5ed586 feat(14-05): extract sortByBeadRegion…`

No refactor commits were needed — both implementations were minimal-to-pass on first try.

## Self-Check: PASSED

Files created — verified present:
- `src/renderer/src/features/selection/lib/sortAnalytes.ts` — FOUND
- `src/renderer/src/features/selection/lib/__tests__/sortAnalytes.test.ts` — FOUND
- `src/renderer/src/stores/__tests__/selectionStore.test.ts` — FOUND
- `.planning/phases/14-smoke-3-plate-page-input-expansion-ui-cleanup-inserted-2026-/14-05-SUMMARY.md` — this file

Commits — verified present in `git log`:
- `dfd3a86` test(14-05): add failing tests for selectPanel D-18/D-20 (RED) — FOUND
- `60ac90a` feat(14-05): selectPanel preserves singles (D-18) + prunes by membership (D-20) — FOUND
- `2b47e86` test(14-05): add failing tests for sortByBeadRegion helper (RED) — FOUND
- `b5ed586` feat(14-05): extract sortByBeadRegion helper into lib/sortAnalytes.ts (D-15) — FOUND
- `07dc0a8` feat(14-05): SelectedAnalytesList flat bead-region-sorted list (D-14/D-16/D-17) — FOUND

Acceptance criteria — verified:
- `npm run typecheck` exits 0 — PASS
- `npm run test` 324/324 passing — PASS
- All Task 1/2/3 grep acceptance criteria — PASS (10/10 for Task 3 grep checks)

## Threat Flags

None. The selection-feature changes do not introduce any new network endpoints, auth paths, file access patterns, or schema changes. The IPC boundary (`window.electronAPI.panel.getWithAnalytes`) is unchanged. T-14-05-02 (tampering on IPC error path) is mitigated and exercised by the new T-5 test (operator state preserved on backend failure).
