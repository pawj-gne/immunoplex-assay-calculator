# Phase 13: Smoke 3 — Panel XLSX Parser v3 - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in [13-CONTEXT.md](./13-CONTEXT.md) — this log preserves the alternatives considered.

**Date:** 2026-05-12
**Phase:** 13-smoke-3-panel-xlsx-parser-v3
**Areas discussed:** File format & sheet shape, Schema delta for per-reagent rows, Wholesale-replace mechanics + run FKs, Roman numeral handling + canonical refs

---

## Area Selection

| Option | Description | Selected |
|--------|-------------|----------|
| File format & sheet shape | Single .xlsx vs CSV-per-panel vs both; lenience on Reagent Description naming drift | ✓ |
| Schema delta for per-reagent rows | New columns vs table vs JSON; "variable" Concentration storage; SAPE Name | ✓ |
| Wholesale-replace mechanics + run FKs | SMK3-11 wipe semantics; runs.panel_id behavior | ✓ |
| Roman numeral handling + canonical refs | "Panel I" → "Panel 1"; storage form; range; regex | ✓ |

User selected all 4 areas.

---

## Area 1: File format & sheet shape

### Q1: Canonical input file shape?

| Option | Description | Selected |
|--------|-------------|----------|
| Single .xlsx with multiple sheets | One workbook = N panels + Table tab; matches PRD "1 sheet with multiple tabs"; CSVs are dev fixtures only | ✓ |
| Multiple .csv files (one per panel) | Matches templates/panels/ directly; zero shim layer; no atomic upload UX | |
| Both — .xlsx primary, .csv accepted | Auto-detect by extension; risk of divergent error messages | |

**Result:** D-01 — single .xlsx canonical.

### Q2: How to identify the 'Table' summary tab?

| Option | Description | Selected |
|--------|-------------|----------|
| Sheet name 'Table' (case-insensitive) | Simple; matches PRD wording | ✓ |
| Content shape detection | Skip sheets without Criteria/Values/Category markers; harder debug | |
| Both — name match first, then content fallback | Catches author typos in tab names | |

**Result:** D-02 — name match only. Sheets with the Table name and bad content fail validation under strict D-06/D-21 — not silent skip.

### Q3: Reagent Description naming drift handling?

| Option | Description | Selected |
|--------|-------------|----------|
| Loose match — canonicalize via regex | Maps Beads/Bead, Antibodies/Ab/Antibody, SAPE/SA-PE etc; trim + case-insensitive | ✓ |
| Strict match — require exact wording | Forces template uniformity; blocks SC #6 today (Bio-Rad uses "Ab ") | |
| Loose + warning surfaced to operator | Best-of-both | |

**Result:** D-03 — loose match. Bio-Rad's "Ab " and Millipore's "Antibodies " both canonicalize to "antibodies".

### Q4: UI + IPC channel?

| Option | Description | Selected |
|--------|-------------|----------|
| Reuse IMPORT_PANEL_DATA channel + ImportButton | Phase 5 D-01 hard-cut; only parser swaps under same IPC | ✓ |
| New button + new IPC (IMPORT_MASTER_PANELS_XLSX) | Visibly distinct; more UI churn | |
| Same button, split per-format flow | Keeps v1 path alive longer than intended | |

**Result:** D-04 — IPC + UI unchanged; parser swap is invisible.

### Q5 (follow-up): SC #6 17/17 gate implementation?

| Option | Description | Selected |
|--------|-------------|----------|
| Convert 17 CSVs to one combined .xlsx | Operator gets canonical multi-sheet UX; tests use canonical input; regenerable via npm script | ✓ |
| Test parser at two layers (CSV unit + .xlsx integration) | Refactor parser to operate on row arrays | |
| Keep CSVs as fixtures + parser handles both | Revisits D-01 (xlsx canonical) | |

**Result:** D-05 — generated combined fixture at templates/panels/all-panels.xlsx.

---

## Area 2: Schema delta for per-reagent rows

### Q1: Where do per-reagent Concentrations/Diluents/SAPE Name live?

