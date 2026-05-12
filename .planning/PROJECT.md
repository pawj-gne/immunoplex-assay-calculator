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

### Active

(Phase 13 validated SMK3-08..11 + SMK3-DIL-01; remaining Smoke 3 work lives in Phases 14, 15, 16 — see Current Milestone below.)

## Current Milestone: v2.0 Panel XLSX Upload + Master-Panel Data Model

**Goal:** Replace the flat-CSV panel importer with a vendor-native multi-tab xlsx format, introduce a `master_panels` concept to anchor reagent volumes and vendor-specific terminology per (platform, species), and wire the calculator to read reagent volumes from the master panel when available.

**Target features:**
- **Panel XLSX upload** — multi-tab xlsx ingest replacing or coexisting with v1's flat CSV. Per-tab pipeline with metadata (B1–B4 + optional A6 vendor singles term), master analyte list (cols A/B/C), premix columns (E+), blank-stop rules, case-insensitive platform/species resolution, validation-before-write, upsert-on-re-import. Full spec in `.planning/PANEL-UPLOAD-V2-SPEC.md`.
- **Vendor-specific singles term in UI** — once `vendor_singles_term` lands on master panels, replace the generic "Analytes" label in `AnalyteGrid` with the vendor term ("Singleplex", "Simplex", etc.) when available. Closes D-4.1-05.
- **Calculator reagent-volume wiring** — calculator reads `reagent_volume_per_well` from the run's master panel first, falls back to platform default for full-custom and v1-imported panels. Documented behavior change.

**Key context:**
- Schema delta: new `master_panels` table; `master_panel_id` FK on `panels` and `analytes` (nullable for v1-imported rows).
- v1 out-of-scope items (tablet support, barcode scanning, photo annotation, lab usage tracking) stay out of v2.0. If any are pulled forward after stakeholder feedback, they land as v2.1+.
- 6 open decisions from `.planning/PANEL-UPLOAD-V2-SPEC.md` §Open decisions (replace-vs-coexist, calculator strictness, vendor-term UI placement, premix-drop semantics, validation strictness, file-level schema versioning) will be locked during `/gsd-discuss-phase` before planning the first phase.

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
*Last updated: 2026-05-12 — Phase 13 complete (Smoke 3 Panel XLSX Parser v3; SMK3-08..11 + SMK3-DIL-01 validated; per-reagent schema live; 216/216 tests). Visual UI confirmation for ImportButton banner deferred to Phase 16 UAT (Windows-only). Next: Phase 14 (Plate Page Input Expansion + UI Cleanup).*
