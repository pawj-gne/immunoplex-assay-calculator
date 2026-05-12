# Synthesized Constraints (SPEC intel)

No SPEC-type document was ingested in this run. The ingest set contains a single PRD (`smoke-3.md`).

However, the orchestrator flagged `.planning/PANEL-UPLOAD-V2-SPEC.md` as the LOCKED v2 contract for conflict-engine purposes (it is referenced by PROJECT.md as the panel-upload-v2 source of truth). The PRD's calculation block contains protocol-level rules that overlap that spec's schema. The new structural assertions the PRD makes against panel data — which behave like schema constraints — are recorded below so the roadmapper has them in one place.

Every conflict between these PRD-derived constraints and the existing PANEL-UPLOAD-V2-SPEC.md is surfaced in `INGEST-CONFLICTS.md`. This file just documents what the PRD says; it does NOT pick winners.

---

## Constraint: panel-data file shape (PRD view)

- type: schema
- source: smoke-3.md §Database, §Hierarchy of UI interaction, §Calculation — Variables
- content:
  - "Criteria / Values / Category" sectioned layout per tab
  - Tab contains a Criteria area (Platform, Species, Panel)
  - Tab contains a Values area (per-reagent volume/well, per-reagent diluent, possibly per-reagent concentration)
  - Tab contains a Category area (Premix list, Single Analyte list, with premix membership)
  - Panel Description, Diluent (per reagent), SAPE Name, per-reagent Volume/well, and Premix "Count" column are all distinct fields the PRD assumes are present on each tab
  - A "Table" summary tab lists which Panels are available for which (Platform, Species)

**Note:** this contradicts PANEL-UPLOAD-V2-SPEC.md §Per-tab layout (locked), which specifies a B1–B4 metadata block, a SINGLE Reagent Volume row, no per-reagent diluent or SAPE name fields, and premix columns starting at col E with literal "Target" headers at row 7. See `INGEST-CONFLICTS.md` BLOCKER #1.

## Constraint: per-reagent volume/well, diluent, SAPE Name

- type: schema
- source: smoke-3.md §Hierarchy of UI interaction (database description), §Calculation — Variables — Volume/well, §Calculation — Variables — TSC
- content:
  - Each of Beads, Antibodies, and SAPE has its own concentration, diluent, and volume/well in the panel tab
  - Diluent for beads/antibodies depends on the user's selection: 1× premix → that premix is the diluent; > 1× → use the per-reagent Values-table diluent column
  - SAPE has a named "SAPE Name" field per tab (distinct from generic SA-PE)

**Note:** PANEL-UPLOAD-V2-SPEC.md models a single `reagent_volume_per_well` field per master panel (B4), not per-reagent volumes. Diluent and SAPE-name fields do not appear in the v2 spec at all. See `INGEST-CONFLICTS.md` BLOCKER #2.

## Constraint: premix "Count" column

- type: schema
- source: smoke-3.md §Hierarchy of UI interaction — Second Step, §Calculation — Variables — TSC
- content:
  - Each premix has a "Count" attribute in the source data (number of analytes in the premix), referenced when computing TA vs TSC
  - The PRD does not specify exact cell position for the Count column

**Note:** PANEL-UPLOAD-V2-SPEC.md does not include a premix Count column — count is derived by counting non-blank rows in the premix column (E+, row 8 downward). The PRD-stated Count column is redundant with the implicit count in the v2 spec but is not actively contradictory; flagged as INFO in `INGEST-CONFLICTS.md`.

## Constraint: plate-layout snake direction

- type: protocol
- source: smoke-3.md §Third Step: Plate & Sample Count
- content:
  - Singles mode fills unknown columns 4–12 column-first: A4, B4, C4, D4, E4, F4, G4, H4, then A5 → H5, etc.

**Note:** Matches the shipped behavior in `usePlateLayout.ts` and decision 03-01 ("Standards occupy columns 1-3"). No conflict; recorded for traceability.

## Constraint: replicate-mode capacities

- type: protocol
- source: smoke-3.md §Limits
- content:
  - Singles: 72 samples per plate
  - Duplicates: 36 samples per plate

**Note:** Matches PROJECT.md §Domain Rules and REQUIREMENTS.md CALC-01. No conflict.

## Constraint: dead volume per setup

- type: protocol
- source: smoke-3.md §Dead volume
- content:
  - 2 mL per setup
  - Total dead volume = number_of_setups × 2 mL

**Note:** Matches decision 02-03 ("Default dead volume changed to 2000 uL (2 mL)") and CALC-03. The PRD adds the new variable "number of setups" as a calculation input. Whether existing CALC-03 already supports a setups multiplier or assumes 1 setup is unclear from REQUIREMENTS.md text alone — flagged as WARNING in `INGEST-CONFLICTS.md`.

## Constraint: rounding precision

- type: protocol
- source: smoke-3.md §Calculation — Variables — Volume/well
- content:
  - Round all calculated values to the tenth decimal (0.1 mL precision)

**Note:** REQUIREMENTS.md CALC-06 and PROJECT.md §Domain Rules say "round up to nearest mL" (1 mL precision, ceiling). PRD says "round to the tenth decimal" (0.1 mL precision, rounding-not-ceiling). These are different precisions AND different rounding modes. See `INGEST-CONFLICTS.md` BLOCKER #3.
