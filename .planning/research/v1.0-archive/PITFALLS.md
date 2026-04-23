# Pitfalls Research

**Domain:** Laboratory Assay Calculator / Documentation Tool (Luminex/Immunoplex)
**Researched:** 2026-01-22
**Confidence:** MEDIUM-HIGH (multiple verified sources, domain-specific research)

## Critical Pitfalls

### Pitfall 1: Floating-Point Arithmetic in Volume Calculations

**What goes wrong:**
Dilution and volume calculations produce subtly incorrect results due to floating-point precision errors. For example, calculating 0.1 + 0.2 yields 0.30000000000000004 instead of 0.3. In laboratory contexts, these errors can propagate through serial dilutions, causing compounded inaccuracies that affect assay results.

**Why it happens:**
Most programming languages represent decimal numbers in binary floating-point format, which cannot exactly represent many common decimal fractions. Developers assume standard arithmetic will produce exact results for simple calculations. The errors are often invisible until they manifest as off-by-one-pipette-step errors or failed QC checks.

**How to avoid:**
- Use decimal/fixed-point arithmetic libraries (e.g., decimal.js, big.js) for ALL volume and concentration calculations
- Store volumes as integers in smallest practical unit (microliters as integers, not milliliters as floats)
- Round displayed values explicitly at the presentation layer, not calculation layer
- Test calculations against known-correct manual calculations with edge cases

**Warning signs:**
- Calculated volumes that end in .9999999 or .0000001
- Sum of aliquot volumes not equaling total volume
- Dilution series that don't back-calculate to expected concentrations
- QC checks failing intermittently on boundary conditions

**Phase to address:**
Phase 1 (Core Calculation Engine) - This must be architected correctly from the start. Retrofitting decimal arithmetic is expensive.

---

### Pitfall 2: Serial Dilution Error Propagation Blindness

**What goes wrong:**
Standard curve calculations assume independent measurements, but serial dilutions introduce correlated errors. If the first dilution step is off by 5%, all subsequent concentrations inherit that error. Software that doesn't account for this produces incorrect confidence intervals and precision profiles.

**Why it happens:**
Each dilution step compounds the error from previous steps. The math is non-trivial - studies show "failure to account for serial dilution error in calibration inference on unknown samples leads to serious inaccuracy of assessments of assay precision." Developers implement simple division without understanding error propagation.

**How to avoid:**
- Document clearly that displayed concentrations assume perfect dilution technique
- Provide "error budget" calculations showing how pipetting error affects final concentrations
- Consider implementing parallel dilution schemes (from stock) for critical standards rather than serial
- Add extra volume to compensate for pipetting error (e.g., 20 uL extra per step)
- Flag when calculated volumes are below pipette minimum accuracy range

**Warning signs:**
- Users reporting that their standard curves don't match expected concentrations
- Back-calculated concentrations outside 80-120% recovery range
- Increasing variance in lower concentration standards

**Phase to address:**
Phase 2 (Dilution Calculator) - Must be designed into the dilution logic, not added later.

---

### Pitfall 3: Unit Conversion Catastrophes

**What goes wrong:**
Mixing units (mL vs uL, mg/mL vs ug/mL, mM vs uM) causes 1000x errors in reagent preparation. A recipe calling for 10 uL that gets interpreted as 10 mL wastes expensive reagents. Worse, a 1000x concentration error can ruin an entire assay run.

**Why it happens:**
- Different kit manufacturers use different concentration units in their documentation
- Lab operators mentally convert between units and make errors
- Input fields accept any numeric value without unit context
- Copy-paste from kit inserts brings inconsistent units

**How to avoid:**
- ALWAYS display units prominently next to every numeric value
- Use unit-aware data types internally (not just numbers)
- Require explicit unit selection for all inputs
- Convert all internal calculations to canonical units, display in user-preferred units
- Add sanity checks: flag volumes < 1 uL or > 1000 uL as likely errors
- Color-code or visually distinguish different unit scales

**Warning signs:**
- Calculated volumes that seem "too big" or "too small"
- Users asking "is this in microliters or milliliters?"
- Recipes producing extremely concentrated or dilute solutions
- Kit lot changes causing calculation failures

