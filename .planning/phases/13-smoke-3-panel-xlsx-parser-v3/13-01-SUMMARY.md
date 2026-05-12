---
phase: 13-smoke-3-panel-xlsx-parser-v3
plan: 01
subsystem: db
tags: [schema, drizzle, master-panel-reagents, wholesale-replace, repository]

# Dependency graph
requires:
  - phase: 05-master-panel-schema-repository-foundation
    provides: masterPanels + analytes + premixPanels tables, masterPanelRepository upsert path, FK cascade conventions
  - phase: 12-smoke-3-calculator-rules
    provides: SMK3-16 snapshot-frozen run contract (informs D-15/D-17 SET NULL FK choice)
provides:
  - master_panel_reagents table type definition (TS source-of-truth for drizzle-kit generate in Plan 13-03)
  - master_panels schema delta (drop 3 vol cols; add sape_name + description; swap composite UNIQUE to include name)
  - FK tightening on runs.panelId + run_single_analytes.analyteId (Pitfall E gap close)
  - masterPanelReagent.ts repository (CRUD + deleteByMasterPanelId)
  - masterPanelRepository extensions (findByPlatformSpeciesName / createWithMetadata / updateMetadata)
  - analyteRepository.deleteByMasterPanelId + panelRepository.deleteByMasterPanelId
  - panelRepository.create() extended to accept masterPanelId (OQ-1 resolution)
  - Phase 13 D-06 unit-test coverage (10 cases, skipped pending Plan 13-03 migration)
affects: [13-02, 13-03, 13-04, 13-05, 13-06, 14, 15]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "drizzle-orm sqlite-core check() helper for SQL CHECK constraints (drizzle 0.45.1)"
    - "Repository methods never open transactions — importer owns transaction scope (carries Phase 5 D-18)"
    - "Phase 13 wholesale-replace primitives: deleteByMasterPanelId on premix_panels + analytes + master_panel_reagents (cascade), paired with onDelete:'set null' on runs.panelId + run_single_analytes.analyteId so historical run rows survive with NULL FK"

key-files:
  created:
    - src/shared/types/masterPanelReagent.ts
    - src/main/db/repositories/masterPanelReagent.ts
    - src/main/db/repositories/__tests__/masterPanelReagent.test.ts
  modified:
    - src/main/db/schema.ts
    - src/shared/types/masterPanel.ts
    - src/main/db/repositories/masterPanel.ts
    - src/main/db/repositories/analyte.ts
    - src/main/db/repositories/panel.ts
    - src/main/db/repositories/__tests__/masterPanel.test.ts
    - src/main/db/repositories/__tests__/analyte.test.ts

key-decisions:
  - "drizzle-orm 0.45.1 `check()` helper is available — verified in node_modules/drizzle-orm/sqlite-core/checks.d.ts; both CHECK constraints (reagent_kind_enum + sape_conc_not_null) declared inline in schema.ts (no Plan 13-03 hand-edit fallback needed)"
  - "MasterPanelUpsertInput type retained as alias for v0.7.0 back-compat (D-11); new Smoke 3 callers use createWithMetadata / updateMetadata. Upsert path now writes sapeName + description (both default NULL) instead of the dropped 3 vol fields"
  - "panelRepository.create() extended with optional masterPanelId (OQ-1 resolution); no setMasterPanelId method added — wholesale-replace flow always DELETEs then INSERTs fresh"
  - "All 10 masterPanelReagent.test.ts cases authored with it.skip() pending Plan 13-03 migration — createTestDb() runs migrate() against drizzle/migrations and the new migration lands in 13-03. Cleaner than red-then-green at the phase level"
  - "Two new Phase 13 D-14 composite-UNIQUE tests (also it.skip) added to masterPanel.test.ts; supersede the prior Phase 5 SC #3 (platform_id, species_id) UNIQUE test"
  - "Rule 3 deviation: analyte.test.ts had to drop the same beadsVolumePerWell/abVolumePerWell/sapeVolumePerWell fields from its beforeEach seed call to keep tsc passing; bundled into Task 5 commit because it's the same shape of cleanup"

