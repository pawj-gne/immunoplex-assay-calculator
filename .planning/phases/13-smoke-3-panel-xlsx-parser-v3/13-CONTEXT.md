# Phase 13: Smoke 3 — Panel XLSX Parser v3 - Context

**Gathered:** 2026-05-12
**Status:** Ready for planning

<domain>
## Phase Boundary

Replace the v0.7.0 panel importer ([`src/main/import/parser.ts`](../../../src/main/import/parser.ts) — expects flat `Panel Name` / `Platform` / `Species` header rows with a single `Target` / `Bead Region` analyte block) with a v3 parser that ingests the Smoke 3 sectioned xlsx format:

- One workbook with **N sheets** (one per Platform/Species/Panel) + a `Table` summary sheet that's ignored.
- Each panel sheet has three blocks: **Criteria** (Platform / Species / Panel / Panel Description), **Values** (per-reagent rows: Beads / Antibodies / SAPE each with Concentration + Diluent + Volume/well + SAPE Name), **Category** (Single Analytes list + Premix matrix with Premix Name row + Premix Concentration row + Count column + member analyte columns).
- Per (Platform, Species, Panel) triple: **wholesale-replace** on re-upload (DELETE old analytes + premixes + per-reagent rows, INSERT fresh).
- Panel names normalize Roman → Arabic at parse time (`Panel I` → `Panel 1`).
- Per-sheet validation strict, file-level reject (Phase 5 D-06 carryforward).

Out of scope for this phase: UI Plate-page input expansion (Phase 14 — SMK3-04 Number of Setups input, SMK3-02/03 Old reagents); run document audit trail (Phase 15 — SMK3-15/16/17 display logic); calculator wiring of `master_panel_reagents` table reads (Phase 14 will swap the calculator from reading the deprecated 3 master_panels volume columns to the new reagent rows — Phase 13 ONLY writes them).

</domain>

<decisions>
## Implementation Decisions

### File Format & I/O

- **D-01:** Single `.xlsx` workbook with multiple sheets is the canonical input. CSV-per-panel (the 17 fixtures at [`templates/panels/`](../../../templates/panels/)) are dev fixtures only — they are NOT a supported user-facing input. The PRD wording "1 sheet with multiple tabs" anchors this.
- **D-02:** The summary `Table` tab is skipped by **sheet name match** (case-insensitive equality on `Table`). If the lab renames it, they must rename it back. Sheets that match the name pattern but lack the Criteria/Values/Category markers fail validation under D-06 below (not silently skipped).
- **D-03:** Reagent Description loose-match canonicalization in the Values block. Whitespace-trim + case-insensitive + alias regex:
  - `Beads` | `Bead` → `beads`
  - `Antibodies` | `Antibody` | `Ab` → `antibodies`
  - `SAPE` | `SA-PE` | `Streptavidin-PE` → `sape`
  - `SAPE Name` (case-insensitive, whitespace-trimmed) → `sape_name`
  - Rationale: real fixtures use `Antibodies ` (Millipore/Thermofisher trailing space) and `Ab ` (Bio-Rad trailing space). Strict match would break SC #6 17/17 gate on Bio-Rad's fixture today.
- **D-04:** Reuse existing [`IPC_CHANNELS.IMPORT_PANEL_DATA`](../../../src/shared/constants/channels.ts) channel + existing [`ImportButton.tsx`](../../../src/renderer/src/features/import/ImportButton.tsx). Only the parser implementation changes — IPC + UI surface stay identical. Per Phase 5 D-01 hard-cut: v1 path is unreachable from UI; the new parser silently replaces v1 behind the same IPC handler.
- **D-05:** The Phase 13 SC #6 17/17 fixture gate uses [`templates/panels/all-panels.xlsx`](../../../templates/panels/all-panels.xlsx) — a single workbook with 17 panel sheets + a `Table` summary sheet, generated from the 17 source CSVs by an npm script (committed once; regenerable). The integration test loads the .xlsx and asserts 17 ResolvedPanels are produced.

### Schema Delta

