# Feature Research

**Domain:** Lab Assay Calculator / LIMS-Lite for Luminex/Immunoplex Multiplexed Immunoassays
**Researched:** 2026-01-22
**Confidence:** MEDIUM (based on cross-referenced web searches; no direct user research available)

## Feature Landscape

### Table Stakes (Users Expect These)

Features users assume exist. Missing these = product feels incomplete.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **Dilution Calculator** | Core function - every immunoassay requires dilutions. Users currently use Excel or mental math. C1V1=C2V2 calculations are fundamental. | LOW | Use standard dilution formula. Support serial dilutions. |
| **Reagent Volume Calculator** | Operators need to know exact volumes for mastermixes, standards, detection antibodies. Prevents waste and errors. | LOW | Account for overage (10-20% extra for pipetting loss). |
| **96-Well Plate Visualization** | Industry standard format. Operators need to see sample placement visually. Missing this = unusable. | MEDIUM | Support color-coding for samples/standards/controls. |
| **Plate Layout Planning** | Users need to define where samples, standards, and controls go before running. This is universal in the domain. | MEDIUM | Drag-and-drop or click-to-assign wells. |
| **Standard Curve Serial Dilution Setup** | Every Luminex assay requires a standard curve (typically 7-point + blank). Automating this calculation is expected. | MEDIUM | Support multiple dilution schemes (1:2, 1:3, 1:4). |
| **Run Metadata Capture** | Documenting who ran what, when, with which reagents is basic lab practice. Required for troubleshooting. | LOW | Date, operator, platform, assay kit info. |
| **Lot Number Tracking** | Traceability is fundamental in regulated labs. Every kit, reagent, and bead lot needs recording. | LOW | Simple text entry fields with validation. |
| **Printable Prep Sheets** | Operators work at the bench, not at a computer. They need printed instructions to follow. | LOW | PDF or print-ready format. Clear, step-by-step. |
| **Run History / Search** | Labs need to look back at previous runs for troubleshooting, comparison, or audit. "What did we do last time?" | MEDIUM | Search by date, operator, assay type, sample IDs. |
| **Data Persistence** | Losing run data is unacceptable. Local storage at minimum. | LOW | SQLite or similar embedded database. |
| **Multiple Platform Support** | Labs use Milliplex, BioRad, ProCartaPlex, R&D Systems. App must not be locked to one vendor. | MEDIUM | Configurable per-platform templates/defaults. |

### Differentiators (Competitive Advantage)

Features that set the product apart. Not required, but valuable.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Unified Calculator + Documentation** | Competing tools are either calculators (no documentation) or LIMS (complex, expensive, no calculation). Combining both in a simple desktop app is novel. | MEDIUM | This is the core value proposition. |
| **Prep Recipe Generation** | Generate step-by-step operator instructions with exact volumes, timing, and well assignments. Reduces cognitive load. | MEDIUM | "Add 50uL of Standard 1 to wells A1-A2" style instructions. |
| **Offline-First Desktop** | Most LIMS are cloud-based, requiring internet and subscriptions. A simple desktop app works anywhere, no subscription. | LOW | Desktop app (Electron/Tauri) with local storage. |
| **Assay-Specific Templates** | Pre-built templates for common Luminex kits (Milliplex, ProCartaPlex) with correct default dilutions and standard curve points. | MEDIUM | Requires research per-kit. Huge time saver for users. |
| **Smart Overage Calculation** | Automatically add 10-20% overage for pipetting loss. Prevent running out of reagent mid-plate. | LOW | Simple multiplier, but often forgotten. |
| **Cross-Run Comparison** | Compare QC values across runs to detect drift. Levey-Jennings style trending. | HIGH | Requires statistical tracking over time. |
| **Export to xPONENT/Bio-Plex Manager** | Generate import files for Luminex instrument software (plate layout, sample IDs). | HIGH | Requires reverse-engineering file formats. |
| **Sample Dilution Factor Tracking** | Track what dilution factor was used for each sample to aid in result interpretation. | LOW | Critical for samples outside standard curve range. |
| **Reagent Expiration Alerts** | Warn when using lots close to expiration. Common cause of failed runs. | LOW | Simple date comparison. |
| **Barcode/QR Code Scanning** | Scan kit lot numbers, sample IDs instead of manual entry. Reduces transcription errors. | MEDIUM | Requires camera or barcode scanner integration. |
| **Protocol Version Control** | Track changes to prep protocols over time. "What changed since last month?" | MEDIUM | ELN-style versioning. |

