# Panel Upload v2 — Draft Spec

**Status:** draft (pre-phase, awaits promotion into v2.x milestone)
**Last updated:** 2026-04-23
**Supersedes:** The long-format CSV parser shipped in Phase 3.1 (panel-data-import)

---

## Why v2

The Phase 3.1 importer accepts a flat CSV with one row per (platform, species, panel, analyte) tuple. Reality: vendors supply panel data as *wide* spreadsheets with one master list per (platform, species) and premixes as subsets. The v1 format forced manual reshaping. v2 accepts vendor files directly.

## File-level shape

- **File format:** `.xlsx` (multi-tab). CSV is not supported in v2 because CSV has no native concept of multiple sheets.
- **One tab = one master panel** scoped to a unique `(platform, species)` pair.
- **Tab name:** informational only; the tab's internal metadata (B1-B4) is authoritative.
- **Multiple tabs per file:** yes. Each tab is parsed independently.

## Per-tab layout (locked)

```
        A                 B                 C                 D        E            F            G           ...
Row 1 │ "Panel Name:"   │ <panel name>    │                 │        │             │             │
Row 2 │ "Platform"       │ <platform>      │                 │        │             │             │
Row 3 │ "Species"        │ <species>       │                 │        │             │             │
Row 4 │ "Reagent Volume" │ <µL/well>       │                 │        │             │             │
Row 5 │ (blank separator row — fully empty)
Row 6 │ <vendor singles │                 │                 │ (blank)│ <Premix A> │ <Premix B> │ <Premix C> │ ...
      │  term, e.g.     │                 │                 │        │  name       │  name       │  name
      │  "Simplex">     │                 │                 │        │             │             │
Row 7 │ "Target"         │ "BeadRegion"    │ "Concentration" │ (blank)│ "Target"    │ "Target"    │ "Target"   │ ...
Row 8+│ <analyte name>   │ <bead region>   │ <concentration> │        │ <analyte>   │ <analyte>   │ <analyte>  │
      │ ...              │ ...             │ ...             │        │ ...         │ ...         │ ...
```

### Column conventions

| Cols | Purpose |
|------|---------|
| **A, B, C** | Master analyte list: Target (analyte name), BeadRegion (positive integer), Concentration (stock conc as multiplier, e.g. 20 = 20×) |
| **D** | Blank separator column |
| **E onwards** | Premix panels — one column per premix. Column header (Row 6) = premix name. Row 7 = literal "Target". Row 8+ = analyte names referencing the master list |

### Blank-stop rules

- **Master list (cols A/B/C):** Read rows 8 downward until column A is blank, then stop.
- **Each premix column (E, F, G, ...):** Read rows 8 downward until that column is blank, then stop. Premix columns stop independently — one can end at row 15 while the adjacent one continues to row 40.
- **Premix discovery:** Scan Row 6 starting at column E, moving right. Stop at the first empty cell in Row 6. That empty cell marks the end of premix data.

## Metadata fields

| Cell | Field | Type | Notes |
|------|-------|------|-------|
| B1 | Panel name | string, required | Becomes the `master_panel.name` |
| B2 | Platform | string, required | Resolved case-insensitively against existing `platforms` table. If not found → validation error listing valid platforms |
| B3 | Species | string, required | Resolved case-insensitively within the matched platform's species list. If not found → error listing valid species for that platform |
| B4 | Reagent volume | positive number, required | Assay volume per well in µL. Becomes source of truth for this master panel — overrides platform default |
| A6 | Vendor singles term | string, optional | Vendor-specific label for singles (e.g., "Simplex" for Thermo, "Singleplex" for Milliplex). Displayed in UI for operator recognition. If blank, UI falls back to "Single" |

## Analyte list semantics