- **D-06:** New table `master_panel_reagents`:
  - `id` TEXT PRIMARY KEY
  - `master_panel_id` TEXT NOT NULL FK → `master_panels.id`, `onDelete: 'cascade'`
  - `reagent_kind` TEXT NOT NULL CHECK (`reagent_kind IN ('beads', 'antibodies', 'sape')`)
  - `concentration` REAL NULL (NULL = 'variable' sentinel for beads/antibodies; per CHECK below, sape must be NOT NULL)
  - `diluent` TEXT NULL (open-text per SMK3-DIL-01; verbatim from xlsx — `L-AB`, `n/a`, `Assay Buffer` etc.)
  - `volume_per_well` REAL NOT NULL
  - `created_at`, `updated_at` TEXT NOT NULL
  - Composite UNIQUE on `(master_panel_id, reagent_kind)`
  - CHECK constraint: `reagent_kind <> 'sape' OR concentration IS NOT NULL` (SAPE rows must carry a numeric concentration; all 17 fixtures comply)
- **D-07:** The literal string `variable` in xlsx Beads/Antibodies Concentration cells maps to SQL NULL at insert time. Calculator interpretation: NULL on a `master_panel_reagents` row means "use the per-analyte concentration from `analytes.single_conc`" — a phase-14 calculator-wiring detail, but the storage contract is set here. The literal text `variable` is NOT persisted (parse-time signal only).
- **D-08:** Premix matrix maps to existing Phase 5 schema:
  - Each premix column header → one `premix_panels` row with `master_panel_id` set, `name` = "Premix Name" cell, `sub_panel_conc` = "Premix Concentration" cell value.
  - Each non-empty cell below in the premix column → one `panel_analytes` link row joining that premix to the named analyte (matched case-insensitively against the Single Analytes block in the same sheet).
  - The "Count" column is **parse-time scaffolding** (validates premix size if needed) — NOT persisted.
- **D-09:** SAPE Concentration is honored verbatim. Bio-Rad fixtures use `100` (not 1×); SMK3-17 formula (`Total Volume ÷ SAPE concentration`) divides by 100 for Bio-Rad runs and 1 for Millipore/Thermofisher. Persist whatever the xlsx says.
- **D-10:** Phase 13 migration **drops** the Phase 5 columns `master_panels.beadsVolumePerWell`, `master_panels.abVolumePerWell`, `master_panels.sapeVolumePerWell` in the SAME drizzle migration that adds `master_panel_reagents`. Single-migration atomicity required so the schema is internally consistent across the cut. `master_panels.sape_name TEXT NULL` is added in the same migration.
- **D-11:** `master_panels.vendorSinglesTerm` column **survives** Phase 13. The Smoke 3 PRD doesn't include a vendor singles term cell; new imports write NULL. Phase 5 D-03 wired this column to AnalyteGrid + "No Premix (Custom Assay)" chip — Phase 14/15 may continue consuming it for v1-era data; Phase 13 does not regress that surface.

### Wholesale-Replace Semantics + FK Behavior

- **D-12:** Re-upload of a (Platform, Species, Panel) triple **hard-DELETES** the matching `premix_panels` rows + cascade-deletes `panel_analytes` rows + DELETEs `analytes` rows scoped to the old master_panel + UPDATEs the master_panel row in-place. New xlsx contents INSERT fresh. Per SMK3-11; supersedes Phase 5 D-05 (orphan dropped premixes).
- **D-13:** Match key for master_panel lookup-on-reupload is composite **`(platform_id, species_id, normalized_panel_name)`**. Normalized form per D-18 below.
- **D-14:** Phase 13 migration **drops** the Phase 5 `master_panels_platform_species_uniq` UNIQUE index and **adds** `UNIQUE (platform_id, species_id, name)`. Required because Smoke 3 has N panels per (platform, species) — Millipore Human alone has Panels 1 through 7 per [`templates/panels/_table.csv`](../../../templates/panels/_table.csv). Single migration with D-06 + D-10 above.
- **D-15:** `runs.panel_id` FK onDelete behavior remains **SET NULL** (Phase 4 convention). When a premix_panel gets wholesale-deleted, historical runs.panel_id becomes NULL. Run document shows `(panel data archived)` next to the panel-name field; persisted volume/dead_volume/numberOfSetups/plate-layout remain intact (snapshot-frozen per SMK3-16). Run math reproduces exactly.
- **D-16:** `analytes` rows scoped to the old master_panel are **hard-deleted** during wholesale-replace and re-INSERTed from the new xlsx (new UUIDs each re-upload). Per SMK3-11 explicit wording "wholesale replaces the existing panel (analytes + premixes + per-reagent rows + metadata)".
- **D-17:** `run_single_analytes.analyte_id` FK onDelete: **SET NULL**. After wholesale-replace, historical run_single_analytes rows survive but their `analyte_id` becomes NULL. Run document shows `(analyte data archived)` for those entries. Plate layout (`runs.platesJson`) is independent (stores well coordinates, not analyte IDs) so the plate displays correctly regardless.

