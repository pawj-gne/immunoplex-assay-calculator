---
phase: 14-smoke-3-plate-page-input-expansion-ui-cleanup-inserted-2026-
plan: 03
subsystem: ui
tags: [react, tsx, platform-selection, smoke-3, ui-cleanup]

# Dependency graph
requires:
  - phase: 14-smoke-3-plate-page-input-expansion-ui-cleanup-inserted-2026-
    provides: "Smoke 3 PRD §Hierarchy First Step (stock-conc labels removed from operator surfaces)"
provides:
  - "PlatformCard renders Title + optional Selected badge + optional Description only (no stock-conc footer)"
  - "PlatformSelector green-bordered selected-platform box renders only the `Platform Selected: {name}` heading"
affects:
  - 14-04 (platform selection page composition)
  - 16-windows-uat-release (operator-facing UX matches Smoke 3 PRD)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Subtractive UI cleanup: surgical JSX deletions without restyling siblings"
    - "Preserve type-level field even when removing UI consumer (platform.stockConcentration stays on Platform interface for non-UI consumers like useCalculator.ts)"

key-files:
  created: []
  modified:
    - src/renderer/src/features/platform/components/PlatformCard.tsx
    - src/renderer/src/features/platform/components/PlatformSelector.tsx

key-decisions:
  - "D-12: Removed PlatformCard stock-conc footer INCLUDING its `border-t` separator — no replacement micro-fact, no preserved spacer"
  - "D-13: Removed BOTH the `Stock concentration: Xx` line AND the `Ready to proceed with reagent calculations.` line from PlatformSelector's green box; kept only the `Platform Selected: {name}` heading"
  - "Preserved `platform.stockConcentration` on the Platform interface — non-UI consumers (useCalculator.ts line 75) still read it; the deletion is UI-only"
  - "Left the `mb-2` on the `<h3>` in PlatformSelector unchanged per plan note D-13 (no JSX restyling)"

patterns-established:
  - "UI-only field removal: delete the JSX consumer site but keep the type-level field if any non-UI consumer reads it"
  - "When deleting a footer block bounded by `border-t`, the separator goes with the block (not preserved as an empty spacer)"

requirements-completed: [SMK3-01]

# Metrics
duration: ~3 min
completed: 2026-05-12
---

# Phase 14 Plan 03: Strip Stock-Concentration Labels from Platform UI — Summary

**Subtractive UI cleanup: PlatformCard loses its `Stock Concentration: Xx` footer block (including `border-t` separator); PlatformSelector's green box loses both the stock-conc line and the ready-to-proceed line, keeping only the `Platform Selected: {name}` heading.**

## Performance

- **Duration:** ~3 min (per-task commits at 13:26 and 13:27 -0700)
- **Started:** 2026-05-12T20:24Z (approx, post-base-reset)
- **Completed:** 2026-05-12T20:27Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- `PlatformCard.tsx`: deleted 9 lines (the `<div className="flex items-center gap-2 pt-2 border-t ...">` footer block plus its preceding blank line) — Title + Selected badge + Description are the only remaining contents
- `PlatformSelector.tsx`: deleted 6 lines (the two `<p>` siblings of the `<h3>` heading inside the `bg-green-50` container) — `Platform Selected: {name}` heading is the only remaining content in the green box
- Plan-wide grep verifications all pass: zero `Stock Concentration` / `Stock concentration` / `Ready to proceed` matches across `src/renderer/src/features/platform/`; `Platform Selected:` heading preserved (1 match in PlatformSelector); `bg-green-50` container preserved (1 match)
- No production-typecheck regressions introduced in `features/platform/`

## Task Commits