patterns-established:
  - "When schema declares a CHECK constraint via drizzle's `check()` helper, the second arg is a `sql\`...\`` template literal — use `${t.colName}` interpolation to reference the column. Validates at insert time; better-sqlite3 surfaces `CHECK constraint failed: <name>` with the constraint name"
  - "When the importer hard-deletes parent rows that have child references in run history tables, ALL such FKs must declare `onDelete: 'set null'` (Pitfall E). For Phase 13: runs.panelId + run_single_analytes.analyteId. Plan 13-03 migration carries the same FK semantics into the SQL"
  - "deleteByMasterPanelId on repos that own junction tables (e.g. panel.ts owning panel_analytes) MUST first gather child ids, manually delete junction rows, then delete the parent rows — relying on SQLite FK cascade would require declaring the junction FK with onDelete:'cascade' which Phase 5's schema didn't do (and changing it would be a separate migration risk)"

# Metrics
duration: 14m 25s
completed: 2026-05-12
---

# Phase 13 Plan 01: Master Panel Reagents Schema + Repository Layer Summary

*TS source-of-truth for the Phase 13 master_panel_reagents table + master_panels delta + wholesale-replace repository primitives — Plan 13-03 will diff drizzle-kit generate against this state.*

## Performance

- **Duration:** 14m 25s
- **Started:** 2026-05-12T16:59:27Z
- **Completed:** 2026-05-12T17:13:52Z
- **Tasks:** 5 / 5 complete
- **Files modified:** 10 (3 created + 7 modified)
- **Lines:** +524 / -60 across the plan

## Accomplishments

- Added `master_panel_reagents` table to `schema.ts` with composite UNIQUE (master_panel_id, reagent_kind), two CHECK constraints (`reagent_kind_enum`, `sape_conc_not_null`), and FK cascade to `master_panels` (D-06).
- Dropped the three per-reagent volume columns from `master_panels`, added `sape_name` + `description` (both nullable), and swapped the composite UNIQUE from `(platform_id, species_id)` to `(platform_id, species_id, name)` (D-10, D-14).
- Tightened `runs.panelId` to `onDelete: 'set null'` and made `run_single_analytes.analyteId` nullable with `onDelete: 'set null'` (D-15, D-17, Pitfall E).
- Created `masterPanelReagentRepository` with `create / findByMasterPanelId / deleteByMasterPanelId / getById`.
- Extended `masterPanelRepository` with `findByPlatformSpeciesName / createWithMetadata / updateMetadata` (Phase 13 D-12, D-13). Retired the dropped vol fields from the back-compat `upsertByPlatformAndSpecies` SET/INSERT clauses.
- Added `deleteByMasterPanelId` to `analyteRepository` (D-16) and `panelRepository` (D-12); extended `panelRepository.create()` to accept an optional `masterPanelId` (OQ-1 resolution).
- Authored 10 vitest cases for `masterPanelReagentRepository` (marked `it.skip` pending Plan 13-03 migration); added two Phase 13 D-14 composite-UNIQUE tests in `masterPanel.test.ts` (also `it.skip`).
- Kept `tsc --noEmit -p tsconfig.node.json` and `tsc --noEmit -p tsconfig.web.json` at exit 0.

## Task Commits

1. **Task 1: Define MasterPanelReagent types + extend MasterPanel type** - `f31265b` (feat)
2. **Task 2: Extend schema.ts with master_panel_reagents + master_panels delta + FK tightening** - `d78a60f` (feat)
3. **Task 3: Extend masterPanelRepository + create masterPanelReagentRepository + extend analyte/panel repos** - `c83c99f` (feat)
4. **Task 4: Write masterPanelReagentRepository unit tests** - `3b3c9b8` (test)
5. **Task 5: Update existing masterPanel.test.ts to drop removed-column assertions** - `0ffe42d` (test)

## Files Created/Modified

### Created

- `src/shared/types/masterPanelReagent.ts` - `ReagentKind` union + `MasterPanelReagent` + `MasterPanelReagentCreate` types (D-06/D-07/SMK3-DIL-01)
- `src/main/db/repositories/masterPanelReagent.ts` - Repository for master_panel_reagents (create / findByMasterPanelId / deleteByMasterPanelId / getById)
- `src/main/db/repositories/__tests__/masterPanelReagent.test.ts` - 10 vitest cases covering CRUD + CHECK + UNIQUE + FK cascade (all `it.skip` pending Plan 13-03)

### Modified