### Roman → Arabic Normalization

- **D-18:** `master_panels.name` stores **only the normalized form** (`Panel 1`, not `Panel I`). Parser converts at parse time. Calculator + UI display the normalized form per PRD ("calculator displays Arabic"). The author's source string is NOT persisted. Single source of truth: the normalized name.
- **D-19:** Roman → Arabic conversion range is **`I` through `X` (1–10)** only. Lookup table: I=1, II=2, III=3, IV=4, V=5, VI=6, VII=7, VIII=8, IX=9, X=10. Author-supplied numerals outside this range fail validation. Current real fixtures max at Panel VII (Millipore Human) — 1-10 has 3× headroom.
- **D-20:** Panel name regex (after whitespace-trimming + case-folding):
  ```
  ^Panel\s+([IVX]+|\d+)$
  ```
  Anything else fails validation with `"Panel name must be \"Panel <number>\" or \"Panel <I..X>\" (got \"<input>\")"`. The regex enforces the `Panel ` prefix (real fixtures all use it) and accepts only roman-I/V/X chars or pure digits in the variant suffix.
- **D-21:** If two sheets in the same .xlsx normalize to the same `(platform_id, species_id, normalized_panel_name)` triple (e.g., one sheet `Panel I`, another `Panel 1`, same Platform + Species), the **entire file is rejected** with a validation error: `"Sheets \"<sheet_a>\" and \"<sheet_b>\" normalize to the same (<platform>, <species>, <name>). Resolve duplicate panel names."` Zero DB writes. Carries forward Phase 5 D-06 strict file-level reject.

### Claude's Discretion

- Exact Drizzle migration filename and SQL ordering within the single migration file (composite + add-table + drop-cols + add-col can be in any order so long as the file is atomic).
- Internal parser pipeline shape (row-array intermediate vs streaming) — researcher will recommend.
- Validator output error-message wording for non-D-21 cases (missing required cells, invalid number formats, etc.).
- Test fixture generation script location (`scripts/build-panels-fixture.ts` or similar — npm task name TBD).
- The `panel_description` field from the Criteria block (`Cytokine/Chemokine`, etc.) — Phase 13 may persist on `master_panels.description` (exists already on premix_panels but NOT on master_panels — could add or store at premix level). Researcher to recommend; either works.
- Whether to surface a "0 panels imported, 17 skipped" preview banner in the existing ImportButton flow or just the standard summary banner.
- Exact field name `master_panel_reagents.reagent_kind` vs `kind` vs `reagent_type` — schema-only cosmetic.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Authoritative product spec
- `.planning/SMOKE-3-PRD.md` — full PRD; especially §Database (sheet shape), §Hierarchy of UI interaction → Second Step: Category (premix matrix wording), §Calculation → Variables (TSC + premix concentration rule), §Calculation → Calculation (PE volume formula SMK3-17). PRD is source-of-truth as of 2026-05-11.
- `.planning/INGEST-RESOLUTIONS.md` §E (SMK3-08 / SMK3-09 / SMK3-10 / SMK3-11 / SMK3-DIL-01 / SMK3-12 / SMK3-17) — resolution lineage for the parser-relevant Smoke 3 IDs.

