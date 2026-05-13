---
phase: 15-smoke-3-run-document-audit-trail
plan: 01
subsystem: database
tags: [drizzle, sqlite, migration, schema, zod, types, audit-trail, smoke3]

requires:
  - phase: 14-smoke-3-plate-page-input-expansion-ui-cleanup
    provides: runs.numberOfSetups + oldBeads + oldAntibodies columns + conditional-write idiom (Plan 14-08)
  - phase: 13
    provides: master_panels + master_panel_reagents tables (source-of-truth for the 7 snapshot fields)
  - phase: 6
    provides: runs.machine_name + is_offline_save (boolean NOT NULL DEFAULT false precedent)

provides:
  - 10 new audit-trail snapshot columns on runs (7 nullable text/real + 2 NOT NULL boolean override + 1 nullable text marker)
  - drizzle migration 0009_chemical_prism.sql
  - RunRecord + RunCreate type extensions for the 10 fields
  - runCreate zod schema extensions
  - runRepository.create + update conditional writes for the 10 fields
  - column-presence assertions in migration.test.ts (10 new) and T-7..T-18 round-trip tests in run.test.ts (12 new)

affects: [15-02-ipc, 15-03-snapshot-rewrite, 15-04-audit-trail-ui, 15-05-pe-math-integration]

tech-stack:
  added: []
  patterns:
    - "Phase 14-08 conditional-write idiom: `if (data.X !== undefined) insertValues.X = data.X` for nullable snapshot fields with DB DEFAULT fall-through preserving pre-migration round-trip"
    - "Phase 6 isOfflineSave shape replicated for override booleans (integer mode:'boolean' NOT NULL default false)"

key-files:
  created:
    - drizzle/migrations/0009_chemical_prism.sql
    - drizzle/migrations/meta/0009_snapshot.json
  modified:
    - src/main/db/schema.ts
    - src/shared/types/run.ts
    - src/shared/validation/run.ts
    - src/main/db/repositories/run.ts
    - src/main/db/__tests__/migration.test.ts
    - src/main/db/repositories/__tests__/run.test.ts
    - drizzle/migrations/meta/_journal.json

key-decisions:
  - "Migration name auto-generated as `0009_chemical_prism` by drizzle-kit (not hand-renamed per Phase 14-08 convention)"
  - "All 8 master-panel-derived columns nullable so pre-Phase-15 rows tolerate the migration without backfill (D-15-04)"
  - "2 override booleans use Phase 6 isOfflineSave shape (integer mode:'boolean' NOT NULL default false)"
  - "calculation_rules_version is a nullable text marker — NULL on legacy rows, 'smoke3' on new saves (drives historical-run banner in Plan 15-04)"

patterns-established:
  - "Audit-trail snapshot pattern: denormalize master-panel-derived values at save time so renders are stable across master-panel edits (D-15-01)"
  - "Conditional-write extension idiom continues from Phase 14-08 — new optional fields slot into both create() insertValues and update() setWithProvenance without altering the base payload"

requirements-completed: [SMK3-16]

duration: 15min
completed: 2026-05-12
---

# Phase 15 Plan 01: Schema delta + migration 0009 + repository extension + types/zod Summary

**10 new audit-trail snapshot columns on `runs` (sape_name, sape_concentration, beads/antibodies diluent + volume_per_well, premix_concentration, 2 override booleans, calculation_rules_version) wired through Drizzle migration 0009, RunRecord/RunCreate types, zod, and runRepository conditional writes.**

## Performance

- **Duration:** ~15 min (resumed from Task 1 already complete in prior worktree)
- **Started:** 2026-05-12T17:15:00Z (continuation agent reset)
- **Completed:** 2026-05-12T17:19:00Z
- **Tasks:** 4 (Task 1 by prior executor; Tasks 2–4 by continuation agent after user authorized db:generate)
- **Files modified:** 7 (5 source + 2 emitted migration artifacts + 1 journal)

## Accomplishments

- 10 new columns on `runs` per D-15-03 (7 nullable text/real, 2 NOT NULL boolean overrides default false, 1 nullable text marker)
- drizzle migration 0009_chemical_prism.sql emitted verbatim from `npm run db:generate` (no hand edits)
- RunRecord + RunCreate carry the 10 optional fields with correct null/boolean/string typing
- runCreate zod schema accepts the 10 new fields (8 nullable+optional, 2 booleans default false, marker nullable+optional)
- runRepository.create + update extend the Phase 14-08 conditional-write idiom for all 10 fields
- migration.test.ts: 10 new column-presence assertions (8 nullable + 2 NOT NULL boolean)
- run.test.ts: T-7..T-18 (12 new round-trip tests: 10 per-field + 1 all-supplied + 1 all-omitted-defaults)
- Full test suite (43 tests across the 2 files) passes; typecheck exit 0

## Task Commits

Each task committed atomically with `--no-verify` (parallel-executor protocol):

1. **Task 1: Schema + types + zod delta (10 new fields)** — `23200f8` (feat) *(prior executor in separate worktree)*
2. **Task 2: [BLOCKING] Generate Drizzle migration 0009** — `f2dbeac` (feat)
3. **Task 3: Repository conditional-write extension** — `6d1fb5c` (feat)
4. **Task 4: Migration column-presence + round-trip tests** — `f72e00e` (test)

Plan metadata commit follows (this SUMMARY.md commit).

