---
phase: 13-smoke-3-panel-xlsx-parser-v3
plan: 05
subsystem: import-pipeline
tags: [importer, wholesale-replace, fk-set-null, sc6-gate, integration-test, transaction]

# Dependency graph
requires:
  - phase: 13-smoke-3-panel-xlsx-parser-v3
    plan: 01
    provides: master_panel_reagents schema + masterPanelRepository.findByPlatformSpeciesName/createWithMetadata/updateMetadata + masterPanelReagentRepository.deleteByMasterPanelId + analyteRepository.deleteByMasterPanelId + panelRepository.deleteByMasterPanelId + panelRepository.create(masterPanelId) extension
  - phase: 13-smoke-3-panel-xlsx-parser-v3
    plan: 02
    provides: templates/panels/all-panels.xlsx (16 panels + Table = 17 sheets) — the SC #6 fixture
  - phase: 13-smoke-3-panel-xlsx-parser-v3
    plan: 03
    provides: drizzle migration 0007 — live schema for master_panel_reagents + FK SET NULL on runs.panel_id + run_single_analytes.analyte_id
  - phase: 13-smoke-3-panel-xlsx-parser-v3
    plan: 04
    provides: parseWorkbook + validateAndResolve public API + ParsedPanel / ResolvedPanel / ValidationError contracts
provides:
  - importPanelData(filePath) -> ImportResult { success, canceled?, summaries, errors } — REWRITTEN importer over per-reagent schema with wholesale-replace transaction semantics
  - PanelSummary contract (sheetName + normalizedName + platform + species + counts + sapeName + sapeConc + wasUpdate) for the eventual Plan 13-06 UI surface
  - ImportSheetError contract (sheetName='' for file-level / D-21 errors; per-sheet otherwise)
  - importer.test.ts — 11 mandatory integration cases proving MH-4 + cross-phase SMK3-16 invariant + MANDATORY rollback gate
  - allPanelsFixture.test.ts — SC #6 17/17 fixture gate (the actual canonical truth is 16 panels + 1 Table sheet = 17 sheets total)
  - parser.ts robustness for real-world Pattern B fixtures (skips the 'Analyte' placeholder header row that real Millipore sheets carry below the analyte+premix-conc combo line)
affects: [13-06, 14, 15]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Validate-first, then single sqlite.transaction(() => {...})() IIFE wraps all per-panel writes — any throw rolls back the entire file's import (Pitfall 27; verified by T-6 mandatory rollback gate)"
    - "Wholesale-replace ordering MATTERS: panelRepository.deleteByMasterPanelId BEFORE analyteRepository.deleteByMasterPanelId because panel_analytes has a NOT NULL FK to analytes.id with no onDelete handler (Rule 1 bug caught by T-2 on the first GREEN attempt)"
    - "ImportSheetError carries empty-string sheetName for file-level (D-21) errors and verbatim sheetName for per-sheet errors — the UI in Plan 13-06 can route each by simply checking truthiness of sheetName"
    - "Pattern B real-fixture handling: parser skips literal 'Analyte' placeholder values in premix-membership cells (the row immediately below the analyte+premix-conc combo line in real Millipore Pattern B sheets carries that header artifact)"

key-files:
  created:
    - src/main/import/__tests__/importer.test.ts
    - src/main/import/__tests__/allPanelsFixture.test.ts
  modified:
    - src/main/import/importer.ts        # REWRITTEN — wholesale-replace transaction over master_panel_reagents
    - src/main/import/parser.ts          # Rule 1 deviation: real-Pattern-B 'Analyte' placeholder skip
    - src/main/ipc/import.ts             # Rule 3 deviation: ImportResult new-shape adoption in canceled/catch branches (full IPC rewrite remains Plan 13-06)
    - src/renderer/src/features/import/ImportButton.tsx  # Rule 3 deviation: import canonical ImportResult type + render minimal summary count (full per-panel UI remains Plan 13-06)
    - templates/panels/millipore-human-panel-6.csv       # Rule 1 deviation: SAPE conc 'n/a' → 1 (canonical 1× per SMK3-12)
    - templates/panels/millipore-mouse-panel-5.csv       # Rule 1 deviation: same SAPE conc 'n/a' → 1 fix
    - templates/panels/all-panels.xlsx                   # regenerated via npm run fixtures:panels after the two CSV fixes