- `src/main/db/schema.ts` - Added masterPanelReagents table + master_panels delta + FK tightening on runs.panelId + run_single_analytes.analyteId
- `src/shared/types/masterPanel.ts` - Removed 3 vol fields; added sapeName + description (nullable)
- `src/main/db/repositories/masterPanel.ts` - Added findByPlatformSpeciesName + createWithMetadata + updateMetadata; cleaned upsertByPlatformAndSpecies to write new columns
- `src/main/db/repositories/analyte.ts` - Added deleteByMasterPanelId
- `src/main/db/repositories/panel.ts` - Extended create() with optional masterPanelId; added deleteByMasterPanelId (cascade-cleans panel_analytes junction)
- `src/main/db/repositories/__tests__/masterPanel.test.ts` - Dropped legacy vol-field assertions; added two D-14 composite-UNIQUE tests (it.skip)
- `src/main/db/repositories/__tests__/analyte.test.ts` - Removed legacy vol fields from beforeEach seed (Rule 3 compile fix)

## Decisions Made

**drizzle-orm `check()` helper available without fallback.** Verified at `node_modules/drizzle-orm/sqlite-core/checks.d.ts` line 22 (`export declare function check(name: string, value: SQL): CheckBuilder`). Both CHECK constraints (`reagent_kind_enum` + `sape_conc_not_null`) are declared inline in schema.ts via `check('name', sql\`...\`)`. Plan 13-03 will get them automatically via `drizzle-kit generate` — no SQL hand-edit required.

**MasterPanelUpsertInput retained as alias for v0.7.0 back-compat.** D-11 keeps `vendor_singles_term` alive; the upsert path is preserved (now writing `sapeName` + `description` defaulting to NULL instead of the dropped 3 vol fields) so v0.7.0-imported data and Phase 5 tests keep working. New Smoke 3 callers in Plans 13-04..06 will use `createWithMetadata` / `updateMetadata` instead.

**panelRepository.create() extended (OQ-1 resolution) — no `setMasterPanelId` method added.** The wholesale-replace flow always DELETEs then INSERTs fresh, so a separate setter is unnecessary. Extending `create()` with an optional `masterPanelId` is the minimal-API path; existing v0.7.0 callers (which never set the field) still pass `undefined` and get `masterPanelId: null` as before.

**All 10 masterPanelReagent.test.ts cases marked `it.skip()` initially.** `createTestDb()` runs `migrate()` against `drizzle/migrations`, which doesn't yet contain the new migration (lands in Plan 13-03). The skipped cases avoid a known-red plan boundary; Plan 13-03 Task 3 explicitly un-skips them once the migration is applied. Two new Phase 13 D-14 tests in `masterPanel.test.ts` use the same pattern.

**Rule 3 deviation captured below** — `analyte.test.ts` had to drop the dropped vol fields too, even though it wasn't in the plan's `<files>` list.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Dropped legacy vol-field literals from analyte.test.ts beforeEach**