### Requirements
- `.planning/REQUIREMENTS.md` §v2.1 Smoke 3 PRD Adoption → Panel XLSX Parser v3 (SMK3-08, SMK3-09, SMK3-10, SMK3-11). Plus SMK3-DIL-01 (diluent open-text), SMK3-12 (SAPE Name traceability), SMK3-17 (PE volume formula).
- `.planning/REQUIREMENTS.md` §MPAN-01 through MPAN-06 — Phase 5's data model; **MPAN-01 wording is REVISED here** (Phase 5 D-09 shipped 3 volume columns; Phase 13 drops them per D-10 above and adds master_panel_reagents per D-06).
- `.planning/REQUIREMENTS.md` §CALV-01 — **REVISED here too** (single `reagent_volume_per_well` resolution replaced by per-reagent lookup against master_panel_reagents). Phase 14 will swap the calculator read path.

### Roadmap entry
- `.planning/ROADMAP.md` §Phase 13 — the 6 Success Criteria (parser type signature, sheet shape coverage, Roman normalization, wholesale-replace, legacy CSV deletion, 17/17 fixture gate).

### Prior locked decisions (carryforward, do NOT re-litigate)
- `.planning/phases/05-master-panel-schema-repository-foundation/05-CONTEXT.md` §Decisions:
  - D-01 (hard-cut v1 importer) — Phase 13 reuses the IPC channel but swaps the parser implementation under it. v1 path is gone from the UI.
  - D-06 (strict file-level reject) — carried forward to D-21 above.
  - D-08 (xlsx authoritative on every re-import) — operator UI edits to panel name do NOT survive re-upload (xlsx wins).
  - D-09 (master_panels composite UNIQUE) — superseded by D-14 above (UNIQUE now includes name).
  - D-16/D-17 (existing repository upsert API shapes) — Phase 13 will EXTEND with `wholesaleReplace` variants but the inbound upsert signatures stay.
  - D-19 (premix-panel upsert method was deferred from Phase 5 to "Phase 7" — now Phase 13 by supersession) — Phase 13 owns the premix upsert.

### Superseded spec (DO NOT use as input — historical reference only)
- `.planning/PANEL-UPLOAD-V2-SPEC.md` — SUPERSEDED 2026-05-11 by SMOKE-3-PRD.md. The per-tab grid in this file (B1–B4 metadata + col-E premixes + row-7 Target headers) does NOT match the Smoke 3 sectioned format. Idempotency philosophy and open-decisions lineage still informative, but the parser layout grid must be discarded.

### Fixtures
- `templates/panels/` — 17 real-panel CSV fixtures (Millipore × 7 human + 5 mouse, Bio-Rad × 1 human + 1 mouse, Thermofisher × 1 human + 1 mouse) — the SC #6 17/17 test gate. Will be converted to one combined `all-panels.xlsx` per D-05.
- `templates/panels/_table.csv` — the summary tab fixture (skipped per D-02 + SMK3-10).
- `templates/panel-template.csv` + `templates/sample-panel-import.csv` — v0.7.0 legacy CSV format. Phase 13 SC #5 requires these to be deleted.

### Existing code to read
- `src/main/import/parser.ts` — v0.7.0 parser (161 lines) — being replaced.
- `src/main/import/importer.ts` — v0.7.0 importer (142 lines) — being rewritten. Currently uses `panelRepository` only; Phase 13 wires `masterPanelRepository` + `analyteRepository` + per-reagent repo.
- `src/main/import/validator.ts` — v0.7.0 validator (69 lines) — being rewritten.
- `src/main/import/__tests__/parser.test.ts` — existing test infrastructure pattern.
- `src/main/db/schema.ts` — Phase 5 schema (master_panels, premix_panels, analytes, panel_analytes, runs, run_single_analytes).
- `src/main/db/repositories/masterPanel.ts` + `panel.ts` + `analyte.ts` — Phase 5 repos; Phase 13 extends with wholesaleReplace operations.
- `src/main/ipc/import.ts` + `src/shared/constants/channels.ts` — IPC handler + channel name (unchanged per D-04).
- `src/renderer/src/features/import/ImportButton.tsx` — UI entry (unchanged per D-04, may surface per-sheet summary banner).

