---
phase: 04-run-documentation-persistence-deployment
plan: 01
subsystem: database
tags: [drizzle, sqlite, electron-ipc, zod, better-sqlite3, persistence]

# Dependency graph
requires:
  - phase: 01-foundation
    provides: Drizzle ORM, better-sqlite3 client, migration runner, repository pattern, IPC + Zod boundary, preload bridge
  - phase: 03.3-analyte-selection-redesign
    provides: plateStore.plates Record<number, Set<string>> shape, calculatorStore snapshot fields, selection store
provides:
  - operators table seeded with the 9-name lab roster (D-20)
  - runs table capturing full Phase 4 metadata (request#, override, user, operator FK, date, sampleType enum, dilutionFactor, sampleCount, replicateMode, requestType, platformId/speciesId/panelId, volumePerWell, deadVolume, hamilton 1-5, runPlatePosition 1-4, standardPosition 1-2, troughPosition 1-2, comments, plex, plateCount, platesJson)
  - runSingleAnalytes join table (D-19) for per-run single analyte snapshot
  - Drizzle migration 0003 auto-applied at startup
  - Zod-validated IPC: run.{getAll,getById,create,update,delete}, operator.{getAll,create,update,delete}
  - Typed preload bridge — window.electronAPI.run.* and window.electronAPI.operator.*
  - RunUpdate = RunCreate alias propagated through type → schema → IPC → preload (ISSUE 3 fix)
affects: [04-02 Document & Save, 04-04 Finalized Run View, 04-05 Operators Manage page]

# Tech tracking
tech-stack:
  added: []  # No new dependencies — reuses existing drizzle-orm, better-sqlite3, zod, electron IPC
  patterns:
    - "Hydrated read pattern: repository converts JSON-serialized columns + join-table rows into a single hydrated record before returning to IPC"
    - "Immutable-after-create columns enforced at the repository layer (update() omits requestType/platformId/speciesId from SET clause)"
    - "Update-payload alias of Create-payload (RunUpdate = RunCreate) keeps type/schema/IPC/preload contracts internally consistent"
    - "Soft-delete via active flag for entities referenced by FK (operator)"

key-files:
  created:
    - drizzle/migrations/0003_damp_prima.sql
    - drizzle/migrations/meta/0003_snapshot.json
    - src/main/db/repositories/run.ts
    - src/main/db/repositories/operator.ts
    - src/main/ipc/run.ts
    - src/main/ipc/operator.ts
    - src/shared/types/run.ts
    - src/shared/types/operator.ts
    - src/shared/validation/run.ts
    - src/shared/validation/operator.ts
  modified:
    - src/main/db/schema.ts
    - src/main/db/seed.ts
    - src/main/ipc/index.ts
    - src/preload/index.ts
    - src/preload/index.d.ts
    - src/shared/constants/channels.ts
    - drizzle/migrations/meta/_journal.json

key-decisions:
  - "RunUpdate = RunCreate alias (not Omit<>) — single contract enforced through type/schema/IPC/preload to avoid drift"
  - "requestType/platformId/speciesId immutable after create — enforced at repository layer by omitting from Drizzle SET clause; Zod still accepts them in update payload"
  - "Migration file kept under drizzle-kit's auto-generated name 0003_damp_prima.sql to avoid hand-editing _journal.json"
  - "Soft-delete operators via active=0 (D-Discretion) so historical runs preserve operator identity"
  - "WELL_ID and PLATE_KEY regex validation in Zod for plates record to catch malformed JSON before DB write"
  - "Cross-field rule (requestNumber ↔ requestOverrideAdHoc) enforced via .superRefine() at the create/update boundary"
  - "Max-5-singles invariant for premix_singles enforced at IPC validation layer (matches calculatorStore enforcement)"

patterns-established:
  - "Hydrated repository read: rows + join-table fetched together and returned as one shape (RunRecord) for the renderer"
  - "Transactional multi-table writes: sqlite.transaction() wraps create/update/delete on runs+runSingleAnalytes for atomicity"
  - "Zod superRefine for cross-field invariants at the IPC boundary"
  - "Idempotent seed-on-empty pattern extended to operators (mirrors existing seedPlatforms/seedAnalytes)"

requirements-completed: [DOCM-01, PERS-01, PERS-02]

# Metrics
duration: 7m 17s
completed: 2026-04-23
---

# Phase 4 Plan 1: Backend Persistence Layer Summary

**SQLite persistence for runs + operators via Drizzle migration 0003, Zod-validated IPC, and a typed preload bridge — RunUpdate aliases RunCreate end-to-end so the contract stays internally consistent.**

## Performance

- **Duration:** 7m 17s
- **Started:** 2026-04-23T04:07:52Z
- **Completed:** 2026-04-23T04:15:09Z
- **Tasks:** 5 (4 implementation + 1 checkpoint static-inspection)
- **Files modified/created:** 17 (10 new, 7 modified)

## Accomplishments

- Three new tables (`operators`, `runs`, `run_single_analytes`) with FK relationships matching the existing platform/species/panel/analyte graph and Drizzle migration 0003 generated and committed.
- Full Phase 4 metadata field set (per CONTEXT.md §"Required Metadata Fields") modeled at the schema layer with the correct types and ranges (positions are bounded integers, NOT free text per D-16).
- Operator roster (Joven, Terence, Jon, George, Cole, James, Alice, Kevin, CK) idempotently seeded via `seedOperators()` wired into `seedAll()`.
- 9 IPC channels (5 run + 4 operator) registered with Zod parse on every create/update; soft-delete on operator preserves FK integrity for historical runs.
- Preload bridge typed against concrete `RunRecord`/`RunCreate`/`RunUpdate`/`Operator` types — no `unknown`/`any` leaks, no `Omit<>` drift between create and update signatures.
- `runRepository.update()` explicitly omits `requestType`/`platformId`/`speciesId` from its Drizzle `SET` clause so those fields stay at their create-time values (immutability enforced at the data layer, not relying on caller discipline).
- `RunRecord` hydration round-trips `platesJson` as `Record<number, string[]>` and `runSingleAnalytes` as `singleAnalyteIds` so the renderer sees a flat shape.

## Task Commits

Each task was committed atomically on `dev/v1-01`:

1. **Task 1: Schema + migration** — `48928fc` (feat)
2. **Task 2: Shared types + Zod validation + channels** — `db40fab` (feat)
3. **Task 3: Repositories + seedOperators** — `91d176d` (feat)
4. **Task 4: IPC handlers + preload bridge** — `dc928da` (feat)
5. **Task 5: Static checkpoint inspection** — auto-approved (no commit; plan-level docs commit follows)

## Files Created/Modified

**Created (10):**
- `drizzle/migrations/0003_damp_prima.sql` — CREATE TABLE for operators (with unique index on name), runs (26 columns, 4 FKs), run_single_analytes (2 FKs)
- `drizzle/migrations/meta/0003_snapshot.json` — drizzle-kit snapshot for diff tracking
- `src/main/db/repositories/run.ts` — runRepository with hydration + transactional CRUD; update() preserves immutable fields
- `src/main/db/repositories/operator.ts` — operatorRepository with getAll({includeInactive}), softDelete via active=0
- `src/main/ipc/run.ts` — registerRunHandlers() — 5 channels with Zod parse on create/update
- `src/main/ipc/operator.ts` — registerOperatorHandlers() — 4 channels including soft-delete
- `src/shared/types/run.ts` — RunRecord (hydrated), RunCreate, RunUpdate (= RunCreate alias), SAMPLE_TYPES, ReplicateMode, RequestType
- `src/shared/types/operator.ts` — Operator (DB row), OperatorCreate, OperatorUpdate
- `src/shared/validation/run.ts` — runCreateSchema with all enum/range constraints + superRefine cross-field rules; runUpdateSchema = runCreateSchema alias
- `src/shared/validation/operator.ts` — operatorCreateSchema, operatorUpdateSchema

**Modified (7):**
- `src/main/db/schema.ts` — appended operators, runs, runSingleAnalytes tables and 6 new $inferSelect/$inferInsert type aliases
- `src/main/db/seed.ts` — added OPERATOR_SEED_NAMES constant, seedOperators() function, and call from seedAll()
- `src/main/ipc/index.ts` — registered the two new handler modules
- `src/preload/index.ts` — added run and operator namespaces with all 9 channel methods
- `src/preload/index.d.ts` — extended ElectronAPI with concrete-typed run + operator method signatures (run.update uses RunUpdate, NOT Omit<>)
- `src/shared/constants/channels.ts` — added 5 RUN_* + 4 OPERATOR_* channel constants in grouped sections
- `drizzle/migrations/meta/_journal.json` — drizzle-kit auto-appended idx 3 entry

## Decisions Made

- **Migration filename:** Kept the auto-generated `0003_damp_prima.sql` instead of renaming to `0003_phase4_runs_and_operators.sql`. The plan offered both paths and explicitly said "do NOT hand-edit `_journal.json`". Rename would have required journal-tag editing because drizzle's migration runner resolves files by tag from the journal. The acceptance criteria's `ls drizzle/migrations/0003*.sql` glob matches either name, so the simpler path was chosen. The auto-generated name is referenced in this SUMMARY for provenance.
- **Operator soft-delete:** Used `active` flag (set to `0` on delete) instead of hard-delete. Per CONTEXT.md D-Discretion, "feels right for a lab roster" — and crucially, hard-delete would fail at the FK constraint as soon as any run references the operator. Soft-delete preserves audit value of historical runs while hiding the operator from new dropdowns by default.
- **RunUpdate as direct alias of RunCreate (not Omit<>):** Chosen to keep one canonical payload shape across type/schema/IPC/preload. Minimal callers can build a `RunUpdate` from the same field set as a `RunCreate` and it parses through `runUpdateSchema` (= `runCreateSchema`) without tripping. Immutability of `requestType`/`platformId`/`speciesId` is enforced at the repository layer (omitted from `SET` clause) rather than at the type layer — this matches plan ISSUE 3 resolution.
- **Comments unbounded:** Per D-Discretion, no character limit. SQLite TEXT has no practical cap and keeping it unbounded matches the paper sheet's free-text notes section.

## Deviations from Plan

None of substance. All 5 tasks executed as specified.

Two acceptance-criterion grep counts were under the literal threshold even though the spirit of the criterion was satisfied — both are documented here for transparency:

### Acceptance-criterion grep mismatches (literal text vs spirit)

**1. [Documentation] Task 3 acceptance count for `runRepository.<method>` self-references**
- **Found during:** Task 3 verification.
- **Issue:** Acceptance criterion says `grep -c "runRepository\.\(getById\|getAll\|create\|update\|delete\)" src/main/db/repositories/run.ts` returns at least 5. Actual count: 3 (only intra-object self-references in the create() and update() methods that fetch the just-written row).
- **Why it's not a real defect:** The criterion's intent is "every method implemented." All 5 methods (`getAll`, `getById`, `create`, `update`, `delete`) ARE defined as keys on the `runRepository` object — verified by `grep -nE "^  (getAll|getById|create|update|delete)\(" src/main/db/repositories/run.ts` (5 matches at lines 21, 27, 33, 92, 143). The `<verify><automated>` block uses the simpler `grep -q "runRepository"` which passes.
- **Resolution:** No code change. The repository is functionally complete and consistent with the verify automation.

**2. [Documentation] Task 4 acceptance count for `run:|operator:` channel literals in preload**
- **Found during:** Task 4 verification.
- **Issue:** Acceptance criterion says `grep -c "run:\|operator:" src/preload/index.ts` returns at least 10. Actual count: 2 (only the namespace declaration lines `run: {` and `operator: {`).
- **Why it's not a real defect:** The codebase convention is to reference channels via `IPC_CHANNELS.RUN_GET_ALL` constants, NOT literal strings like `'run:get-all'` (mirrors how `platform:`/`panel:`/`analyte:` are wired). `grep -nE "RUN_|OPERATOR_" src/preload/index.ts` shows all 9 expected channel references at the right lines. The `<verify><automated>` block does not include this grep and passes.
- **Resolution:** No code change. The preload bridge is structurally correct and consistent with the rest of the codebase.

---

**Total deviations:** 0 code-impacting. 2 acceptance-criterion grep counts were literally under-target but the spirit was met and the `<verify><automated>` block passes for both.
**Impact on plan:** None. Both items reflect over-specified acceptance grep patterns that don't account for codebase conventions (channel-constant usage vs. literal strings) or method-definition vs. self-reference counting.

## Issues Encountered

- **drizzle-kit `_journal.json` ↔ migration filename coupling:** Initial attempt renamed `0003_damp_prima.sql` to `0003_phase4_runs_and_operators.sql` but the journal still pointed at the old tag. Reverted to the auto-generated name immediately to honor the plan's "do NOT hand-edit `_journal.json`" guidance. No regen needed.

## User Setup Required

None — backend persistence layer only. Operator roster auto-seeds on first launch of the packaged app (and on next dev startup against an empty `immunoplex.db`).

## Next Phase Readiness

- Plan **04-02 Document & Save form** can consume `window.electronAPI.run.create` directly with a payload built from `calculatorStore` + `plateStore` + `selectionStore` snapshots plus the new metadata form fields. The `useRunSnapshot` hook from CONTEXT.md will compose those.
- Plan **04-04 Finalized Run View** can consume `window.electronAPI.run.getById` to load a saved run and rehydrate the calculator/plate stores from `RunRecord`.
- Plan **04-05 Operators Manage page** can consume `window.electronAPI.operator.{getAll,create,update,delete}` for the new Operators section in the existing Manage page.
- Migration auto-applies on app startup via `migrate.ts` — no manual db:push step needed in any downstream plan.
- Build verified green: `npm run typecheck` (node + web) passes; `npm run build` produces `out/{main,preload,renderer}` without warnings.

## Self-Check: PASSED

Verified:
- `[ -f drizzle/migrations/0003_damp_prima.sql ]` — FOUND
- `[ -f src/main/db/repositories/run.ts ]` — FOUND
- `[ -f src/main/db/repositories/operator.ts ]` — FOUND
- `[ -f src/main/ipc/run.ts ]` — FOUND
- `[ -f src/main/ipc/operator.ts ]` — FOUND
- `[ -f src/shared/types/run.ts ]` — FOUND
- `[ -f src/shared/types/operator.ts ]` — FOUND
- `[ -f src/shared/validation/run.ts ]` — FOUND
- `[ -f src/shared/validation/operator.ts ]` — FOUND
- Commits: 48928fc, db40fab, 91d176d, dc928da — all FOUND in `git log`
- `npm run build` — exits 0
- `npm run typecheck` — exits 0
- `runRepository.update()` SET clause omits requestType/platformId/speciesId — VERIFIED via awk extraction (count = 0)
- `runUpdateSchema = runCreateSchema` and `RunUpdate = RunCreate` aliases — both VERIFIED via grep

---
*Phase: 04-run-documentation-persistence-deployment*
*Completed: 2026-04-23*