1. **Task 1: Strip Stock Concentration footer from PlatformCard.tsx (D-12)** — `03fa624` (refactor)
2. **Task 2: Strip Stock concentration + Ready-to-proceed lines from PlatformSelector.tsx green box (D-13)** — committed as part of `60ac90a` (see Deviation 1 below; deletion landed on the branch but was attributed to a sibling executor's commit message)

**Plan metadata:** see commit for this SUMMARY.md.

## Files Created/Modified

- `src/renderer/src/features/platform/components/PlatformCard.tsx` — removed stock-conc footer (lines 42-49 of the pre-edit file plus its preceding blank line); now ends at the description `<p>` block, then `</button>`
- `src/renderer/src/features/platform/components/PlatformSelector.tsx` — removed two `<p>` blocks inside the green-bordered selected-platform container (lines 56-61 of the pre-edit file); the `<h3>Platform Selected: {selectedPlatform.name}</h3>` is now the only child of the `bg-green-50` `<div>`

## Decisions Made

- Followed plan D-12 and D-13 verbatim. No restyling of preserved JSX. `platform.stockConcentration` field preserved on the type for non-UI consumers per plan §success_criteria item 3.

## Deviations from Plan

### Sibling-Attributed Commit (Cross-Executor Race)

**1. [Environment] Task 2 deletion was absorbed into a sibling executor's commit message**

- **Found during:** Task 2 commit step
- **Issue:** After staging `PlatformSelector.tsx` and running `git commit --no-verify -m "refactor(14-03): ..."`, the staged change had already been swept into commit `60ac90a` titled `feat(14-05): selectPanel preserves singles (D-18) + prunes by membership (D-20)`. My explicit `git commit` then found nothing staged and reported "no changes added to commit".
- **Root cause:** This worktree contains uncommitted in-flight changes from other Wave 1 sibling plan executors (14-01 calculator refactor, 14-05 selectionStore work, 14-02 plate hooks). A sibling appears to have run a broad `git add` (e.g., `git add -A` or `git commit -a`) that captured my staged file alongside their own work, between my `git add` and `git commit` calls.
- **Effect:** The plan's required code change is on the branch (grep verification confirms zero matches for the removed strings; `Platform Selected:` heading preserved). The Task 2 commit is *content-correct* but *message-incorrect*: it claims to be a 14-05 feat commit when it also contains a 14-03 refactor.
- **Did not auto-fix:** Reverting or rewriting `60ac90a` would be destructive (it contains the legitimate Wave 1 14-05 work for selectionStore D-18/D-20). Per the destructive-git-prohibition rule and the parallel-executor scope-boundary rule, I left the commit intact and document the discrepancy here.
- **Files affected:** `src/renderer/src/features/platform/components/PlatformSelector.tsx` (my Task 2 change), `src/renderer/src/stores/selectionStore.ts` (sibling 14-05 change)
- **Verification:** Plan-wide grep across `src/renderer/src/features/platform/` returns zero matches for `Stock Concentration|Stock concentration|Ready to proceed`; `Platform Selected:` returns 1 match (heading preserved).

### Auto-fixed Issues

None. The plan executed exactly as specified for both deletions. The only deviation is the commit-attribution race described above, which I cannot remediate without destructive rewrites of a sibling's commit.

---

**Total deviations:** 1 environmental (cross-executor commit-attribution race; content unaffected)
**Impact on plan:** Plan goal fully achieved (both deletions on branch, grep assertions pass). Only commit-message attribution is mis-routed.

## Issues Encountered

- **Pre-existing typecheck failures unrelated to this plan:** During Task 1 and Task 2 verification, `npm run typecheck` reported errors in `src/renderer/src/lib/__tests__/decimal.test.ts`, `src/renderer/src/lib/__tests__/calculator.test.ts`, `src/renderer/src/features/plate/hooks/usePlateLayout.ts`, and `src/renderer/src/stores/plateStore.ts`. These errors originate from sibling Wave 1 in-flight work (14-01 calculator, 14-02 plate layout) and not from my Platform edits. Per scope boundary (only auto-fix issues directly caused by current task changes), I logged them in `deferred-items.md` rather than attempting fixes. The error set is in flux as sibling executors commit/uncommit pieces of their work; verification by file scope (`grep "features/platform"` against typecheck output) returned zero errors throughout — confirming my edits introduce no new typecheck failures.
- **Worktree base mismatch on startup:** Worktree HEAD was at `2bbcc5f`, expected base was `2198ca1` (two ancestor commits ahead on the same line). Initial `git reset --hard` denied; resolved via `git merge --ff-only 2198ca1` (non-destructive fast-forward, working tree was clean).

## Known Stubs

None. The deletions remove existing rendered text; no placeholder/stub content was introduced.

## Threat Flags

None. The plan's threat model marks the only relevant threat (T-14-03-01 stock-concentration information disclosure) as `accept`; the deletion does not introduce new trust boundaries, new network surface, or new auth paths. UI-only subtractive change.

## Self-Check

| Check | Result |
| --- | --- |
| `PlatformCard.tsx` modified on disk (matches plan §action) | PASS |
| `PlatformSelector.tsx` modified on disk (matches plan §action) | PASS |
| `grep "Stock Concentration\|Stock concentration" src/renderer/src/features/platform/components/Platform*.tsx` returns ZERO matches | PASS |
| `grep "Ready to proceed" src/renderer/src/features/platform/components/PlatformSelector.tsx` returns ZERO matches | PASS |
| `grep "Platform Selected:" src/renderer/src/features/platform/components/PlatformSelector.tsx` returns ≥1 match | PASS (1 match) |
| `grep "bg-green-50" src/renderer/src/features/platform/components/PlatformSelector.tsx` returns 1 match | PASS |
| `grep "platform.name\|platform.description" src/renderer/src/features/platform/components/PlatformCard.tsx` returns ≥1 match each | PASS |
| Commit `03fa624` exists in git log | PASS |
| Commit `60ac90a` contains PlatformSelector deletion diff | PASS (verified via `git show 60ac90a -- PlatformSelector.tsx`) |
| `npm run typecheck` reports zero errors in `features/platform/` | PASS |

## Self-Check: PASSED

## Next Phase Readiness

- Plan 14-03 deliverables are on `dev/v1-01` (PlatformCard + PlatformSelector deletions present). Visual UAT on Windows can verify D-12 and D-13 via build:win + manual inspection.
- No follow-up tasks needed inside this plan.
- Cross-executor commit attribution issue (Deviation 1) should be noted by the phase orchestrator if commit-by-commit traceability is required for audit; if functional equivalence on the merged branch is sufficient, no action needed.

---
*Phase: 14-smoke-3-plate-page-input-expansion-ui-cleanup-inserted-2026-*
*Plan: 03*
*Completed: 2026-05-12*