**Phase to address:**
Phase 1 (Data Models) - Unit-awareness must be built into the type system from day one.

---

### Pitfall 4: Bead Region Collision in Multiplex Assays

**What goes wrong:**
When combining singleplex kits with multiplex premix panels, two analytes get assigned to the same bead region. The Luminex instrument cannot distinguish them, producing garbage data. Operators don't discover the collision until after running an expensive plate.

**Why it happens:**
- Different kit lots may use different bead region assignments
- Combining kits from different vendors without checking region maps
- Software doesn't validate bead region uniqueness across combined panels
- Region assignments change between kit versions

**How to avoid:**
- Require bead region input for every analyte in a panel
- Validate uniqueness before allowing panel creation
- Store bead region mappings per kit lot, not just per analyte
- Display a visual "bead region map" showing occupied regions
- Warn when combining kits that have potential region conflicts
- Link to manufacturer documentation for region assignments

**Warning signs:**
- Luminex software showing unexpected bead counts in regions
- Two analytes reporting identical values across all samples
- Panel configurations that work with one kit lot but fail with another

**Phase to address:**
Phase 2 (Platform Configuration) - Must be validated before any run setup can be finalized.

---

### Pitfall 5: Premix/Singles Combination Rule Violations

**What goes wrong:**
Operators create invalid panel configurations by adding too many singles to a premix panel (violating the "max 5 singles with premix" rule) or combining incompatible premixes. The software allows the configuration, but the assay fails due to bead interference or reagent incompatibility.

**Why it happens:**
- Platform-specific rules aren't encoded in software
- Rules vary by manufacturer (Milliplex, BioRad, ProCartaPlex, R&D)
- Rules change between kit versions
- Operators don't read fine print in kit documentation

**How to avoid:**
- Encode platform-specific configuration rules as validation logic
- Block invalid configurations with clear error messages explaining the rule
- Provide manufacturer documentation links for rule sources
- Track rule versions and update when platforms change
- Allow admin override with explicit acknowledgment of deviation

**Warning signs:**
- Operators creating configurations then modifying them manually "because the software won't let me"
- Recurring assay failures with the same panel configurations
- Different operators getting different results with "the same" panel

**Phase to address:**
Phase 2 (Platform Configuration) - Rules must be enforced before run setup proceeds.

---

### Pitfall 6: Lot Number Traceability Gaps

**What goes wrong:**
When assay troubleshooting is needed months later, operators cannot determine which reagent lots were used in a specific run. The data exists but wasn't captured at the right granularity - they know "Human Cytokine Panel A" was used but not which lot of detection antibody.

**Why it happens:**
- Lot numbers are tedious to enter, so operators skip them
- Software captures kit lot but not component lots
- Lot information isn't required at the right workflow step
- Expiration tracking exists for inventory but isn't linked to run records

**How to avoid:**
- Make lot number entry mandatory (not optional) for all reagents used
- Capture lots at the moment of use, not just at inventory receipt
- Barcode scanning for lot entry to reduce friction
- Link lot numbers to run records immutably
- Provide "lot deviation" reports showing which runs used a specific lot

**Warning signs:**
- Audit findings citing incomplete lot traceability
- Troubleshooting sessions stalled by "we don't know which lot we used"
- Inventory showing lots in stock that were actually consumed

**Phase to address:**
Phase 3 (Documentation & Tracking) - Must be designed into the run documentation workflow.

---

### Pitfall 7: Well Mapping Mental Model Mismatches

**What goes wrong:**
Software displays well positions one way (A1, A2, A3...) but the operator reads the physical plate differently (by column: A1, B1, C1...). Or the software uses 0-indexed positions internally but displays 1-indexed, causing off-by-one errors in well assignments.

**Why it happens:**
- Different instruments and software use different well addressing conventions
- Row-major vs column-major ordering assumptions
- 0-indexed programming vs 1-indexed lab conventions
- Physical plate orientation can be ambiguous (A1 in which corner?)

**How to avoid:**
- Always show visual plate map, not just well list
- Use consistent A1-H12 notation everywhere (never 0-indexed in UI)
- Clearly mark plate orientation (A1 corner highlighted)
- Match output format to Luminex software import requirements
- Allow drag-and-drop well assignment with immediate visual feedback
- Show "reading order" animation to clarify instrument scan pattern

