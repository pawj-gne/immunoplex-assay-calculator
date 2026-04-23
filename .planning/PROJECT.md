# Immunoplex Assay Calculator

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

### Active

(None — v1.0 milestone code-complete pending Windows smoke test)

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

**Domain rules:**
- 96-well microtiter plates: 72 wells for unknowns (singles) or 36 (duplicates), 24 wells reserved for protein standards
- Volume calculation: `(total wells × vol per well) + dead volume`, rounded up to nearest mL
- Premix panels are 1x ready-to-use (no dilution math)
- Single analyte addition: `master mix volume ÷ stock concentration (e.g., 20x)`
- Premix + singles: max 5 singles allowed (more dilutes premix concentration), premix is the diluent
- Full custom: no limit on singles, Assay Buffer is the diluent
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

---
*Last updated: 2026-04-23 after Phase 4 completion — v1.0 milestone code-complete pending Windows smoke test HUMAN-UAT-04-03-01*