- **Master list (cols A/B/C)** = all single analytes available for this `(platform, species)`. When an operator picks "full custom" or "premix + singles" in the calculator, this is the pool they pick from.
- **Each premix column** = subset of the master. Every analyte name in a premix column **must exist** in the master list (column A). If a premix references an unknown analyte → validation error listing the offending analyte and column.
- **Bead region + concentration** live only in the master. Premix columns don't repeat them; the app looks up these values from the master when displaying a premix.

## Parser spec

### IPC + UI

- **New IPC channel:** `IMPORT_MASTER_PANEL_FILE` (separate from the existing `IMPORT_PANEL_DATA`)
- **UI:** Import button in the Manage page's Panels section (matches the pattern of the existing Operators section). File dialog filtered to `.xlsx` only.
- **Result banner:** on success, report per-tab summary — "Imported 3 master panels: Milliplex Human Cytokines (30 analytes, 4 premixes); Milliplex Mouse Cytokines (25, 3); BioRad Human Chemokines (15, 2)."

### Per-tab parse pipeline

1. **Extract metadata** from B1-B4. Validate presence + types. Bail with tab-level error if any required cell is missing.
2. **Resolve platform + species** against the DB. Bail if either lookup fails.
3. **Extract vendor singles term** from A6 (optional).
4. **Extract master analyte list** — iterate rows 8 downward, reading A/B/C. Stop when A is blank. Validate each row: A is non-empty string, B is positive integer, C is positive number.
5. **Discover premix columns** — iterate Row 6 from E rightward until blank. Collect (column_index, premix_name) pairs.
6. **Extract each premix's analyte list** — for each premix column, read down from Row 8 until blank. Each value must exist in the master list (case-insensitive match). Collect errors per invalid reference.
7. **Collect all validation errors across all tabs before any DB writes** (matches v1's fail-fast behavior).
8. **If errors:** return structured error result, no DB mutation.
9. **If clean:** transactional insert per tab — upsert master panel row, upsert analytes, upsert premix panels, upsert panel-analyte links.

### Error reporting

Errors surface per-tab, per-row (or per-cell where meaningful) with enough context to locate the offender:

```
Tab "Cytokines Human Milliplex" — 3 errors:
  • Row 4 (Reagent Volume): expected positive number, got "fifty"
  • Master Row 12: analyte "IL-6-R" has non-integer bead region "12.5"
  • Premix column F (row 6 name "Th1/Th2 Panel"), row 9: analyte "IL-99" not found in master list
```

### Idempotency / re-upload

- Re-importing the same file → **upsert semantics**:
  - Master panel: matched by `(platform_id, species_id)`. If exists, update `name`, `reagent_volume`, `vendor_singles_term`. Do not delete.
  - Analytes: matched by `(name, platform_id, species_id)` (case-insensitive). If exists, update `bead_region` + `concentration`. Do not delete.
  - Premixes: matched by `(master_panel_id, name)` (case-insensitive). If exists, replace its analyte membership list wholesale (delete old links, insert new).
- **Deletion of orphaned analytes or premixes is not automatic.** If a re-upload drops an analyte from the master, the old analyte remains in the DB (so historical runs referencing it still work). A separate "cleanup orphaned analytes" admin action can be added later.

## Data-model delta

### New concept: master panel

Currently `panels` is flat. v2 introduces a distinction:

- **Master panel** = the full single-analyte universe for a `(platform, species)`. Exactly one per pair. Stores reagent volume + vendor singles term.
- **Premix panel** = a named subset of a master panel's analytes.

### Proposed schema changes

**New table:** `master_panels`

| Column | Type | Notes |
|--------|------|-------|
| `id` | integer PK | |
| `platform_id` | integer FK → platforms | UNIQUE with species_id |
| `species_id` | integer FK → species | UNIQUE with platform_id |
| `name` | text, not null | From B1 |
| `reagent_volume_per_well` | real, not null | µL/well, from B4 |
| `vendor_singles_term` | text, nullable | From A6 |
| `created_at`, `updated_at` | ISO timestamps | |

**Changes to existing `panels` table** (rename mentally to "premix panels", but keep table name for compat):

- Add `master_panel_id` integer FK → master_panels (nullable initially for backwards compat with v1-imported panels that have no master)
- Keep existing columns unchanged

**Changes to `analytes` table:**

- Add `master_panel_id` FK → master_panels (nullable)
- On import, all analytes under a master get the FK set. Analytes imported via v1 keep `master_panel_id = null` until a v2 import adopts them.

**No schema change to `panel_analytes`** — the existing many-to-many link table still models premix membership correctly.

### Calculator behavior change

The calculator currently reads assay volume from platform config. After v2:

1. If a run's panel has a master with `reagent_volume_per_well` → use that.
2. Else if the run is a `full custom` (no panel) → use platform default.
3. Else → use platform default (for v1-imported panels without a master).

This is a behavior change worth flagging but low-risk — existing v0.5.0 data paths stay on path 3.

## Migration path

1. Ship v2 importer alongside v1 importer. Both IPC channels coexist.
2. UI surfaces only v2 as the default. v1 remains accessible via a "legacy import" link or is removed entirely (decide at discuss-phase).
3. Re-import existing panels through v2 to populate master_panels and link analytes/panels retroactively. No data loss — v1 imports stay functional throughout.
4. Once all production panels are re-imported through v2, optionally remove v1 code.

## Open decisions

These are the things to lock during `/gsd-discuss-phase` before planning:

1. **Replace or coexist?** Does v2 replace v1's CSV importer, or do both live on?
2. **Reagent volume calculator wiring** — does the calculator strictly require a master panel to derive reagent volume (forcing v2 re-import of all existing data), or does it fall back to platform default gracefully?
3. **Vendor singles term UI** — where does "Simplex"/"Singleplex" actually render? On the analyte picker? On the premix selector? Doesn't have to be figured out now but good to note.
4. **Re-import semantics for premix drops** — if a premix exists in DB but isn't in the uploaded file, do we delete it, soft-delete it, or leave it orphaned? Suggested default: leave orphaned, with a future cleanup action.
5. **Validation strictness** — strict mode (all tabs must validate, file is rejected as a unit) or partial (each tab validated independently, partial import on mixed results)? Suggested: strict, matching v1's fail-fast philosophy.
6. **File-level schema versioning** — should tabs include a version marker (e.g., a "Format Version: 2" cell) so future format changes can be detected without guessing? Suggested: yes, add as A5 or similar metadata cell.

## Non-goals

- CSV support for v2 (xlsx only)
- Round-trip export (v2 is import-only)
- Template download from the app (can be a follow-up)
- Preview-before-commit UI (good idea but not required for minimum viable v2)

## Example tab (for reference)

```
Row 1: Panel Name:     | Cytokines
Row 2: Platform         | Milliplex
Row 3: Species          | Human
Row 4: Reagent Volume   | 50
Row 5: (empty)
Row 6: Singleplex       |     |     |     | Th1/Th2 Panel | Inflammation Panel
Row 7: Target           | BeadRegion | Concentration |     | Target | Target
Row 8: IL-6             | 12         | 20            |     | IL-6   | IL-6
Row 9: TNF-α            | 15         | 20            |     | IFN-γ  | TNF-α
Row 10: IFN-γ           | 20         | 20            |     | IL-4   | (end)
Row 11: IL-4            | 25         | 20            |     | (end)  |
Row 12: IL-10           | 30         | 20            |     |        |
Row 13: (end)           |            |               |     |        |
```

This tab creates:
- 1 master panel ("Cytokines", Milliplex, Human, 50 µL/well, vendor term "Singleplex")
- 5 analytes (IL-6, TNF-α, IFN-γ, IL-4, IL-10)
- 2 premix panels ("Th1/Th2 Panel" with 3 analytes; "Inflammation Panel" with 2)
