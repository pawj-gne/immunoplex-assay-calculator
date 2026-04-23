# Requirements: Immunoplex Assay Calculator

**Defined:** 2026-01-22
**Core Value:** Accurate reagent calculations with clear prep recipes - operators must be able to trust the math and follow the instructions without second-guessing.

## v1 Requirements

Requirements for initial release. Each maps to roadmap phases.

### Calculation Engine

- [ ] **CALC-01**: App calculates total reagent volume based on sample count, replicate mode (singles/duplicates), and plate capacity (72/36 unknowns + 24 standards per plate)
- [ ] **CALC-02**: App calculates single analyte addition volumes (master mix volume / stock concentration)
- [ ] **CALC-03**: App includes dead volume in all volume calculations
- [ ] **CALC-04**: App displays calculations in real-time as operator enters inputs
- [ ] **CALC-05**: App enforces max 5 singles rule when premix is selected
- [ ] **CALC-06**: App rounds final volumes up to nearest mL
- [ ] **CALC-07**: App supports platform-specific stock concentrations (Milliplex, BioRad, ProCartaPlex, R&D)

### Plate Planning

- [ ] **PLAT-01**: App visually distinguishes standards wells from unknown sample wells

### Recipe Generation

- [ ] **RECP-01**: App generates printable prep sheet with all calculated volumes
- [ ] **RECP-02**: App generates step-by-step reagent preparation instructions
- [ ] **RECP-03**: App displays bead region list for plate reader instrument setup
- [ ] **RECP-04**: App generates reagent checklist with checkboxes for prep tracking

### Run Documentation

- [x] **DOCM-01
**: App captures run metadata (user name, date, operator, number of plates, number of samples, sample type, replicate mode, Hamilton assignment, tube block position, trough position, platform, species, panel selection, analyte count)

### Run Persistence

- [x] **PERS-01
**: App saves run records to local storage
- [x] **PERS-02
**: App loads previously saved run records

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Plate Planning

- **PLAT-02**: App displays interactive 96-well plate visualization grid
- **PLAT-03**: Operator can assign samples to specific well positions
- **PLAT-04**: Operator can drag-and-drop samples onto wells

### Run Documentation

- **DOCM-02**: Operator can enter lot numbers for reagents
- **DOCM-03**: Operator can attach photos from connected camera
- **DOCM-04**: App maintains audit trail of run record modifications

### Run History

- **HIST-01**: Operator can search runs by date, user, operator, platform
- **HIST-02**: Operator can perform full-text search across all run fields
- **HIST-03**: Operator can export run records to PDF/CSV

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Run request queue integration | External system, not replacing it |
| Tablet/mobile support | Desktop first, tablet is future enhancement |
| Barcode scanning | Manual lot entry for v1, barcode is v2 |
| Lab usage tracking/analytics | Defer until core workflow is solid |
| Photo annotation | Simple upload sufficient for v1 |
| Standard curve fitting/analysis | Data analysis is separate concern, out of scope |
| Cloud sync/multi-user | Single workstation use case for v1 |
| xPONENT/Bio-Plex file export | Instrument integration deferred |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| CALC-01 | Phase 2 | Pending |
| CALC-02 | Phase 2 | Pending |
| CALC-03 | Phase 2 | Pending |
| CALC-04 | Phase 2 | Pending |
| CALC-05 | Phase 2 | Pending |
| CALC-06 | Phase 2 | Pending |
| CALC-07 | Phase 1 | Pending |
| PLAT-01 | Phase 3 | Pending |
| RECP-01 | Phase 3 | Pending |
| RECP-02 | Phase 3 | Pending |
| RECP-03 | Phase 3 | Pending |
| RECP-04 | Phase 3 | Pending |
| DOCM-01 | Phase 4 (04-01 + 04-02 + 04-04 + 04-05) | Complete |
| PERS-01 | Phase 4 (04-01 + 04-02) | Complete |
| PERS-02 | Phase 4 (04-01 + 04-02 + 04-04) | Complete |

**Coverage:**
- v1 requirements: 15 total
- Mapped to phases: 15
- Unmapped: 0

---
*Requirements defined: 2026-01-22*
*Last updated: 2026-01-22 after roadmap creation*