### Anti-Features (Commonly Requested, Often Problematic)

Features that seem good but create problems.

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| **Full LIMS Functionality** | "We need sample chain of custody, instrument integration, compliance modules..." | Scope creep. Existing LIMS (LabWare, SLIMS) already do this. You become a worse version of expensive software. | Stay focused: calculation + prep documentation only. Integrate with existing LIMS via export if needed. |
| **Data Analysis / Curve Fitting** | "Can you also analyze the results and fit the standard curve?" | This is what xPONENT, Bio-Plex Manager, Quantist already do well. Duplicating is wasted effort. | Export plate layouts TO analysis software. Don't replicate analysis. |
| **Cloud Sync / Multi-User** | "We want to share runs across the team" | Adds authentication, sync conflicts, server infrastructure, security concerns. | Start with local-only. Export/import files for sharing. Cloud is v2+ if validated need exists. |
| **21 CFR Part 11 Compliance** | "We need FDA compliance for electronic records" | Requires audit trails, electronic signatures, validation documentation. Massive scope increase for regulated environments. | Document that this is NOT for regulated use. Or: plan a separate "Pro/Compliance" tier later. |
| **Real-Time Instrument Integration** | "Can it talk directly to the Luminex instrument?" | Requires proprietary SDKs, vendor partnerships, complex integration. xPONENT already handles this. | Export plate layouts that xPONENT can import. No direct instrument communication. |
| **AI-Powered Recommendations** | "Use AI to optimize dilution factors" | Adds complexity, unpredictability, and requires training data. Dilution calculations are deterministic. | Provide sensible defaults based on kit documentation. Let operators override. |
| **Mobile App** | "I want to use it on my phone at the bench" | Mobile interfaces are poor for data entry. Desktop is better for this workflow. Bench work happens at a workstation. | Printable prep sheets are the mobile solution. |
| **Unlimited Customization** | "Every lab is different, we need to customize everything" | Leads to configuration complexity that defeats simplicity. Users drown in options. | Opinionated defaults with escape hatches. 80% of users should need no configuration. |

## Feature Dependencies

```
[Dilution Calculator]
    |
    v
[Reagent Volume Calculator] -- uses dilution results
    |
    v
[Prep Recipe Generator] -- combines volumes into steps
    |
    v
[Printable Prep Sheet] -- formats recipe for bench use

[96-Well Plate Visualization]
    |
    v
[Plate Layout Planning] -- needs visual editor
    |
    v
[Standard Curve Setup] -- uses plate layout
    |
    v
[xPONENT/Bio-Plex Export] -- exports plate definition

[Run Metadata Capture]
    |
    +---> [Lot Number Tracking]
    |
    v
[Data Persistence]
    |
    v
[Run History / Search] -- queries persisted data
    |
    v
[Cross-Run Comparison] -- analyzes history
```

### Dependency Notes

- **Dilution Calculator is foundational:** Everything else depends on correct dilution math.
- **Plate Layout enables Standard Curve:** You must define where wells go before calculating standard prep.
- **Persistence enables History:** No search without stored data.
- **Prep Recipe is the integration point:** It pulls from calculators and plate layout to generate operator instructions.

## MVP Definition

### Launch With (v1)

Minimum viable product - what's needed to validate the concept.

- [ ] **Dilution Calculator** - Core C1V1=C2V2 with serial dilution support
- [ ] **Reagent Volume Calculator** - Mastermix volumes with overage
- [ ] **96-Well Plate Visualization** - View and edit sample placement
- [ ] **Standard Curve Setup** - 7-point serial dilution calculator
- [ ] **Prep Recipe Generator** - Step-by-step instructions with volumes
- [ ] **Printable Prep Sheet** - PDF export for bench use
- [ ] **Run Metadata Capture** - Date, operator, kit info, lot numbers
- [ ] **Basic Persistence** - Save and load runs locally
- [ ] **Basic Search** - Find previous runs by date/name