- **Found during:** Task 2 verification (tsc surfaced 17 errors across `masterPanel.ts` repo + `masterPanel.test.ts` + `analyte.test.ts`)
- **Issue:** `analyte.test.ts` line 28 passed `beadsVolumePerWell: 25, abVolumePerWell: 25, sapeVolumePerWell: 25` to `masterPanelRepository.upsertByPlatformAndSpecies(...)` inside its `beforeEach`. Task 1 removed those fields from `MasterPanelUpsertInput`, so tsc emitted TS2353 ("does not exist on type"). The plan's Task 5 `<files>` only listed `masterPanel.test.ts`, but `analyte.test.ts` had the same pattern and was blocking `tsc --noEmit` exit 0 (a plan-level success criterion).
- **Fix:** Dropped the three field literals from the `masterPanelRepository.upsertByPlatformAndSpecies(...)` call inside `analyte.test.ts` `beforeEach`. No assertions in the file read those fields, so no further changes needed.
- **Files modified:** `src/main/db/repositories/__tests__/analyte.test.ts` (1 hunk; -4 / +3 lines including new comment).
- **Verification:** `npx tsc --noEmit -p tsconfig.node.json --composite false` exits 0.
- **Committed in:** `0ffe42d` (Task 5 commit — bundled because it's the same shape of test-seed cleanup the plan called out for `masterPanel.test.ts`).

**Total deviations:** 1
**Impact:** None on plan scope — same test-seed cleanup the plan explicitly anticipated in Task 1's notes ("remove the field passes in test seeds (Phase 5 tests in masterPanel.test.ts)"). The plan's `<files>` list for Task 5 simply didn't enumerate the second test file that uses the same upsert call.

## Issues Encountered

- None. The plan's interfaces section flagged the analyte.test.ts callsite implicitly; the fix is identical to the masterPanel.test.ts fix the plan specified.
- Pre-existing worktree-base modifications to `.claude/settings.json`, `.planning/config.json`, and `.planning/STATE.md` were preserved untouched (per `parallel_execution` rule that this agent does NOT modify STATE.md — orchestrator owns it).

## User Setup Required

None - no external service configuration required. Drizzle migration generation (`npm run db:generate`) is Plan 13-03's responsibility; this plan only authors the TS schema source-of-truth.

## Next Phase Readiness

- Plan 13-02 can write the SAPE display-traceability constants (SMK3-12) on top of the new `master_panels.sape_name` column.
- Plan 13-03 can run `npx drizzle-kit generate` against the updated schema.ts; the diff produces a single migration that (a) creates `master_panel_reagents` with both CHECK + UNIQUE constraints, (b) drops the 3 vol cols from master_panels, (c) adds `sape_name` + `description`, (d) drops the old UNIQUE index and adds the new 3-col one, (e) recreates `runs` + `run_single_analytes` with the tightened FKs. Plan 13-03 Task 3 also un-skips all 12 `it.skip(...)` cases authored here.
- Plans 13-04 + 13-05 + 13-06 can `import { masterPanelReagentRepository, type ReagentKind } from '../../db/repositories/masterPanelReagent'` and `import { findByPlatformSpeciesName, createWithMetadata, updateMetadata } from '../../db/repositories/masterPanel'` without further schema work.
- Phase 14 (calculator-wiring SMK3-08 / SMK3-17) can read `master_panel_reagents` directly; the FK tightening guarantees historical run rows survive any wholesale-replace event with NULL FKs (snapshot-frozen behavior intact per SMK3-16).

## TDD Gate Compliance

Plan-level type is `execute` (not `tdd`), so the plan-wide RED/GREEN/REFACTOR gate sequence does NOT apply. Individual task-level `tdd="true"` tags govern intra-task discipline: type definitions (Task 1) and schema (Task 2) have compile-time contract tests via `tsc --noEmit`; the masterPanelReagent vitest cases (Task 4) are authored as `it.skip(...)` pending Plan 13-03 migration. RED-style test commits exist in the log (`3b3c9b8` test commit and `0ffe42d` test commit) covering Task 4 + Task 5 respectively.

## Self-Check: PASSED

Verified files exist on disk:
- `src/shared/types/masterPanelReagent.ts` → FOUND
- `src/main/db/repositories/masterPanelReagent.ts` → FOUND
- `src/main/db/repositories/__tests__/masterPanelReagent.test.ts` → FOUND
- `src/main/db/schema.ts` → FOUND (modified)
- `src/shared/types/masterPanel.ts` → FOUND (modified)
- `src/main/db/repositories/masterPanel.ts` → FOUND (modified)
- `src/main/db/repositories/analyte.ts` → FOUND (modified)
- `src/main/db/repositories/panel.ts` → FOUND (modified)
- `src/main/db/repositories/__tests__/masterPanel.test.ts` → FOUND (modified)
- `src/main/db/repositories/__tests__/analyte.test.ts` → FOUND (modified)

Verified commits exist in git log:
- `f31265b` → FOUND (Task 1: types)
- `d78a60f` → FOUND (Task 2: schema)
- `c83c99f` → FOUND (Task 3: repositories)
- `3b3c9b8` → FOUND (Task 4: reagent tests)
- `0ffe42d` → FOUND (Task 5: test cleanup)

Plan-level verification:
- `grep -c 'masterPanelReagents = sqliteTable' src/main/db/schema.ts` → 1 ✓
- `grep -c 'reagent_kind_enum\|sape_conc_not_null' src/main/db/schema.ts` → 2 ✓
- `grep -c 'VolumePerWell' src/main/db/schema.ts` → 0 ✓
- `npx tsc --noEmit -p tsconfig.node.json --composite false` → exit 0 ✓
- `npx tsc --noEmit -p tsconfig.web.json --composite false` → exit 0 ✓

---

*Phase: 13-smoke-3-panel-xlsx-parser-v3*
*Completed: 2026-05-12*
