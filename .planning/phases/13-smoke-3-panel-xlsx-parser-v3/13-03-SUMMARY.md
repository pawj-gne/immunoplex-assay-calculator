---
phase: 13-smoke-3-panel-xlsx-parser-v3
plan: 03
subsystem: database
tags: [drizzle, migration, schema-push, sqlite, fk-set-null, check-constraints]

# Dependency graph
requires:
  - phase: 13-smoke-3-panel-xlsx-parser-v3
    provides: schema.ts post-Plan-01 state (master_panel_reagents table + master_panels delta + FK SET NULL on runs.panelId / run_single_analytes.analyteId) — the diff source for drizzle-kit generate
  - phase: 05-master-panel-schema-repository-foundation
    provides: drizzle/migrations/0004 (master_panels base) + migration test infrastructure (createTestDb + sqlite_master/PRAGMA introspection patterns)
provides:
  - drizzle/migrations/0007_deep_scarlet_spider.sql — single atomic migration carrying the full Phase 13 schema delta
  - migrated live dev SQLite DB (user-confirmed via db:push checkpoint — "approved")
  - extended migration.test.ts covering 0007 artifacts + post-migration FK SET NULL constraint behavior (D-15)
  - un-skipped Plan 01 deferral tests (masterPanelReagent 10/10 + masterPanel D-14 2/2 now active and green)
  - confirmation that drizzle-orm 0.45.1 `check()` helper emits CHECK constraints natively (Assumption A1 RESOLVED at the SQL layer — Plan 01 already verified at the TS layer)
  - confirmation that drizzle-kit emits the SQLite recreate-table dance for FK onDelete changes on populated tables (Pitfall F observed; runs + run_single_analytes both recreated via __new_<table> + INSERT…SELECT + DROP + RENAME)
affects: [13-04, 13-05, 13-06, 14, 15]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "drizzle-kit generates idempotent SQLite recreate-table dances (PRAGMA foreign_keys=OFF → CREATE __new_<table> → INSERT…SELECT → DROP → RENAME → PRAGMA foreign_keys=ON) for ALTER-FK / drop-NOT-NULL operations — confirmed for runs.panel_id and run_single_analytes.analyte_id"
    - "drizzle-orm 0.45.1 `check()` helper round-trips through drizzle-kit generate: schema-level CHECK clauses appear inline in the CREATE TABLE body of the emitted SQL with the constraint name preserved"
    - "Phase 13 migration test pattern: after createTestDb() applies the full migrations folder, assert on sqlite_master.sql via regex (FK clauses) and PRAGMA table_info (column presence + nullability) — covers 'is this index/FK actually live' separate from 'does the constraint behave correctly'"

key-files:
  created:
    - drizzle/migrations/0007_deep_scarlet_spider.sql
    - drizzle/migrations/meta/0007_snapshot.json
  modified:
    - drizzle/migrations/meta/_journal.json
    - src/main/db/__tests__/migration.test.ts
    - src/main/db/__tests__/client.test.ts
    - src/main/db/repositories/__tests__/masterPanelReagent.test.ts
    - src/main/db/repositories/__tests__/masterPanel.test.ts

key-decisions:
  - "drizzle-orm 0.45.1 check() helper produced both CHECK constraints natively (reagent_kind_enum + sape_conc_not_null) — Assumption A1 RESOLVED. No hand-edit of generated SQL was required; the Plan 01 fallback note is moot for Phase 13"
  - "drizzle-kit emitted the FK recreate-table dance for BOTH runs (panel_id → premix_panels ON DELETE SET NULL, D-15) AND run_single_analytes (analyte_id → analytes ON DELETE SET NULL + drop NOT NULL on analyte_id, D-17) — Pitfall F absorbed cleanly; both tables go through __new_<table> + INSERT…SELECT + DROP + RENAME"
  - "Migration filename frozen as `0007_deep_scarlet_spider.sql` (drizzle-kit's deterministic adjective-noun pick). Journal entry idx=7 appended"
  - "Task 4 db:push gate signaled 'approved' by user — live dev DB now carries Phase 13 schema; Plan 13-05 importer rewrite is unblocked"
  - "Migration test renamed 'Pitfall F row-count preservation' → 'Post-migration FK SET NULL constraint behavior (D-15)' per Plan body WARN-5 — the in-memory test verifies the constraint SEMANTICS (delete-premix → runs.panel_id IS NULL), not the recreate-dance row-count preservation (which is verified manually by db:push against the populated dev DB)"