### Add After Validation (v1.x)

Features to add once core is working.

- [ ] **Assay-Specific Templates** - After validating core workflow works
- [ ] **Multiple Platform Support** - After understanding user platform mix
- [ ] **Export to xPONENT/Bio-Plex** - After confirming user demand
- [ ] **Cross-Run Comparison** - After accumulating run history
- [ ] **Barcode Scanning** - After confirming manual entry is painful enough

### Future Consideration (v2+)

Features to defer until product-market fit is established.

- [ ] **Protocol Version Control** - Adds complexity, defer until users request
- [ ] **Reagent Expiration Tracking** - Nice but not critical for MVP
- [ ] **Cloud Sync** - Only if validated need for team sharing
- [ ] **Compliance Features** - Separate product tier if regulated labs need it

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Dilution Calculator | HIGH | LOW | P1 |
| Reagent Volume Calculator | HIGH | LOW | P1 |
| 96-Well Plate Visualization | HIGH | MEDIUM | P1 |
| Standard Curve Setup | HIGH | MEDIUM | P1 |
| Prep Recipe Generator | HIGH | MEDIUM | P1 |
| Printable Prep Sheet | HIGH | LOW | P1 |
| Run Metadata Capture | MEDIUM | LOW | P1 |
| Basic Persistence | HIGH | LOW | P1 |
| Basic Search | MEDIUM | MEDIUM | P1 |
| Lot Number Tracking | MEDIUM | LOW | P1 |
| Assay-Specific Templates | HIGH | MEDIUM | P2 |
| Export to xPONENT | MEDIUM | HIGH | P2 |
| Platform Templates | MEDIUM | MEDIUM | P2 |
| Cross-Run Comparison | MEDIUM | HIGH | P3 |
| Barcode Scanning | MEDIUM | MEDIUM | P3 |
| Protocol Versioning | LOW | MEDIUM | P3 |

**Priority key:**
- P1: Must have for launch
- P2: Should have, add when possible
- P3: Nice to have, future consideration

## Competitor Feature Analysis

| Feature | Excel/Manual | Vendor Software (xPONENT) | Full LIMS | Our Approach |
|---------|--------------|---------------------------|-----------|--------------|
| Dilution Calculation | User does math | Limited calculator tools | Often missing | Core feature, multiple methods |
| Plate Layout | Paper templates | Built-in editor | Varies | Visual editor, export-compatible |
| Prep Instructions | Written protocols | None | Protocol management | Auto-generated from calc results |
| Run Documentation | Paper notebooks | Raw data files only | Comprehensive | Focused on prep, not analysis |
| History/Search | File folders | Per-software | Comprehensive | Simple, fast, local |
| Cost | Free | Bundled with instrument | $10K-100K+/year | One-time purchase / free |
| Learning Curve | None | Moderate | High | Low - familiar concepts |
| Offline | Yes | Usually yes | Often no | Yes, offline-first |

### Competitive Positioning

**Not competing with:**
- Full LIMS (LabWare, SLIMS, Sapio) - different market, different price point
- Instrument software (xPONENT, Bio-Plex Manager) - complementary, not replacement
- Analysis software (Belysa, Quantist) - we do prep, they do analysis

**Competing with:**
- Excel spreadsheets with manual calculations
- Paper protocols and mental math
- Vendor-provided calculation worksheets (PDF)

**Differentiation:**
- Unified calculation + documentation in one tool
- Offline desktop, no subscription
- Generates printable operator instructions
- Stores run history for troubleshooting

## Domain-Specific Considerations

### Luminex/Immunoplex Specifics

- **Bead regions vary by kit** - Each analyte has a specific bead region number
- **Standard curves are kit-specific** - Different kits have different top standards and dilution schemes
- **Sample matrices matter** - Serum, plasma, cell culture supernatant have different protocols
- **Wash steps are critical but not calculated** - Prep sheets should include wash steps even though no calculation needed
- **Incubation times vary** - Some kits are overnight, some are 2-hour protocols

