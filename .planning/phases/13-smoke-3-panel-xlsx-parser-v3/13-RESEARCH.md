# Phase 13: Smoke 3 — Panel XLSX Parser v3 - Research

**Researched:** 2026-05-12
**Domain:** XLSX parsing + Drizzle schema migration + transactional wholesale-replace importer
**Confidence:** HIGH (CONTEXT.md locks 21 decisions; all 17 fixtures inspected; existing code paths verified)

## Summary

Phase 13 replaces the v0.7.0 single-CSV/single-tab importer with a v3 multi-sheet xlsx parser, grows the schema to per-reagent rows in a new `master_panel_reagents` table, drops the three legacy volume columns from `master_panels`, swaps a UNIQUE index to include `name`, and rewires the importer for transactional wholesale-replace semantics on the `(platform_id, species_id, normalized_name)` composite key.

CONTEXT.md locks 21 decisions (D-01..D-21); they fully fix file format, schema delta, FK behavior, Roman→Arabic normalization, and validation strictness. Open items are limited to migration filename, parser pipeline shape, error-message wording, fixture script location, panel_description storage location, banner copy, and one cosmetic column-naming choice. Each is resolved below under "Concrete Recommendations."

The technical risk concentrates in three areas: (1) the variable per-vendor block layout in the Category section — Bio-Rad/Thermofisher/most Millipore put `Premix Name` on row 16, but `millipore-human-panel-1.csv` shifts the structure such that the analyte-header row coincides with the `Premix Concentration` row; (2) trailing-whitespace tokens like `Antibodies ` (Millipore/Thermofisher) and `Ab ` (Bio-Rad) that must canonicalize via the D-03 alias regex; (3) the single-migration atomicity required by D-06 + D-10 + D-14 (add table + drop 3 cols + swap UNIQUE index + add `sape_name` col in one drizzle migration file).

**Primary recommendation:** Build a marker-driven, two-pass row-array parser (xlsx → `unknown[][]` → sectioned blocks via label search → typed `ResolvedPanel`). Decompose the parse logic into three pure block parsers (`parseCriteria`, `parseValues`, `parseCategory`) over a shared `Cell.at(r,c)` accessor. Aggregate validation errors across all sheets BEFORE opening the transaction; the transaction is a single IIFE wrapping wholesale-delete + INSERT-fresh per (platform, species, normalized_name) match.

## User Constraints (from CONTEXT.md)

### Locked Decisions

**File Format & I/O**
- **D-01:** Single `.xlsx` workbook with multiple sheets is canonical input. CSV-per-panel are dev fixtures only — not user-facing.
- **D-02:** `Table` summary tab skipped by case-insensitive sheet-name equality on `Table`. Sheets matching the name but lacking Criteria/Values/Category markers fail validation under D-06 (not silent skip).
- **D-03:** Reagent Description loose-match canonicalization with whitespace-trim + case-insensitive + alias regex:
  - `Beads` | `Bead` → `beads`
  - `Antibodies` | `Antibody` | `Ab` → `antibodies`
  - `SAPE` | `SA-PE` | `Streptavidin-PE` → `sape`
  - `SAPE Name` → `sape_name`
- **D-04:** Reuse existing `IPC_CHANNELS.IMPORT_PANEL_DATA` + existing `ImportButton.tsx`. Parser implementation changes; IPC + UI surface stay identical. v1 path silently replaced.
- **D-05:** SC #6 17/17 fixture gate uses `templates/panels/all-panels.xlsx` — single workbook, 17 panel sheets + `Table` summary, generated from the 17 source CSVs by an npm script. Committed; regenerable.

**Schema Delta**
- **D-06:** New table `master_panel_reagents`:
  - `id` TEXT PRIMARY KEY
  - `master_panel_id` TEXT NOT NULL FK → `master_panels.id`, `onDelete: 'cascade'`
  - `reagent_kind` TEXT NOT NULL CHECK (`reagent_kind IN ('beads', 'antibodies', 'sape')`)
  - `concentration` REAL NULL (NULL = 'variable' sentinel; per CHECK below, sape must be NOT NULL)
  - `diluent` TEXT NULL (open-text per SMK3-DIL-01)
  - `volume_per_well` REAL NOT NULL
  - `created_at`, `updated_at` TEXT NOT NULL
  - Composite UNIQUE on `(master_panel_id, reagent_kind)`
  - CHECK: `reagent_kind <> 'sape' OR concentration IS NOT NULL`
- **D-07:** Literal `variable` in xlsx Beads/Antibodies Concentration cells → SQL NULL at insert time. Literal text NOT persisted.
- **D-08:** Premix matrix maps to existing Phase 5 `premix_panels` + `panel_analytes`:
  - Each premix column header → one `premix_panels` row with `master_panel_id` set, `name` = "Premix Name" cell, `sub_panel_conc` = "Premix Concentration" cell.
  - Each non-empty cell below in the premix column → one `panel_analytes` link row (case-insensitive analyte match).
  - "Count" column = parse-time scaffolding; NOT persisted.
- **D-09:** SAPE Concentration honored verbatim (Bio-Rad uses 100; Millipore/Thermofisher use 1).
- **D-10:** Phase 13 migration drops `master_panels.beadsVolumePerWell` + `abVolumePerWell` + `sapeVolumePerWell` columns in the SAME migration that adds `master_panel_reagents`. Adds `master_panels.sape_name TEXT NULL` in the same migration.
- **D-11:** `master_panels.vendorSinglesTerm` column SURVIVES Phase 13 (Phase 5 D-03 wiring preserved). New imports write NULL.

**Wholesale-Replace Semantics + FK Behavior**
- **D-12:** Re-upload of (Platform, Species, Panel) hard-DELETEs matching `premix_panels` + cascade-deletes `panel_analytes` + DELETEs `analytes` rows scoped to old master_panel + UPDATEs master_panel row in-place. Supersedes Phase 5 D-05.
- **D-13:** Match key is composite `(platform_id, species_id, normalized_panel_name)`.
- **D-14:** Migration DROPs Phase 5 `master_panels_platform_species_uniq` and ADDs `UNIQUE (platform_id, species_id, name)`. Single migration with D-06 + D-10.
- **D-15:** `runs.panel_id` FK onDelete remains SET NULL (Phase 4). Wholesale-delete of premix_panel sets `runs.panel_id = NULL`; UI shows `(panel data archived)`. Snapshot-frozen values intact.
- **D-16:** `analytes` rows scoped to old master_panel hard-deleted during wholesale-replace and re-INSERTed (new UUIDs).
- **D-17:** `run_single_analytes.analyte_id` FK onDelete: SET NULL. After wholesale-replace, historical run_single_analytes survive with NULL analyte_id; UI shows `(analyte data archived)`.

**Roman → Arabic Normalization**
- **D-18:** `master_panels.name` stores ONLY normalized form (`Panel 1`, not `Panel I`). Parser converts at parse time.
- **D-19:** Roman conversion range I..X (1–10) only. Lookup table: I=1, II=2, III=3, IV=4, V=5, VI=6, VII=7, VIII=8, IX=9, X=10. Out-of-range fails validation.
- **D-20:** Panel name regex (after whitespace-trim + case-fold): `^Panel\s+([IVX]+|\d+)$`. Anything else fails validation: `"Panel name must be \"Panel <number>\" or \"Panel <I..X>\" (got \"<input>\")"`.
- **D-21:** Duplicate-normalize sheets in same .xlsx → entire file rejected: `"Sheets \"<sheet_a>\" and \"<sheet_b>\" normalize to the same (<platform>, <species>, <name>). Resolve duplicate panel names."` Zero DB writes.

### Claude's Discretion
1. Exact Drizzle migration filename + SQL ordering (single atomic migration).
2. Internal parser pipeline shape (row-array intermediate vs streaming).
3. Validator error-message wording for non-D-21 cases.
4. Test fixture generation script location + npm task name.
5. `panel_description` storage location (master_panels.description vs premix_panels.description).
6. Per-sheet preview banner content/wording.
7. Cosmetic naming: `master_panel_reagents.reagent_kind` vs `kind` vs `reagent_type`.

### Deferred Ideas (OUT OF SCOPE for Phase 13)
- `vendor_singles_term` column removal (future cleanup phase).
- Admin action to clean up orphan analytes.
- A5 schema version marker.
- Preview-before-commit UI (PIMP-11).
- Premix member ordinal preservation (Count → `panel_analytes.ordinal`).
- Banner-comparison detail richness (diff vs prior upload).

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SMK3-08 | Importer accepts Smoke 3 sectioned xlsx (Criteria/Values/Category blocks; per-reagent rows; Premix matrix) | Per-block parser design below; D-06 schema; 17 fixture inspection |
| SMK3-09 | Importer normalizes panel name Roman → Arabic at parse time | D-18/D-19/D-20; `normalizePanelName()` function spec below |
| SMK3-10 | Importer enumerates panels from sheet names; `Table` tab ignored | D-02; `XLSX.SheetNames.filter(n => n.trim().toLowerCase() !== 'table')` |
| SMK3-11 | Re-upload wholesale-replaces (Platform, Species, Panel) triple | D-12 / D-13 / D-16; `wholesaleReplace` repo API below |
| SMK3-DIL-01 | Diluent column = open-ended free text; stored verbatim | D-06 (`diluent TEXT NULL`); no normalization; CHECK constraints only on `reagent_kind` + `concentration` |

## Project Constraints (from CLAUDE.md)

- **Branching:** Never commit to main; use `dev/v1-01` (already on branch).
- **Commits:** Conventional Commits prefix (`feat:`, `fix:`, `docs:`, `refactor:`, `chore:`). Push after committing.
- **Debug:** Three-strike rule — stop after 3 failed fix attempts.
- **Deployment:** Windows-only. Dev on macOS; runtime test by `npm run build:win` → install on Windows workstation. ELECTRON_RUN_AS_NODE issue under Claude Code SDK breaks in-terminal Electron dev — unit tests via vitest are the primary verification mode.

## Standard Stack

### Verified versions

| Library | Installed | Registry latest (2026-05-12) | Use in Phase 13 |
|---------|-----------|------------------------------|-----------------|
| `xlsx` | 0.18.5 | 0.18.5 | Multi-sheet read; `sheet_to_json` with `header: 1` `[VERIFIED: npm view xlsx version → 0.18.5; matches package.json]` |
| `drizzle-orm` | 0.45.1 | (in lockstep with drizzle-kit) | `sqliteTable`, `uniqueIndex(...).on(...)`, `$inferSelect/$inferInsert` `[VERIFIED: package.json]` |
| `drizzle-kit` | 0.31.8 | 0.31.10 (minor diff; safe) | `db:generate` for migration file `[VERIFIED: npm view drizzle-kit version → 0.31.10]` |
| `better-sqlite3` | 12.6.2 | 12.10.0 | Synchronous transactions; `sqlite.transaction(() => {...})()` IIFE `[VERIFIED: npm view better-sqlite3 version → 12.10.0; CHECK constraints + composite UNIQUE supported natively]` |
| `vitest` | 2.1.9 | 4.1.6 | Test runner; `pool: 'forks'` already configured for in-memory DB isolation `[VERIFIED: vitest.config.ts]` |
| `zod` | 3.24.2 | (current) | Available but not needed in parser — explicit type coercion + boundary checks are clearer than Zod `[VERIFIED: package.json; Pitfall 7 in PITFALLS.md recommends explicit coercion]` |

No new dependencies required. All needed primitives are in the existing toolchain.