### Project-level invariants
- `CLAUDE.md` — commit protocol (dev/v1-01 branch; Conventional Commits; three-strike debug rule; Windows-only deployment so test cycle is `npm run build:win` → install on Windows workstation).
- `.planning/PROJECT.md` — domain rules (Smoke 3 PRD source of truth; diluent rule; dead volume formula; 0.1 mL ceiling rounding).

### Just-completed phase context (informs SMK3-16 invariant)
- `.planning/phases/12-smoke-3-calculator-rules/12-VERIFICATION.md` — Phase 12 just shipped (11/11, 2026-05-12). The snapshot-frozen run contract is end-to-end-tested: runStore.loadRun restores volumePerWell + numberOfSetups. Phase 13's wholesale-replace must NOT break this (D-15 + D-17 SET NULL FK behavior preserves the snapshot).
- `.planning/phases/12-smoke-3-calculator-rules/12-04-SUMMARY.md` — gap-closure rationale + setVolumePerWell action.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`xlsx` npm package** — already a dependency (used by v0.7.0 parser.ts at line 1). The v3 parser uses the same library; the read pattern is `XLSX.readFile(filePath) → workbook.Sheets[sheetName] → XLSX.utils.sheet_to_json(sheet, { header: 1, blankrows: false })` producing `unknown[][]`.
- **`vitest`** — test framework set up by Phase 5 D-20. Test fixture pattern: programmatic better-sqlite3 in-memory DB. Existing tests in `src/main/db/repositories/__tests__/` and `src/main/__tests__/`.
- **`crypto.randomUUID()`** — used throughout the repo for primary keys; continue this pattern for new `master_panel_reagents.id` and the new analyte/premix UUIDs on re-upload.
- **Better-sqlite3 transactions** — `getSqlite().transaction(() => { ... })()` IIFE pattern used in `importer.ts:49`. Phase 13's wholesale-replace must wrap entire-file processing in one transaction (carries Pitfall 27 from Phase 5).
- **Drizzle ORM** — `sqliteTable` declarations in `src/main/db/schema.ts`; type inference via `$inferSelect` / `$inferInsert`. New `MasterPanelReagent` types follow this pattern.

### Established Patterns
- **Strict file-level reject** (Phase 5 D-06) — validator collects ALL errors across ALL sheets BEFORE any DB write. Single transaction wraps the writes. If any sheet has any validation error, zero DB writes happen.
- **Composite UNIQUE on platform-species** (Phase 5 D-09) — Drizzle pattern uses `uniqueIndex('name').on(t.colA, t.colB)` — NOT column-level `.unique()` (Pitfall 14). D-14 follows this pattern with the 3-column UNIQUE.
- **FK onDelete declared explicitly** (Phase 5 D-12 + Pitfall 13) — every new FK in Phase 13's schema delta must declare `onDelete` ('cascade' for master_panel_reagents under master_panels; 'set null' for runs/run_single_analytes — already exists per Phase 4).
- **Case-insensitive name lookup** — `lower(name) = lower(?)` pattern used in analyteRepository per Phase 5 D-17. Reused for panel_analytes member matching in D-08.

### Integration Points
- IPC handler `IPC_CHANNELS.IMPORT_PANEL_DATA` (`src/main/ipc/import.ts`) stays; only the parser+importer behind it changes.
- UI button `ImportButton.tsx` stays; the per-sheet summary banner content updates to reflect new fields (per-reagent volumes; premix counts; panel name normalization preview).
- Phase 14 will read `master_panel_reagents` table from the calculator; Phase 13 only writes it. Phase 14 is responsible for the calculator-resolution swap (CALV-01 revisited).

</code_context>

<specifics>
## Specific Ideas

