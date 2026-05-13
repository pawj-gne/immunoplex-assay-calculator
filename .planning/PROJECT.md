# Immunoplex Assay Calculator

## Source of Truth

> As of **2026-05-11**, the lab-owner-authored [`SMOKE-3-PRD.md`](./SMOKE-3-PRD.md) is the canonical product spec.
> When PRD requirements conflict with previously locked v1/v2 decisions, **the PRD wins.** Affected supersedes are tracked in [`INGEST-RESOLUTIONS.md`](./INGEST-RESOLUTIONS.md) (R-01..R-15 + SMK3-01..17). [`PANEL-UPLOAD-V2-SPEC.md`](./PANEL-UPLOAD-V2-SPEC.md) is preserved but marked SUPERSEDED.

## What This Is

A desktop application for lab operators to set up and document Luminex/Immunoplex assays. It replaces the current paper-and-pen workflow by calculating reagent volumes and dilutions, generating prep recipes, and maintaining searchable run records for troubleshooting and usage tracking.

## Core Value

Accurate reagent calculations with clear prep recipes — operators must be able to trust the math and follow the instructions without second-guessing.

## Requirements

### Validated

- [x] Calculate total reagent volumes based on sample count, replicate mode, and plate capacity (Phases 1-2, shipped v0.1.0)
- [x] Calculate single-analyte additions to master mix (volume = total / stock concentration) (Phase 2, shipped v0.1.0)
- [x] Handle three request types: premix-only, premix + singles (max 5), full custom (no limit) (Phase 2, shipped v0.1.0)
- [x] Support multiple platforms with platform-specific stock concentrations (Milliplex, BioRad, ProCartaPlex) (Phases 1, 3.1, 3.2, shipped v0.4.x — R&D removed)
- [x] Generate clear reagent prep recipe for operator to follow (Phase 3, shipped v0.2.0)
- [x] Display bead regions for plate reader instrument setup (Phase 3, shipped v0.2.0)
- [x] Capture run metadata (user, date, operator, sample count, sample type, replicate mode, platform, species, Hamilton assignment, positions, panel, analytes) (Phase 4, code-complete — pending Windows smoke test HUMAN-UAT-04-03-01)
- [x] **SMK3-08**: Importer accepts Smoke 3 sectioned xlsx format (Criteria/Values/Category per sheet; per-reagent rows; Premix matrix) (Phase 13, validated 2026-05-12 — supersedes v0.7.0 parser; 28 parser tests + SC #6 fixture gate 12/12 green)
- [x] **SMK3-09**: Importer normalizes panel name Roman → Arabic at parse time (`Panel I` → `Panel 1`) (Phase 13, validated 2026-05-12 — 31 normalize tests)
- [x] **SMK3-10**: Importer enumerates panels from sheet names; master `Table` tab ignored (Phase 13, validated 2026-05-12 — allPanelsFixture T-1)
- [x] **SMK3-11**: Re-upload of (Platform, Species, Panel) **wholesale-replaces** existing panel (Phase 13, validated 2026-05-12 — importer.test.ts T-2/T-4/T-5/T-6 + FK SET NULL on runs.panel_id + run_single_analytes.analyte_id)
- [x] **SMK3-DIL-01**: Diluent column free-text, stored verbatim, no enum/normalization (Phase 13, validated 2026-05-12 — 11 importer integration tests + diluentResolver coverage)
- [x] **SMK3-12**: SAPE Name display in run document metadata header for traceability (Phase 15, validated 2026-05-12 — programmatic; visual render deferred to Phase 16 UAT)
- [x] **SMK3-15**: Audit Trail section on finalized run document — 4-block layout (Inputs / Intermediates / Outputs / Diluent decision) with per-reagent breakdown (Phase 15, validated 2026-05-12 — programmatic; visual render deferred to Phase 16 UAT)
- [x] **SMK3-16**: Snapshot-frozen historical runs — pre-Phase-15 runs render persisted values with amber advisory banner, never recompute (Phase 15, validated 2026-05-12 — 10 new snapshot columns + `calculationRulesVersion` marker + HistoricalRunBanner conditional; visual render deferred to Phase 16 UAT)
- [x] **SMK3-17**: PE volume formula = `Total Volume of the Assay ÷ SAPE concentration`, derived from Values-block SAPE row (Phase 15, validated 2026-05-12 — Group M 7 unit tests + T-M-INT integration test against canonical 9.4 mL fixture; visual cell render deferred to Phase 16 UAT)

### Active

(Phase 15 validated SMK3-12, SMK3-15, SMK3-16, SMK3-17 programmatically; Windows-runtime UAT for all 4 visual items routed to Phase 16. Remaining Smoke 3 work lives in Phase 16 — see Current Milestone below.)

## Current Milestone: v1.0 Release — Smoke 3 calculator on Windows lab PC

**Goal:** Ship the Smoke 3 PRD-compliant desktop calculator on the operator's Windows workstation. Tag v1.0.0 after a clean Windows UAT pass.

**Status:** In UAT — Phase 16 (Windows UAT & Release). Phases 12-15.1 are merged and code-complete on `dev/v1-01` (439/439 tests; typecheck exit 0; 0 critical/warning code-review findings).

**Pending v1.0.0 deliverables:**
- `npm run build:win` produces `dist/immunoplex-assay-calculator-1.0.0-x64-setup.exe`
- Operator runs `16-SMOKE-TEST-GUIDE.md` Section A/B/C on the Windows lab PC against `templates/panels/all-panels.xlsx`; outcome `## Overall: PASS`
- `git tag -a v1.0.0` + `gh release create v1.0.0` with CHANGELOG.md §[1.0.0] as the release body

## Next Milestone: v1.1 — Network Layer & Central Server (Phase 6)

**Trigger:** Lab-confirmed v1.0 real-world use (suggestion ≥1-2 weeks of actual assay work). NOT immediate after v1.0.

**Goal preview:** One designated lab PC runs an HTTP server owning the central SQLite DB; other PCs route DB ops via HTTP; offline fallback via local SQLite + sync-back queue.

v1.2 (Phase 7 — central audit trail) follows v1.1 with a hard dependency on the v1.1 server layer. v2.0 is reserved for a future major version with scope TBD (not Phase 6/7 territory per D-16-20).

### Out of Scope

- Run request queue integration — external system, not replacing it
- Tablet/mobile support — desktop first, tablet later for photo capture
- Barcode scanning — manual lot number entry for v1
- Lab usage tracking/analytics — defer until core workflow is solid
- Photo annotation — simple upload from connected camera for now

## Context

**Current workflow:**
1. Operator reviews run request queue (external system) for next day's runs
2. Fills out paper "run documentation" sheet with run details
3. Manually calculates reagent volumes and dilutions
4. Preps reagents following handwritten calculations
5. Records lot numbers and takes plate photos for documentation

**Domain rules** (Smoke 3 PRD authoritative — see [SMOKE-3-PRD.md](./SMOKE-3-PRD.md); resolution trail in [INGEST-RESOLUTIONS.md](./INGEST-RESOLUTIONS.md)):
- 96-well microtiter plates: 72 wells for unknowns (singles) or 36 (duplicates), 24 wells reserved for protein standards
- Plate snake: singles fill column-by-column starting `A4 → H4`, then `A5 → H5`, …, through col 12. Duplicates pair adjacent rows in the same column: samples 1–4 occupy col 4 as `(A4,B4) (C4,D4) (E4,F4) (G4,H4)`, then col 5, … through col 12 (R-10 / SMK3-14)
- Volume calculation: `(total wells × vol per well) + dead volume`, **rounded UP to nearest 0.1 mL** (ceiling at 0.1 mL — supersedes the prior round-to-nearest-mL rule; R-03 / SMK3-06)
- Dead volume: `number_of_setups × 2 mL`; default setups = 1 (R-07 / SMK3-05). Extends shipped CALC-03.
- Premix panels are 1× ready-to-use (no dilution math). Single analyte addition: `master mix volume ÷ stock concentration` (e.g., 20×)
- **Diluent for Beads + Antibodies (concentration-keyed; supersedes the prior request-type-keyed rule):** if ANY selected premix is 1×, that premix is the diluent for Beads and Antibodies (no ordering — any 1× premix wins). If all selections are >1× (no 1× premix selected), fall back to the per-reagent Values-table diluent for each reagent. (R-04 / SMK3-07)
- Selection cap: max 5 singles when a premix is selected (CALC-05 retained per PRD silence ≠ removal; R-05). Replicate caps (72 single / 36 duplicate) per plate are separate constraints.
- Per-reagent fields (Smoke 3 panel format): Beads, Antibodies, SAPE each carry their own Concentration + Diluent + Volume/well. SAPE has a vendor-named `SAPE Name` field (display-only, traceability; SMK3-12). PE volume = `Total Volume of the Assay ÷ SAPE concentration` (SMK3-17).
- Reagents: capture antibody beads, biotinylated antibodies, SA-PE

**Reference data available:**
- Bead region map CSV (analyte to bead region mapping)
- Platform-specific parameters (stock concentrations, volumes per well) — need to capture/configure

**Deployment:**
- Desktop workstation application
- Operators have dedicated computer at workstation
- Network access available
- Photo upload from connected camera (existing workflow)

## Constraints

- **Platform**: Desktop-first (Windows workstation)
- **Data**: Must support searchable run history
- **Accuracy**: Calculations must match established lab protocols exactly

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Desktop-first, tablet later | Operators work at computer workstations; tablet only needed for photos | — Pending |
| Manual lot number entry for v1 | Barcode scanning adds complexity; manual entry matches current workflow | — Pending |
| Platform-specific configuration | Each vendor (Milliplex, BioRad, etc.) has different stock concentrations and analytes | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-05-13 — Phase 15.1 complete (Phase 15 code-review gap closure; WR-01 loadRun override-flag restoration + WR-02 audit-trail integrity on null IPC + WR-06 derive 6 em-dashed audit-trail rows; 3 plans, all Wave 1 parallel; 4/4 verifier must-haves at code level; 439/439 tests; typecheck exit 0; 0 critical/warning code-review findings, 4 info). 4 visual items added to Phase 16 Windows UAT bundle (now 15 total — 11 from Phase 15 + 4 from 15.1). Phase 16 D-16-16/17/18 hard preconditions now closed. Next: Phase 16 (Windows UAT & Release — build .exe, install on Windows, walk through Smoke 3 features end-to-end, tag release).*