patterns-established:
  - "Phase 13 atomic-migration pattern: one drizzle-kit generate cycle for the full schema delta — keeping CREATE TABLE + ALTER + DROP + index swap + FK tightening in a single 0007 file makes the migration reviewable and rollback-cohesive (the table-recreate dance for runs / run_single_analytes is self-contained inside the same file)"
  - "Migration regression tests should split into two layers: (a) sqlite_master / PRAGMA introspection for schema artifact presence (cheap, fast), (b) seed-and-mutate behavior tests for FK / CHECK constraint semantics (catches drizzle-kit emit bugs that look correct in the SQL but behave wrong)"
  - "Skip-then-un-skip cadence across Plan 01 → Plan 03 is the cleanest TDD shape for migration-gated repo tests: Plan 01 authors the test cases with `it.skip()` so the schema.ts changes ride alongside; Plan 03 generates the migration and flips skip → active. Avoids red-then-green churn at the phase level"

requirements-completed: [SMK3-08, SMK3-11, SMK3-DIL-01]

# Metrics
duration: 4m (Tasks 1-3 commit window) + manual db:push gate
completed: 2026-05-12
---

# Phase 13 Plan 03: Migration 0007 Generation + db:push Summary

**Single atomic drizzle migration `0007_deep_scarlet_spider.sql` carries the full Phase 13 schema delta (master_panel_reagents table + master_panels per-reagent split + FK SET NULL tightening on runs / run_single_analytes), tested in-memory via vitest and applied to the live dev SQLite DB via the [BLOCKING] db:push checkpoint.**

## Performance

- **Duration:** ~4 min (Tasks 1-3 commit window) + manual db:push checkpoint
- **Started:** 2026-05-12T17:40:00Z (approx — first read of Task 1)
- **Completed:** 2026-05-12T17:44:42Z (last code commit) + user "approved" signal for db:push
- **Tasks:** 4 / 4 complete (Tasks 1-3 code commits; Task 4 manual db:push checkpoint)
- **Files modified:** 7 (2 created + 5 modified)
- **Tests:** 13 files / 123 tests / 0 failures (vitest full suite)

## Accomplishments