- **17/17 SC #6 gate workflow:** npm script `scripts/build-panels-fixture.ts` reads the 17 CSVs in `templates/panels/`, writes one `templates/panels/all-panels.xlsx` workbook (17 panel sheets + a `Table` summary sheet generated from `_table.csv`). Committed to source control. Regenerable via `npm run fixtures:panels`. Vitest integration test loads the .xlsx and asserts `parsedPanels.length === 17` plus per-panel deep-equality assertions against gold-files (TBD shape: JSON or expected-object literals — researcher's call).

- **Per-sheet summary banner content:** When import succeeds, the UI shows per-sheet (per-panel) lines like:
  ```
  ✓ Millipore / Human / Panel 1: 33 analytes, 4 premixes, sape_name=SAPE-10
  ✓ Bio-Rad / Mouse / Panel 1: 27 analytes, 2 premixes, sape_name=Streptavidin-PE (SAPE conc=100, divisor applied per SMK3-17)
  ✓ Thermofisher / Human / Panel 1: 34 analytes, 1 premix
  ...
  ```
  When import fails, the banner shows the validation errors grouped per sheet so the lab can spot-fix.

- **Diluent `n/a` semantics:** All 17 fixtures use `n/a` (lowercase, no period) for the SAPE diluent. Per SMK3-DIL-01 ("open-ended free text; no enum; no normalization"), the parser stores `n/a` verbatim. Calculator display will surface "n/a" as-is — not "Not Applicable" or `null` or empty string. The lab's choice of `n/a` is their choice.

- **Pre-Smoke-3 run handling:** Runs saved before this phase ships have `runs.panel_id` pointing at v0.7.0-imported premix_panels rows. Those rows have `master_panel_id` IS NULL (Phase 5 set this nullable for backwards-compat). Phase 13's wholesale-replace only targets premix_panels with `master_panel_id IS NOT NULL` (matched to a re-uploaded panel). v0.7.0 rows are unaffected → historical pre-Smoke-3 runs reload exactly as before (per SMK3-16, plus they had no per-reagent fields to lose).

- **Migration deletion of legacy CSV templates (SC #5):** `templates/panel-template.csv` and `templates/sample-panel-import.csv` are deleted in this phase. The 17 fixtures at `templates/panels/` stay (they're the test gate). The Manage page no longer references CSV downloads (UI cleanup task).

</specifics>

<deferred>
## Deferred Ideas

- **vendor_singles_term column removal** — D-11 kept this Phase 5 surface alive for v0.7.0-era data; a future cleanup phase can remove the column once no master_panel still uses it. Track in v3+ cleanup.
- **Admin action to clean up orphan analytes** — if a future bug causes analytes to be orphaned (master_panel_id IS NULL with no run_single_analytes references), an admin "cleanup" action belongs in v2.1+. Not in scope for Phase 13. Phase 5's PIMP-13 already deferred this.
- **A5 schema version marker** (e.g., `Format Version: 3`) — Phase 5 D-07 deferred to v2.1; carries forward. Phase 13 ships without a version marker; format is implicit.
- **Preview-before-commit UI** (PIMP-11) — Phase 5 didn't ship; carries forward as v2.1+ candidate. Phase 13 commits atomically inside one transaction; no preview surface.
- **Premix member ordinal preservation** — the "Count" column in the xlsx orders premix members 1..N. D-08 said this is parse-time scaffolding (not persisted). If downstream display needs author-controlled ordering, add `panel_analytes.ordinal` later. Deferred.
- **Panel description (`master_panels.description`)** — Phase 5 schema has it on `premix_panels` but not `master_panels`. The Criteria block has a "Panel Description" cell (e.g., `Cytokine/Chemokine`). Storage location is in Claude's Discretion (D-section); if the planner picks "add to master_panels", that's a Phase 13 column addition.
- **Per-sheet banner detail richness** — Specifics section sketches the success banner content; final wording in Claude's Discretion. If the lab needs richer summaries (e.g., "compared to prior re-upload: +2 premixes, -1 analyte"), that's a v2.1+ enhancement.

</deferred>

---

*Phase: 13-smoke-3-panel-xlsx-parser-v3*
*Context gathered: 2026-05-12*