### Common Luminex Platforms to Support

1. **Milliplex (MilliporeSigma)** - Largest market share
2. **Bio-Plex (Bio-Rad)** - Popular in academic labs
3. **ProCartaPlex (Thermo Fisher)** - Growing market
4. **R&D Systems (Bio-Techne)** - High-quality, premium pricing

Each has slightly different protocols, dilution schemes, and software requirements.

## Sources

### LIMS and Lab Software Features
- [LIMS for Small Labs: 2026 Guide - Scispot](https://www.scispot.com/blog/how-to-pick-your-laboratory-information-management-system-lims)
- [Key Features of Modern LIMS - CloudLIMS](https://cloudlims.com/key-features-to-look-for-in-modern-laboratory-information-management-system-lims-software-systems/)
- [LIMS Pain Points and Solutions - ISU Corp](https://www.isucorp.ca/blog/lims-pain-points-and-solutions)
- [6 of the Worst LIMS Reviews on G2 - Sapio Sciences](https://www.sapiosciences.com/blog/6-of-the-worst-lims-reviews-on-g2/)

### Luminex Software
- [Belysa Immunoassay Curve Fitting - Sigma-Aldrich](https://www.sigmaaldrich.com/US/en/services/software-and-digital-platforms/belysa-immunoassay-curve-fitting-software)
- [Quantist Luminex Data Analysis - Bio-Techne](https://www.bio-techne.com/reagents/luminex/luminex-software-quantist)
- [ProcartaPlex Analysis App - Thermo Fisher](https://www.thermofisher.com/us/en/home/life-science/antibodies/immunoassays/procartaplex-assays-luminex/procartaplex-immunoassays/procartaplex-analyst-software.html)
- [Bio-Plex Manager Software - Bio-Rad](https://www.bio-rad.com/en-us/product/bio-plex-manager-software-standard-edition)

### Plate Mapping and Documentation
- [PlateEditor: Web-based plate layout management - PMC](https://pmc.ncbi.nlm.nih.gov/articles/PMC8162687/)
- [96-Well Plate Templates - Sigma-Aldrich](https://www.sigmaaldrich.com/US/en/technical-documents/technical-article/cell-culture-and-cell-culture-analysis/cell-based-assays/96-well-plate-template)
- [LabKey Plate Templates Documentation](https://www.labkey.org/Documentation/wiki-page.view?name=editPlateTemplate)

### Dilution Calculators
- [Serial Dilution Calculator - AAT Bioquest](https://www.aatbio.com/tools/serial-dilution)
- [Solution Dilution Calculator - QIAGEN](https://www.qiagen.com/us/applications/enzymes/tools-and-calculators/solution-dilution-calculator)
- [PCR Master Mix Calculator - Sigma-Aldrich](https://www.sigmaaldrich.com/US/en/support/calculators-and-apps/pcr-master-mix-calculator)

### Traceability and Audit
- [LIMS Traceability Quality - LabWare](https://www.labware.com/blog/ways-lims-traceability-promotes-quality)
- [Audit Trail Requirements - Technology Networks](https://www.technologynetworks.com/informatics/articles/audit-trail-requirements-for-a-digitalized-regulated-laboratory-401729)

### ELN Features
- [Electronic Lab Notebooks - Harvard Data Management](https://datamanagement.hms.harvard.edu/collect-analyze/electronic-lab-notebooks)
- [ELN Software - LabKey](https://www.labkey.com/products-services/electronic-lab-notebook/)

### Laboratory Errors
- [5 Most Common Lab Errors - Labbit](https://www.labbit.com/resources/5-most-common-lab-errors-what-causes-them)
- [Errors in Laboratory Testing Process - PMC](https://pmc.ncbi.nlm.nih.gov/articles/PMC7271754/)

---
*Feature research for: Lab Assay Calculator / LIMS-Lite for Luminex/Immunoplex*
*Researched: 2026-01-22*
