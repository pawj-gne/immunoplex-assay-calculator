---
phase: 13-smoke-3-panel-xlsx-parser-v3
verified: 2026-05-12T11:30:00Z
status: human_needed
score: 6/6 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Visual verification of ImportButton banner in running Electron app"
    expected: "On successful import, banner shows headline 'Imported N panels (X new, Y updated).' with per-sheet detail lines listing platform/species/normalizedName/counts/SAPE info. On failure, banner shows grouped error display with [file-level] or [sheetName] prefixes and '; no data written.' tail."
    why_human: "App is Windows-only for deployment; cannot run Electron UI in macOS Claude Code SDK environment (ELECTRON_RUN_AS_NODE issue). ImportButton.tsx banner rendering is type-checked and logic-verified but visual + UX correctness requires running the app on Windows (Phase 16 UAT gate)."
---

# Phase 13: Smoke 3 — Panel XLSX Parser v3 Verification Report

**Phase Goal:** A new parser accepts the lab's actual xlsx format (sectioned `Criteria` / `Values` / `Category` per sheet with per-reagent rows and a Premix matrix) and writes per-reagent rows into a revised master_panels schema. Re-upload of a (Platform, Species, Panel) wholesale-replaces. Roman panel numerals normalize to Arabic at parse time. Master `Table` tab is ignored. Legacy CSV templates deleted.
**Verified:** 2026-05-12T11:30:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (from ROADMAP.md Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Parser reads multi-tab xlsx, ignores `Table` sheet, emits typed `ResolvedPanel[]` | ✓ VERIFIED | `parseWorkbook` in `src/main/import/parser.ts`; `allPanelsFixture.test.ts` T-1 asserts `parseWorkbook(FIXTURE_PATH)` returns 16 panels (Table skipped per D-02); 28 parser unit tests green |
| 2 | Each parsed sheet exposes panel metadata + per-reagent rows + Premix matrix + Single Analytes list | ✓ VERIFIED | `ParsedPanel` type in `parser.ts` exports `sheetName, platform, species, panelNameNormalized, panelDescription, sapeName, reagents (3), premixes, analytes`; T-5 asserts every panel has exactly 3 reagent rows; T-6 asserts > 0 analytes; 28 parser tests cover Criteria/Values/Category block parsing |
| 3 | Roman → Arabic normalization: `Panel I` → `Panel 1`, `II` → `2`, …; lab can author either form | ✓ VERIFIED | `normalize.ts` exports `normalizePanelName` with explicit `ROMAN_TO_ARABIC` lookup table (I..X); `allPanelsFixture.test.ts` T-3 + T-4 assert `Thermofisher Human Panel I` and `Thermofisher Mouse Panel I` sheets normalize to `Panel 1`; 31 normalize unit tests green |
| 4 | Re-upload of (Platform, Species, Panel) wipes existing analytes + premixes + per-reagent rows + metadata in a single transaction; orphan preservation removed | ✓ VERIFIED | `importer.ts` uses `sqlite.transaction()` IIFE wrapping all per-panel writes; `importer.test.ts` T-2 proves re-upload preserves master_panel.id while generating new analyte UUIDs; T-4/T-5 verify FK SET NULL on `runs.panel_id` and `run_single_analytes.analyte_id`; T-6 mandatory rollback test confirms zero partial writes on failure |
| 5 | Legacy `templates/panel-template.csv` and `sample-panel-import.csv` deleted; v0.7.0 `parser.ts` replaced; import surface accessible from Manage page | ✓ VERIFIED | `ls templates/panel-template.csv` → No such file; `ls templates/sample-panel-import.csv` → No such file; `grep -rn "panel-template.csv\|sample-panel-import.csv" src/ scripts/` → 0 matches; `parser.ts` rewritten (30 exports, no `parseImportFile` reference) |
| 6 | The 16 vendor panel CSVs at `templates/panels/` all parse successfully (17 sheets including Table) | ✓ VERIFIED | `allPanelsFixture.test.ts` T-10 (`SC #6 GATE`) asserts `result.summaries.toHaveLength(16)` + `master_panels COUNT = 16` + `master_panel_reagents COUNT = 48 (16×3)`; SC #6 description says "17 CSVs" counting `_table.csv`; 16 parse, 1 (Table) is correctly skipped |

**Score:** 6/6 truths verified

### Note on SC #6 "17 CSVs" vs 16 parsed panels

The ROADMAP SC #6 says "The 17 CSVs at `templates/panels/`" — this counts 16 vendor panel CSVs plus `_table.csv` = 17 total CSV files. The `_table.csv` generates the `Table` sheet which is correctly skipped by the parser (D-02). The implementation correctly produces 16 `ResolvedPanel` objects and the fixture workbook has 17 sheets. `allPanelsFixture.test.ts` asserts both the 17-sheet total (`wb.SheetNames.toHaveLength(17)`) AND the 16-panel parsed count, satisfying the SC intent.

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/main/db/schema.ts` | Extended with `masterPanelReagents` table + master_panels delta + FK tightening | ✓ VERIFIED | `masterPanelReagents = sqliteTable` confirmed (grep=1); 2 CHECK constraints (reagent_kind_enum + sape_conc_not_null); 0 legacy volume columns; `sape_name` + `description` present; `master_panels_platform_species_name_uniq` UNIQUE; 4+ `onDelete: 'set null'` FKs |
| `src/shared/types/masterPanelReagent.ts` | `ReagentKind` + `MasterPanelReagent` + `MasterPanelReagentCreate` types | ✓ VERIFIED | File exists (3,136 bytes); exports all 3 types; `concentration: number | null` present for D-07 nullable sentinel |
| `src/main/db/repositories/masterPanelReagent.ts` | CRUD + deleteByMasterPanelId | ✓ VERIFIED | File exists; `masterPanelReagentRepository` with `create`, `findByMasterPanelId`, `deleteByMasterPanelId`, `getById` (grep count = 1 for deleteByMasterPanelId) |
| `drizzle/migrations/0007_deep_scarlet_spider.sql` | Single atomic migration covering all Phase 13 schema delta | ✓ VERIFIED | File exists; grep confirms `master_panel_reagents` (4 hits), `ON DELETE SET NULL` (2 hits), `DROP COLUMN beads_volume_per_well` (1 hit), `master_panels_platform_species_name_uniq` (1 hit) |
| `src/main/import/normalize.ts` | Roman→Arabic + canonReagentKind pure helpers | ✓ VERIFIED | File exists (3,136 bytes); `normalizePanelName` + `canonReagentKind` + `isSapeNameLabel` exported; ROMAN_TO_ARABIC lookup I..X; 31 unit tests |
| `src/main/import/parser.ts` | REWRITTEN — multi-tab block parser (Criteria/Values/Category) | ✓ VERIFIED | File exists (14,524 bytes); exports `parseWorkbook`, `parseSheet`, `ParsedPanel`, `ParseError`; 28 unit tests green |
| `src/main/import/validator.ts` | REWRITTEN — multi-sheet aggregation + D-21 cross-sheet collision | ✓ VERIFIED | File exists (4,198 bytes); exports `validateAndResolve`, `ResolvedPanel`, `ValidationError`; 12 unit tests green |
| `src/main/import/importer.ts` | REWRITTEN — wholesale-replace transaction over master_panel_reagents | ✓ VERIFIED | `parseWorkbook\|validateAndResolve\|wholesaleReplace` (8 occurrences); `deleteByMasterPanelId` (6 occurrences); `sqlite.transaction` (1 occurrence); `PanelSummary\|ImportSheetError\|ImportResult` (11 occurrences) |
| `src/main/import/__tests__/importer.test.ts` | 11 integration tests: wholesale-replace + FK SET NULL + rollback + diluent + Phase 12 regression | ✓ VERIFIED | File exists (17,526 bytes); T-6 rollback test present (grep=1); SMK3-16/numberOfSetups (17 occurrences); `setSqliteForTests` (2 occurrences) |
| `src/main/import/__tests__/allPanelsFixture.test.ts` | SC #6 17/17 fixture gate (16 panels + Table) | ✓ VERIFIED | File exists (7,909 bytes); `toHaveLength(17)` for sheet count (3 assertions); T-10 SC #6 GATE passes with 16 summaries + 48 reagents |
| `templates/panels/all-panels.xlsx` | 17-sheet workbook (16 panels + Table) — Plan 02 SC #6 fixture | ✓ VERIFIED | File exists (201,143 bytes); `node -e` confirms 17 total sheets, 16 panel sheets |
| `scripts/build-panels-fixture.ts` | CSV→XLSX generator | ✓ VERIFIED | File exists (4,226 bytes); 2 occurrences of `XLSX.utils.aoa_to_sheet` |
| `src/preload/index.d.ts` | PanelSummary + ImportSheetError + ImportResult types (renderer-side) | ✓ VERIFIED | `summaries\|PanelSummary` count = 2 (≥ 2); `created:\|skipped:` count = 0 (old shape removed) |
| `src/renderer/src/features/import/ImportButton.tsx` | Banner updated for new ImportResult shape | ✓ VERIFIED | `result.summaries` count = 4; `wasUpdate` count = 3; `no data written` count = 2; `result.created\|result.skipped` count = 0 |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `importer.ts` | `parser.ts` + `validator.ts` | `parseWorkbook` + `validateAndResolve` imports | ✓ WIRED | 8 occurrences of `parseWorkbook\|validateAndResolve\|wholesaleReplace` in importer.ts |
| `importer.ts` | `masterPanelReagent.ts` repo | `masterPanelReagentRepository` import | ✓ WIRED | 6 occurrences of `deleteByMasterPanelId` in importer.ts confirms 3 repo delete calls |
| `schema.ts` | `masterPanelReagent.ts` types | `$inferSelect / $inferInsert` type inference | ✓ WIRED | `src/shared/types/masterPanelReagent.ts` exports `MasterPanelReagent` + `MasterPanelReagentCreate`; repo imports both types |
| `ipc/import.ts` | `importer.ts` | `importPanelData` + `ImportResult` import | ✓ WIRED | 4 occurrences in ipc/import.ts; 2 references to `importPanelData` |
| `ImportButton.tsx` | `preload/index.d.ts` | `window.electronAPI.import.panelData()` return type | ✓ WIRED | `preload/index.d.ts` declares `PanelSummary + ImportResult`; ImportButton renders `result.summaries` |
| `allPanelsFixture.test.ts` | `templates/panels/all-panels.xlsx` | `path.resolve(__dirname, '../../../templates/panels/all-panels.xlsx')` | ✓ WIRED | 5 occurrences of `all-panels.xlsx` in test file; fixture file confirmed present at 201,143 bytes |
| `migration 0007` | `schema.ts` (Plan 01) | `drizzle-kit generate` diff | ✓ WIRED | Migration filename `0007_deep_scarlet_spider.sql` per journal; all schema deltas confirmed in SQL |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `importer.ts → importPanelData` | `resolved` (ResolvedPanel[]) | `validateAndResolve(parsed, allPlatforms, allSpecies)` where `allPlatforms/allSpecies` from `db.select().from(platforms/species).all()` | Real DB query against live platforms/species tables | ✓ FLOWING |
| `importer.ts → wholesaleReplace` | `existing` master panel | `masterPanelRepository.findByPlatformSpeciesName(...)` | Real DB SELECT against `master_panels` by composite UNIQUE | ✓ FLOWING |
| `allPanelsFixture.test.ts T-10` | `result.summaries` (16 items) | `importPanelData(FIXTURE_PATH)` reading from `templates/panels/all-panels.xlsx` | Real xlsx file + real DB writes; confirmed 16 master_panels + 48 reagents via raw SQL COUNT | ✓ FLOWING |
| `masterPanelReagent.test.ts` | CHECK constraint enforcement | Raw INSERT via `masterPanelReagentRepository.create()` | Real in-memory SQLite with migration 0007 applied; CHECK + UNIQUE violations tested and confirmed | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Evidence | Status |
|----------|----------|--------|
| `npm test` full suite 216/216 | Three consecutive runs confirmed by 13-05 SUMMARY; fresh run in this verification confirms 216/216 across 17 test files | ✓ PASS |
| DB migration 0007 applies cleanly to in-memory test DB | `migration.test.ts` 12/12 passing including all 7 Phase 13 0007-specific assertions | ✓ PASS |
| 10/10 `masterPanelReagent.test.ts` cases passing (CHECK + UNIQUE + FK cascade) | Full suite confirms `masterPanelReagent.test.ts (10 tests)` — no `it.skip` remaining | ✓ PASS |
| T-6 rollback test: zero partial writes on mid-transaction failure | `grep -c "rolls back all writes"` = 1 in importer.test.ts; full suite passes | ✓ PASS |
| T-11 SMK3-16 cross-phase regression: historical run columns survive wholesale-replace | 17 occurrences of SMK3-16/numberOfSetups references; full suite green | ✓ PASS |
| SC #6 gate: 16 panels import from all-panels.xlsx with 16 master_panels + 48 reagents | `allPanelsFixture.test.ts T-10` passes in full suite (12/12 for that file) | ✓ PASS |
| Roman→Arabic normalization: Thermofisher Human/Mouse Panel I → Panel 1 | T-3 + T-4 in allPanelsFixture.test.ts both green | ✓ PASS |
| SMK3-DIL-01 diluent verbatim: `n/a` + `L-AB` stored as-is | T-7 in importer.test.ts; T-9 in allPanelsFixture.test.ts; `diluent` column in schema confirmed | ✓ PASS |
| Legacy CSVs absent; zero source references | `ls templates/panel-template.csv` → ENOENT; `grep src/ scripts/ "*.ts" "*.tsx"` → 0 matches | ✓ PASS |
| tsc clean on both tsconfig.node.json + tsconfig.web.json | 13-06 SUMMARY verifies; plan-level done-criteria in all plans confirm tsc exit 0 | ✓ PASS |

### Requirements Coverage

| Requirement | Source Plans | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| SMK3-08 | 13-01, 13-02, 13-03, 13-04, 13-05, 13-06 | Importer accepts Smoke 3 sectioned xlsx format (Criteria/Values/Category blocks per sheet; per-reagent rows in Values; Premix matrix in Category) | ✓ SATISFIED | `parser.ts` REWRITTEN; `validator.ts` REWRITTEN; `importer.ts` REWRITTEN; 28 parser tests + 12 validator tests + 11 importer tests + 12 fixture tests all green |
| SMK3-09 | 13-04, 13-05 | Importer normalizes panel name Roman → Arabic at parse time | ✓ SATISFIED | `normalize.ts::normalizePanelName` with ROMAN_TO_ARABIC I..X lookup; allPanelsFixture T-3/T-4 assert Panel I → Panel 1; 31 normalize tests green |
| SMK3-10 | 13-02, 13-04, 13-05 | Importer enumerates panels from sheet names; master `Table` tab ignored | ✓ SATISFIED | D-02 case-insensitive Table-sheet skip in `parseWorkbook`; allPanelsFixture T-1 confirms 16 panels returned (Table skipped); `scripts/build-panels-fixture.ts` + `templates/panels/all-panels.xlsx` fixture in place |
| SMK3-11 | 13-01, 13-03, 13-05 | Re-upload wholesale-replaces: wipes analytes + premixes + per-reagent rows + metadata in single transaction | ✓ SATISFIED | `importer.ts::wholesaleReplace` with `sqlite.transaction()` IIFE; importer.test.ts T-2 (same ID preserved, analytes get new UUIDs), T-4/T-5 (FK SET NULL), T-6 (rollback gate) all green |
| SMK3-DIL-01 | 13-01, 13-04, 13-05 | Diluent column is open-ended free text stored verbatim; no enum or normalization for storage | ✓ SATISFIED (partial — calculator display deferred to Phase 15) | `schema.ts` `diluent text` column (D-07); importer.test.ts T-7 verifies `L-AB` + `n/a` stored exactly; allPanelsFixture T-9 verifies `n/a` + `L-AB`/`Assay Buffer` present in DB after SC #6 import. REQUIREMENTS.md SMK3-DIL-01 says "Calculator surfaces the diluent string" — that display half is Phase 15 scope. Storage half is fully satisfied here. |

Note: REQUIREMENTS.md SMK3-DIL-01 has two halves: (a) store verbatim (Phase 13 — DONE), and (b) calculator surfaces it (Phase 15). The Phase 13 plans explicitly scope only the storage half. The display half is addressed in Phase 15 ("diluent-decision breakdown" is a Phase 15 success criterion).

### Anti-Patterns Found

| File | Pattern | Severity | Impact |
|------|---------|----------|--------|
| `deferred-items.md` | `npm run lint` fails due to missing `eslint.config.mjs` — pre-existing ESLint v9 tooling debt | ℹ️ Info | Zero functional impact; no ESLint config has ever shipped in this repo. `npm run typecheck` (the real type-safety gate) exits 0. Tracked for future tooling-debt cleanup plan. |
| `deferred-items.md` | `runStore.test.ts` referenced in Plan 13-06 verification does not exist | ℹ️ Info | Phantom reference. The substantive Phase 12 SMK3-16 invariant is fully covered by `importer.test.ts T-11` which is green. No gap in invariant coverage, only in belt-and-suspenders renderer-level test (deferred to Phase 14/15). |

No stubs, empty implementations, or blocked code paths found. All Phase 13 imports are substantive and wired. No `TODO/FIXME/PLACEHOLDER` comments in Phase 13 source files. No hardcoded empty data arrays flowing to rendering.

### Human Verification Required

#### 1. ImportButton Banner Visual Appearance

**Test:** On Windows workstation: open the Electron app, navigate to the Manage page, click the Import button, select `templates/panels/all-panels.xlsx`, wait for import to complete.
**Expected:** Banner turns green with headline `"Imported 16 panels (16 new, 0 updated)."` and 16 detail lines, each showing `"{Platform} / {Species} / {normalizedName}: {N} analytes, {M} premix(es), SAPE: {sapeName} ({sapeConc}x)"`. Re-import same file: headline shows `"(0 new, 16 updated)"`, all detail lines end with `" [updated]"`.
**Why human:** App is Windows-only for deployment. `ELECTRON_RUN_AS_NODE` issue in macOS Claude Code SDK environment prevents running the Electron renderer. ImportButton banner content is type-checked (tsc exit 0) and logic-verified (per-sheet summary string construction verified by reading `ImportButton.tsx`), but visual rendering + UX confirmation requires the running app on Windows. Scheduled for Phase 16 UAT.

### Gaps Summary

No blocking gaps found. All 6 ROADMAP success criteria are verified programmatically. The one human verification item (ImportButton banner visual appearance) is expected for this phase — the app is Windows-only and cannot be run in the macOS development environment. This is a known deployment constraint documented in CLAUDE.md.

The two deferred items in `deferred-items.md` (ESLint missing config + phantom runStore.test.ts reference) are pre-existing tooling debt and a plan-text aspirational reference respectively. Neither represents a Phase 13 goal gap.

---

_Verified: 2026-05-12T11:30:00Z_
_Verifier: Claude (gsd-verifier)_
