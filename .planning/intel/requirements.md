# Synthesized Requirements (PRD intel)

All requirements below were extracted from a single PRD:

- source: `/Users/pawj/Lab_Dev/immunoplex-assay-calculator/.planning/inbox/smoke-3.md`
- precedence: PRD (default)
- locked: false

Requirement IDs use the `REQ-smoke3-{slug}` namespace so they don't collide with existing `CALC-/PIMP-/MPAN-/CALV-/VTRM-/PLAT-/RECP-/DOCM-` IDs in `REQUIREMENTS.md`. The roadmapper will re-namespace into the canonical scheme when merging.

---

## Database / criteria selection

### REQ-smoke3-db-single-sheet-multi-tab

- description: Panel database is a single sheet with multiple tabs; tabs are labeled by Platform / Species / Panel; each non-table tab corresponds to a specific (Platform, Species, Panel) triple. A "Table" tab summarizes the elements of each criteria.
- acceptance:
  - App reads panel data from a multi-tab workbook
  - Each non-summary tab is scoped to a (Platform, Species, Panel)
  - A "Table" tab summarizes which Panels exist for which Platform/Species
- scope: panel data source format
- source: smoke-3.md §Database

### REQ-smoke3-criteria-hierarchy

- description: First UI page lets operator select Platform, Species, then Panel — in that order. The selected criteria determine which tab the rest of the flow reads from. Selecting Platform shows "Platform Selected: <name>" verification (must NOT show stock concentration or "Ready to proceed with reagent calculations" copy). Next step is gated until Panel is selected.
- acceptance:
  - Order is enforced: Platform → Species → Panel; later steps locked until all three picked
  - Selecting Platform = "Millipore" shows verification line "Platform selected: Millipore" only
  - Stock-concentration labels do NOT appear on the Platform-selection screen (explicit removal action called out in PRD)
  - "Select Panel" appears only after Species is picked, and the panel list is filtered by (Platform, Species) via the Table tab
- scope: criteria selection UI (First Step)
- source: smoke-3.md §Hierarchy of UI interaction — First Step: Criteria

## Category selection

### REQ-smoke3-category-premix-and-singles

- description: After criteria, present two analyte categories — Single Analytes and Premix — with Premix listed first, then Single Analytes. Operator may pick singles alone, premixes alone, or any combination. When a premix is selected, its member analytes are highlighted in the Single Analytes list and become non-selectable. Additional singles not in any selected premix remain selectable.
- acceptance:
  - UI renders Premix section above Single Analytes section
  - Selecting premix "JAMmate F" (containing IL-1a, IL-6, GM-CSF, IL-10) makes those four analytes visually highlighted and disabled in singles
  - User can still select singles not in any selected premix (e.g., IL-2, IFN-g)
  - TSC (Total Selected Count) = number of premix and singles selections the user made (3 in the worked example) — NOT the count of constituent analytes (6 in the worked example)
  - TA (Total Analytes) = sum of all analytes including premix members (6 in the worked example) — used only for bead-region display
  - Reagent volume calculations use TSC, not TA
- scope: category selection UI (Second Step) + TSC/TA definitions
- source: smoke-3.md §Second Step: Category

## Plate & sample count inputs

### REQ-smoke3-plate-sample-inputs

- description: Third UI page captures: (1) number of plates, (2) replicate mode, (3) number of samples per plate, (4) volume of old reagent (beads and antibodies), (5) number of setups.
- acceptance:
  - All five fields appear on the Plate & Sample Count page
  - Plate layout is snaked by columns starting at A4 → H4, then A5 → H5, etc. (column-first fill of unknown columns 4-12)
  - Old-reagent volume can be 0 or greater
- scope: third-step UI inputs
- source: smoke-3.md §Third Step: Plate & Sample Count

### REQ-smoke3-replicate-mode-caps

- description: Replicate mode limits.
- acceptance:
  - Singles mode: max 72 samples per plate
  - Duplicates mode: max 36 samples per plate
- scope: replicate-mode capacity
- source: smoke-3.md §Limits

