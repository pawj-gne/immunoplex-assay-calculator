# Feature Research — v2.0 Panel XLSX Upload + Master-Panel Data Model

**Domain:** Vendor-native panel ingest + master-panel wiring for an Electron/Luminex assay calculator
**Researched:** 2026-04-23
**Confidence:** HIGH (spec-driven — `.planning/PANEL-UPLOAD-V2-SPEC.md` pre-locks most shape; 6 open decisions explicitly flagged for `/gsd-discuss-phase`)

## Scope note (read first)

This FEATURES.md is scoped to the v2.0 milestone **only**. v1.0 feature landscape (dilution calculator, plate layout, prep recipes, run history, etc.) lives in `.planning/research/v1.0-archive/FEATURES.md` and is **not** re-researched here — those features are shipped or pending UAT and are load-bearing dependencies, not candidates for the v2 roadmap.

The three v2 feature clusters:
1. **Panel XLSX upload** — multi-tab vendor-native xlsx ingest (replaces or coexists with v1 flat CSV)
2. **Vendor singles term UI rollout** — `vendor_singles_term` (cell A6) surfaced in UI, closing D-4.1-05
3. **Calculator reagent-volume wiring** — calculator reads `reagent_volume_per_well` from the run's master panel, falls back to platform default

## Feature Landscape

### Table Stakes (v2.0 must-haves for first ship)

Non-negotiable for v2.0 release — the spec already locks these or the user has pre-committed. Missing any of these and v2 doesn't actually solve the "manual reshaping of vendor spreadsheets" problem.

