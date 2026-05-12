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

---

## From 14-04 (calculator/plate/run store layer + snapshot fidelity)

### ~~DB schema does not persist numberOfSetups / oldBeads / oldAntibodies~~ — Resolved in 14-08

> **Resolved in 14-08.** Plan 14-08 added `number_of_setups REAL NOT NULL DEFAULT 1`,
> `old_beads REAL NOT NULL DEFAULT 0`, `old_antibodies REAL NOT NULL DEFAULT 0` to the
> `runs` table via Drizzle migration `0008_runs_setups_and_old_reagents.sql`. The
> `runRepository.create` and `update` methods now write the three fields when supplied
> (and let the DB DEFAULT fire when omitted, preserving the pre-Phase-14 round-trip
> contract). Three column-presence assertions in `migration.test.ts` + six new
> repository round-trip tests in `run.test.ts` (T-1..T-6) lock in the regression
> guard. SMK3-16 snapshot fidelity now holds end-to-end (renderer → IPC → SQLite →
> IPC → renderer).

~~The TypeScript `RunRecord` + `RunCreate` types and the Zod `runCreateSchema` carry~~
~~`numberOfSetups`, `oldBeads`, `oldAntibodies` as optional fields with `?? 0/1` defaults~~
~~on load. However, `src/main/db/schema.ts` (the Drizzle `runs` table) does NOT contain~~
~~columns for any of these three fields, and `src/main/db/repositories/run.ts`~~
~~(`runRepository.create` + `update`) does not write them.~~

~~Consequence: a saved run will NOT round-trip the three new fields through SQLite.~~
~~`runRepository.getById` will return `record.numberOfSetups === undefined` (and same~~
~~for the two Phase-14 fields), which the renderer's `?? 0/1` defaults handle correctly~~
~~but means the persisted-on-disk run is silently lossy.~~

~~The gap was inherited from Phase 12 (where `numberOfSetups` was added to the TS type +~~
~~Zod but NOT to the DB schema). Phase 14 Plan 04 inherits the same shape for~~
~~`oldBeads`/`oldAntibodies` rather than fixing the underlying gap in this plan.~~

~~**Follow-up required:**~~
~~1. Add `numberOfSetups`, `oldBeads`, `oldAntibodies` columns to the `runs` table in~~
~~   `src/main/db/schema.ts` (all REAL with NULL allowed, or NOT NULL with defaults).~~
~~2. Generate a drizzle migration (next available `00xx_*.sql`).~~
~~3. Extend `runRepository.create()` and `runRepository.update()` to write/read these~~
~~   three columns.~~
~~4. Update `migration.test.ts` with column-presence assertions.~~

~~Recommend bundling this with the wider Phase 15 plan or as a Phase 14.5 hotfix BEFORE~~
~~Plan 14-06 ships the UI — otherwise Plan 06's operator inputs will work in-session but~~
~~silently drop on save/reload, undermining SMK3-16 for real on-disk persistence.~~