## Calculation rules

(These are documented under requirements because they describe operator-observable outputs. The structural constraints, e.g. per-reagent diluent and per-reagent volume/well, are also captured in `constraints.md`.)

### REQ-smoke3-tsc-driven-calculation

- description: Reagent calculations are driven by TSC (the user's premix-or-single selection count), not TA (total constituent analytes). Diluent selection depends on premix concentration: if any selected premix has concentration = 1× AND additional selections are made (singles, other premixes, or mixed), the 1× premix is the diluent for Beads and Antibodies. If selections have concentration > 1×, use the "Values" table in the tab to determine diluent.
- acceptance:
  - Calculator uses TSC as the multiplier driver, not TA
  - When a 1× premix is selected alongside any other selection, beads/antibodies diluent = that premix
  - When all selections are > 1×, diluent is sourced from the "Values" table per tab
- scope: reagent-calc driver + diluent selection
- source: smoke-3.md §Calculation — Variables — TSC

### REQ-smoke3-total-well-count

- description: Total Well Count = sum of all wells across all plates, where each plate auto-contributes 24 standard wells.
- acceptance:
  - Two plates / 100 samples (60 + 40 split) → 48 standards + 100 samples = 148 total wells
  - Standards count is fixed at 24 per plate regardless of replicate mode
- scope: well counting
- source: smoke-3.md §Calculation — Variables — Total Well Count

### REQ-smoke3-reagent-volume-formula

- description: Reagent volume per reagent = volume/well (from the panel tab's "Values" area, platform-specific) × total well count. Round all calculated values to the tenth decimal (0.1 mL precision).
- acceptance:
  - Thermofisher / Human / Panel 1 example: 148 wells × 0.05 mL/well = 7.4 mL beads; 148 × 0.025 = 3.7 mL antibodies
  - Output displays to 1 decimal place
- scope: per-reagent volume formula + rounding
- source: smoke-3.md §Calculation — Variables — Volume/well

### REQ-smoke3-old-reagent-handling

- description: Old reagent volume (≥ 0) is added to total reagent volume but is NOT subtracted from the volume-per-well calc; rather, the new-reagent volume is derived from `total_assay_volume - old_reagent`.
- acceptance:
  - `Total reagent = New reagent + Old reagent`
  - `New reagent = total_assay_volume - old_reagent`
- scope: old-reagent accounting
- source: smoke-3.md §Old Reagents + §Calculation — Total reagent volume

### REQ-smoke3-dead-volume

- description: Each setup contributes 2 mL of dead volume.
- acceptance:
  - `dead_volume = number_of_setups × 2 mL`
- scope: dead-volume formula
- source: smoke-3.md §Dead volume + §Calculation — Dead volume

### REQ-smoke3-pe-volume

- description: PE (SA-PE) volume = total assay volume ÷ concentration.
- acceptance:
  - PE volume formula evaluates against the total assay volume (reagent + dead) divided by SA-PE concentration
- scope: SA-PE volume formula
- source: smoke-3.md §Calculation — Calculation of PE volume

### REQ-smoke3-total-assay-volume

- description: Total volume of the assay = total reagent volume + dead volume.
- acceptance:
  - Formula: `total_assay_volume = total_reagent + dead_volume`
- scope: total-assay-volume aggregation
- source: smoke-3.md §Calculation — Calculation of total volume of the assay

### REQ-smoke3-show-work

- description: Final document must display all calculation work (not just the result).
- acceptance:
  - Generated prep doc renders intermediate quantities (wells, vol/well, multiplications) alongside the final values
- scope: prep-doc detail level
- source: smoke-3.md §Calculation — "Show all calculation work on the final document."

### REQ-smoke3-na-skips-calc

- description: A cell containing `n/a` in the database signifies that reagent / step is not part of the protocol and is not calculated.
- acceptance:
  - Importer / calculator skips fields where the source value is literally `n/a`
- scope: sentinel-value handling
- source: smoke-3.md §Total Reaction Volume