| Option | Description | Selected |
|--------|-------------|----------|
| New master_panel_reagents table | One row per (master_panel_id, reagent_kind ∈ {beads, antibodies, sape}); clean future extension | ✓ |
| Extend master_panels with 9 new columns | Fewer joins; column explosion risk | |
| JSON blob reagents_json on master_panels | Flexible; loses SQL queryability and Drizzle benefits | |

**Result:** D-06 — new master_panel_reagents table; sape_name as separate column on master_panels.

### Q2: How is 'variable' Concentration stored?

| Option | Description | Selected |
|--------|-------------|----------|
| SQL NULL with CHECK constraint | concentration REAL NULL; sape kind requires NOT NULL via CHECK | ✓ |
| Sentinel string 'variable' in TEXT column | Verbatim audit; string-switch overhead | |
| Rejected at parse time | Blocks SC #6 (all fixtures use "variable") | |

**Result:** D-07 — NULL means "use per-analyte single_conc" semantically; sape rows must have numeric concentration.

### Q3: Premix matrix representation?

| Option | Description | Selected |
|--------|-------------|----------|
| Existing premix_panels + panel_analytes from Phase 5 | premix_panels.sub_panel_conc = Premix Concentration; Count column not persisted | ✓ |
| New premix_members table with explicit ordinal | Preserves Count ordering; cosmetic-only unless display needs it | |
| Premix as JSON array on master_panels | Loses FK integrity | |

**Result:** D-08 — reuse Phase 5 schema; Count column is parse-time scaffolding.

### Q4: Bio-Rad SAPE Concentration = 100 handling?

| Option | Description | Selected |
|--------|-------------|----------|
| Honor verbatim — SMK3-17 divides Total ÷ 100 for Bio-Rad | Persist whatever xlsx says; math is correct | ✓ |
| Reject as data error (SAPE must be 1×) | Blocks SC #6 17/17 | |
| Warn but accept | Surfacing the unusual value | |

**Result:** D-09 — verbatim.

### Q5 (follow-up): Phase 5's master_panels.beadsVolumePerWell/abVolumePerWell/sapeVolumePerWell columns — keep, drop, or migrate?

| Option | Description | Selected |
|--------|-------------|----------|
| Drop in Phase 13 migration | Single migration adds reagent table + drops 3 old columns; clean schema | ✓ |
| Keep as denormalized cache | Dual sources of truth | |
| Defer to Phase 14/15 | Phased migration | |

**Result:** D-10 — drop in same migration.

### Q6 (follow-up): vendor_singles_term column survival?

| Option | Description | Selected |
|--------|-------------|----------|
| Keep — Phase 14/15 still consumes it | Phase 5 D-03 wiring preserved | ✓ |
| Drop — PRD silence ≡ removal | Strict; invalidates Phase 5 D-03 | |
| Keep but mark unused | Schema survives; importer always NULL | |

**Result:** D-11 — keep alive.

---

## Area 3: Wholesale-replace mechanics + run FKs

### Q1: Premix wipe semantics on re-upload?

| Option | Description | Selected |
|--------|-------------|----------|
| Hard DELETE premix_panels + cascade panel_analytes | Per SMK3-11 wording; runs.panel_id SET NULL handles historical refs | ✓ |
| Soft-delete with archived_at | Full audit trail; query overhead | |
| Block re-upload if any run references | Hardest gate; conflicts with SMK3-11 | |

**Result:** D-12 — hard DELETE + cascade.

### Q2: Match key for master_panel on re-upload?

| Option | Description | Selected |
|--------|-------------|----------|
| (platform_id, species_id, normalized_panel_name) | Matches PRD "Platform, Species, Panel triple" + Roman normalization | ✓ |
| (platform_id, species_id) only — Phase 5's current shape | Doesn't fit Millipore Human's 7 panels | |
| Match by master_panels.id via UI | Forces UI flow change; contradicts PRD upload UX | |

**Result:** D-13 — composite match key with normalized name.

### Q3: How does the schema's UNIQUE index evolve?

| Option | Description | Selected |
|--------|-------------|----------|
| Drop old UNIQUE, add UNIQUE(platform_id, species_id, name) | Single migration with D-06 + D-10; natural key match | ✓ |
| Add new master_panel_groups table | Heavier schema churn | |
| Allow multiple master_panels with same (platform, species); app-layer constraint only | Risk of data corruption | |