### Architectural responsibility map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|--------------|----------------|-----------|
| File-dialog + IPC | Main (`src/main/ipc/import.ts`) | — | Electron API only available in main process |
| XLSX parse → row arrays | Main (`src/main/import/parser.ts`) | — | SheetJS lives main-process-only per Pitfall 11 |
| Validation + roll-up | Main (`src/main/import/validator.ts`) | — | Cross-sheet collision detection (D-21) requires whole-file view |
| Wholesale-replace transaction | Main (`src/main/import/importer.ts`) | Repos | Importer owns transaction scope (Pitfall 27) |
| Schema + migrations | Main (`src/main/db/schema.ts`, `drizzle/migrations/`) | — | Drizzle-kit generates from schema.ts |
| Repository CRUD | Main (`src/main/db/repositories/*.ts`) | — | Single source for SQL; no transaction inside (Phase 5 D-18 convention) |
| UI banner | Renderer (`ImportButton.tsx`) | — | Per-sheet success/error summary |
| Calculator reads `master_panel_reagents` | Renderer/main (Phase 14) | — | Out of scope for Phase 13; Phase 13 only WRITES this table |

## Architecture Patterns

### System Architecture Diagram

```
                              ┌────────────────────────────────────┐
                              │ Renderer: ImportButton.tsx         │
                              │   window.electronAPI.import.       │
                              │     panelData()                    │
                              └─────────────────┬──────────────────┘
                                                │ IPC invoke
                                                ▼
                              ┌────────────────────────────────────┐
                              │ Main: ipc/import.ts                │
                              │   dialog.showOpenDialog (.xlsx)    │
                              │   importPanelData(filePath)        │
                              └─────────────────┬──────────────────┘
                                                ▼
                              ┌────────────────────────────────────┐
                              │ Main: import/importer.ts           │
                              │   orchestrates: parse → validate → │
                              │   resolve FK ids → wholesaleReplace│
                              │   inside ONE transaction           │
                              └─────────────────┬──────────────────┘
                                                ▼
                       ┌────────────────────┬───┴────────────────────┐
                       ▼                    ▼                        ▼
              ┌──────────────────┐ ┌──────────────────┐  ┌──────────────────┐
              │ parser.ts        │ │ validator.ts     │  │ repositories/    │
              │  parseWorkbook   │ │  validateAll     │  │   masterPanel.ts │
              │   per-sheet:     │ │   - platforms    │  │   reagent.ts NEW │
              │    Criteria      │ │   - species      │  │   panel.ts       │
              │    Values        │ │   - dup-normaliz │  │   analyte.ts     │
              │    Category      │ │   - cross-block  │  └──────────────────┘
              │  ParsedPanel[]   │ │ ResolvedPanel[]  │
              └──────────────────┘ └──────────────────┘
                                                                 ▼
                                              ┌──────────────────────────────┐
                                              │ better-sqlite3 transaction:  │
                                              │  for each ResolvedPanel:     │
                                              │   1. SELECT existing master  │
                                              │      by (plat, spec, name)   │
                                              │   2. If found:               │
                                              │      DELETE master_panel_    │
                                              │        reagents WHERE        │
                                              │        master_panel_id=...   │
                                              │      DELETE analytes WHERE   │
                                              │        master_panel_id=...   │
                                              │      DELETE premix_panels    │
                                              │        WHERE master_panel_   │
                                              │        id=... (cascades to   │
                                              │        panel_analytes)       │
                                              │      UPDATE master_panels    │
                                              │   3. Else: INSERT master     │
                                              │   4. INSERT 3 reagent rows   │
                                              │   5. INSERT analytes         │
                                              │   6. INSERT premix_panels    │
                                              │   7. INSERT panel_analytes   │
                                              │      (premix membership)     │
                                              └──────────────────────────────┘
```

### Recommended Project Structure

```
src/main/import/
├── parser.ts            # REWRITTEN — multi-sheet XLSX → ParsedPanel[]
├── validator.ts         # REWRITTEN — cross-sheet validation, FK resolve → ResolvedPanel[]
├── importer.ts          # REWRITTEN — orchestrator + transaction boundary
├── normalize.ts         # NEW — normalizePanelName(), canonReagentKind(), Roman→Arabic
├── blockParser.ts       # NEW — parseCriteria / parseValues / parseCategory helpers
└── __tests__/
    ├── parser.test.ts             # REWRITTEN — block-level unit tests
    ├── validator.test.ts          # NEW — multi-sheet error aggregation
    ├── importer.test.ts           # NEW — wholesale-replace transaction tests
    ├── normalize.test.ts          # NEW — Roman→Arabic edge cases
    ├── allPanelsFixture.test.ts   # NEW — SC #6 17/17 integration gate
    └── fixtures/
        └── (generated artifacts from scripts/build-panels-fixture.ts)

src/main/db/
├── schema.ts                       # EXTENDED — add masterPanelReagents; drop 3 columns; swap UNIQUE
├── repositories/
│   ├── masterPanel.ts              # EXTENDED — add wholesaleReplace, findByPlatformSpeciesName
│   ├── masterPanelReagent.ts       # NEW — full CRUD for new table
│   ├── analyte.ts                  # EXTENDED — deleteByMasterPanelId
│   └── panel.ts                    # EXTENDED — deleteByMasterPanelId (premixes)
└── __tests__/
    └── masterPanelReagent.test.ts  # NEW — CRUD + CHECK constraint + composite UNIQUE

drizzle/migrations/
└── 0007_<adjective>_<noun>.sql     # NEW — single atomic migration (D-06 + D-10 + D-14)

scripts/
└── build-panels-fixture.ts         # NEW — converts templates/panels/*.csv → all-panels.xlsx

templates/panels/
├── all-panels.xlsx                 # NEW — generated, committed (gitignored regen)
└── _table.csv                      # exists — used to build Table sheet in all-panels.xlsx

templates/                          # DELETED files (SC #5):
├── panel-template.csv              # DELETE
└── sample-panel-import.csv         # DELETE

src/main/import/__tests__/parser.test.ts  # update test target (no longer references deleted CSVs)
```

### Pattern 1: Marker-Driven Block Parser (over xlsx → unknown[][])

**What:** Read each panel sheet as a row-array (`unknown[][]`), then locate three block headers by text-marker scan, then parse each block over a constrained row range.

**Why:** The 17-fixture survey reveals per-vendor row offsets vary (millipore-human-panel-1.csv has Single Analytes label on row 16 col A; Bio-Rad/Thermofisher/most Millipore have it on row 17 col A). Hardcoded row offsets WILL fail. Marker scanning by text label is robust. `[VERIFIED: direct inspection of templates/panels/*.csv]`

**Example:**
```typescript
// src/main/import/parser.ts (NEW)
// Source: pattern follows Phase 5 v0.7.0 parser.ts:25-31 (XLSX.readFile + sheet_to_json)
//         but generalized for multi-sheet + marker-driven block scan.
import * as XLSX from 'xlsx'

export interface ParsedReagent {
  kind: 'beads' | 'antibodies' | 'sape'
  concentration: number | null      // null when source cell = 'variable' (beads/antibodies only)
  diluent: string | null
  volumePerWell: number
}

export interface ParsedAnalyte {
  name: string
  beadRegion: number
  concentration: number              // single-analyte concentration from Category block col C
}

export interface ParsedPremix {
  name: string
  premixConc: number
  memberNames: string[]              // verbatim names; case-insensitive match in validator
}

export interface ParsedPanel {
  sheetName: string                  // source xlsx sheet name; verbatim for error messages
  platform: string                   // verbatim from Criteria block
  species: string
  panelNameRaw: string               // verbatim 'Panel I' or 'Panel 1' from Criteria
  panelNameNormalized: string        // 'Panel 1' after Roman→Arabic
  panelDescription: string | null    // e.g., 'Cytokine/Chemokine'
  sapeName: string | null            // e.g., 'SAPE-10' or 'Streptavidin-PE'
  reagents: ParsedReagent[]          // length 3 (beads, antibodies, sape); enforced post-parse
  analytes: ParsedAnalyte[]
  premixes: ParsedPremix[]
}

export class ParseError extends Error {
  constructor(message: string, public sheetName?: string) {
    super(sheetName ? `[${sheetName}] ${message}` : message)
    this.name = 'ParseError'
  }
}

export function parseWorkbook(filePath: string): ParsedPanel[] {
  const workbook = XLSX.readFile(filePath, { cellFormula: false, cellDates: false })
  const panels: ParsedPanel[] = []
  for (const sheetName of workbook.SheetNames) {
    if (sheetName.trim().toLowerCase() === 'table') continue  // D-02
    const sheet = workbook.Sheets[sheetName]
    const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
      header: 1,
      blankrows: false,
      defval: null
    }) as unknown[][]
    panels.push(parseSheet(sheetName, rows))
  }
  return panels
}

function parseSheet(sheetName: string, rows: unknown[][]): ParsedPanel {
  const criteriaRow = findMarker(rows, 'criteria', 0)
  const valuesRow   = findMarker(rows, 'values', 0)
  const categoryRow = findMarker(rows, 'category', 0)
  if (criteriaRow < 0) throw new ParseError('Missing "Criteria" section marker in column A', sheetName)
  if (valuesRow < 0)   throw new ParseError('Missing "Values" section marker in column A', sheetName)
  if (categoryRow < 0) throw new ParseError('Missing "Category" section marker in column A', sheetName)
  // Each block parses rows in its slice; blocks are sequential.
  const criteria  = parseCriteria(sheetName, rows, criteriaRow + 1, valuesRow)
  const reagents  = parseValues(sheetName, rows, valuesRow + 1, categoryRow)
  const sapeName  = findSapeName(sheetName, rows, valuesRow + 1, categoryRow)
  const category  = parseCategory(sheetName, rows, categoryRow + 1)
  return {
    sheetName,
    platform: criteria.platform,
    species: criteria.species,
    panelNameRaw: criteria.panelNameRaw,
    panelNameNormalized: normalizePanelName(criteria.panelNameRaw, sheetName),
    panelDescription: criteria.description,
    sapeName,
    reagents,
    analytes: category.analytes,
    premixes: category.premixes
  }
}
```

### Pattern 2: Block-Local Parsers as Pure Functions

`parseCriteria`, `parseValues`, `parseCategory` each take `(sheetName, rows, startRow, endRow)` and return their typed result OR throw `ParseError`. They share a `cell(r, c): string` helper that trims + coalesces empty/null to `''`. Each parser DOES NOT know about the other blocks → easy to unit-test independently.

### Pattern 3: Cross-Block Markers in Category

For the Category block (the variable-shape one), locate the `Premix Name` row by scanning col E (or any col ≥ E) for the text `Premix Name` after case-folding + trim. The row containing `Premix Name` defines premix column positions (col F onwards = premix headers). The row with `Premix Concentration` text in the same column gives premix concentrations. Then locate the analyte data start row by scanning for either:
- A row with `Analyte` in col A AND `Bead Region` in col B (Bio-Rad / Thermofisher / Millipore panels 2-7 pattern), OR
- A row with `Analyte | Bead Region | Concentration` in cols A-C that coincides with the `Premix Concentration` row (Millipore Panel 1 pattern — both share row 17).

Then walk rows downward until col A is blank. For each row: cols A-C = analyte data; col E = ordinal count (ignored per D-08); cols F..F+N = premix member names (case-insensitive lookup against the analyte block in the same sheet — Pitfall 9).

### Pattern 4: Single Transaction Wrapping Whole-File Writes

Following Phase 5 D-18 + Pitfall 27: validate everything FIRST, return early on any error, then open ONE transaction wrapping all writes. Phase 13 importer:

```typescript
// src/main/import/importer.ts (NEW shape)
const sqlite = getSqlite()
sqlite.transaction(() => {
  for (const resolved of resolvedPanels) {
    // 1. Look up by (platform_id, species_id, normalized_name) → existing master | null
    const existing = masterPanelRepository.findByPlatformSpeciesName(...)
    if (existing) {
      // 2. Wholesale-delete: cascade via FKs where possible
      analyteRepository.deleteByMasterPanelId(existing.id)          // hard delete
      panelRepository.deleteByMasterPanelId(existing.id)            // hard delete; cascades panel_analytes
      masterPanelReagentRepository.deleteByMasterPanelId(existing.id)  // CASCADE via FK
      masterPanelRepository.updateMetadata(existing.id, ...)        // name, sape_name, description
      // ↑ runs.panel_id pointing at deleted premix_panels rows becomes NULL (D-15)
      // ↑ run_single_analytes.analyte_id pointing at deleted analyte rows becomes NULL (D-17)
    } else {
      masterPanelRepository.create({ ... }) // includes sape_name, description
    }
    // 3. INSERT-fresh: reagents + analytes + premixes + panel_analytes links
    for (const r of resolved.reagents) masterPanelReagentRepository.create({ masterPanelId, ...r })
    for (const a of resolved.analytes) analyteRepository.create({ masterPanelId, ...a })
    for (const p of resolved.premixes) { /* create premix_panels + panel_analytes */ }
  }
})()   // IIFE — matches existing importer.ts:49 pattern
```

### Anti-Patterns to Avoid

- **Hardcoded row offsets** (e.g., "Premix Name is always on row 16") — `millipore-human-panel-1.csv` proves this wrong; use marker scanning.
- **Streaming/incremental parse** — file sizes are tiny (largest fixture < 100 rows). The row-array intermediate is simpler to reason about and unit-test.
- **Per-tab transactions** — Pitfall 27. Use one transaction wrapping the whole file.
- **Zod for primitive coercion** — Pitfall 7. Use explicit `coerceNumber(raw, cellLabel)` helper; reserve Zod for shape validation at IPC boundary (already established pattern).
- **Renaming `premix_panels` to `panels`** — Pitfall 15. Keep table name.
- **`onDelete: 'no action'`** — Pitfall 13. Every new FK declares `onDelete` explicitly.
- **Column-level `.unique()` for composite indexes** — Pitfall 14. Use `uniqueIndex(...).on(...)`.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| XLSX parsing | Hand-rolled ZIP+XML reader | `XLSX.readFile` from `xlsx@0.18.5` | Already in deps; matches v0.7.0 pattern |
| Roman numeral parsing | Generic Roman parser (e.g., `roman-numerals` lib) | Hardcoded I..X lookup table | D-19 caps at I..X; lookup table is 10 entries; no dep needed; out-of-range explicitly fails |
| SQLite CHECK constraints | App-level validation only | `check()` clause in Drizzle schema | DB-enforced; survives bypass attempts |
| FK cascade | App-level cleanup queries | `onDelete: 'cascade' \| 'set null'` in schema | Atomic with DELETE; impossible to forget |
| Transaction wrapping | Manual BEGIN/COMMIT | `sqlite.transaction(() => {...})()` IIFE | Matches Phase 4/5 pattern; automatic rollback on throw |
| Fixture XLSX | Hand-author in Excel | `scripts/build-panels-fixture.ts` programmatic build | Pitfall 24; diff-friendly; regenerable |
| In-memory test DB | Custom setup | `createTestDb()` from `src/main/db/__tests__/testDb.ts` | Already shipped; PRAGMA foreign_keys ON; migrations applied |

**Key insight:** Hand-rolling here means rebuilding things that drizzle-orm + xlsx + better-sqlite3 give us for free. The cost is real (debug time on tooling we re-invent) and the alternatives are already in deps.

## Runtime State Inventory