**Warning signs:**
- Operators asking "which corner is A1?"
- Sample results that seem shifted by one row or column
- Exports that don't import correctly into Luminex software
- Duplicate samples appearing in wrong wells

**Phase to address:**
Phase 2 (Plate Layout) - Visual plate representation must be clear and consistent.

---

### Pitfall 8: Recipe Ambiguity in Operator Instructions

**What goes wrong:**
Generated recipes are technically correct but ambiguous to follow. "Add 10 uL of standard to each well" - which standard? All 8 points? "Mix thoroughly" - how many times? For how long? Operators interpret instructions differently, causing run-to-run variation.

**Why it happens:**
- Developer mindset: assumes the reader knows context
- Recipe generation focuses on "what" not "how"
- No validation that recipes are followable by bench operator
- Implicit assumptions about operator skill level

**How to avoid:**
- Generate step-by-step instructions, not summaries
- Include explicit quantities, well positions, and timing for every step
- Use consistent terminology matching kit documentation
- Add "verify" checkpoints (e.g., "Expected final volume: 12 mL")
- Include warnings for critical steps (e.g., "Vortex beads immediately before adding - beads settle quickly")
- Test recipes with actual bench operators before release

**Warning signs:**
- Operators asking clarifying questions about generated recipes
- Different operators interpreting the same recipe differently
- Run notes full of "I assumed this meant..."
- Experienced operators ignoring software-generated recipes

**Phase to address:**
Phase 3 (Recipe Generation) - Requires user testing and iteration with actual operators.

---

## Technical Debt Patterns

Shortcuts that seem reasonable but create long-term problems.

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Hardcoding platform-specific rules | Faster initial development | Every platform change requires code changes, rule conflicts accumulate | Never - use configuration |
| Storing calculations as final values only | Simpler data model | Cannot audit how values were derived, no recalculation if formulas improve | Never for regulated use |
| Single-user design | Simpler architecture | Cannot share configurations, no audit trail of who changed what | MVP only, refactor before v2 |
| Inline validation messages | Quick to implement | Inconsistent error messaging, no i18n support | Prototype only |
| Floating-point for volumes | Native number type | Precision errors compound silently | Never - use decimal library |
| Optional lot numbers | Faster data entry | Traceability gaps discovered during audits | Never for production use |

## Integration Gotchas

Common mistakes when connecting to external systems or formats.

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Luminex xPONENT import | Generating well lists in row-major order when software expects column-major | Match exact format specification, test import with actual software |
| Excel export | Using localized decimal separators (comma vs period) | Use explicit formatting, detect system locale or offer format choice |
| Barcode scanners | Assuming all barcodes are same length/format | Support variable formats, validate against expected patterns per field |
| PDF recipe generation | Embedding fonts that don't support special characters | Use PDF/A with embedded Unicode fonts |
| Plate reader data import | Parsing based on column position not header names | Parse headers, handle column reordering gracefully |

## Performance Traps

Patterns that work at small scale but fail as usage grows.

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Loading full run history on startup | App becomes slow to launch | Paginate history, lazy-load details | > 100 runs |
| Storing plate images as BLOBs in SQLite | Database file grows huge, backup slow | Store images as files, reference by path | > 50 runs with images |
| Recalculating all values on every keystroke | UI becomes laggy during data entry | Debounce calculations, calculate on blur | > 20 analytes in panel |
| No database indexes on search fields | Run history search becomes slow | Index lot numbers, dates, operator names | > 500 runs |
| Synchronous file I/O for exports | UI freezes during large exports | Async operations with progress indicator | > 10 MB exports |

## Security Mistakes

Domain-specific security issues beyond general application security.