**Result:** D-14 — drop + re-add UNIQUE in same migration.

### Q4: runs.panel_id FK behavior?

| Option | Description | Selected |
|--------|-------------|----------|
| onDelete: SET NULL (Phase 4 convention) | Run still loads; UI shows "(panel data archived)"; snapshot-frozen values intact | ✓ |
| onDelete: RESTRICT | Blocks wholesale-replace if any run refs; conflicts with SMK3-11 | |
| Add runs.panel_name_snapshot column | Most operator-friendly; minor schema delta on runs | |

**Result:** D-15 — SET NULL (already convention).

### Q5 (follow-up): Analyte wipe semantics?

| Option | Description | Selected |
|--------|-------------|----------|
| DELETE analytes WHERE master_panel_id = $old_id; INSERT fresh | Per SMK3-11 wording; clean semantics | ✓ |
| DELETE only if not referenced; SET master_panel_id=NULL otherwise (orphan-on-write) | Mixed semantics | |
| Soft-archive with archived_at | Heaviest schema delta | |

**Result:** D-16 — hard DELETE + INSERT fresh.

### Q6 (follow-up): run_single_analytes FK behavior on analyte wipe?

| Option | Description | Selected |
|--------|-------------|----------|
| onDelete: SET NULL | Run document shows "(analyte data archived)"; plate layout preserved via runs.platesJson | ✓ |
| Add run_single_analytes.analyte_name_snapshot column | Best display fidelity; schema delta | |
| onDelete: RESTRICT | Wholesale-replace partial failure; mixes responsibilities | |

**Result:** D-17 — SET NULL.

---

## Area 4: Roman numeral handling + canonical refs

### Q1: Canonical storage form?

| Option | Description | Selected |
|--------|-------------|----------|
| Store only normalized "Panel 1" | Single source of truth; matches PRD "calculator displays Arabic" | ✓ |
| Store BOTH source ("Panel I") + normalized | Audit-trail extra column | |
| Store author verbatim; normalize at display/match only | Conflicts with PRD Arabic-display rule | |

**Result:** D-18 — normalized only.

### Q2: Roman conversion range?

| Option | Description | Selected |
|--------|-------------|----------|
| I through X (1–10) only | Covers real fixtures (max VII); simple lookup table | ✓ |
| Full Roman parser (I through MMMCMXCIX) | Over-engineered; library dep | |
| Reject Roman beyond whitelist (I..XX) | Forces lab pre-conversion | |

**Result:** D-19 — I..X only.

### Q3: Panel name regex?

| Option | Description | Selected |
|--------|-------------|----------|
| `^Panel\s+([IVX]+|\d+)$` case-insensitive | Enforces "Panel " prefix; accepts roman + digits | ✓ |
| Accept any free-text; normalize only if ends with Roman | More flexible; invites name drift | |
| Match only exact `^Panel\s+([IVX]+|\d+)$` no case-fold | Strictest | |

**Result:** D-20 — case-insensitive regex with mandatory "Panel " prefix.

### Q4: Duplicate-normalized sheet handling?

| Option | Description | Selected |
|--------|-------------|----------|
| Reject the file with validation error | Carries Phase 5 D-06 strict file-level reject | ✓ |
| Last sheet wins | Silently drops data | |
| Warn and use first sheet | Safer than last-wins; still silent drop | |

**Result:** D-21 — strict reject.

---

## Done check

User selected "I'm ready for context" — no further gray areas surfaced.

## Claude's Discretion

Items the user delegated:
- Drizzle migration filename + SQL ordering within the single migration file
- Internal parser pipeline shape (row-array intermediate vs streaming)
- Validator error-message wording for non-D-21 cases
- Test fixture generation script location and exact npm task name
- `panel_description` storage location (master_panels.description vs premix_panels.description)
- Per-sheet summary banner exact copy
- `master_panel_reagents.reagent_kind` vs `kind` vs `reagent_type` naming

## Deferred Ideas

Captured in 13-CONTEXT.md `<deferred>` section. Nothing dropped from this discussion was scope-creep into another phase except the items already listed there (vendor_singles_term cleanup, orphan-analytes admin action, A5 schema version marker, preview-before-commit UI, premix-member ordinal column, panel_description location, banner richness).