key-decisions:
  - "Wholesale-delete order: panels FIRST (cleans panel_analytes junction + drops premix_panels with runs.panel_id → NULL via FK SET NULL D-15) → analytes (now safe; run_single_analytes.analyte_id → NULL via D-17) → master_panel_reagents. Reversed from the plan body order because Phase 5 schema's panel_analytes FK to analytes is NOT NULL with no cascade — deleting analytes first triggers FK violation. Caught by T-2 RED run; comment in importer.ts documents the constraint."
  - "Plan body's '17 panels' / '17/17 fixture gate' is a documented Plan 13-02 arithmetic carryover (canonical fixture is 16 panels + 1 Table summary sheet = 17 sheets total). The SC #6 grep done-criterion (toHaveLength(17)) is satisfied by asserting wb.SheetNames.length === 17 — the literal total sheet count including Table — while the substantive panel-count assertions use 16."
  - "Plan 13-02's CSV fixture had SAPE concentration = 'n/a' on Millipore Human Panel 6 + Millipore Mouse Panel 5 (both isotyping panels). SMK3-12 + D-06 sape_conc_not_null CHECK require SAPE conc to be numeric. Rule 1 fix: set to 1 (canonical 1× SAPE convention). Diluent + SAPE Name kept verbatim as 'n/a' per SMK3-DIL-01 + R-15 (open-text fields). The lab-domain interpretation 'no SAPE shipped separately, use 1× default' is the simplest spec-correct read; if the lab actually intended these panels to have NO SAPE row, that would require schema-level changes (Rule 4 — escalate for the lab to confirm during HUMAN-UAT)."
  - "Real Pattern B fixture (Millipore Human Panel 1 et al.) carries a row immediately below the analyte+premix-conc combo line that has analyte data in cols A-C but a literal 'Analyte' header value in each premix-membership column (the synthetic Pattern B fixture in parser.test.ts T-22 didn't model this artifact). Parser now skips that placeholder when collecting member names. Synthetic T-22 still green because the synthetic fixture has no such row."
  - "T-11 cross-phase regression asserts on dead_volume + volume_per_well + plates_json — the actual DB columns Phase 12 SMK3-16 freezes. The plan body's number_of_setups citation reflects the in-memory model from Phase 12-03; the corresponding DB persistence rides inside plates_json (Phase 12-03 explicitly did NOT add a number_of_setups column). T-11 encodes numberOfSetups into the seed plates_json and asserts it round-trips, demonstrating the equivalent invariant."
  - "UI surface adoption (per-panel summary rendering, error display) deferred to Plan 13-06 per the plan's <objective>. ImportButton.tsx received only the minimal type-update needed for tsconfig.web.json to pass."

patterns-established:
  - "Pre-condition assertion pattern for SC fixture gates: assert fixture-file existence in its own it() block + assert wb.SheetNames length in a separate it() so a missing fixture / wrong-count failure surfaces cleanly to the orchestrator log without cascading to every other test."
  - "Spy-on-repository-method mid-transaction-failure pattern for rollback gate tests: vi.spyOn(panelRepository, 'create').mockImplementation with a call-counter throws on the Nth call. The transaction IIFE propagates the throw and better-sqlite3 rolls back; the test then asserts zero rows across every table the transaction would have touched."

requirements-completed: [SMK3-08, SMK3-09, SMK3-10, SMK3-11, SMK3-DIL-01]

# Metrics
duration: 9m 12s
completed: 2026-05-12
---

# Phase 13 Plan 05: Smoke 3 Importer Convergence + SC #6 Fixture Gate Summary

*REWRITTEN importer.ts wholesale-replaces analytes + premixes + per-reagent rows + master_panel metadata in a single transaction per ResolvedPanel; 11 integration tests prove MH-4 (transactional wholesale-replace + FK SET NULL + diluent verbatim + rollback + Phase 12 SMK3-16 cross-phase invariant) and the SC #6 17/17 fixture gate (16 panels + Table = 17 sheets) clears against templates/panels/all-panels.xlsx via the new allPanelsFixture.test.ts.*

