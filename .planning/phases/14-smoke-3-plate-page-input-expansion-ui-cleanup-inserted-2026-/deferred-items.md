# Phase 14 — Deferred Items

Out-of-scope discoveries logged by executors (per scope-boundary rule: only auto-fix issues
DIRECTLY caused by the current task's changes; log unrelated failures here).

---

## From 14-03 (PlatformCard / PlatformSelector cleanup)

### Pre-existing typecheck failures observed in the shared worktree

During Plan 14-03 execution, `npm run typecheck` reported the following errors. None are
in `src/renderer/src/features/platform/` (the surface 14-03 touches). They originate from
in-flight sibling-executor work in Wave 1 (14-01 calculator, 14-02 plate hooks, 14-05
selectionStore). They are deferred for the responsible plans' executors to resolve.

- `src/renderer/src/lib/__tests__/decimal.test.ts(2,48): error TS2305: Module '"../decimal"' has no exported member 'floorToTenthML'.`
  - Likely belongs to Plan 14-01 (TDD RED/GREEN cycle for `floorToTenthML`).
- `src/renderer/src/lib/__tests__/calculator.test.ts(7,3): error TS2305: Module '"../calculator"' has no exported member 'applyOldReagentSubtraction'.`
- `src/renderer/src/lib/__tests__/calculator.test.ts(7,3): error TS6133: 'applyOldReagentSubtraction' is declared but its value is never read.`
  - Likely belongs to Plan 14-01 or 14-04 (calculator refactor).
- `src/renderer/src/features/plate/hooks/usePlateLayout.ts(7,3): error TS2305: Module '"../../../../../shared/constants/calculator"' has no exported member 'DUPLICATE_HORIZONTAL_PAIRS'.`
- `src/renderer/src/features/plate/hooks/usePlateLayout.ts(8,3): error TS2305: Module '"../../../../../shared/constants/calculator"' has no exported member 'DUPLICATE_VERTICAL_COL'.`
- `src/renderer/src/stores/plateStore.ts(6,3): error TS2305: Module '"../../../shared/constants/calculator"' has no exported member 'DUPLICATE_HORIZONTAL_PAIRS'.`
- `src/renderer/src/stores/plateStore.ts(7,3): error TS2305: Module '"../../../shared/constants/calculator"' has no exported member 'DUPLICATE_VERTICAL_COL'.`
  - Likely belongs to Plan 14-02 (plate layout vertical-pair geometry).

The 14-03 scope (PlatformCard + PlatformSelector) introduces zero new typecheck errors:
`npm run typecheck 2>&1 | grep "features/platform"` returns no matches after both 14-03 edits.

### Cross-executor git race observed

The shared worktree appears to be in use by multiple parallel executors that share a
working directory and HEAD. Between staging and committing my Task 2 edit (`PlatformSelector.tsx`),
the staged file was absorbed into a sibling executor's commit (`60ac90a feat(14-05): ...`).
The plan's required content is on the branch; only the commit-message attribution is mis-routed.

This is logged for the phase orchestrator's awareness — if per-plan commit traceability
is required, consider serializing Wave 1 commits or giving each executor a separate
worktree under `.claude/worktrees/`.