## Files Created/Modified

- `src/main/db/schema.ts` — 10 new column declarations on the `runs` table (after Phase 14-08 columns)
- `src/shared/types/run.ts` — 10 optional fields added to both RunRecord + RunCreate interfaces
- `src/shared/validation/run.ts` — 10 new zod fields in runCreate schema
- `src/main/db/repositories/run.ts` — 10 conditional writes in create(), 10 in update() + setWithProvenance type intersection extended
- `src/main/db/__tests__/migration.test.ts` — new describe block "migration 15-01 — runs audit-trail snapshot columns" with parameterized it.each blocks for 8 nullable + 2 NOT NULL boolean assertions
- `src/main/db/repositories/__tests__/run.test.ts` — new nested describe "Phase 15 audit-trail snapshot persistence" with T-7..T-18 (12 tests)
- `drizzle/migrations/0009_chemical_prism.sql` — emitted by drizzle-kit, 10 `ALTER TABLE` statements
- `drizzle/migrations/meta/0009_snapshot.json` — drizzle-kit snapshot of post-0009 schema state
- `drizzle/migrations/meta/_journal.json` — appended idx=9 entry registering 0009

## Decisions Made

- Migration applied via the runtime migrate() path on next app launch (per plan: do NOT run `db:push` against live dev.db; tests exercise migrate() via createTestDb()).
- The `setWithProvenance` type intersection in update() was extended with the same 10 fields so the conditional writes typecheck against `data.X` without `any` casts.
- The 12 new round-trip tests live as a NESTED describe inside the existing Plan 14-08 describe block so they share the `beforeEach`/`afterEach` harness (operators seed + db reset) without duplication. This deviates slightly from the plan suggestion of "sibling describe", but is functionally equivalent and avoids duplicating the seed scaffolding.

## Deviations from Plan

### Auto-fixed Issues / Plan accounting notes

**1. [Rule 1 - Plan accounting error from Task 1] sapeName grep count mismatch (carried from prior executor)**
- **Found during:** Task 1 (executed in a prior worktree by `worktree-agent-a66448785c7f0ba83`)
- **Issue:** Plan acceptance criterion `grep -c "sapeName: text('sape_name')" src/main/db/schema.ts` expects 1 but actual is 2 because `master_panels` already had a `sapeName: text('sape_name')` column from Phase 13. The new `runs.sapeName` column is the additional occurrence — both are correct per D-15-03.
- **Fix:** No code change needed; plan acceptance count was the error. The continuation agent's sanity grep accepted `2` and confirmed Task 1's schema delta is correct.
- **Files modified:** none
- **Verification:** Both `master_panels.sapeName` (Phase 13) and `runs.sapeName` (Phase 15) are present and correctly typed; downstream tests in Task 4 round-trip the new `runs.sapeName` cleanly.
- **Committed in:** —

**2. [Rule 1 - Plan accounting error] _journal.json idx count mismatch**
- **Found during:** Task 2 acceptance verification
- **Issue:** Plan acceptance criterion `grep -c '"idx":' drizzle/migrations/meta/_journal.json` expects 9 but actual is 10. The journal contains 10 entries (idx values 0..9 inclusive) because prior phases emitted 9 migrations (0000–0008), and 0009 is the 10th entry.
- **Fix:** No code change needed; plan acceptance count was the error. The continuation agent confirmed the 10th entry corresponds to the new `0009_chemical_prism` migration with `idx=9` (correct).
- **Files modified:** none
- **Verification:** Cat of `_journal.json` shows 10 entries terminating with `{"idx":9,"tag":"0009_chemical_prism"}`. Targeted test files exit 0 — migrate() applies all 10 entries cleanly.
- **Committed in:** —

---

**Total deviations:** 2 (both plan-accounting errors; zero code changes required)
**Impact on plan:** Functionally none — all acceptance content matches; only the counts in two grep assertions were off by one.

## Issues Encountered

- None. db:generate ran non-interactively on the first attempt (10 unambiguous column adds, no rename detection prompts), exactly matching Phase 14-08's behavior.

## User Setup Required

None. The emitted migration applies via the runtime `migrate()` call on app startup and via `createTestDb()` in the test harness. The plan explicitly forbids `npm run db:push` against the live dev.db.

## Next Phase Readiness

- **15-02 (IPC):** RunCreate now carries the 10 fields end-to-end; preload/IPC handlers can pass them through zod-validated payloads.
- **15-03 (snapshot rewrite):** Renderer snapshot builder can populate the 10 fields from selectionStore.selectedPanel + master_panel_reagents at save time.
- **15-04 (audit-trail UI):** RunRecord exposes the fields for rendering; calculationRulesVersion=== 'smoke3' is the marker for the new-format banner toggle.
- **15-05 (PE math integration):** sapeConcentration + diluent + volume fields are available for downstream PE recompute paths.
- No blockers for downstream plans.

---
*Phase: 15-smoke-3-run-document-audit-trail*
*Completed: 2026-05-12*

## Self-Check: PASSED

- All 10 modified/created files exist on disk
- All 4 task commits reachable in git log (23200f8, f2dbeac, 6d1fb5c, f72e00e)
- `npm run typecheck` exit 0
- `npm test -- --run src/main/db/__tests__/migration.test.ts src/main/db/repositories/__tests__/run.test.ts` → 43 tests passed