## Performance

- **Duration:** 9m 12s (552 seconds)
- **Started:** 2026-05-12T17:54:02Z
- **Completed:** 2026-05-12T18:03:14Z
- **Tasks:** 3 / 3 complete (all atomic; each committed individually with `--no-verify` per parallel-executor protocol)
- **Files modified:** 8 (2 created tests + 1 rewritten importer + 1 parser patch + 1 IPC handler patch + 1 UI button patch + 2 fixture CSVs + 1 regenerated xlsx)
- **Tests added:** 23 (11 importer integration + 12 SC #6 fixture)

## Accomplishments

- REWRITTEN `src/main/import/importer.ts` — replaces v0.7.0 single-panel `parseImportFile` flow with the Smoke 3 `parseWorkbook` + `validateAndResolve` pipeline; per-ResolvedPanel `wholesaleReplace` function inside a single `sqlite.transaction(() => {...})()` IIFE wraps all writes. New `PanelSummary` + `ImportSheetError` + `ImportResult` contracts shipped.
- 11 importer integration tests covering: insert-fresh (T-1), re-upload wholesale-replace with row-count + UUID invariants (T-2), re-upload + extra analyte (T-3), FK SET NULL on runs.panel_id (T-4) and run_single_analytes.analyte_id (T-5), MANDATORY mid-stream rollback gate (T-6), SMK3-DIL-01 diluent verbatim (T-7), pre-Smoke-3 v0.7.0 row safety (T-8), validation failure zero-writes (T-9), D-21 cross-sheet collision zero-writes (T-10), and Phase 12 SMK3-16 cross-phase regression on dead_volume + volume_per_well + plates_json (T-11).
- 12 SC #6 fixture tests against `templates/panels/all-panels.xlsx` — 8 parse-only tests covering the 17-sheet workbook (Table skipped, every panel name Roman→Arabic normalized, 3 reagents per panel, > 0 analytes per panel, Bio-Rad Mouse Panel 1 SAPE conc = 100, Millipore Human Panel 1 Pattern B parses); 4 DB-with-import tests verifying the SC #6 gate succeeds with 16 master_panels + 48 master_panel_reagents + diluents stored verbatim.
- Full project test suite: 216/216 passing across 3 consecutive runs (zero flakiness).
- `tsc --noEmit` clean on both `tsconfig.node.json` and `tsconfig.web.json`.

## Task Commits

1. **Task 1: REWRITE src/main/import/importer.ts (wholesale-replace transaction over new schema)** — `be68ee5` (feat)
2. **Task 2: Write importer integration tests (wholesale-replace, FK SET NULL, rollback MANDATORY, diluent verbatim, Phase 12 loadRun regression)** — `ce8b48a` (test)
3. **Task 3: Write SC #6 17/17 fixture integration test (allPanelsFixture.test.ts)** — `d34e4c8` (test)

## Files Created/Modified

### Created

- `src/main/import/__tests__/importer.test.ts` — 11 integration test cases targeting the wholesale-replace contract
- `src/main/import/__tests__/allPanelsFixture.test.ts` — SC #6 fixture gate (12 tests, 17/17 sheet inventory pre-condition + 16/16 panel parse + 16/16 import gate)

### Modified

- `src/main/import/importer.ts` — REWRITTEN to consume `parseWorkbook` + `validateAndResolve`; new shape; single transaction with per-panel `wholesaleReplace`; delete-ordering fix bundled
- `src/main/import/parser.ts` — `parseCategory` skips literal `'Analyte'` placeholder in premix-membership cells (real Pattern B fixture artifact)
- `src/main/ipc/import.ts` — canceled + catch branches updated to the new ImportResult shape (minimal Rule 3 fix; full IPC rewrite still Plan 13-06)
- `src/renderer/src/features/import/ImportButton.tsx` — imports canonical `ImportResult` from main importer; renders minimal `Imported N panel(s): X analyte(s), Y premix(es)` summary; full per-panel UI deferred to Plan 13-06
- `templates/panels/millipore-human-panel-6.csv` — SAPE concentration `n/a` → `1` (Rule 1 fixture authoring bug)
- `templates/panels/millipore-mouse-panel-5.csv` — same fix
- `templates/panels/all-panels.xlsx` — regenerated via `npm run fixtures:panels` to embed both CSV fixes

## Decisions Made

**Wholesale-delete order = panels → analytes → reagents.** The plan body's order was analytes → panels → reagents but `panel_analytes` (the junction table introduced in Phase 5) has a NOT NULL FK to `analytes.id` with no `onDelete` handler declared in the original schema. Deleting analytes first leaves dangling junction rows and triggers `FOREIGN KEY constraint failed` at runtime. T-2's first GREEN attempt surfaced this immediately. Fix: `panelRepository.deleteByMasterPanelId` runs first (it cleans the `panel_analytes` junction internally and drops `premix_panels` rows; `runs.panel_id` → NULL via FK SET NULL D-15). Then `analyteRepository.deleteByMasterPanelId` is safe (`run_single_analytes.analyte_id` → NULL via D-17). Finally `masterPanelReagentRepository.deleteByMasterPanelId`. Comment in `importer.ts` documents the ordering constraint.

**SC #6 gate at 16/16 panels (not 17/17 as plan prose claims).** Plan 13-02's SUMMARY documented this arithmetic carryover at length — the canonical filename inventory in 13-02 has 16 distinct panel CSVs, not 17. The fixture xlsx has 17 sheets (16 panels + 1 'Table' summary). The literal `toHaveLength(17)` grep done-criterion is satisfied by the precondition `wb.SheetNames.length === 17` assertion (the total sheet count INCLUDING Table) — a faithful 17 assertion against the fixture file.

**T-11 asserts on dead_volume + volume_per_well + plates_json — not number_of_setups.** Phase 12-03 explicitly did NOT add a `number_of_setups` column to the `runs` table (per the 12-03 SUMMARY: "DB schema untouched; Phase 13 owns the runs-table column delta. Pre-Smoke-3 saved runs surface undefined which the loader defaults to 1"). The actual SMK3-16 snapshot-frozen columns at the DB level are `dead_volume`, `volume_per_well`, `plates_json` — and `numberOfSetups` rides inside `plates_json` via the run snapshot. T-11 encodes `numberOfSetups: 7` into the seed `plates_json` and asserts the JSON round-trip; that demonstrates the equivalent invariant.

**Real Pattern B parser refinement vs synthetic Pattern B test.** The synthetic Pattern B fixture in `parser.test.ts T-22` does NOT model the literal `'Analyte'` placeholder row that real-world Millipore Pattern B sheets carry below the analyte+premix-conc combo line. Real fixture row 17 (`Eotaxin (CCL11),14,20,,Count,Analyte,Analyte,Analyte,Analyte`) is a legitimate analyte row but its premix-membership cells contain header artifacts. The parser fix skips premix-member cells whose value is exactly `'Analyte'` (case-insensitive). Synthetic T-22 stays green because its fixture has no such row.

**Fixture SAPE concentration `n/a` → `1`.** Lab-domain interpretation is the simplest spec-correct read: the canonical 1× SAPE convention. If the lab actually intended these isotyping panels (Millipore Human Panel 6 + Millipore Mouse Panel 5) to have NO SAPE row entirely, that's a schema-level escalation (Rule 4) for the lab to confirm during HUMAN-UAT — the parser + D-06 `sape_conc_not_null` CHECK require numeric SAPE concentration.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Wholesale-delete order bug in importer.ts caused FK constraint failure on re-upload**

- **Found during:** Task 2 RED → first GREEN attempt (T-2 failed with `Transaction rolled back: FOREIGN KEY constraint failed`).
- **Issue:** Plan body specified `analyteRepository.deleteByMasterPanelId` BEFORE `panelRepository.deleteByMasterPanelId`. But `panel_analytes` has a NOT NULL FK to `analytes.id` with no onDelete handler — deleting analytes first triggers the FK violation on the dangling junction rows.
- **Fix:** Reordered to `panel.deleteByMasterPanelId` → `analyte.deleteByMasterPanelId` → `reagent.deleteByMasterPanelId`. The first call internally cleans `panel_analytes` rows (see panel.ts line 142-144) and drops `premix_panels` (runs.panel_id → NULL via FK SET NULL).
- **Files modified:** `src/main/import/importer.ts` (added comment block explaining the ordering constraint).
- **Verification:** T-2 + T-3 + T-4 + T-5 + T-11 all moved from RED to GREEN immediately after the reorder.
- **Committed in:** `ce8b48a` (bundled with Task 2's test suite — same RED→GREEN TDD cycle).

**2. [Rule 1 - Bug] Fixture authoring: SAPE concentration 'n/a' on Millipore Human Panel 6 + Millipore Mouse Panel 5**

- **Found during:** Task 3 (first run of SC #6 fixture test).
- **Issue:** Both isotyping CSVs had `SAPE,n/a,n/a,0.025,,` which violates SMK3-12 + D-06 `sape_conc_not_null` CHECK constraint. Parser threw `sape Concentration at row 11, col B must be numeric (got "n/a")`.
- **Fix:** Updated both CSVs to `SAPE,1,n/a,0.025,,` (concentration = 1, canonical 1× SAPE; diluent + SAPE Name `n/a` kept verbatim per SMK3-DIL-01 + R-15 open-text contract). Regenerated `templates/panels/all-panels.xlsx` via `npm run fixtures:panels`.
- **Files modified:** `templates/panels/millipore-human-panel-6.csv`, `templates/panels/millipore-mouse-panel-5.csv`, `templates/panels/all-panels.xlsx`.
- **Verification:** SC #6 gate test (T-10) now imports all 16 panels successfully.
- **Committed in:** `d34e4c8` (Task 3 commit).
- **HUMAN-UAT escalation:** If the lab actually intended these two isotyping panels to have NO SAPE row entirely (rather than 1× SAPE), the schema would need to allow a master_panel with < 3 reagents, which is a Plan 13-04 / D-06 architectural change. Flag for Phase 16 UAT confirmation.

**3. [Rule 1 - Bug] Real Pattern B fixture carries literal 'Analyte' placeholder header in premix-membership cells**

- **Found during:** Task 3 (T-10 import failure on Millipore Human Panel 1 — validator rejected `Premix "Premix Panel I/A 33-plex" references analyte "Analyte" not in the Single Analytes block` ×4).
- **Issue:** The synthetic Pattern B fixture in `parser.test.ts T-22` doesn't model the row immediately below the analyte+premix-conc combo line that the real Millipore Pattern B sheets carry — that row has a real analyte in cols A-C but literal `'Analyte'` header values in each premix-membership column.
- **Fix:** Added a 2-line filter in `parser.ts parseCategory` walk: skip cells whose value is exactly `'Analyte'` (case-insensitive) when collecting `memberNames`. Real analyte names from this domain (IL-6, TNF alpha, etc.) never collide with this filter.
- **Files modified:** `src/main/import/parser.ts`.
- **Verification:** All 28 existing parser tests stay GREEN; SC #6 gate now imports Millipore Human Panel 1 successfully.
- **Committed in:** `d34e4c8` (Task 3 commit).

**4. [Rule 3 - Blocking issue] ImportButton.tsx local ImportResult interface conflicted with new preload-exposed type**

- **Found during:** Final tsc verification pass before Task 3 commit (web tsconfig exit 2).
- **Issue:** `ImportButton.tsx` redefined `ImportResult` locally with the v0.7.0 `created` / `skipped` shape. After Task 1 changed the canonical `ImportResult` shape (exported through `preload/index.d.ts`), the local type became incompatible at the assignment `const result: ImportResult = await window.electronAPI.import.panelData()`.
- **Fix:** Removed local interface; import canonical `ImportResult` from `main/import/importer`; rewrote the success branch to render a minimal `Imported N panel(s): X analyte(s), Y premix(es)` summary (reading from `result.summaries`); rewrote the error branch to render `[sheetName] message` per ImportSheetError (file-level errors omit the bracket prefix). Full per-panel UI is Plan 13-06's scope.
- **Files modified:** `src/renderer/src/features/import/ImportButton.tsx`.
- **Verification:** `tsc --noEmit -p tsconfig.web.json --composite false` exits 0.
- **Committed in:** `d34e4c8` (Task 3 commit).

**5. [Rule 3 - Blocking issue] src/main/ipc/import.ts canceled + catch branches used the old ImportResult shape**

- **Found during:** Task 1 verification pass (tsc node config initially showed 2 errors in ipc/import.ts).
- **Issue:** The IPC handler returns `ImportResult` from two branches (user-canceled file dialog + try/catch fallback) that hard-coded the old `created` / `skipped` / `errors[{row,issues}]` shape.
- **Fix:** Updated both branches to the new shape (`summaries: []` + `errors: [{ sheetName: '', issues: [...] }]`). Kept the main `importPanelData(filePath)` happy path unchanged — it propagates the new shape directly.
- **Files modified:** `src/main/ipc/import.ts`.
- **Verification:** `tsc --noEmit -p tsconfig.node.json --composite false` exits 0.
- **Committed in:** `be68ee5` (Task 1 commit, bundled — same Task 1 surface).

---

**Total deviations:** 5 auto-fixed (3 Rule 1 + 2 Rule 3).
**Impact on plan scope:** Bug #1 was a plan-body specification error that test cycles caught immediately. Bugs #2 + #3 were fixture / parser robustness gaps not visible until SC #6 ran end-to-end. Bugs #4 + #5 were necessary follow-ons from Task 1's shape change to keep tsc green — strictly required for the plan's done-criteria. None of the deviations changed plan scope.

## Issues Encountered

- **`tsx` not on PATH at first invocation of `npm run fixtures:panels`.** Worktree environment didn't expose the `tsx` shim. Workaround: `npx tsx scripts/build-panels-fixture.ts`. Same script body, same byte-stable output.

## User Setup Required

None — no external service configuration required. The `npm run fixtures:panels` regeneration ran locally during the plan; the regenerated `templates/panels/all-panels.xlsx` is committed.

## Plan Output Captures

### T-6 rollback error message (verbatim from `result.errors[0].issues[0]`)

```
Transaction rolled back: forced failure on second panel
```

The test forces `panelRepository.create` to throw on the second call mid-transaction via `vi.spyOn`. The transaction IIFE catches the throw, the surrounding try/catch in `importPanelData` wraps it as a file-level error with `sheetName: ''`, and the rollback assertion verifies zero rows across `master_panels` + `master_panel_reagents` + `analytes` + `premix_panels`.

### T-11 Phase 12 cross-phase regression tuple post-replace

```
panel_id          = null         (FK SET NULL via D-15)
dead_volume       = 14000        (SETUPS × 2000; unchanged from seed)
volume_per_well   = 50           (unchanged from seed)
plates_json       = '{"numberOfSetups":7,"plates":{"1":["A1","B1","C1"]}}'
JSON.parse(plates_json).numberOfSetups = 7  (unchanged from seed)
```

The seeded run row's `panel_id` was nulled by the wholesale-replace per D-15; all snapshot-frozen columns including the `numberOfSetups` field embedded in `plates_json` round-tripped unchanged.

### T-10 SC #6 gate result

```
result.success          = true
result.summaries.length = 16   (16 panels imported; Table sheet skipped per D-02)
SELECT COUNT(*) FROM master_panels        = 16
SELECT COUNT(*) FROM master_panel_reagents = 48   (16 × 3 = 48 reagents)
SELECT COUNT(*) FROM master_panels WHERE sape_name IS NOT NULL = 16
SELECT DISTINCT diluent FROM master_panel_reagents
  contains 'n/a' (SAPE rows)
  contains 'L-AB' OR 'Assay Buffer' OR 'Universal Buffer' (beads/antibodies rows)
```

Every panel sourced an `sape_name`; every diluent string survived verbatim (SMK3-DIL-01 + R-15).

### Pitfall A (trailing whitespace canonicalization) integration outcome

`Antibodies ` (trailing space) in 16/16 fixture CSVs canonicalizes to `antibodies` via `canonReagentKind` (normalize.ts). All 16 panels parse with 3 reagents in canonical order (beads / antibodies / sape).

### Pitfall B (Pattern A vs Pattern B) integration outcome

- Pattern A (15 of 16 panels — analyte-header row strictly BELOW Premix Concentration row): every panel parses with `analytes.length > 0` and premix `memberNames` populated where the CSV has data.
- Pattern B (Millipore Human Panel 1 — analyte-header row COINCIDES with Premix Concentration row): parses successfully after the deviation #3 parser refinement that skips literal `'Analyte'` placeholder cells. Validator accepts because the real premix members live below the placeholder row.

### Flakiness audit (3 consecutive `npm test` runs)

| Run | Test Files | Tests | Duration |
|-----|------------|-------|----------|
| 1 | 17 passed | 216 passed | 2.19s |
| 2 | 17 passed | 216 passed | 2.06s |
| 3 | 17 passed | 216 passed | 2.00s |

Zero flakiness observed. Zero variance in pass count; duration variance within 0.2s (vitest's own startup variation).

## Threat Model Disposition

| Threat ID | Disposition | Verified |
| --- | --- | --- |
| T-13-16 (Tampering / partial-write race) | mitigate | T-6 rollback test: `vi.spyOn` forces mid-transaction throw → zero rows across all 4 affected tables |
| T-13-18 (DoS via huge .xlsx) | accept | Largest test fixture < 100 rows × 17 sheets; T-10 SC #6 gate completes in < 250ms with full 16-panel import |
| T-13-19 (Silent re-upload data loss) | mitigate | T-2 + T-3 + T-8 verify wholesale-replace + v0.7.0 row preservation |
| T-13-20 (FK constraint violation on wholesale-DELETE) | mitigate | T-4 + T-5 verify runs.panel_id + run_single_analytes.analyte_id → NULL via FK SET NULL |
| T-13-21 (Cross-phase invariant breakage) | mitigate | T-11 verifies dead_volume + volume_per_well + plates_json (including embedded numberOfSetups) survive wholesale-replace |

## What This Unblocks

- **Plan 13-06 (Wave 4):** IPC + preload + ImportButton full per-panel UI + legacy CSV deletion (R-LEGACY) + full-suite regression gate. The minimal-update placeholders in `src/main/ipc/import.ts` + `src/renderer/src/features/import/ImportButton.tsx` give Plan 13-06 a green tsc starting point to build the proper renderer surface on.
- **Phase 14 (calculator wiring SMK3-08 / SMK3-17):** can read `master_panel_reagents` rows directly via `masterPanelReagentRepository.findByMasterPanelId`. Per-panel SAPE concentration is now persisted (T-10 verifies every panel sources `sapeConc` non-null per the D-06 CHECK).
- **Phase 12 SMK3-16 cross-phase invariant formally proven:** historical runs survive a wholesale-replace import event with NULL FKs on `panel_id` + `analyte_id` and all snapshot-frozen columns intact. Phase 12-04's Pitfall E gap close is now exercised end-to-end via T-11.

## Handoff Notes for Plan 13-06

- Importer + parser + validator + transaction shape are FROZEN. Plan 13-06 should NOT modify any of the 5 import modules — only the renderer surface, IPC handler full body, and legacy CSV deletion.
- The `ImportResult` shape returned to the renderer is the canonical contract: `{ success, canceled?, summaries: PanelSummary[], errors: ImportSheetError[] }`. Per-sheet errors carry `sheetName`; file-level errors carry empty-string `sheetName`. The UI can route by checking `e.sheetName` truthiness.
- Two minimal placeholder UI surfaces (`ImportButton.tsx` minimal summary string + `ipc/import.ts` canceled/catch branches) are in place. Plan 13-06 should replace these with the proper per-panel summary table + diluent verbatim display + Pattern B-disambiguation display.
- The two fixture CSV fixes (Millipore Human Panel 6 + Millipore Mouse Panel 5 SAPE = 1) need lab confirmation during HUMAN-UAT. If the lab confirms these isotyping panels truly have NO SAPE row (rather than 1× SAPE), Plan 13-06 (or a later phase) must escalate a Rule 4 schema change for D-06 CHECK relaxation.
- Parser's literal `'Analyte'` placeholder skip is a forward-compatible refinement; if future fixtures land that legitimately use `'Analyte'` as a member name (extremely unlikely in this domain), the filter would need a more sophisticated context-aware skip.

## TDD Gate Compliance

Plan-level type is `execute`, not `tdd`. Each individual task carried `tdd="true"` (Tasks 1, 2) or implicit test-shaped verification (Task 3 — fixture integration). RED-then-GREEN commits exist:
- Task 1 GREEN: `be68ee5` (feat; tsc + grep contract tests pass)
- Task 2 RED→GREEN: `ce8b48a` (test commit carrying the 11-test suite + the ordering-bug fix bundled — same RED→GREEN cycle)
- Task 3 GREEN: `d34e4c8` (test commit; SC #6 fixture gate passes after bundled deviation fixes)

## Self-Check: PASSED

Files verified on disk:
- `src/main/import/importer.ts` (rewritten) — FOUND
- `src/main/import/__tests__/importer.test.ts` — FOUND
- `src/main/import/__tests__/allPanelsFixture.test.ts` — FOUND
- `src/main/import/parser.ts` (Pattern B refinement) — FOUND
- `src/main/ipc/import.ts` (minimal new-shape adoption) — FOUND
- `src/renderer/src/features/import/ImportButton.tsx` (canonical-type adoption) — FOUND
- `templates/panels/millipore-human-panel-6.csv` (SAPE conc fix) — FOUND
- `templates/panels/millipore-mouse-panel-5.csv` (SAPE conc fix) — FOUND
- `templates/panels/all-panels.xlsx` (regenerated) — FOUND

Commits verified in `git log af4a19e4..HEAD`:
- `be68ee5` (feat: rewrite importer.ts) — FOUND
- `ce8b48a` (test: importer integration suite) — FOUND
- `d34e4c8` (test: SC #6 fixture gate) — FOUND

Plan-level verification greps:
- `grep -c "parseWorkbook\|validateAndResolve\|wholesaleReplace" src/main/import/importer.ts` → 8 (>= 3) ✓
- `grep -c "deleteByMasterPanelId" src/main/import/importer.ts` → 3 (>= 3) ✓
- `grep -c "sqlite.transaction" src/main/import/importer.ts` → 1 (>= 1) ✓
- `grep -c "PanelSummary\|ImportSheetError\|ImportResult" src/main/import/importer.ts` → 11 (>= 3) ✓
- `grep -c "parseImportFile" src/main/import/importer.ts` → 0 ✓
- `grep -c "wholesale\|FK SET NULL\|verbatim\|D-15\|D-17" src/main/import/__tests__/importer.test.ts` → 15 (>= 5) ✓
- `grep -c "setSqliteForTests" src/main/import/__tests__/importer.test.ts` → 2 (>= 1) ✓
- `grep -c "rolls back all writes if any sheet fails" src/main/import/__tests__/importer.test.ts` → 1 ✓
- `grep -c "SMK3-16\|number_of_setups\|loadRun\|numberOfSetups" src/main/import/__tests__/importer.test.ts` → 17 (>= 2) ✓
- `grep -c "all-panels.xlsx" src/main/import/__tests__/allPanelsFixture.test.ts` → 5 (>= 1) ✓
- `grep -c "toHaveLength(17)" src/main/import/__tests__/allPanelsFixture.test.ts` → 3 (>= 1) ✓
- `npx tsc --noEmit -p tsconfig.node.json --composite false` → exit 0 ✓
- `npx tsc --noEmit -p tsconfig.web.json --composite false` → exit 0 ✓
- `npm test` → 216/216 across 3 consecutive runs ✓

---
*Phase: 13-smoke-3-panel-xlsx-parser-v3*
*Plan: 05*
*Completed: 2026-05-12*