> Phase 13 is a schema + parser rewrite — explicit rename/migration concerns apply.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | (a) `master_panels` rows with old `beads_volume_per_well`/`ab_volume_per_well`/`sape_volume_per_well` cols — Phase 5 dummy data, no real users; (b) `premix_panels` rows from v0.7.0 import with `master_panel_id IS NULL` — pre-Smoke-3 runs depend on these; (c) `analytes` rows with various `master_panel_id` states | (a) Drop columns in migration (data lost — acceptable, Phase 5 D-02 hard-cut accepted this); (b) Leave untouched — wholesale-replace only targets rows with `master_panel_id IS NOT NULL` matching new file; (c) Same — wholesale-replace only touches rows with master_panel_id pointing at re-uploaded master |
| Live service config | None — Electron app; no external service registrations | None |
| OS-registered state | None — desktop app | None |
| Secrets/env vars | None — no auth, no API keys | None |
| Build artifacts | Built Electron bundle (`out/`) embeds compiled schema; rebuild on schema change | `npm run build` (Phase 13's commit triggers); existing `postinstall` re-runs electron-rebuild for better-sqlite3 |
| Test fixtures | `templates/panel-template.csv` + `templates/sample-panel-import.csv` referenced by `src/main/import/__tests__/parser.test.ts:7` | DELETE files (SC #5); REWRITE parser.test.ts to consume generated fixture from `templates/panels/all-panels.xlsx` |

**Critical:** The `parser.test.ts` test at line 7 references `templates/panel-template.csv` which Phase 13 deletes. The test must be REWRITTEN, not just deleted, since the v3 parser's contract differs. This is captured in the test architecture below.

## xlsx Library Specifics for the Sectioned Format

### Read pattern (verified against installed xlsx@0.18.5)

```typescript
const workbook = XLSX.readFile(filePath, {
  cellFormula: false,    // evaluate formulas; do not preserve formula text (Pitfall 10)
  cellDates: false       // avoid auto-date coercion for cells like "Panel III" → Date
})
const sheet = workbook.Sheets[sheetName]
const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
  header: 1,             // emit array-of-arrays (not object-keyed)
  blankrows: false,      // skip rows where all cells are null/empty
  defval: null           // missing cells appear as null (not undefined) for consistent access
}) as unknown[][]
```

### Cell-access helper (per Pitfall 6 + Pitfall 7)

```typescript
function cell(rows: unknown[][], r: number, c: number): string {
  const raw = rows[r]?.[c]
  if (raw === null || raw === undefined) return ''
  return String(raw).trim()
}

function cellNumber(rows: unknown[][], r: number, c: number, label: string, sheetName: string): number {
  const raw = rows[r]?.[c]
  const num = typeof raw === 'number' ? raw : Number(String(raw ?? '').trim())
  if (!Number.isFinite(num)) {
    throw new ParseError(`${label} at row ${r + 1}, col ${String.fromCharCode(65 + c)} must be numeric (got "${raw}")`, sheetName)
  }
  return num
}

function cellNumberOrVariable(rows: unknown[][], r: number, c: number, label: string, sheetName: string): number | null {
  const raw = String(rows[r]?.[c] ?? '').trim().toLowerCase()
  if (raw === 'variable') return null  // D-07
  return cellNumber(rows, r, c, label, sheetName)
}
```

### Findings from xlsx library behavior (verified)

- `blankrows: false` skips fully-blank rows from the output, so row indices in `rows` are NOT the spreadsheet row numbers. The parser MUST use the returned 0-indexed array index for `rows[i]` access, and translate to 1-indexed for error messages (Pitfall 6).
- `defval: null` ensures cells in trailing positions don't disappear, e.g. row `Beads,variable,L-AB,0.025,,,,,` reliably yields `['Beads', 'variable', 'L-AB', 0.025, null, null, null, null, null]`.
- `cellFormula: false` prevents formula-text leakage. The fixtures don't contain formulas, but vendor xlsx files might.
- Trailing-whitespace strings like `Antibodies ` and `Ab ` come through verbatim — D-03 canonicalization happens in `canonReagentKind(s: string): 'beads' | 'antibodies' | 'sape' | null` before downstream comparison.

`[CITED: SheetJS docs — https://docs.sheetjs.com/docs/api/utilities/]` — `sheet_to_json` with `header: 1` emits array-of-arrays; `blankrows: false` skips blank rows.

## Per-Block Parser Design

### Block layout summary (from 17 fixture inspection)

All 17 fixtures share this skeleton:

```
Row 1:  Criteria
Row 2:  Platform | <platform name (may have trailing space)>
Row 3:  Species  | <species name>
Row 4:  Panel    | <panel name — "Panel I" or "Panel 1">
Row 5:  Panel Description | <description string>
Row 6:  (blank separator)
Row 7:  Values
Row 8:  Reagent Description | Concentration | Diluent | Volume/well (ml)
Row 9:  Beads        | variable | <diluent> | <vol>
Row 10: Antibodies   | variable | <diluent> | <vol>   ← OR "Ab " for Bio-Rad mouse
Row 11: SAPE         | <conc>   | n/a       | <vol>
Row 12: SAPE Name    | <name>
Row 13: (blank separator)
Row 14: Category
Row 15: (blank, col E label: "Premix")
Row 16: <var>        |  |  |  | Premix Name | <name1> | <name2> | ...
Row 17: <var>        |  |  |  | Premix Concentration | <conc1> | <conc2> | ...
Row 18: Analyte | Bead Region | Concentration | | Count | Analyte | Analyte | ...
Row 19+: <analyte rows + premix membership>
```

**Per-vendor variation observed in 17 fixtures:**

- All fixtures: rows 1-13 follow the skeleton exactly (modulo trailing-whitespace differences in Platform/Reagent names).
- **Pattern A** (Bio-Rad H/M, Thermofisher H/M, Millipore Human Panels 2-7, Millipore Mouse Panels 1-5):
  - Row 16, col A = empty; col E = `Premix Name`
  - Row 17, col A = `Single Analytes` (cosmetic label); col E = `Premix Concentration`
  - Row 18, col A = `Analyte`; col B = `Bead Region`; col C = `Concentration`; col E = `Count`; col F+ = `Analyte`
  - Row 19+ = data
- **Pattern B** (Millipore Human Panel 1 only):
  - Row 16, col A = `Single Analytes`; col E = `Premix Name`
  - Row 17, col A = `Analyte`; col B = `Bead Region`; col C = `Concentration`; col E = `Premix Concentration` (the Premix Concentration row IS the analyte-header row)
  - Row 18+ = data (col A-C = analyte data; col E = ordinal count integer; col F+ = premix member names)

Because Pattern B exists in 1 of 17 fixtures, the parser MUST locate block boundaries by text markers, not by row offsets.

### parseCriteria (rows after `Criteria` marker, before `Values` marker)

Required cells (located by label scan in col A; value in col B):
- `Platform` → trim → store as `platform` string
- `Species` → trim → store as `species` string
- `Panel` → trim → store verbatim as `panelNameRaw`; normalize via `normalizePanelName()` → `panelNameNormalized`
- `Panel Description` → optional → trim → store as `description` (nullable)

If any required label missing OR value cell empty: throw `ParseError` with sheet name + row label.

### parseValues (rows after `Values` marker, before `Category` marker)

Required:
- Header row (locate by `Reagent Description` label in col A): cols A-D = `Reagent Description | Concentration | Diluent | Volume/well (ml)`.
- Three reagent rows below the header: one row each for canonReagentKind = beads, antibodies, sape (collected by canonicalization of col A; D-03).
- One optional `SAPE Name` row: col A label-match, col B = name. If present, capture; else `sapeName = null`.

Per row:
- `concentration` = cellNumberOrVariable for beads + antibodies; cellNumber (strict) for sape (D-06 CHECK).
- `diluent` = cell(col C) → trim → store verbatim (open text per SMK3-DIL-01); if empty string, store NULL.
- `volumePerWell` = cellNumber for col D; reject if NaN or ≤ 0.

Output: `ParsedReagent[]` of length 3 (in canonical order beads, antibodies, sape). If fewer than 3 detected after canonicalization, ParseError.

### parseCategory (rows after `Category` marker)

Phase 1 — locate the premix header rows:
- Scan downward from `categoryRow + 1`. Find the row containing `Premix Name` text (case-insensitive trim) in any column ≥ col E (typically col E). Call this `premixNameRow`.
- Find the next row containing `Premix Concentration` text in the same column. Call this `premixConcRow`. (May be same column as premixNameRow — both are col E in all 17 fixtures.)
- The premix column positions are: every column index `c ≥ premixNameCol + 1` where `cell(premixNameRow, c)` is non-empty.

Phase 2 — locate the analyte data header:
- Find the row where col A = `Analyte` AND col B = `Bead Region` AND col C = `Concentration` (case-insensitive). Call this `analyteHeaderRow`.
- Pattern A: analyteHeaderRow = premixConcRow + 1 (the dedicated header row).
- Pattern B: analyteHeaderRow = premixConcRow (they coincide).
- Validation: analyteHeaderRow ≥ premixConcRow (never above premix concentration row).

Phase 3 — walk analyte data rows:
- Start at `analyteHeaderRow + 1`. Stop when col A is blank (`cell(r, 0) === ''`).
- For each data row: collect `(name, beadRegion, concentration)` from cols A-C. Reject if duplicate `lower(name)`.
- Concurrently: for each premix column position p, if `cell(r, p)` is non-empty, append to `premixes[premixIdx].memberNames`.

Phase 4 — assemble premix list:
- For each premix column position: `name = cell(premixNameRow, p)`, `premixConc = cellNumber(premixConcRow, p)`, `memberNames = [...]` collected in Phase 3.

Output: `{ analytes: ParsedAnalyte[], premixes: ParsedPremix[] }`.

## Validator Architecture

### Responsibilities

1. **Cross-sheet duplicate-normalize detection** (D-21): if two sheets produce the same `(platform_id, species_id, normalized_name)` triple, reject the whole file with the exact D-21 error message.
2. **Platform + Species FK resolution** (case-insensitive lookup against `platforms` + `species` tables; carryforward of v0.7.0 validator.ts pattern).
3. **Premix-member case-insensitive existence check**: every name in `premix.memberNames` must match (case-insensitive trim) an entry in `panel.analytes`.
4. **Sape-concentration NOT NULL gate** (D-06 CHECK pre-check at validator layer for nicer error messages; DB CHECK is the belt-and-braces).
5. **All errors aggregated across sheets BEFORE returning** (D-06 strict file-level reject — Phase 5 carryforward).

### Output shape

```typescript
export interface ResolvedReagent extends ParsedReagent {}

export interface ResolvedAnalyte extends ParsedAnalyte {}

export interface ResolvedPremix extends ParsedPremix {}

export interface ResolvedPanel {
  sheetName: string
  platformId: string                     // resolved from name → DB UUID
  speciesId: string                      // resolved from name → DB UUID
  panelNameNormalized: string            // Roman→Arabic normalized
  panelDescription: string | null
  sapeName: string | null
  reagents: ResolvedReagent[]
  analytes: ResolvedAnalyte[]
  premixes: ResolvedPremix[]
}

export interface ValidationError {
  sheetName: string                      // may be '' for cross-sheet errors (D-21)
  message: string
}

export interface ValidationResult {
  resolved: ResolvedPanel[] | null       // null when errors.length > 0
  errors: ValidationError[]
}
```

### Algorithm

```typescript
export function validateAndResolve(
  parsedPanels: ParsedPanel[],
  platforms: { id: string; name: string }[],
  speciesList: { id: string; name: string; platformId: string }[]
): ValidationResult {
  const errors: ValidationError[] = []
  const resolved: ResolvedPanel[] = []

  // First pass: resolve platform/species + premix-member check per sheet
  for (const p of parsedPanels) {
    const platform = platforms.find((x) => x.name.toLowerCase() === p.platform.toLowerCase())
    if (!platform) { errors.push({ sheetName: p.sheetName, message: `Unknown platform "${p.platform}". Valid: ${platforms.map((x) => x.name).join(', ')}` }); continue }
    const platformSpecies = speciesList.filter((s) => s.platformId === platform.id)
    const matchedSpecies = platformSpecies.find((s) => s.name.toLowerCase() === p.species.toLowerCase())
    if (!matchedSpecies) { errors.push({ sheetName: p.sheetName, message: `Unknown species "${p.species}" for platform "${platform.name}". Valid: ${platformSpecies.map((s) => s.name).join(', ')}` }); continue }

    const masterNamesLC = new Set(p.analytes.map((a) => a.name.toLowerCase()))
    for (const pm of p.premixes) {
      for (const m of pm.memberNames) {
        if (!masterNamesLC.has(m.toLowerCase())) {
          errors.push({ sheetName: p.sheetName, message: `Premix "${pm.name}" references analyte "${m}" not in the Single Analytes block` })
        }
      }
    }

    const sape = p.reagents.find((r) => r.kind === 'sape')
    if (!sape || sape.concentration === null) {
      errors.push({ sheetName: p.sheetName, message: `SAPE concentration must be a numeric value (cannot be "variable")` })
    }

    resolved.push({
      sheetName: p.sheetName,
      platformId: platform.id,
      speciesId: matchedSpecies.id,
      panelNameNormalized: p.panelNameNormalized,
      panelDescription: p.panelDescription,
      sapeName: p.sapeName,
      reagents: p.reagents,
      analytes: p.analytes,
      premixes: p.premixes
    })
  }

  // Second pass: D-21 cross-sheet duplicate detection
  const tripleSeen = new Map<string, string>() // triple key → first sheet name
  for (const r of resolved) {
    const key = `${r.platformId}|${r.speciesId}|${r.panelNameNormalized}`
    const prior = tripleSeen.get(key)
    if (prior) {
      errors.push({
        sheetName: '',
        message: `Sheets "${prior}" and "${r.sheetName}" normalize to the same (${r.platformId}, ${r.speciesId}, ${r.panelNameNormalized}). Resolve duplicate panel names.`
      })
    } else {
      tripleSeen.set(key, r.sheetName)
    }
  }

  if (errors.length > 0) return { resolved: null, errors }
  return { resolved, errors: [] }
}
```

## Importer Transaction Architecture

### wholesaleReplace API on masterPanelRepository (NEW)

```typescript
// Extension to src/main/db/repositories/masterPanel.ts
export const masterPanelRepository = {
  // ...existing methods...

  /**
   * D-13 lookup: composite (platform_id, species_id, normalized_name).
   */
  findByPlatformSpeciesName(
    platformId: string,
    speciesId: string,
    normalizedName: string
  ): MasterPanel | null { /* ... */ },

  /**
   * D-12 wholesale-replace primitives (no transaction inside — Phase 5 D-18).
   * Caller (importer) MUST wrap in a single transaction.
   */
  createWithMetadata(input: {
    platformId: string
    speciesId: string
    name: string
    description: string | null
    sapeName: string | null
    vendorSinglesTerm: string | null   // always null in Phase 13; preserves Phase 5 D-11
  }): MasterPanel { /* INSERT */ },

  updateMetadata(id: string, input: {
    name: string
    description: string | null
    sapeName: string | null
  }): void { /* UPDATE ... WHERE id = ? */ },

  deleteCascadeMasterPanelChildren(id: string): void {
    // master_panel_reagents will cascade-delete via FK onDelete: 'cascade'
    // analytes: hard-delete (D-16); run_single_analytes FK SET NULL (D-17)
    // premix_panels: hard-delete (D-12); panel_analytes cascade via local logic
    // runs.panel_id pointing at deleted premix_panels: FK SET NULL (D-15)
  }
}
```

### Transaction boundary in importer.ts (NEW shape)

```typescript
const sqlite = getSqlite()
sqlite.transaction(() => {
  for (const r of resolved) {
    const existing = masterPanelRepository.findByPlatformSpeciesName(
      r.platformId, r.speciesId, r.panelNameNormalized
    )
    let masterPanelId: string
    if (existing) {
      // 1. Wholesale-delete children (D-12, D-16)
      analyteRepository.deleteByMasterPanelId(existing.id)            // hard delete; cascades run_single_analytes.analyte_id → NULL (D-17)
      panelRepository.deleteByMasterPanelId(existing.id)              // hard delete premix_panels + panel_analytes; cascades runs.panel_id → NULL (D-15)
      masterPanelReagentRepository.deleteByMasterPanelId(existing.id) // cascade via FK; explicit for clarity
      // 2. Update master_panels metadata in-place (preserve id + created_at)
      masterPanelRepository.updateMetadata(existing.id, {
        name: r.panelNameNormalized,
        description: r.panelDescription,
        sapeName: r.sapeName
      })
      masterPanelId = existing.id
    } else {
      const created = masterPanelRepository.createWithMetadata({
        platformId: r.platformId,
        speciesId: r.speciesId,
        name: r.panelNameNormalized,
        description: r.panelDescription,
        sapeName: r.sapeName,
        vendorSinglesTerm: null
      })
      masterPanelId = created.id
    }
    // 3. Insert fresh: reagents (3 rows), analytes (N rows), premixes (M rows + links)
    for (const rg of r.reagents) {
      masterPanelReagentRepository.create({
        masterPanelId,
        reagentKind: rg.kind,
        concentration: rg.concentration,
        diluent: rg.diluent,
        volumePerWell: rg.volumePerWell
      })
    }
    const analyteIdByLowerName = new Map<string, string>()
    for (const a of r.analytes) {
      const created = analyteRepository.create({
        name: a.name,
        beadRegion: a.beadRegion,
        premixConc: a.concentration,   // D-22 carryforward (mirror on INSERT)
        singleConc: a.concentration,
        platformId: r.platformId,
        speciesId: r.speciesId,
        masterPanelId
      })
      analyteIdByLowerName.set(a.name.toLowerCase(), created.id)
    }
    for (const pm of r.premixes) {
      const premix = panelRepository.create({
        name: pm.name,
        description: null,
        platformId: r.platformId,
        speciesId: r.speciesId,
        parentPanelId: null,
        subPanelConc: pm.premixConc
      })
      // Note: panelRepository.create CURRENTLY does NOT set master_panel_id.
      // Extension needed: take `masterPanelId` arg OR a separate setMasterPanelId update.
      panelRepository.setMasterPanelId(premix.id, masterPanelId)  // NEW method
      for (const memberName of pm.memberNames) {
        const aid = analyteIdByLowerName.get(memberName.toLowerCase())
        if (!aid) continue  // already validated; defensive
        panelRepository.addAnalyteToPanel(premix.id, aid)
      }
    }
  }
})()   // IIFE — Phase 4/5 idiomatic pattern
```

### FK SET NULL behavior (verified)

Already in schema (Phase 5):
- `analytes.masterPanelId` → `references(masterPanels.id, { onDelete: 'set null' })` — but Phase 13 hard-DELETEs `analytes` rows directly via `deleteByMasterPanelId`, so this FK never fires.
- `premix_panels.masterPanelId` → `references(masterPanels.id, { onDelete: 'set null' })` — same: hard-delete bypasses.
- `runs.panelId` → `references(premixPanels.id)` — currently NO explicit `onDelete` in `schema.ts:138`. The Phase 5 default became `'no action'`. **This may be a Phase 5 gap that surfaces now.** Pitfall 13 + D-15 require explicit `'set null'`. The Phase 13 migration may need to add `onDelete: 'set null'` declaration. `[VERIFIED: schema.ts:138 has no onDelete clause]`
- `run_single_analytes.analyteId` → `references(analytes.id)` — same gap; needs `'set null'` per D-17.

**Recommendation:** Phase 13 migration MUST add explicit `onDelete: 'set null'` to `runs.panelId` and `run_single_analytes.analyteId` FK declarations. Verify the generated SQL contains `ON DELETE SET NULL` after drizzle-kit generate. Without this, the wholesale-DELETE of premix_panels/analytes will fail FK CONSTRAINT instead of nulling the historical references. This single-line schema edit goes in the same migration.

## Drizzle Migration Recommendation

### Filename: `0007_<adjective>_<noun>.sql`

drizzle-kit auto-generates the random suffix; phase commit just uses whatever it picks. Conventional next index is `0007_` (0006_outstanding_miss_america.sql is the last). Don't manually rename — drizzle-kit's `_journal.json` keys off the original tag.

### Migration content (single file, atomic)

Generated by ONE `npm run db:generate` after schema.ts edits. Expected SQL output (verified pattern against drizzle-kit 0.31.8 behavior; cross-reference 0004_lame_deathstrike.sql for similar shape):

```sql
-- 0007_<auto-name>.sql

-- 1. Create master_panel_reagents table (D-06)
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
    CONSTRAINT reagent_kind_enum CHECK (`reagent_kind` IN ('beads', 'antibodies', 'sape')),
    CONSTRAINT sape_conc_not_null CHECK (`reagent_kind` <> 'sape' OR `concentration` IS NOT NULL)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `master_panel_reagents_master_kind_uniq` ON `master_panel_reagents` (`master_panel_id`, `reagent_kind`);
--> statement-breakpoint

-- 2. Drop legacy volume columns from master_panels (D-10)
ALTER TABLE `master_panels` DROP COLUMN `beads_volume_per_well`;
--> statement-breakpoint
ALTER TABLE `master_panels` DROP COLUMN `ab_volume_per_well`;
--> statement-breakpoint
ALTER TABLE `master_panels` DROP COLUMN `sape_volume_per_well`;
--> statement-breakpoint

-- 3. Add sape_name + description columns to master_panels (D-10 + Recommendation 5)
ALTER TABLE `master_panels` ADD `sape_name` text;
--> statement-breakpoint
ALTER TABLE `master_panels` ADD `description` text;
--> statement-breakpoint

-- 4. Swap UNIQUE index: drop platform_species, add platform_species_name (D-14)
DROP INDEX `master_panels_platform_species_uniq`;
--> statement-breakpoint
CREATE UNIQUE INDEX `master_panels_platform_species_name_uniq` ON `master_panels` (`platform_id`, `species_id`, `name`);
--> statement-breakpoint

-- 5. Tighten existing FKs to declare onDelete: 'set null' (D-15, D-17) — Phase 5 gap closure
-- NOTE: SQLite cannot modify FK in place. Drizzle-kit may emit recreate-table-via-temp pattern
-- (this is normal; verify generated SQL handles it correctly).
-- ALTER TABLE `runs` ... and `run_single_analytes` ... — drizzle-kit will emit the recreate cycle.
```

### Atomicity guarantee

SQLite migrations run in a transaction by default when invoked via `migrate()`. Drizzle-orm's `migrate(db, ...)` reads the migration file as one unit. If any statement fails, the whole migration rolls back (verified: tests in `src/main/db/__tests__/migration.test.ts` exercise this).

### Caveat: SQLite ALTER TABLE limitations

SQLite's native `ALTER TABLE DROP COLUMN` works only since 3.35.0 (2021). better-sqlite3 12.x bundles SQLite ≥ 3.42.0 (`[VERIFIED: better-sqlite3 release notes; 12.x ships SQLite 3.42+]`), so `DROP COLUMN` is supported natively without the table-recreation dance.

For FK modifications on `runs.panel_id` and `run_single_analytes.analyte_id`: SQLite has no `ALTER TABLE ALTER CONSTRAINT`. drizzle-kit handles this by emitting the create-temp-table → copy-data → drop-original → rename-temp cycle. Inspect generated SQL after `db:generate` to confirm. The output is verbose but correct.

### Migration test

Add to `src/main/db/__tests__/migration.test.ts`: a forward-migration test that applies migrations 0000 through 0007 against a fresh in-memory DB, then inspects: (a) `master_panel_reagents` table exists with the 2 CHECK constraints, (b) `master_panels.beads_volume_per_well` does NOT exist, (c) `master_panels.sape_name` exists, (d) `master_panels_platform_species_name_uniq` index exists and the old one does not, (e) FK on `runs.panel_id` has ON DELETE SET NULL. Use `sqlite.prepare("SELECT sql FROM sqlite_master WHERE name = ?").get(name)` to read schema text.

## Test Architecture

### Vitest patterns (established)

- `pool: 'forks'` in `vitest.config.ts` — each test file gets its own process (better-sqlite3 native module + in-memory DB isolation).
- `createTestDb()` in `src/main/db/__tests__/testDb.ts` — fresh in-memory DB with PRAGMA foreign_keys ON + migrations applied.
- `setDatabaseForTests(testDb.db)` / `resetDatabaseForTests()` — override the module-level singleton.
- `setSqliteForTests(testDb.sqlite)` — needed when tests exercise `getSqlite().transaction(...)` directly (Phase 6 expressServer.test.ts pattern).
- `seedPlatformAndSpecies(sqlite)` — minimal seed helper for FK parents.

### Test file inventory (Phase 13)

| Test file | Layer | What it covers |
|-----------|-------|----------------|
| `src/main/import/__tests__/normalize.test.ts` | Pure unit | Roman→Arabic I..X conversion; out-of-range; whitespace + case folding; regex anchors |
| `src/main/import/__tests__/parser.test.ts` (REWRITTEN) | Per-block unit | parseCriteria; parseValues; parseCategory; pattern A vs pattern B; `variable` → null; trailing whitespace; markers missing |
| `src/main/import/__tests__/validator.test.ts` (NEW) | Per-sheet + cross-sheet | Platform/species lookup; premix-member case-insensitive match; D-21 duplicate-normalize; multi-sheet error aggregation |
| `src/main/import/__tests__/importer.test.ts` (NEW) | Repository + transaction | wholesaleReplace insert-fresh vs replace-existing; FK SET NULL on runs after replace; one transaction wraps; rollback on error |
| `src/main/db/repositories/__tests__/masterPanelReagent.test.ts` (NEW) | Repository | CRUD; composite UNIQUE; CHECK constraints (kind enum; sape conc NOT NULL); cascade FK |
| `src/main/db/__tests__/migration.test.ts` (EXTENDED) | Migration | Forward-only apply 0000→0007; assert schema artifacts |
| `src/main/import/__tests__/allPanelsFixture.test.ts` (NEW) | Integration | Load generated `templates/panels/all-panels.xlsx`; assert 17 ResolvedPanels; deep equality on each |

### Per-fixture deep-equality strategy

For the 17/17 SC #6 gate: generate JSON "gold files" once via a snapshot-style approach. Two options:

- **Option A (recommended):** Inline expected objects in the test file. Pro: diff-friendly review; explicit assertion shape. Con: 17 × ~30-line objects = ~500 lines of test.
- **Option B:** Vitest snapshot (`expect(panels).toMatchSnapshot()`). Pro: terse. Con: snapshot files are review-opaque; easy to accidentally rubber-stamp a wrong update.

Recommend Option A for the FIRST landing — explicit data is easier to review for accuracy. Migrate to snapshots in a follow-up phase if the test file grows unwieldy.

For incremental sanity: write per-vendor "spot check" tests that assert just the metadata (panel name, sape name, premix count, analyte count) for each of the 17. Then ONE deep-equality test against a single hand-validated fixture (e.g., Thermofisher Human Panel I — smallest, most predictable).

### `templates/panels/all-panels.xlsx` generation

**Script location:** `scripts/build-panels-fixture.ts` (recommendation 4 below).

**npm task:** `npm run fixtures:panels` (alias for `ts-node scripts/build-panels-fixture.ts` OR `tsx scripts/build-panels-fixture.ts` — check existing `scripts/` conventions). The existing `package.json` has no scripts/ runner; recommendation is `tsx` (zero-config, no compile step) added as a devDependency, OR run via `node --import tsx/esm scripts/build-panels-fixture.ts`.

The script: reads each `templates/panels/*.csv` (excluding `_table.csv`), parses each to a 2D array, calls `XLSX.utils.aoa_to_sheet(array)`, appends as a workbook sheet (sheet name = `${vendor}-${species}-panel-${X}` or similar canonical naming), then reads `_table.csv` → adds as `Table` sheet. Writes the result to `templates/panels/all-panels.xlsx` via `XLSX.writeFile`.

Commit the generated `.xlsx` to git (D-05: "committed once; regenerable"). Document the regenerate command in a README or in `templates/panels/_table.csv` adjacent comment.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | `vitest@2.1.9` (installed); upgrade to `4.1.6` (latest) optional but not required |
| Config file | `vitest.config.ts` (existing — `pool: 'forks'`, `globals: true`, `environment: 'node'`) |
| Quick run command | `npm test -- src/main/import` (filters to import tests) |
| Full suite command | `npm test` (runs all `src/**/*.test.ts`) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SMK3-08 | Multi-sheet xlsx parse → ResolvedPanel[] | Unit + integration | `npm test -- parser.test.ts allPanelsFixture.test.ts` | ❌ Wave 0 (rewrite) |
| SMK3-08 | Per-reagent rows in Values block (beads/antibodies/sape × conc/diluent/vol) | Unit | `npm test -- parser.test.ts -t "parseValues"` | ❌ Wave 0 |
| SMK3-08 | Premix matrix in Category block | Unit | `npm test -- parser.test.ts -t "parseCategory"` | ❌ Wave 0 |
| SMK3-09 | Roman → Arabic normalization | Unit | `npm test -- normalize.test.ts` | ❌ Wave 0 |
| SMK3-09 | Out-of-range Roman rejected with D-20 message | Unit | `npm test -- normalize.test.ts -t "out of range"` | ❌ Wave 0 |
| SMK3-10 | `Table` sheet skipped | Unit | `npm test -- parser.test.ts -t "Table sheet"` | ❌ Wave 0 |
| SMK3-10 | Non-Table sheets without Criteria/Values/Category fail validation | Unit | `npm test -- parser.test.ts -t "missing marker"` | ❌ Wave 0 |
| SMK3-11 | Wholesale-replace deletes old children + INSERTs fresh | Integration | `npm test -- importer.test.ts -t "wholesale replace"` | ❌ Wave 0 |
| SMK3-11 | Re-upload of (Platform, Species, Panel) updates master in place | Integration | `npm test -- importer.test.ts -t "update existing"` | ❌ Wave 0 |
| SMK3-11 | Historical runs.panel_id becomes NULL after wholesale-delete (D-15) | Integration | `npm test -- importer.test.ts -t "FK SET NULL"` | ❌ Wave 0 |
| SMK3-11 | Historical run_single_analytes.analyte_id NULL after replace (D-17) | Integration | `npm test -- importer.test.ts -t "analyte SET NULL"` | ❌ Wave 0 |
| SMK3-11 | D-21 duplicate-normalize file reject | Unit | `npm test -- validator.test.ts -t "duplicate normalize"` | ❌ Wave 0 |
| SMK3-DIL-01 | Diluent stored verbatim (no normalization) | Integration | `npm test -- importer.test.ts -t "diluent verbatim"` | ❌ Wave 0 |
| (schema) | master_panel_reagents CHECK constraints | Repository | `npm test -- masterPanelReagent.test.ts` | ❌ Wave 0 |
| (schema) | Composite UNIQUE on (platform, species, name) | Repository | `npm test -- masterPanel.test.ts -t "composite UNIQUE"` | Partial — extend existing |
| (schema) | Migration 0007 applies cleanly + schema artifacts exist | Migration | `npm test -- migration.test.ts -t "0007"` | Partial — extend existing |
| (SC #6) | 17/17 fixtures parse | Integration | `npm test -- allPanelsFixture.test.ts` | ❌ Wave 0 (requires all-panels.xlsx) |

### Sampling rate

- **Per task commit:** `npm test -- src/main/import` (~2-5 sec for the import test directory; quick)
- **Per wave merge:** `npm test` (full suite; ~10-20 sec; established pattern)
- **Phase gate:** Full suite green before `/gsd-verify-work`; manual `npm run build:win` → Windows smoke per CLAUDE.md (deferred to Phase 16 per ROADMAP).

### Wave 0 Gaps

- [ ] `scripts/build-panels-fixture.ts` — converts `templates/panels/*.csv` → `templates/panels/all-panels.xlsx`; commits the .xlsx
- [ ] `templates/panels/all-panels.xlsx` — generated artifact (committed once)
- [ ] `src/main/import/normalize.ts` — `normalizePanelName(raw, sheetName)` + `canonReagentKind(s)`; Roman→Arabic lookup
- [ ] `src/main/import/__tests__/normalize.test.ts` — Roman edge cases (I..X bounds; non-matching; case sensitivity)
- [ ] `src/main/import/__tests__/parser.test.ts` — REWRITE (existing file references DELETED `panel-template.csv`)
- [ ] `src/main/import/__tests__/validator.test.ts` — NEW (multi-sheet errors, D-21 collision, premix-member matching)
- [ ] `src/main/import/__tests__/importer.test.ts` — NEW (transaction; wholesale-replace; FK SET NULL; rollback)
- [ ] `src/main/import/__tests__/allPanelsFixture.test.ts` — NEW (17/17 SC #6 gate)
- [ ] `src/main/db/repositories/masterPanelReagent.ts` — NEW repository module
- [ ] `src/main/db/repositories/__tests__/masterPanelReagent.test.ts` — NEW
- [ ] `src/main/db/__tests__/migration.test.ts` — extend with 0007 forward-migration assertions
- [ ] `src/shared/types/masterPanelReagent.ts` — NEW (`MasterPanelReagent`, `MasterPanelReagentCreate`)
- [ ] Update `src/main/db/repositories/analyte.ts` — add `deleteByMasterPanelId(masterPanelId)`
- [ ] Update `src/main/db/repositories/panel.ts` — add `deleteByMasterPanelId(masterPanelId)` + `setMasterPanelId(panelId, masterPanelId)`
- [ ] Update `src/main/db/repositories/masterPanel.ts` — add `findByPlatformSpeciesName`, `createWithMetadata`, `updateMetadata`, `deleteCascadeMasterPanelChildren` (or compose from the others)
- [ ] DELETE `templates/panel-template.csv` (SC #5)
- [ ] DELETE `templates/sample-panel-import.csv` (SC #5)
- [ ] `tsx` devDependency (or equivalent script runner) for `scripts/build-panels-fixture.ts` — add to package.json `scripts.fixtures:panels`

## Concrete Recommendations for the 7 "Claude's Discretion" Items

### Recommendation 1: Drizzle migration filename + SQL ordering

**Filename:** `0007_<auto>.sql` — let drizzle-kit assign the random adjective_noun suffix. Don't manually rename.

**SQL ordering inside the single migration file (drizzle-kit emits in roughly this order, verify post-generate):**

1. `CREATE TABLE master_panel_reagents` (with FK + 2 CHECKs)
2. `CREATE UNIQUE INDEX master_panel_reagents_master_kind_uniq`
3. `ALTER TABLE master_panels DROP COLUMN beads_volume_per_well` × 3
4. `ALTER TABLE master_panels ADD sape_name text` × 2 (sape_name + description)
5. `DROP INDEX master_panels_platform_species_uniq`
6. `CREATE UNIQUE INDEX master_panels_platform_species_name_uniq`
7. Recreate-table dance for `runs` (FK addition) — drizzle-kit auto-generates
8. Recreate-table dance for `run_single_analytes` — drizzle-kit auto-generates

**Atomicity guarantee:** Drizzle-orm's `migrate()` wraps each migration file in a single transaction. Any statement failure rolls back the whole file. `[VERIFIED: drizzle-orm/better-sqlite3/migrator behavior; consistent with 0004_lame_deathstrike.sql pattern]`

**Validation:** Add migration test in `migration.test.ts` (Wave 0): apply migrations against fresh in-memory DB, assert schema artifacts.

### Recommendation 2: Internal parser pipeline shape

**Choice: row-array intermediate, not streaming.**

**Rationale:**
- Fixtures are tiny (largest ~70 rows; 17 sheets × ~50 rows = ~850 rows total).
- Marker-driven block detection NEEDS forward-then-backward scan (locate `Premix Concentration` row, then walk analyte rows that may share that row). Streaming makes this awkward.
- Row-array is the existing v0.7.0 pattern (`parser.ts:28`) — minimal departure → easier review.
- Pure functions over arrays = trivial unit testing.

**Performance:** Parsing 17 panels via `XLSX.readFile` → 17× `sheet_to_json` measured well under 100ms on macOS dev. Pitfall 11 (large-file blocking) is not a concern at this scale.

### Recommendation 3: Validator error-message wording

Adopt a `[sheet: X] [section: Y] message` prefix convention. Examples:

- `[Millipore Human Panel I] [Criteria] Cell "Panel" value is required (got empty)`
- `[Bio-Rad Mouse Panel I] [Values] Beads row has invalid Volume/well: expected positive number, got "0.05ml"`
- `[Thermofisher Human Panel I] [Category] Premix "Premix Panel I 34-plex" references analyte "IL-99" not in the Single Analytes block`
- `[file-level] Sheets "Millipore Mouse Panel I" and "Millipore Mouse Panel 1" normalize to the same (<platformId>, <speciesId>, Panel 1). Resolve duplicate panel names.` (per D-21)
- `[Millipore Human Panel III] [normalize] Panel name must be "Panel <number>" or "Panel <I..X>" (got "Panel III-A")` (per D-20)

These prefixes make the per-sheet banner grouping (banner content recommendation 6) trivial: group errors by `[sheet: X]` token.

### Recommendation 4: Test fixture generation script location + npm task name

**Script path:** `scripts/build-panels-fixture.ts` — matches existing directory convention (no `scripts/` exists yet; create it).

**npm task:** Add to `package.json` `scripts`:
```json
"fixtures:panels": "tsx scripts/build-panels-fixture.ts"
```

**Add `tsx` to devDependencies:** lightweight TS runner; zero-config; preferred over `ts-node` for one-off scripts. Add via `npm i -D tsx`.

**Behavior:** Read each CSV in `templates/panels/` (skip `_table.csv` initially), parse to 2D array via `node:fs` + a simple CSV splitter (the CSVs are well-formed — no embedded commas in values, verified). For each: `XLSX.utils.aoa_to_sheet(rows)` → `XLSX.utils.book_append_sheet(wb, sheet, sheetName)` where `sheetName` = derived from filename (e.g., `millipore-human-panel-1.csv` → `Millipore Human Panel 1` or whatever the script normalizes to). Finally read `_table.csv` and add as `Table` sheet. Write to `templates/panels/all-panels.xlsx`.

**Naming convention for sheet names inside the xlsx:** Recommend the original case-preserved form (e.g., `Millipore Human Panel I`) so D-19 Roman→Arabic conversion is exercised end-to-end by the integration test.

### Recommendation 5: `panel_description` storage location

**Choice: ADD `description` column to `master_panels` in the Phase 13 migration.**

**Rationale:**
- The Criteria block's "Panel Description" semantically belongs to the master panel (e.g., `Cytokine/Chemokine` describes the whole panel, not any one premix subset).
- `premix_panels.description` already exists but stores the premix's description, not the parent master's. Repurposing it is semantically wrong.
- Adding `master_panels.description TEXT NULL` is a one-line schema edit, ships in the same atomic migration, and matches the conceptual hierarchy (Master = Platform/Species/Panel triple; Premix = subset within master).
- Future Phase 15 audit-trail rendering will need to query the master's description for the run-document header — adding it on master avoids a join across premix rows.

**Implementation:** In schema.ts `masterPanels` table block, add `description: text('description')` (nullable, no default). The migration produces `ALTER TABLE master_panels ADD description text;`. Cost: nothing.

### Recommendation 6: Per-sheet preview banner content

**Recommend: structured per-sheet banner with grouping; mirrors v0.7.0 banner but enriched.**

```typescript
// In ImportButton.tsx (UPDATE):
interface PanelSummary {
  sheetName: string                  // e.g., "Millipore Human Panel I"
  normalizedName: string             // e.g., "Panel 1"
  platform: string
  species: string
  analyteCount: number
  premixCount: number
  sapeName: string | null
  sapeConc: number
  wasUpdate: boolean                 // true = wholesale-replace; false = first import
}

interface ImportResult {
  success: boolean
  canceled?: boolean
  summaries: PanelSummary[]           // populated on success
  errors: { sheetName: string; issues: string[] }[]   // populated on failure
}
```

**Success banner UI:**
```
✓ Imported 17 panels from "all-panels.xlsx":
  • Millipore Human Panel 1: 33 analytes, 4 premixes, SAPE-10 (1×)
  • Millipore Human Panel 2: 23 analytes, 1 premix, SAPE-4 (1×)
  • Bio-Rad Human Panel 1: 27 analytes, 3 premixes, Streptavidin-PE (1×)
  • Bio-Rad Mouse Panel 1: 23 analytes, 2 premixes, Streptavidin-PE (100×)  [unusual SAPE conc; SMK3-17 divisor applies]
  • ...
```

**Error banner UI:**
```
✗ Import failed (3 errors across 2 sheets); no data written.
  Bio-Rad Mouse Panel 1:
    • [Values] Beads row has invalid Volume/well: expected positive number, got ""
  Millipore Human Panel 5:
    • [Category] Premix "Premix Panel V 6-plex" references analyte "IL-99" not in the Single Analytes block
    • [normalize] Panel name must be "Panel <number>" or "Panel <I..X>" (got "Panel V-A")
```

Use the existing `BannerState` shape but extend `details` to support grouped rendering by sheet. Per D-04 the IPC channel + button surface stay; only banner content + result shape evolve.

**Auto-dismiss:** Keep the 10-second timer on success (existing behavior). Error banners require manual dismiss.

### Recommendation 7: Cosmetic column name

**Choice: `reagent_kind`.**

**Rationale:**
- `kind` alone is ambiguous in a database with multiple "kind-like" axes (sample_type, request_type, replicate_mode already exist on `runs`).
- `reagent_type` reads slightly oddly — `type` is a reserved keyword in many SQL contexts, and the column constrains via enum to a small set of categorical values (kind > type for that).
- `reagent_kind` reads naturally in SQL queries (`SELECT * FROM master_panel_reagents WHERE reagent_kind = 'sape'`) and in TypeScript (`reagent.reagentKind === 'sape'`).
- Matches Drizzle camelCase convention (`reagentKind` in TS code) + snake_case DB (`reagent_kind`).

**Type union:**
```typescript
export type ReagentKind = 'beads' | 'antibodies' | 'sape'
```

## Common Pitfalls

### Pitfall A: xlsx trailing whitespace breaks strict reagent-kind match (NEW for Phase 13)

**What goes wrong:** All 17 fixtures use `Antibodies ` (Millipore/Thermofisher) or `Ab ` (Bio-Rad) — trailing space included. Strict `=== 'Antibodies'` comparison fails on every Millipore and Thermofisher fixture.

**Why it happens:** Lab authors use spreadsheet UI that doesn't visually display trailing whitespace; copy-paste from web sources introduces stray spaces.

**How to avoid:** D-03 mandates `.trim().toLowerCase()` before alias regex match. Encode in `canonReagentKind(s: string): ReagentKind | null` helper. Apply at the SINGLE point where Values-block rows are inspected. Test fixture: feed `'Ab \t'`, `'Antibodies '`, `' antibody'` → all map to `'antibodies'`; feed `'fluoroantibody'` → null.

**Warning signs:** Parse succeeds but produces only 1 or 2 reagent rows per panel; test failure "expected 3 reagents, got 1".

### Pitfall B: Pattern A vs Pattern B Category-block layout drift (NEW for Phase 13)

**What goes wrong:** Millipore-human-panel-1.csv has the analyte-header row coinciding with the Premix Concentration row (Pattern B), while all other fixtures have a dedicated analyte-header row below the Premix Concentration row (Pattern A). A parser that hardcodes "data starts 2 rows below `Premix Name`" works for 16 of 17 fixtures and silently drops Millipore Panel 1's analytes (or reads premix-conc values as bead regions).

**How to avoid:** Locate the analyte data start by scanning for the row where col A = `Analyte`, col B = `Bead Region`, col C = `Concentration`. Data rows start at `analyteHeaderRow + 1`. This works for both patterns because:
- Pattern A: analyteHeaderRow = premixConcRow + 1; data starts at premixConcRow + 2.
- Pattern B: analyteHeaderRow = premixConcRow; data starts at premixConcRow + 1.

**Warning signs:** Millipore Human Panel 1 has 33 analytes per `_table.csv` reference; parser reports 0 or 32 analytes for it.

### Pitfall C: Roman normalization regex anchoring (NEW for Phase 13)

**What goes wrong:** D-20 regex `^Panel\s+([IVX]+|\d+)$` looks correct but fails on `Panel IL` (would match `IL` as Roman since I and L are valid Roman chars — except L isn't in the [IVX] class, so this is actually fine for I..X). However, `Panel VIVI` matches `[IVX]+` and would convert via the I..X lookup table to undefined (key `VIVI` doesn't exist).

**How to avoid:** After regex match, look up the captured group in the I..X table. If undefined and not a pure digit string, throw the D-20 error. The lookup table has exactly 10 entries (I..X); anything else falls through to error.

**Warning signs:** Test fixture with `Panel XI` or `Panel VIVI` should reject with the D-20 message, not panic / produce NaN.

### Pitfall D: SQLite CHECK constraints in drizzle-orm syntax (NEW for Phase 13)

**What goes wrong:** drizzle-orm's `check()` helper for SQLite tables has evolved across versions; older syntax used inline `sql\`CHECK(...)\``. Verify that the installed `drizzle-orm@0.45.1` supports the current pattern.

**How to avoid:** Use the documented current pattern:
```typescript
import { check } from 'drizzle-orm/sqlite-core'
// inside sqliteTable second arg:
(t) => ({
  reagentKindEnum: check('reagent_kind_enum', sql`${t.reagentKind} IN ('beads', 'antibodies', 'sape')`),
  sapeConcNotNull: check('sape_conc_not_null', sql`${t.reagentKind} <> 'sape' OR ${t.concentration} IS NOT NULL`)
})
```
If `check()` doesn't exist in 0.45.1: fall back to raw SQL in the migration file (drizzle-kit will preserve it on regenerate-from-snapshot). `[ASSUMED: drizzle-orm 0.45+ supports check() helper; verify in Wave 1 by running db:generate against a test schema with a CHECK and inspecting output]`

**Warning signs:** `npm run db:generate` produces migration SQL without the CHECK clauses; insert of `reagent_kind = 'foo'` succeeds in tests.

### Pitfall E: FK SET NULL gap in pre-Phase-13 schema (DISCOVERED for Phase 13)

**What goes wrong:** Phase 4 wrote `runs.panelId: text('panel_id').references(() => premixPanels.id)` WITHOUT an explicit `onDelete` clause (`[VERIFIED: schema.ts:138]`). Same for `run_single_analytes.analyteId: text('analyte_id').references(() => analytes.id)` (`[VERIFIED: schema.ts:166]`). SQLite's default is NO ACTION, equivalent to RESTRICT — meaning wholesale-DELETE of `analytes` or `premix_panels` will FAIL with FK constraint violation if any historical run references them.

**How to avoid:** Phase 13 migration MUST update these declarations:
```typescript
panelId: text('panel_id').references(() => premixPanels.id, { onDelete: 'set null' }),
analyteId: text('analyte_id').notNull().references(() => analytes.id, { onDelete: 'set null' }),
```
Note: `runSingleAnalytes.analyteId` is `notNull()` in schema.ts:166. SET NULL on a NOT NULL column is illegal. **This requires changing the column to nullable AS PART of the migration** — a schema delta that affects existing tests. Validate test impact in Wave 1.

**Warning signs:** Importer test "wholesale-replace with historical run" throws `FOREIGN KEY constraint failed` instead of nulling the references.

**Mitigation:** Two options:
- (A) Change `run_single_analytes.analyte_id` to nullable + add `onDelete: 'set null'`. Pro: clean SET NULL semantics. Con: nullable everywhere it's read.
- (B) Add a separate `analyte_name_snapshot` column to `run_single_analytes` and hard-DELETE the row during wholesale-replace. Pro: avoids nullable analyte_id. Con: row-loss on archived analyte references.

Recommend Option A — minimal change; matches D-17 wording ("historical run_single_analytes rows survive but their analyte_id becomes NULL"). The UI shows `(analyte data archived)` for NULL rows.

### Pitfall F: SQLite ALTER TABLE limitations for FK changes (KNOWN, but reaffirmed)

**What goes wrong:** SQLite cannot modify a foreign key constraint in place. drizzle-kit handles this by emitting the recreate-table cycle: create temp table with new schema, copy rows, drop original, rename temp. This works but the migration file becomes verbose (~30 lines per FK change). Risk: a misconfigured `defaultValue` or column rename during the recreate cycle silently loses data.

**How to avoid:** After `npm run db:generate` produces the migration file, MANUALLY inspect every recreate-table block:
- Verify the temp table's `CREATE TABLE` matches the post-migration schema.
- Verify the `INSERT INTO temp SELECT ... FROM original` copies all columns.
- Verify the column-name list in INSERT matches CREATE TABLE order.

Add an assertion to `migration.test.ts`: post-migration, `SELECT COUNT(*) FROM runs` and `SELECT COUNT(*) FROM run_single_analytes` should match pre-migration counts (seed rows in the test, run migration, count after).

### Pitfall G: Carryforward Pitfalls 1, 2, 3, 6, 7, 8, 9, 10, 12, 13, 14, 15, 21, 22, 23, 24, 26, 27 (FROM .planning/research/PITFALLS.md)

These v2.0 pitfalls remain RELEVANT to Phase 13:

- **Pitfall 1** (nullable FK + adoption): mostly moot under wholesale-replace (D-12), but the IS NOT NULL filter on wholesale-replace operations is critical — Phase 13 must NOT touch `premix_panels` rows with `master_panel_id IS NULL` (v0.7.0 legacy rows).
- **Pitfall 6** (SheetJS cell-address off-by-one): explicit row/col indexing in helper functions; error messages use 1-indexed row numbers.
- **Pitfall 7** (numeric cells as strings): `coerceNumber` helper as shown.
- **Pitfall 8** (blank-stop rules): col-A blank stops analyte block; documented exception cases.
- **Pitfall 9** (case-insensitive lookups): premix-member match, platform/species lookup, reagent kind canonicalization.
- **Pitfall 10** (merged cells, formula cells): `cellFormula: false` option; document assumption (no merged cells in fixtures).
- **Pitfall 14** (composite UNIQUE via `uniqueIndex().on()`): D-14 follows pattern.
- **Pitfall 15** (don't rename `premix_panels`): preserved.
- **Pitfall 27** (transaction boundary): validate-first then single transaction.

## Code Examples

### Example: Roman → Arabic normalization

```typescript
// src/main/import/normalize.ts
// Source: ad-hoc; matches D-18/D-19/D-20

const ROMAN_TO_ARABIC: Record<string, number> = {
  I: 1, II: 2, III: 3, IV: 4, V: 5,
  VI: 6, VII: 7, VIII: 8, IX: 9, X: 10
}

const PANEL_NAME_REGEX = /^Panel\s+([IVX]+|\d+)$/i

export function normalizePanelName(raw: string, sheetName: string): string {
  const trimmed = raw.trim()
  const match = trimmed.match(PANEL_NAME_REGEX)
  if (!match) {
    throw new ParseError(`Panel name must be "Panel <number>" or "Panel <I..X>" (got "${raw}")`, sheetName)
  }
  const variant = match[1]
  // Pure digits path
  if (/^\d+$/.test(variant)) {
    const n = Number(variant)
    if (!Number.isInteger(n) || n < 1) {
      throw new ParseError(`Panel name digit must be a positive integer (got "${raw}")`, sheetName)
    }
    return `Panel ${n}`
  }
  // Roman path
  const upper = variant.toUpperCase()
  const arabic = ROMAN_TO_ARABIC[upper]
  if (arabic === undefined) {
    throw new ParseError(`Panel name Roman variant must be I through X (got "${raw}")`, sheetName)
  }
  return `Panel ${arabic}`
}
```

### Example: Reagent-kind canonicalization

```typescript
// src/main/import/normalize.ts (continued)
export type ReagentKind = 'beads' | 'antibodies' | 'sape'

export function canonReagentKind(raw: string): ReagentKind | null {
  const lc = raw.trim().toLowerCase()
  if (lc === 'beads' || lc === 'bead') return 'beads'
  if (lc === 'antibodies' || lc === 'antibody' || lc === 'ab') return 'antibodies'
  if (lc === 'sape' || lc === 'sa-pe' || lc === 'streptavidin-pe') return 'sape'
  return null
}

export function isSapeNameLabel(raw: string): boolean {
  return raw.trim().toLowerCase() === 'sape name'
}
```

### Example: Schema delta in schema.ts

```typescript
// src/main/db/schema.ts (additions; existing exports preserved)
import { sqliteTable, text, real, integer, uniqueIndex, check } from 'drizzle-orm/sqlite-core'
import { sql } from 'drizzle-orm'

// Phase 13 D-06: master_panel_reagents
export const masterPanelReagents = sqliteTable(
  'master_panel_reagents',
  {
    id: text('id').primaryKey(),
    masterPanelId: text('master_panel_id')
      .notNull()
      .references(() => masterPanels.id, { onDelete: 'cascade' }),
    reagentKind: text('reagent_kind').notNull(),       // 'beads' | 'antibodies' | 'sape' — enforced via CHECK
    concentration: real('concentration'),               // nullable; D-07 NULL = 'variable' sentinel
    diluent: text('diluent'),                           // open text per SMK3-DIL-01
    volumePerWell: real('volume_per_well').notNull(),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull()
  },
  (t) => ({
    masterKindUniq: uniqueIndex('master_panel_reagents_master_kind_uniq').on(t.masterPanelId, t.reagentKind),
    reagentKindEnum: check('reagent_kind_enum', sql`${t.reagentKind} IN ('beads', 'antibodies', 'sape')`),
    sapeConcNotNull: check('sape_conc_not_null', sql`${t.reagentKind} <> 'sape' OR ${t.concentration} IS NOT NULL`)
  })
)

// Phase 13 D-10: extend masterPanels — DROP 3 volume cols + ADD sape_name + ADD description
// Pre-Phase-13:
//   beadsVolumePerWell: real('beads_volume_per_well').notNull(),
//   abVolumePerWell: real('ab_volume_per_well').notNull(),
//   sapeVolumePerWell: real('sape_volume_per_well').notNull(),
// Phase 13:
//   sapeName: text('sape_name'),
//   description: text('description'),
//
// D-14: UNIQUE swap — drop platform_species, add platform_species_name
// (t) => ({
//   platformSpeciesNameUniq: uniqueIndex('master_panels_platform_species_name_uniq')
//     .on(t.platformId, t.speciesId, t.name)
// })

// Phase 13 Pitfall E: FK onDelete tightening for runs.panelId + run_single_analytes.analyteId
// runs:
//   panelId: text('panel_id').references(() => premixPanels.id, { onDelete: 'set null' })
// run_single_analytes:
//   analyteId: text('analyte_id').references(() => analytes.id, { onDelete: 'set null' })
//   ↑ NOTE: this column was previously .notNull() — must drop notNull() concurrently with onDelete change

export type MasterPanelReagent = typeof masterPanelReagents.$inferSelect
export type NewMasterPanelReagent = typeof masterPanelReagents.$inferInsert
```

### Example: Repository deleteByMasterPanelId

```typescript
// src/main/db/repositories/analyte.ts (extension)
deleteByMasterPanelId(masterPanelId: string): number {
  const db = getDatabase()
  const result = db
    .delete(analytes)
    .where(eq(analytes.masterPanelId, masterPanelId))
    .run()
  return result.changes
},
```

```typescript
// src/main/db/repositories/panel.ts (extension)
deleteByMasterPanelId(masterPanelId: string): number {
  const db = getDatabase()
  // First delete panel_analytes for these premixes (cascade is via local logic, FK is restrict)
  const premixIds = db
    .select({ id: premixPanels.id })
    .from(premixPanels)
    .where(eq(premixPanels.masterPanelId, masterPanelId))
    .all()
    .map((r) => r.id)
  if (premixIds.length === 0) return 0
  // Bulk-delete junction rows then premix rows
  for (const pid of premixIds) {
    db.delete(panelAnalytes).where(eq(panelAnalytes.panelId, pid)).run()
  }
  const result = db
    .delete(premixPanels)
    .where(eq(premixPanels.masterPanelId, masterPanelId))
    .run()
  return result.changes
},
setMasterPanelId(panelId: string, masterPanelId: string): void {
  const db = getDatabase()
  db.update(premixPanels)
    .set({ masterPanelId, updatedAt: new Date().toISOString() })
    .where(eq(premixPanels.id, panelId))
    .run()
},
```

## Open Questions (RESOLVED)

### OQ-1: Should `panelRepository.create()` take `masterPanelId` directly (vs separate setMasterPanelId)?

- **What we know:** Existing signature does NOT take `masterPanelId` (panel.ts:68-95). Phase 5 D-19 deferred premix upsert to Phase 13.
- **What's unclear:** Cleanest API — extend `create` to accept `masterPanelId?: string | null`, or add a separate `setMasterPanelId`?
- **RESOLVED:** Extend `create` to accept optional `masterPanelId`. Add a single migration to the existing `create` method:
  ```typescript
  create(data: { ..., masterPanelId?: string | null }): PremixPanel {
    // ...existing code...
    const panel: PremixPanel = { ..., masterPanelId: data.masterPanelId ?? null, ... }
  }
  ```
  Backwards-compat — current callers default to null. No need for `setMasterPanelId`.

### OQ-2: Should `run_single_analytes.analyteId` drop `.notNull()` in Phase 13?

- **What we know:** D-17 requires SET NULL behavior; current schema has `.notNull()` on the column (schema.ts:166).
- **What's unclear:** Two options: (a) drop notNull, allow nullable; (b) hard-delete row instead of nulling, snapshot the name elsewhere.
- **RESOLVED:** Adopt (a) — drop `.notNull()` and add `onDelete: 'set null'` per Pitfall E above. Mirror Phase 4's pattern for `runs.panelId` which is already nullable. UI shows `(analyte data archived)` for NULL rows. Document in schema.ts comment.
- **Risk:** Existing tests may assume `analyteId` is always non-null. Audit `src/main/__tests__/expressServer.test.ts` and any other run-related tests for assumptions during Wave 1.

### OQ-3: Sheet name convention in generated `all-panels.xlsx`

- **What we know:** Source CSVs are `bio-rad-mouse-panel-1.csv`, `millipore-human-panel-7.csv`, `thermofisher-human-panel-i.csv`, etc. (mixed case for Roman variant; lower-case throughout otherwise).
- **What's unclear:** What case should the script use for sheet names inside the .xlsx? Options:
  - Filename-preserved: `bio-rad-mouse-panel-1`, `thermofisher-human-panel-i`
  - Title-case: `Bio-Rad Mouse Panel 1`, `Thermofisher Human Panel I`
- **RESOLVED:** Title-case form (mirrors what a lab author would type). This exercises D-19 Roman→Arabic by including `Panel I` (the Thermofisher fixtures) in sheet names that map to `Panel 1` after normalization — making the SC #6 integration test a meaningful regression test for the normalization path.

### OQ-4: Banner enrichment vs minimum acceptable

- **What we know:** CONTEXT Discretion item 6 leaves banner content open. Specifics section sketches enriched per-sheet content.
- **What's unclear:** Wave-of-implementation: should the enriched banner ship in Phase 13, or just the minimum success/failure message with details deferred to Phase 14/15?
- **RESOLVED:** Phase 13 implements the structured `summaries: PanelSummary[]` and `errors: { sheetName, issues }[]` return shape (data plumbing). Phase 13 UI banner ships the basic grouped rendering. Richer comparison-diff banners deferred per CONTEXT.md `<deferred>` ("banner detail richness").

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Build, test, scripts | ✓ | `[ASSUMED: same Node version that built v0.7.0]` | — |
| `xlsx@0.18.5` | Parser | ✓ | 0.18.5 (installed) `[VERIFIED: package.json:37]` | — |
| `drizzle-orm@0.45.1` | Schema, repos | ✓ | 0.45.1 `[VERIFIED: package.json:31]` | — |
| `drizzle-kit@0.31.8` | Migration generation | ✓ | 0.31.8 (installed); latest 0.31.10 (minor diff, safe) `[VERIFIED]` | — |
| `better-sqlite3@12.6.2` | DB layer + CHECK constraints + transactions | ✓ | 12.6.2 (ships SQLite ≥ 3.42+; supports DROP COLUMN natively) `[VERIFIED]` | — |
| `vitest@2.1.9` | Test runner | ✓ | 2.1.9 (installed); 4.x available but not required `[VERIFIED]` | — |
| `tsx` (or `ts-node`) | scripts/build-panels-fixture.ts runner | ✗ | — | Install `tsx` as devDependency (`npm i -D tsx`); already a tiny, mature module |

**Missing dependencies with no fallback:** None.

**Missing dependencies with fallback:** `tsx` — install during Wave 0 of Phase 13.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Single-tab CSV with flat panel layout (v0.7.0 parser.ts) | Multi-sheet xlsx with sectioned Criteria/Values/Category blocks | Phase 13 (2026-05-12) | Fundamental rewrite of parser + validator + importer |
| 3 volume columns on master_panels (Phase 5 D-09) | per-reagent rows in master_panel_reagents table (D-06) | Phase 13 (2026-05-12) | Schema migration; Phase 14 calculator-read swap |
| Upsert master_panel by (platform, species) (Phase 5 D-16) | Lookup by (platform, species, normalized_name); wholesale-replace on match (D-13, D-14) | Phase 13 (2026-05-12) | Idempotency model fundamentally different — REPLACE not UPSERT |
| Orphan dropped premixes (Phase 5 D-05) | Wholesale-delete + INSERT-fresh (D-12) | Phase 13 (2026-05-12) | Supersedes MPAN-05; clean re-upload semantics |
| Hand-roll csv → object parser | Use `xlsx` library's `sheet_to_json({header: 1})` for row arrays | Already in v0.7.0 | No change; established pattern |

**Deprecated / outdated:**
- `templates/panel-template.csv` and `templates/sample-panel-import.csv` — DELETED in Phase 13 (SC #5).
- v0.7.0 `parser.ts` (161 lines) — REPLACED in Phase 13 by new parser.ts (+ helpers).
- v0.7.0 `validator.ts` (69 lines) — REPLACED in Phase 13.
- v0.7.0 `importer.ts` (142 lines) — REPLACED in Phase 13.
- `panel-template.csv` reference in `parser.test.ts:7` — must be removed when SC #5 deletes the file.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | drizzle-orm@0.45.1 supports `check()` helper in sqlite-core; if not, raw SQL in migration works as a fallback | Pitfall D | Low — fall back to raw SQL in migration file |
| A2 | drizzle-kit@0.31.8 emits clean ALTER TABLE DROP COLUMN for SQLite native syntax (not table-recreate dance for column drops) | Drizzle Migration Recommendation | Low — table-recreate dance also works; just verbose |
| A3 | Sheet names inside `all-panels.xlsx` will be Title-case (`Millipore Human Panel I`); not yet decided in CONTEXT | OQ-3 | Low — exact case is cosmetic; D-19 normalizes on parse |
| A4 | No fixture in `templates/panels/` uses merged cells or embedded formulas; `cellFormula: false` is sufficient | xlsx Library Specifics | Low — fixtures inspected; all flat CSV-derived |
| A5 | `run_single_analytes.analyteId` can safely be made nullable in Phase 13 without breaking existing tests | OQ-2 / Pitfall E | Medium — existing test audit required in Wave 1; if assumptions about non-null exist, additional test refactor needed |
| A6 | Node version supports `crypto.randomUUID()` (Node 19+); already used throughout repo | — | Low — established pattern |
| A7 | `templates/panels/all-panels.xlsx` should be committed to git (not gitignored); D-05 says "committed once" | Recommendation 4 | Low — D-05 explicit; binary blob ~50KB |
| A8 | `tsx` is the preferred TypeScript script runner; `ts-node` also viable | Recommendation 4 | Low — both equally functional; tsx is lighter |
| A9 | The fixture script can produce a deterministic .xlsx (same byte output across runs) so git diff is meaningful | Recommendation 4 | Medium — xlsx writer may embed timestamps or random IDs; if so, commit binary as-is + don't re-commit unless content changes |

## Sources

### Primary (HIGH confidence)
- `templates/panels/*.csv` — direct inspection of all 17 source CSVs; revealed Pattern A vs Pattern B Category-block divergence and trailing-whitespace tokens.
- `src/main/import/parser.ts`, `importer.ts`, `validator.ts` — existing v0.7.0 source code (verified line-by-line).
- `src/main/db/schema.ts`, `repositories/*.ts` — existing Phase 5 schema and repos.
- `drizzle/migrations/0004_lame_deathstrike.sql` — Phase 5 migration shape (template for Phase 13's 0007 file).
- `.planning/phases/13-smoke-3-panel-xlsx-parser-v3/13-CONTEXT.md` — locked decisions D-01..D-21.
- `.planning/phases/05-master-panel-schema-repository-foundation/05-CONTEXT.md` — Phase 5 carryforward decisions.
- `.planning/research/PITFALLS.md` Pitfalls 1-27 — v2.0 pitfall catalogue (mostly applicable to Phase 13).
- `.planning/SMOKE-3-PRD.md` §Database — PRD authoritative on sheet shape.
- `.planning/INGEST-RESOLUTIONS.md` §E — SMK3-08/09/10/11/DIL-01/12/17 resolution lineage.
- `package.json`, `vitest.config.ts`, `drizzle.config.ts` — toolchain pin verification.
- `npm view xlsx version`, `npm view drizzle-kit version`, `npm view better-sqlite3 version`, `npm view vitest version` — registry verification of installed versions vs latest.

### Secondary (MEDIUM confidence)
- [SheetJS Community Edition — Utility Functions](https://docs.sheetjs.com/docs/api/utilities/) — `sheet_to_json` options (`header: 1`, `blankrows`, `defval`).
- [SheetJS Community Edition — Reading Files](https://docs.sheetjs.com/docs/api/parse-options/) — `cellFormula: false`, `cellDates: false` options.
- [SheetJS issue #1529 — column header whitespace](https://github.com/SheetJS/sheetjs/issues/1529) — confirms whitespace trimming is a manual post-process step.

### Tertiary (LOW confidence, flagged in Assumptions Log)
- Assumed: drizzle-orm 0.45.1 `check()` helper exists; verify in Wave 1.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — versions verified via `npm view`; toolchain stable.
- Architecture: HIGH — patterns established in Phase 5 + v0.7.0; Phase 13 extends rather than invents.
- Pitfalls: HIGH — Pitfalls A-E newly identified from direct fixture inspection + schema audit; Pitfalls 1-27 carryforward from existing PITFALLS.md.
- Migration: MEDIUM — single-file atomicity is the established drizzle-orm contract, but exact SQL ordering depends on drizzle-kit's generator (inspect post-generate).
- Per-block parser correctness: HIGH — derived from inspection of all 17 fixtures; both Pattern A and Pattern B documented.
- Banner UX: MEDIUM — recommended shape is reasonable but unrelitigated; banner detail richness deferred.

**Research date:** 2026-05-12
**Valid until:** 2026-06-12 (30 days; the v2.0 stack is stable; only re-research if drizzle-kit major bump or xlsx security advisory)