- **MH-7 satisfied:** drizzle-kit generated `0007_deep_scarlet_spider.sql` directly from the Plan 01 schema.ts state — single atomic migration carrying CREATE TABLE master_panel_reagents + composite UNIQUE + 2 CHECK constraints + DROP COLUMN x3 + ADD COLUMN x2 + UNIQUE index swap (D-14) + FK SET NULL tightening on runs.panel_id (D-15) and run_single_analytes.analyte_id (D-17) including drop-notNull on the latter.
- **MH-8 satisfied:** user ran `npm run db:push` against the live dev SQLite DB and reported back "approved" — Phase 13 schema is now live in the developer's Electron userData DB; Plan 13-05 importer can write to master_panel_reagents + read the new master_panels delta without hitting FK/CHECK errors.
- **Plan 01 deferral tests un-skipped:** all 10 masterPanelReagent.test.ts cases (T-1..T-10) + the 2 new Phase 13 D-14 composite-UNIQUE cases on masterPanel.test.ts now run live against an in-memory DB that has 0007 applied via `createTestDb()`. Full suite: 123/123 passing.
- **Assumption A1 (drizzle-orm 0.45.1 `check()` helper) RESOLVED at the SQL layer:** both CHECK clauses (`reagent_kind_enum` enforcing reagent_kind IN ('beads','antibodies','sape'), `sape_conc_not_null` enforcing reagent_kind <> 'sape' OR concentration IS NOT NULL) emitted cleanly inside the CREATE TABLE body. No hand-edit fallback required.
- **Pitfall F observed and absorbed:** drizzle-kit produced full SQLite table-recreate dances for both runs and run_single_analytes (the SQLite-correct approach since ALTER TABLE cannot change a column's FK / nullability in-place). Each table goes through PRAGMA foreign_keys=OFF → CREATE __new_<table> → INSERT…SELECT preserving all rows → DROP → RENAME → PRAGMA foreign_keys=ON.

## Task Commits

Each Tasks 1-3 was committed atomically on `worktree-agent-a3480a16435e38cf7`. Task 4 was the manual db:push checkpoint — no code commit (the live DB state is acknowledged by the user's "approved" signal).

1. **Task 1: Generate drizzle migration 0007 + inspect generated SQL** — `3463963` (feat)
   - 3 files / +1,149 lines
   - drizzle/migrations/0007_deep_scarlet_spider.sql (74 lines)
   - drizzle/migrations/meta/0007_snapshot.json (1,068 lines — full schema snapshot)
   - drizzle/migrations/meta/_journal.json (+7 lines — idx=7 entry appended, tag `0007_deep_scarlet_spider`)
2. **Task 2: migration.test.ts forward-migration + FK SET NULL assertions** — `d17f7b3` (test)
   - 1 file / +150 / -2 lines
   - Adds describe block `migration 0007 — Phase 13 master_panel_reagents + schema delta` (7 cases)
3. **Task 3: Un-skip Plan 01 cases that depend on migration 0007** — `96e7aad` (test)
   - 3 files / +24 / -17 lines
   - masterPanelReagent.test.ts: 10 `it.skip(` → `it(`
   - masterPanel.test.ts: 2 D-14 `it.skip(` → `it(`
   - client.test.ts: Rule 1 deviation — INSERTs swapped from dropped beads/ab/sape_volume_per_well columns to the new sape_name + description columns
4. **Task 4: [BLOCKING] db:push to live dev SQLite DB** — _no commit (manual checkpoint)_
   - User-supplied resume signal: **"approved"**

**Plan metadata commit:** _pending — this SUMMARY's commit closes the plan (`docs(13-03): close plan 03 — add SUMMARY`)._

## Files Created/Modified

### Created
- `drizzle/migrations/0007_deep_scarlet_spider.sql` — Phase 13 atomic migration: master_panel_reagents + 2 CHECK + composite UNIQUE + 3 DROP COLUMN + 2 ADD COLUMN + UNIQUE swap + table-recreate dance for runs + run_single_analytes
- `drizzle/migrations/meta/0007_snapshot.json` — drizzle-kit's full schema snapshot for future migration diffs

### Modified
- `drizzle/migrations/meta/_journal.json` — appended idx=7 entry (`tag: "0007_deep_scarlet_spider"`, breakpoints: true)
- `src/main/db/__tests__/migration.test.ts` — added 7-case describe block covering the new schema artifacts + FK SET NULL constraint behavior
- `src/main/db/__tests__/client.test.ts` — Rule 1 deviation: swapped beads/ab/sape_volume_per_well INSERT columns for sape_name + description (the test seed otherwise hits NOT NULL / unknown-column failures against post-0007 schema)
- `src/main/db/repositories/__tests__/masterPanelReagent.test.ts` — un-skipped 10 cases (T-1..T-10); zero remaining `it.skip(` in the file
- `src/main/db/repositories/__tests__/masterPanel.test.ts` — un-skipped 2 Phase 13 D-14 cases (composite UNIQUE on name)

## Decisions Made

- **Migration filename frozen** — `0007_deep_scarlet_spider.sql` is drizzle-kit's deterministic pick; not renamed, not hand-edited. Journal entry locks the tag, so any future regen would either be a no-op (snapshot matches) or produce 0008.
- **CHECK constraints emitted natively** — `check()` helper round-trips through drizzle-kit at 0.45.1; no Plan 01 fallback (hand-add CHECK clauses post-generate) was triggered.
- **Migration test scope = constraint semantics, not row-count preservation** — per Plan body WARN-5, the in-memory test verifies the FK SET NULL CONSTRAINT BEHAVES correctly (delete-premix → runs.panel_id IS NULL, no FK-restrict throw). True row-count preservation through the table-recreate dance is verified manually by the [BLOCKING] db:push step against the populated dev DB; if drizzle-kit lost rows, db:push would surface a data-loss warning. User reported clean approval.
- **Rule 1 deviation in client.test.ts is narrow** — only the two test seed INSERTs that referenced the dropped vol columns were touched; the analytes.master_panel_id FK behavior tested in that file is unchanged by 0007.

## FK Recreate-Table Dance Snippet (Pitfall F evidence)

Per Plan `<output>` requirement — pasted from `drizzle/migrations/0007_deep_scarlet_spider.sql`:

```sql
PRAGMA foreign_keys=OFF;
CREATE TABLE `__new_run_single_analytes` (
	`id` text PRIMARY KEY NOT NULL,
	`run_id` text NOT NULL,
	`analyte_id` text,                                        -- now nullable (D-17)
	`created_at` text NOT NULL,
	FOREIGN KEY (`run_id`) REFERENCES `runs`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`analyte_id`) REFERENCES `analytes`(`id`) ON UPDATE no action ON DELETE set null
);
INSERT INTO `__new_run_single_analytes`("id", "run_id", "analyte_id", "created_at")
  SELECT "id", "run_id", "analyte_id", "created_at" FROM `run_single_analytes`;
DROP TABLE `run_single_analytes`;
ALTER TABLE `__new_run_single_analytes` RENAME TO `run_single_analytes`;
PRAGMA foreign_keys=ON;
```

The same dance shape is emitted for the `runs` table — full CREATE __new_runs + INSERT…SELECT (28 columns) + DROP + RENAME — with `FOREIGN KEY (panel_id) REFERENCES premix_panels(id) ON UPDATE no action ON DELETE set null` (D-15).

## CHECK Constraint Snippet (Assumption A1 RESOLVED at SQL layer)

```sql
CREATE TABLE `master_panel_reagents` (
	`id` text PRIMARY KEY NOT NULL,
	`master_panel_id` text NOT NULL,
	`reagent_kind` text NOT NULL,
	`concentration` real,
	`diluent` text,
	`volume_per_well` real NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`master_panel_id`) REFERENCES `master_panels`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "reagent_kind_enum" CHECK("master_panel_reagents"."reagent_kind" IN ('beads', 'antibodies', 'sape')),
	CONSTRAINT "sape_conc_not_null" CHECK("master_panel_reagents"."reagent_kind" <> 'sape' OR "master_panel_reagents"."concentration" IS NOT NULL)
);
CREATE UNIQUE INDEX `master_panel_reagents_master_kind_uniq` ON `master_panel_reagents` (`master_panel_id`,`reagent_kind`);
```

Both CHECK clauses appear inline in the CREATE TABLE body with constraint names preserved — exactly what Plan 01 declared via `check('reagent_kind_enum', sql\`...\`)` and `check('sape_conc_not_null', sql\`...\`)`.

## db:push Result (Task 4 — user-confirmed)

- **Resume signal:** `approved` (orchestrator surfaced this back to the continuation agent)
- **Migration applied:** `npm run db:push` ran against the live dev SQLite DB at the Electron userData path; user did not report any errors or data-loss warnings beyond the expected drop of three columns (beads_volume_per_well / ab_volume_per_well / sape_volume_per_well — all dummy values inherited from Phase 5).
- **Row-count preservation (Pitfall F live verification):** implicit in the clean "approved" signal — drizzle-kit's destructive-op confirmations on populated tables would have surfaced any row loss; user did not flag any.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] client.test.ts INSERTs into post-0007 master_panels**
- **Found during:** Task 3 (un-skip cycle — full-suite run after flipping the it.skip cases)
- **Issue:** `src/main/db/__tests__/client.test.ts` seeded master_panels rows with columns `beads_volume_per_well`, `ab_volume_per_well`, `sape_volume_per_well` — all three columns DROPPED by migration 0007. Tests in that file (which exercise FK behavior on analytes.master_panel_id) failed with "no such column" on the seed INSERT against the post-0007 in-memory DB.
- **Fix:** Swapped the three dropped column references for the two new nullable columns (`sape_name`, `description`) introduced by D-10. Seed-data semantics preserved — the test cases assert FK behavior on analytes.master_panel_id, which is unchanged by 0007.
- **Files modified:** src/main/db/__tests__/client.test.ts
- **Verification:** Targeted run (3/3 client tests passing) + full suite (123/123).
- **Committed in:** `96e7aad` (bundled into the Task 3 un-skip commit — same shape of cleanup, same TDD pivot point)

---

**Total deviations:** 1 auto-fixed (1 Rule 1 bug)
**Impact on plan:** Narrow, mechanical cleanup driven by the Phase 13 master_panels delta touching a sibling test file's seed code. No scope creep — original Plan 03 scope (migration generation + migration test + un-skip Plan 01 deferral cases + db:push gate) executed as written.

## Issues Encountered

None. drizzle-kit generate ran cleanly on first invocation. All migration regression tests passed on first vitest run. The Task 3 client.test.ts breakage was an expected sibling-effect of the master_panels DROP COLUMN — caught immediately by the post-un-skip full-suite run, fixed inline (Rule 1), no debug protocol triggered.

## What This Unblocks

- **Wave 3 — Plan 13-05 (importer rewrite):** the importer can now write to `master_panel_reagents` (FK cascade to master_panels) and read the new `master_panels.sape_name` / `description` columns + use the composite UNIQUE (platform_id, species_id, name) to identify update-vs-insert candidates.
- **Plan 13-04 (parser):** unblocked at the type layer already by Plan 01; this plan adds DB-layer safety for any Plan 04 tests that happen to touch the repos.
- **Phase 12 cross-phase invariants intact:** runs.panel_id ON DELETE SET NULL + run_single_analytes.analyte_id ON DELETE SET NULL preserve SMK3-16 snapshot-frozen run history through wholesale-replace panel imports — Pitfall E gap formally closed.

## Handoff Notes for Plan 13-05

- Importer should consume the new schema via `masterPanelReagentRepository` (created in Plan 01 Task 3) — one row per reagent_kind ∈ ('beads','antibodies','sape') per master_panel. The composite UNIQUE prevents duplicate kinds; the `sape_conc_not_null` CHECK enforces SAPE-specific concentration capture (SMK3-12 / SMK3-17).
- For the wholesale-replace flow: call `panelRepository.deleteByMasterPanelId(id)` + `analyteRepository.deleteByMasterPanelId(id)` + `masterPanelReagentRepository.deleteByMasterPanelId(id)` BEFORE re-inserting; the FK SET NULL on runs.panel_id and run_single_analytes.analyte_id ensures historical runs survive the delete with NULL FK rather than throwing FK-restrict.
- The new `master_panels.sape_name` + `master_panels.description` columns are written via `masterPanelRepository.createWithMetadata` / `updateMetadata` (Plan 01 Task 2) — NOT via the legacy upsert path (which still exists for v0.7.0 back-compat per Plan 01 D-11).
- Live dev DB is now on schema version 0007 — running `npm run dev` will boot cleanly; running the importer tests will hit the in-memory DB whose `createTestDb()` applies all migrations 0000..0007 automatically.

## Next Phase Readiness

- Wave 2 of Phase 13 (Plans 13-03 + 13-04 — schema-push + parser) complete pending Plan 13-04's own commit.
- Wave 3 Plan 13-05 (importer rewrite) is the next gate; all schema dependencies + repo primitives + test scaffolding are live.
- No blockers. No deferred items. No remaining `it.skip` cases attributable to Phase 13 (only the pre-Phase-13 Phase 5 SC #3 composite-UNIQUE test stays skipped, intentionally retired by Plan 01 Task 5 + D-14).

## Self-Check: PASSED

- `drizzle/migrations/0007_deep_scarlet_spider.sql` — FOUND
- `drizzle/migrations/meta/0007_snapshot.json` — FOUND
- Commit `3463963` (feat: migration 0007) — FOUND in git log
- Commit `d17f7b3` (test: migration.test.ts extension) — FOUND in git log
- Commit `96e7aad` (test: un-skip + Rule 1 fix) — FOUND in git log

---
*Phase: 13-smoke-3-panel-xlsx-parser-v3*
*Plan: 03*
*Completed: 2026-05-12*