| Mistake | Risk | Prevention |
|---------|------|------------|
| Storing lot/expiration data without validation | Operators enter future dates or impossible lot formats, data becomes untrustworthy | Validate lot number formats per manufacturer, reject future expiration dates |
| No access control on configuration changes | Anyone can modify platform rules, calculation parameters | Role-based access: operator vs admin, log all configuration changes |
| Unencrypted local database | Patient sample IDs (if stored) exposed if laptop lost | Encrypt database at rest, or exclude PII entirely from local storage |
| Recipe PDFs with embedded sensitive data | Protocol details exposed if PDF shared externally | Offer "internal" vs "external" recipe versions, redact lot numbers for external |
| No audit trail on run modifications | Cannot prove data wasn't altered post-run | Immutable run records, separate "amendments" with timestamps |

## UX Pitfalls

Common user experience mistakes in laboratory calculator tools.

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Requiring exact decimal entry (10.000 vs 10) | Tedious data entry, frustration | Accept any valid numeric format, normalize internally |
| No undo for well assignments | Misclick ruins plate layout, must start over | Full undo/redo stack for plate editor |
| Modal dialogs blocking workflow | Cannot reference other data while entering | Side panels or non-modal dialogs, allow window resizing |
| Hiding calculated values until "Generate" clicked | Operator can't verify inputs are reasonable | Real-time calculation preview |
| Tiny touch targets on plate map | Difficult to select wells on touch devices | Minimum 44x44px touch targets, or zoom capability |
| Jargon-heavy error messages | Operators don't understand what went wrong | Plain-language errors with specific fix instructions |
| No visual distinction between required/optional fields | Operators miss required fields, form won't submit | Clear required field indicators, validate on blur not just submit |

## "Looks Done But Isn't" Checklist

Things that appear complete but are missing critical pieces.

- [ ] **Volume Calculator:** Often missing dead volume accounting - verify it adds 10-20% overage for pipetting loss
- [ ] **Dilution Series:** Often missing minimum pipettable volume check - verify it flags steps requiring < 1 uL transfers
- [ ] **Plate Layout:** Often missing duplicate sample handling - verify it supports technical replicates with proper well assignment
- [ ] **Recipe Generation:** Often missing incubation times - verify recipes include all timing requirements from kit protocol
- [ ] **Run Documentation:** Often missing environmental conditions - verify temperature, humidity capture if relevant
- [ ] **Standard Curve:** Often missing blank subtraction step - verify background correction is applied before concentration calculation
- [ ] **Export:** Often missing metadata headers - verify exported files include date, operator, software version
- [ ] **Lot Tracking:** Often missing opened/reconstituted dates - verify tracking includes not just receipt but preparation dates

## Recovery Strategies

When pitfalls occur despite prevention, how to recover.

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Floating-point calculation errors discovered | MEDIUM | Implement decimal library, recalculate all stored derived values, flag affected runs for review |
| Lot traceability gaps discovered | HIGH | Cannot fully recover - implement capture going forward, document gap period for audits |
| Well mapping errors in stored runs | MEDIUM | Add run amendment capability, allow retrospective well map correction with audit trail |
| Platform rule violations in past runs | LOW | Flag affected runs in search results, add "configuration deviation" note to run record |
| Database corruption from power loss | LOW-HIGH (depends on backup) | Restore from backup, implement WAL mode and automatic backups |
| Unit conversion errors in recipes | LOW | Version recipes, issue correction notices, update affected run records |

## Pitfall-to-Phase Mapping

How roadmap phases should address these pitfalls.

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Floating-point arithmetic | Phase 1 (Core Engine) | Unit tests with known-precision edge cases |
| Serial dilution error propagation | Phase 2 (Dilution Calculator) | Compare calculations against manual spreadsheet |
| Unit conversion errors | Phase 1 (Data Models) | Type system prevents mixed-unit arithmetic |
| Bead region collisions | Phase 2 (Platform Config) | Validation rejects duplicate regions in panel |
| Premix/singles rule violations | Phase 2 (Platform Config) | Rules block invalid configurations with clear messages |
| Lot traceability gaps | Phase 3 (Documentation) | Required fields prevent run save without lots |
| Well mapping mismatches | Phase 2 (Plate Layout) | Visual confirmation matches Luminex import |
| Recipe ambiguity | Phase 3 (Recipe Generation) | User testing with actual operators |
| Database corruption | Phase 1 (Storage Layer) | Automatic backups, WAL mode enabled |
| No undo capability | Phase 2 (Plate Editor) | Undo stack implemented from start |

## Sources

