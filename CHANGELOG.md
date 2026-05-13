# Changelog

All notable changes to the Immunoplex Assay Calculator are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.0.0] - 2026-05-13

First release on Windows lab hardware. Implements the Smoke 3 PRD calculator (lab-authored
specification for reagent volume calculations against vendor-native panel data).

### Added

- Per-reagent diluent rule for Beads and Antibodies: if any selected premix is 1×, that
  premix is the diluent. Otherwise, the per-reagent diluent from the panel's Values block
  is used.
- Volume rounding at 0.1 mL precision (ceiling): final reagent volumes round up to the
  nearest tenth of a millilitre instead of the nearest whole millilitre.
- Setups-scaled dead volume: dead volume = `number of setups × 2 mL`. A new
  **Number of Setups** input on the Plate page drives this calculation.
- **Old Beads** and **Old Antibodies** inputs on the Plate page: reusable reagent volume
  is subtracted from the new-reagent calculation and added to the total reagent volume.
- Audit Trail section on the finalized run document showing the full calculation work:
  inputs (plates, samples, replicate mode, selections, old reagents, setups) →
  intermediates (total wells, volume/well, total bead/antibody volume, dead volume) →
  outputs (new reagents, total volumes, PE volume) → diluent decision (which premix won,
  or which Values-table diluent applied per reagent).
- **SAPE Name** field displayed in the run document metadata header (traceability;
  no calculation impact).
- Override badge on the run document when Old Beads or Old Antibodies exceed the
  20% reuse cap, so reviewers can see that the operator confirmed an override.
- Advisory banner on runs saved before the Smoke 3 calculator rules shipped:
  reopening shows the persisted values; the new rules are not retroactively applied.
- Vendor-native panel-xlsx importer accepting the lab's sectioned format (Criteria,
  Values, Category blocks per sheet) with per-reagent rows for Beads, Antibodies, and
  SAPE.
- Wholesale-replace re-upload semantics: re-uploading the same (Platform, Species, Panel)
  triple replaces the existing panel's analytes, premixes, and metadata in a single
  transaction.
- Roman-to-Arabic panel name normalization at import time: `Panel I` is stored and
  displayed as `Panel 1`. The lab can author either form.
- PE volume formula: PE volume = `total volume of the assay ÷ SAPE concentration`,
  read from the SAPE row of the panel's Values block (typically 1×, so PE volume
  equals the total assay volume).

### Changed

- Final volumes now round up to the nearest **0.1 mL** (ceiling), replacing the previous
  rule of rounding up to the nearest whole mL.
- Dead volume is now `number of setups × 2 mL`, replacing the fixed 2 mL constant.
- Diluent selection is now concentration-keyed (any 1× premix wins, otherwise per-reagent
  Values-table diluent applies), replacing the prior request-type-keyed rule with
  Assay Buffer fallback.
- Duplicate plate layout now fills adjacent rows within the same column
  (`(A4,B4) (C4,D4) (E4,F4) (G4,H4)`, then column 5, …, through column 12), replacing
  the prior horizontal-pair + column-12 vertical-pair layout.
- Bead region display is now a single flat list of every analyte in the current selection,
  sorted by bead region, replacing the prior grouping by panel membership.

### Removed

- Legacy CSV panel importer and its templates (`templates/panel-template.csv`,
  `templates/sample-panel-import.csv`). The vendor-native xlsx importer fully
  replaces this workflow.
- "Stock concentration: Xx" labels from platform-selection screens. The
  "Platform Selected: {name}" confirmation is retained.
- v0.7.0 sub-panel CSV importer (an interim importer shape that never reached lab use)
  is superseded by the Smoke 3 per-reagent schema and is not present in v1.0.0. This
  explains the version jump from v0.7.0 to v1.0.0 — v0.7.0 was a dev build only.

### Fixed

- Duplicate pair orientation now matches how a Hamilton robot pipettes (column-major).
- Adding a second plate no longer erases plate 1's layout.
- Species selection is now visible in the run metadata header and in the run list.
- Selecting a premix panel scopes the analyte picker to that panel's analytes only;
  switching between Panel I and Panel II clears stale single-analyte selections.

[unreleased]: https://github.com/pawj-gne/immunoplex-assay-calculator/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/pawj-gne/immunoplex-assay-calculator/releases/tag/v1.0.0