| # | Feature | Complexity | Dependencies on existing code | Spec locks it? |
|---|---------|------------|-------------------------------|----------------|
| TS-1 | **Multi-tab xlsx parser** — one tab = one master panel; tabs parsed independently; tab name informational | **L** — new parser + SheetJS/xlsx lib integration in main process | New main-process module; mirrors `IMPORT_PANEL_DATA` IPC pattern from v1 CSV importer | Yes (§File-level shape, §Per-tab layout) |
| TS-2 | **Per-tab metadata extraction (B1–B4)** — Panel name, Platform, Species, Reagent Volume | **S** — four fixed-cell reads + type coercion | Reuses existing `platforms`/`species` table reads from panelStore | Yes (§Metadata fields) |
| TS-3 | **Case-insensitive platform + species resolution** — B2/B3 matched against DB, error lists valid options on miss | **S** — lowercase comparison against existing joins | Platforms + species tables from v0.4.x; panelStore lookup helpers | Yes (§Metadata fields notes) |
| TS-4 | **Master analyte list extraction (cols A/B/C, blank-stop)** — Target/BeadRegion/Concentration, stop when col A blank | **M** — row iteration + per-row validation (positive int bead region, positive number concentration) | Analytes table from Phase 3.1; upsert keyed by `(name, platform_id, species_id)` | Yes (§Analyte list semantics, §Parser spec step 4) |
| TS-5 | **Premix column discovery (row 6 scan from E rightward)** — stop at first empty header cell | **S** — bounded column iteration | New — no v1 analog (v1 CSV had one row per tuple) | Yes (§Blank-stop rules) |
| TS-6 | **Per-premix analyte list extraction (blank-stop per column)** — each premix col stops independently; every value must exist in master | **M** — per-column iteration + cross-reference against master set | Builds on TS-4 master set; premix table from v1 (`panels` table, soon master-panel-FK'd) | Yes (§Blank-stop rules, §Analyte list semantics) |
| TS-7 | **Fail-fast validation before any DB writes** — collect errors across all tabs, bail on any error, no partial mutation | **M** — error collection pattern | Matches v1 CSV importer's fail-fast philosophy; same result-shape contract | Yes (§Parser spec step 7) — but "strict vs partial" is open decision #5 |
| TS-8 | **Structured per-tab, per-row error reporting** — tab name + row/cell locator + human-readable message | **M** — error object shape; UI banner formatting | Extends v1's error-banner pattern from Panel Management UI (Phase 3.2) | Yes (§Error reporting example) |
| TS-9 | **Transactional upsert per tab** — master_panel, analytes, premixes, panel-analyte links in one tx | **M** — better-sqlite3 `db.transaction(...)` wrapping composite writes | New `master_panels` table + FK additions to `panels` and `analytes` | Yes (§Idempotency / re-upload) |
| TS-10 | **Upsert on re-import (master + analytes + premixes)** — match keys per spec, no automatic deletion of orphans | **M** — per-entity match-key logic; premix membership replaced wholesale | Depends on TS-9; premix-drop semantics = open decision #4 | Partial (orphan-drop behavior open) |
| TS-11 | **Generic "Single" fallback when A6 blank** — UI label falls back to "Single" / "Analytes" if `vendor_singles_term` is null | **S** — nullish-coalesce in render path | `AnalyteGrid.tsx` already uses generic "Analytes" label per D-4.1-05 | Yes (§Metadata fields A6 note) |
| TS-12 | **New IPC channel `IMPORT_MASTER_PANEL_FILE`** — separate from `IMPORT_PANEL_DATA` so v1 and v2 can coexist behind different entry points | **S** — new handler in main, preload bridge, renderer call site | Mirrors existing IPC channel pattern; new file dialog filter `.xlsx` only | Yes (§IPC + UI) |
| TS-13 | **Schema delta: `master_panels` table + FK on `panels`/`analytes` (nullable for v1 rows)** | **M** — migration script + panelStore/analytesStore read paths updated | Existing schema from v0.4.x; nullable FK preserves v1-imported data | Yes (§Proposed schema changes) |
| TS-14 | **Per-tab summary banner on success** — "Imported 3 master panels: X (30 analytes, 4 premixes); Y (25, 3); ..." | **S** — aggregate counts during parse, format on return | Extends existing success-banner component from v1 Panels Management | Yes (§Result banner) |
| TS-15 | **Windows-only smoke re-test of v2 importer + upsert paths** | **M** — build `.exe`, install, manually walk 2-3 import scenarios | Same Windows test cycle as v1.0 (Plan 04.1-05) | N/A (process, not feature) |

### Differentiators (v2.0 high-value if scope allows)

Not strictly required by the spec but high-leverage — each one meaningfully improves either confidence (preview, dry-run) or user recognition (vendor term rollout). Keep in scope unless phase budget forces cuts.

| # | Feature | Value proposition | Complexity | Dependencies | Spec locks it? |
|---|---------|-------------------|------------|--------------|----------------|
| DF-1 | **Vendor singles term rendered in AnalyteGrid section header** | Closes D-4.1-05 — operator sees "Singleplex" (Milliplex) / "Simplex" (Thermo) instead of generic "Analytes", matching vendor documentation they already know | **S** | `AnalyteGrid.tsx` `sectionLabel` prop (already in place post-4.1); selectionStore exposes `vendor_singles_term` from the current run's master panel | Mentioned, placement = open decision #3 |
| DF-2 | **Vendor singles term on premix picker "No Premix (Custom Assay)" chip** | Same recognition win on a second surface — the chip that triggers the master-list view | **S** | `PremixPanelList` component (Phase 3.3); same store read as DF-1 | Open decision #3 |
| DF-3 | **Calculator pulls `reagent_volume_per_well` from master panel with platform-default fallback** | Per-panel vendor-declared volume (e.g., Milliplex = 50 µL, BioRad = 25 µL) flows through to volume calculator without manual re-entry; v1-imported panels (master FK null) graceful-fallback to platform default so no breakage | **M** | calculatorStore (platform default path already exists); new master-panel read on run-panel-change; v1-imported panels get null FK | Yes (§Calculator behavior change), but strict-vs-graceful = open decision #2 |
| DF-4 | **Preview-before-commit UI** — dry-run parse → show summary (counts, resolved platform/species, any warnings) → operator confirms → DB write | Reduces "I uploaded the wrong file into production" anxiety; the spec explicitly flags this as "good idea but not required" | **M** | Requires separating parse from write (two-phase importer); extra IPC round-trip; new modal | No — explicit non-goal in spec, but listed as a differentiator |
| DF-5 | **"Legacy import" link to v1 CSV importer** | Soft-migration path — power user re-imports existing panels via v2; old CSV still works for edge cases | **S** | v1 CSV path stays wired; v2 becomes default button in Manage → Panels section | Yes if coexist wins; no if replace wins (open decision #1) |
| DF-6 | **File-level schema version marker (e.g., cell A5 = "Format Version: 2")** | Forward-compat — v3 parser can detect old files instead of guessing; future-proofs the format | **S** | Adds one validation cell to parser; vendor templates need the marker too | Mentioned as suggested-yes; open decision #6 |
| DF-7 | **Orphan-analyte admin action (post-re-import cleanup)** | When a re-import drops an analyte, old rows remain to preserve historical runs. An admin UI to review + delete orphans avoids DB bloat over time | **M** | New Manage page section; query for analytes with no active panel membership AND no run references | No — spec explicitly defers this to a "separate future action" |

### Anti-Features (explicitly NOT in v2 per spec §Non-goals)

Documented to kill scope creep. The spec is opinionated about what's out.

| # | Feature | Why sometimes requested | Why we're not doing it in v2 | Alternative |
|---|---------|--------------------------|------------------------------|-------------|
| AF-1 | **CSV support in v2 format** | "We already have vendor CSV exports" | CSV has no native multi-sheet concept; v2 shape requires per-tab master+premix layout | v1 CSV importer coexists (if decision #1 = coexist) for flat data; vendors supply `.xlsx` |
| AF-2 | **Round-trip export** (read + write the v2 xlsx) | "We want to edit panels in Excel, re-upload" | Export = second format surface to maintain; export-for-audit ≠ edit-and-reimport; low-demand in v1 feedback | Panel management UI (Phase 3.2) edits analyte-level data directly; operators edit the source xlsx and re-upload |
| AF-3 | **Template download from the app** (empty xlsx for vendors/ops to fill in) | "How do I format a new panel?" | Template lives in repo docs / example file; building an in-app generator is second code path | Ship one canonical example `.xlsx` in `docs/` or on the release page; spec's §Example tab works as reference |
| AF-4 | **Preview-before-commit as gate (mandatory)** | "I want to sanity-check before writing" | Spec lists preview as non-goal for MVP v2 — fail-fast + transactional upsert already prevent partial writes | If adopted, ship as DF-4 (optional two-phase flow); otherwise rely on post-import summary banner + Manage UI review |
| AF-5 | **Automatic orphan deletion on re-import** | "Re-upload should be the single source of truth" | Deletes would cascade-break historical runs referencing dropped analytes/premixes — a correctness disaster | Upsert leaves orphans in place (TS-10); cleanup is a manual admin action (DF-7) |
| AF-6 | **Tab-name authority** (tab name determines master panel identity) | "Tab name is obvious, why re-type it in B1?" | Tab names rename easily, are not unique across files, and operators reuse tab-name conventions inconsistently | B1-B4 metadata is authoritative; tab name is informational only |
| AF-7 | **Direct instrument (xPONENT / Bio-Plex Manager) export of panel definitions** | "Push panels to the instrument software" | Requires reverse-engineering proprietary formats; spec scope is ingest not egress | Out of v2; revisit if user demand surfaces |
| AF-8 | **Cross-panel analyte merging / deduplication UI** | "I have IL-6 in 3 panels, show me them together" | v2's match key is `(name, platform_id, species_id)` which already deduplicates naturally; a UI to surface collisions adds complexity without clear use case | Upsert keys handle it automatically; Manage page Analytes list (if added later) can show multi-panel refs |
| AF-9 | **Regulated-lab compliance (21 CFR Part 11, audit trails for panel imports)** | Carried from v1 anti-feature list | Out of v1 charter; still out in v2 | Separate product tier if ever needed |

## Open Decisions → Feature Questions to Resolve at `/gsd-discuss-phase`

The spec flags six items to lock before planning. Each maps to a concrete feature question with measurable downstream impact.

| # | Spec § | Feature question | Impact if wrong | Suggested resolution | Expected locking point |
|---|--------|------------------|-----------------|----------------------|------------------------|
| **OD-1** | §Open decisions #1 | **Replace or coexist with v1 CSV importer?** — Does v2 delete the `IMPORT_PANEL_DATA` IPC + CSV parse code, or does it keep both live (maybe behind a "legacy" link)? | Replace → forces v2 re-import for every existing panel before v2 ships, blocking migration; Coexist → two code paths to maintain, but soft migration | **Coexist for v2.0**, hide v1 behind a "Legacy CSV import" disclosure; schedule v1 removal for v2.1 after all prod panels migrated | `/gsd-discuss-phase` for v2.0 — locks TS-12 coexist-vs-exclusive and DF-5 scope |
| **OD-2** | §Open decisions #2 | **Calculator strict-requires-master-panel or graceful-fallback?** — For v1-imported panels with no master FK, does the calculator hard-error "re-import via v2" or silently use platform default? | Strict → breaks every run off v1 data until re-import; Graceful → silent behavior drift (volume on-screen ≠ volume-from-master) | **Graceful fallback** (v1 panels keep using platform default); log a subtle "Using platform default — no master panel" hint in the calculator UI for the operator to notice | `/gsd-discuss-phase` — locks DF-3 behavior + the calculator-copy that tells the operator which path was taken |
| **OD-3** | §Open decisions #3 | **Where does `vendor_singles_term` render in UI?** — AnalyteGrid section header only? Premix picker "No Premix" chip? Both? Somewhere else (wizard step label)? | Too many surfaces → inconsistent copy; too few → operator doesn't see the term in the moment of recognition | **Both**: AnalyteGrid header (primary — this is where the operator is picking) + "No Premix (Custom Assay)" chip label rewritten to use the vendor term. Skip wizard-step label (less recognition value) | `/gsd-discuss-phase` — locks DF-1 + DF-2 scope and their one-liner copy decisions |
| **OD-4** | §Open decisions #4 | **Premix-drop re-import semantics** — if DB has premix "Th1/Th2" but a re-uploaded file omits it, do we delete / soft-delete / orphan? | Delete → breaks historical runs referencing it; soft-delete → adds `deleted_at` column + filtering everywhere; orphan → DB bloat over time | **Orphan** (spec's suggested default) — matches analyte orphan behavior, keeps historical runs intact. Defer cleanup action (DF-7) to v2.1 | `/gsd-discuss-phase` — locks TS-10 upsert behavior |
| **OD-5** | §Open decisions #5 | **Validation strictness: strict (file-level reject on any error) or partial (per-tab independent)?** | Strict → single typo in one tab rejects a 5-tab file; Partial → operator thinks import succeeded, but one tab silently missing | **Strict** (spec's suggestion, matches v1 CSV fail-fast). Rationale: operators fix-and-re-upload is already the expected loop; silent partial import is a correctness risk bigger than a usability cost | `/gsd-discuss-phase` — locks TS-7 behavior |
| **OD-6** | §Open decisions #6 | **File-level schema versioning: add a "Format Version: 2" metadata cell (e.g., A5)?** | No marker → v3 parser can't cleanly distinguish v2 files from pre-v2 without guessing; Adds marker → vendors/ops need to include it in templates | **Yes, add as A5** (currently blank separator row; the marker can live there without disturbing §Per-tab layout). Accept absent-marker as "assume v2" for backward compat until v3 ships | `/gsd-discuss-phase` — locks DF-6 scope and influences the canonical template in `docs/` |

## Feature Dependencies

```
[TS-13: master_panels schema + FKs]
    |
    +--> [TS-9: transactional upsert]
    |        |
    |        +--> [TS-10: upsert-on-reimport] --(OD-4 resolves)--> premix-drop semantics
    |
    +--> [DF-3: calculator reagent-volume wiring] --(OD-2 resolves)--> strict vs graceful
    |
    +--> [DF-1 / DF-2: vendor singles term UI] --(OD-3 resolves)--> placement

[TS-1: multi-tab parser]
    |
    +--> [TS-2: metadata B1-B4]
    |        |
    |        +--> [TS-3: platform/species resolution]
    |
    +--> [TS-4: master list extraction]
    |        |
    |        +--> [TS-5: premix column discovery]
    |                 |
    |                 +--> [TS-6: per-premix analyte extraction]
    |
    +--> [TS-7: fail-fast validation] --(OD-5 resolves)--> strict vs partial
    |
    +--> [TS-8: structured error reporting]
    |
    +--> [TS-14: success banner]

[TS-12: new IPC channel] ──coexists-with──> [v1 IMPORT_PANEL_DATA] --(OD-1 resolves)--> replace vs coexist
                                                     |
                                                     +--> [DF-5: legacy import link] (only if coexist)

[DF-6: schema version marker] --(OD-6 resolves)--> adds A5 cell to parser + template

[DF-4: preview-before-commit] ──requires──> [TS-1..TS-8 parse phase decoupled from TS-9 write phase]
                              ──enhances──> [TS-14 success banner] (becomes "preview summary")

[DF-7: orphan cleanup admin] ──requires──> [TS-10 upsert leaving orphans] + [DF-3 master FK on analytes]
```

### Dependency notes

- **TS-13 is the keystone.** The new `master_panels` table and the FK additions on `panels`/`analytes` unlock TS-9, TS-10, DF-1, DF-2, and DF-3. Migration script is the first thing that must land in phase 1 of v2.
- **TS-1 through TS-8 = one cohesive "parser" feature cluster.** Likely one phase, possibly split into "happy path parse" + "validation + error reporting" if phase scope runs long.
- **DF-3 is decoupled from the parser.** The calculator wiring can ship in a separate phase after the schema + parser land. This phases nicely: parser first (data lands), UI rollout second (DF-1/DF-2), calculator wiring third (DF-3).
- **DF-4 (preview) is invasive if retrofitted.** If adopted, bake it into the parser shape from day one (return a parse result that's either "preview" or "commit"); retrofitting a two-phase flow after the fact = double the IPC + state churn.
- **OD-1 gates whether DF-5 exists at all.** If replace wins, DF-5 is deleted from the roadmap entirely.

## MVP Definition for v2.0

### Launch With (v2.0)

Minimum scope to ship v2.0 and actually retire manual panel reshaping.

- [ ] **TS-1 through TS-14** — the full parser + schema + IPC + success banner set. Every one is load-bearing for "vendor hands me a .xlsx, I import it, panels + analytes + premixes exist, calculator uses them."
- [ ] **TS-15** — Windows smoke retest of the v2 importer across 2-3 real vendor files.
- [ ] **DF-1** — vendor singles term in AnalyteGrid section header. This is the closing move on D-4.1-05; leaving it out means v2 ships with the generic "Analytes" label even though the data is now there.
- [ ] **DF-3** — calculator reads `reagent_volume_per_well` from master panel. This is the user-facing payoff of the `master_panels` table; shipping the schema without the calculator wiring is half a feature.
- [ ] **OD-1, OD-2, OD-4, OD-5** resolved — these directly shape TS-7, TS-10, TS-12, DF-3 so they must lock before the phase starts.

### Add After Validation (v2.1)

- [ ] **DF-2** — vendor singles term on "No Premix" chip. Nice consistency win but AnalyteGrid header (DF-1) already covers the primary recognition surface.
- [ ] **DF-5** — legacy v1 CSV import surfaced as a disclosure link (only if OD-1 = coexist). Keep v1 IPC channel wired but move the button out of the primary flow.
- [ ] **DF-6** — A5 schema version marker. Ship in v2.1 so the canonical template can be updated alongside; absent-marker treated as v2 for back-compat.
- [ ] **DF-7** — orphan-analyte / orphan-premix admin cleanup action. Wait until real data accumulates before designing the UI.

### Future Consideration (v3+)

- [ ] **Template generation from within the app** — nice-to-have; external canonical example `.xlsx` in `docs/` is the near-term answer.
- [ ] **DF-4 preview-before-commit** — reconsider if user feedback shows "I uploaded the wrong file" is a real pain. Fail-fast validation + upsert already cover most of the risk.
- [ ] **Round-trip export** — only if operators demand it; edit-in-xlsx-and-re-upload already works if the file is the source of truth.
- [ ] **xPONENT / Bio-Plex Manager panel-definition export** — speculative until someone asks.

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| TS-1 multi-tab parser | HIGH | HIGH | P1 |
| TS-2 metadata B1-B4 | HIGH | LOW | P1 |
| TS-3 case-insensitive platform/species | MEDIUM | LOW | P1 |
| TS-4 master analyte extraction | HIGH | MEDIUM | P1 |
| TS-5 premix column discovery | HIGH | LOW | P1 |
| TS-6 per-premix analyte extraction | HIGH | MEDIUM | P1 |
| TS-7 fail-fast validation | HIGH | MEDIUM | P1 |
| TS-8 structured error reporting | HIGH | MEDIUM | P1 |
| TS-9 transactional upsert | HIGH | MEDIUM | P1 |
| TS-10 upsert-on-reimport | HIGH | MEDIUM | P1 |
| TS-11 "Single" fallback | MEDIUM | LOW | P1 |
| TS-12 new IPC channel | HIGH | LOW | P1 |
| TS-13 master_panels schema + FKs | HIGH | MEDIUM | P1 |
| TS-14 success banner | MEDIUM | LOW | P1 |
| TS-15 Windows smoke re-test | HIGH | MEDIUM | P1 |
| DF-1 vendor term in AnalyteGrid | HIGH | LOW | P1 |
| DF-3 calculator reagent-volume wiring | HIGH | MEDIUM | P1 |
| DF-2 vendor term on premix chip | MEDIUM | LOW | P2 |
| DF-5 legacy v1 CSV disclosure link | LOW | LOW | P2 (if coexist) |
| DF-6 A5 schema version marker | LOW | LOW | P2 |
| DF-4 preview-before-commit | MEDIUM | MEDIUM | P3 |
| DF-7 orphan cleanup admin | LOW | MEDIUM | P3 |

**Priority key:**
- P1: v2.0 launch blocker
- P2: v2.1 — ship when scope allows
- P3: v3+ or never (wait for signal)

## Competitor / Prior-Art Feature Analysis

Narrow comparison against patterns in lab / LIMS / assay tooling that ingest vendor panels.

| Feature | LabKey Luminex (enterprise LIMS) | xPONENT / Bio-Plex Manager (instrument SW) | Excel-native manual workflow | v2 approach |
|---------|----------------------------------|--------------------------------------------|------------------------------|-------------|
| Panel import format | `.xlsx` with analyte-per-tab convention; tab name = analyte | Vendor-specific instrument formats (CSV / Excel / proprietary) | No formal import — manual copy-paste into spreadsheets | Multi-tab `.xlsx`, one tab = one `(platform, species)` master panel (tab name informational, B1-B4 authoritative) |
| Re-import semantics | Update-on-match via configured key columns | Re-import overwrites run-level data | Manual edit, no version history | Upsert keyed on deterministic tuples; orphans preserved, no cascading delete |
| Validation | Row-level validation rules imported from xlsx cells; errors surfaced per row | Format-strict parse, instrument rejects malformed files | None — operators eyeball | Per-tab, per-cell validation; fail-fast file-level reject (OD-5 dependent) |
| Preview / dry-run | Preview-before-commit via admin wizard | No preview — direct load | N/A | Explicit non-goal for v2.0 (DF-4 deferred); transactional upsert is the safety net instead |
| Vendor-term awareness (Singleplex / Simplex) | Generic "Analyte" terminology | Vendor-native in vendor's own software | Operator knows vendor term mentally | Vendor term read from A6 per-tab, rendered in UI (DF-1/DF-2) |
| Reagent-volume provenance | Configurable per-assay in kit definition | Per-kit config in instrument SW | Operator memorizes or reads protocol PDF | Master panel's B4 cell is source of truth; calculator reads it with graceful platform-default fallback (DF-3) |

### Positioning for v2.0

- **Not competing with LabKey-tier LIMS** — they're multi-tenant, multi-assay, 21 CFR Part 11. v2 stays a single-operator desktop tool.
- **Not competing with xPONENT / Bio-Plex Manager** — those handle instrument acquisition + curve fitting. v2 stops at "prep calculations + run docs."
- **Competing directly with manual-Excel reshape** — the exact user problem cited in the spec's "Why v2" section. Win condition: vendor hands operator a stock `.xlsx`, operator imports, no intermediate CSV generation.

## Sources

- **Primary (authoritative):**
  - [.planning/PANEL-UPLOAD-V2-SPEC.md](../../PANEL-UPLOAD-V2-SPEC.md) — full v2 spec, all open decisions
  - [.planning/PROJECT.md](../../PROJECT.md) — v2.0 milestone goal and target features
  - [.planning/phases/04.1-smoke-test-fixes/04.1-CONTEXT.md](../../phases/04.1-smoke-test-fixes/04.1-CONTEXT.md) — D-4.1-05 vendor-term deferral context
  - [.planning/phases/04.1-smoke-test-fixes/04.1-04-SUMMARY.md](../../phases/04.1-smoke-test-fixes/04.1-04-SUMMARY.md) — current AnalyteGrid prop shape (5-prop `sectionLabel` contract that DF-1 builds on)
  - [.planning/research/v1.0-archive/FEATURES.md](./v1.0-archive/FEATURES.md) — v1 feature landscape, retained for structural parity (not re-researched)

- **Secondary (prior-art patterns for validation of spec choices):**
  - [LabKey Luminex file-format docs](https://www.labkey.org/Documentation/wiki-page.view?name=luminexFileFormats) — confirms multi-tab xlsx is a recognized Luminex pattern; LabKey uses tab-name-as-analyte which v2 deliberately rejects in favor of cell-level metadata
  - [LabKey Luminex import tutorial](https://www.labkey.org/Documentation/wiki-page.view?name=importLuminexRunData) — reference for per-run properties read from xlsx headers
  - [Idempotency in System Design (Niessen)](https://blog.devgenius.io/idempotency-in-system-design-full-example-80e9027e7bea) — upsert-is-idempotent framing used for TS-10 rationale
  - [Azure DevOps bulk-import test cases](https://learn.microsoft.com/en-us/azure/devops/test/bulk-import-export-test-cases?view=azure-devops) — confirms "match-ID → replace step list wholesale" pattern matches premix-membership-replace semantics in TS-10

---
*Feature research for: v2.0 Panel XLSX Upload + Master-Panel Data Model*
*Researched: 2026-04-23*
*Confidence: HIGH — spec-driven; 6 open decisions pre-flagged for `/gsd-discuss-phase`*