### LIMS Implementation Pitfalls
- [Common Challenges With LIMS Implementation](https://www.splashlake.com/blog/common-challenges-with-lims-implementation-and-how-to-solve-them)
- [Common Mistakes in LIMS Implementation - Lab Horizons](https://labhorizons.co.uk/2025/04/common-mistakes-in-lims-implementation/)
- [Pitfalls to Avoid When Implementing a LIMS - Stackwave](https://www.stackwave.com/laboratory-software-blog/pitfalls-to-avoid-when-implementing-a-lims)
- [5 Common Pitfalls of LIMS Projects - Thermo Fisher](https://www.thermofisher.com/blog/connectedlab/5-common-pitfalls-of-lims-projects-and-how-to-avoid-them/)

### Dilution Calculation Errors
- [Common Mistakes in Dilution Ratio Calculation - FasterCapital](https://fastercapital.com/topics/common-mistakes-to-avoid-in-dilution-ratio-calculation.html/1)
- [Serial Dilution Error in Calibration - PubMed](https://pubmed.ncbi.nlm.nih.gov/9544505/)
- [Serial Dilutions and Standard Curve - Biology LibreTexts](https://bio.libretexts.org/Bookshelves/Biotechnology/Lab_Manual:_Introduction_to_Biotechnology/01:_Techniques/1.08:_Serial_Dilutions_and_Standard_Curve)

### Luminex-Specific Issues
- [Luminex Troubleshooting Guide - R&D Systems](https://www.rndsystems.com/resources/protocols/troubleshooting-guide-luminex)
- [ProcartaPlex Troubleshooting - Thermo Fisher](https://www.thermofisher.com/us/en/home/technical-resources/technical-reference-library/antibodies-immunoassays-support-center/luminex-assays-support/luminex-assays-support-troubleshooting.html)
- [MILLIPLEX Tips & Tricks - Sigma-Aldrich](https://www.sigmaaldrich.com/US/en/technical-documents/product-supporting/milliplex/tips-tricks-immunoassay-protocol-troubleshooting-advice)

### Floating-Point Precision
- [Floating-Point Arithmetic Issues - Python Documentation](https://docs.python.org/3/tutorial/floatingpoint.html)
- [Precision and Accuracy in Floating-Point - Microsoft](https://learn.microsoft.com/en-us/troubleshoot/microsoft-365-apps/access/floating-calculations-info)
- [Floating-Point Error Propagation Guide](https://floating-point-gui.de/errors/propagation/)

### Laboratory Data Entry and Validation
- [5 Most Common Lab Errors - Labbit](https://www.labbit.com/resources/5-most-common-lab-errors-what-causes-them)
- [How Lab Informatics Systems Reduce Data Entry Errors - LabLynx](https://www.lablynx.com/resources/articles/laboratory-informatics-systems-help-eliminate-data-entry-errors/)
- [Reducing Human Error in Labs - LabLynx](https://www.lablynx.com/resources/articles/reducing-human-error-labs/)

### Lot Tracking and Traceability
- [Why Labs Need Data Traceability - Labguru](https://www.labguru.com/blog/achieving-traceability-with-a-laboratory-information-system)
- [LIMS Traceability Quality - LabWare](https://www.labware.com/blog/ways-lims-traceability-promotes-quality)

### 96-Well Plate Management
- [Tips for Overcoming 96 Deep Well Plate Mistakes - MBP Inc](https://mbpinc.net/3-tips-for-overcoming-96-deep-well-plate-mistakes)
- [PlateEditor for Multi-Well Plate Management - PMC](https://pmc.ncbi.nlm.nih.gov/articles/PMC8162687/)

### Desktop Application Data Persistence
- [Electron Data Persistence Tutorial](https://10xdev.blog/electron-data-persistence/)
- [SQLite Backup Strategies in Production](https://oldmoe.blog/2024/04/30/backup-strategies-for-sqlite-in-production/)
- [Data Persistence Lessons from Electron App - Station](https://medium.com/getstation/what-we-learned-from-data-persistence-in-our-growing-electron-app-72c9ad19fce)

---
*Pitfalls research for: Immunoplex Assay Calculator*
*Researched: 2026-01-22*
