# Project Research Summary

**Project:** Immunoplex Assay Calculator
**Domain:** Desktop Lab Informatics Application (Luminex/Immunoplex Multiplexed Immunoassays)
**Researched:** 2026-01-22
**Confidence:** MEDIUM-HIGH

## Executive Summary

The Immunoplex Assay Calculator is a desktop lab informatics tool for Luminex multiplexed immunoassays. This type of application requires precision calculation (dilutions, volumes, concentrations), visual plate layout management (96-well plates), run documentation with full traceability, and searchable history. The recommended approach is an Electron desktop app with React UI, TypeScript for type safety, SQLite for local data persistence, and decimal.js for precision arithmetic. This stack prioritizes stability and debuggability in lab environments over bleeding-edge performance.

The core value proposition is unique: combining automated calculation with comprehensive documentation in a single offline-first desktop tool. Current alternatives are either simple Excel calculators (no documentation, error-prone) or full enterprise LIMS (complex, expensive, overkill for single-lab use). By focusing on calculation + prep recipe generation + run history, this tool fills a clear gap without attempting to compete with instrument software (xPONENT, Bio-Plex Manager) or analysis tools (Belysa, Quantist).

The critical risks center on precision arithmetic (floating-point errors compound in serial dilutions), unit conversion catastrophes (1000x errors from mixing mL/uL), and traceability gaps (lot tracking must be mandatory, not optional). All three risks are mitigated by architecture decisions in Phase 1: decimal arithmetic from day one, unit-aware type system, and required fields for lot numbers. The build order follows natural dependencies: foundation (database, IPC) → platform configuration (assay templates) → calculator core (pure functions) → run documentation (persistence) → history/search (querying).

## Key Findings

### Recommended Stack

For a Windows desktop lab informatics application, Electron is recommended over Tauri despite performance trade-offs. Lab environments prioritize battle-tested stability and mature ecosystem support (native modules, debugging tools) over memory footprint. The application is single-user desktop, so memory is not a critical constraint. React 19 provides industry-standard UI framework with excellent TypeScript support. SQLite via better-sqlite3 is ideal for embedded desktop databases with zero configuration and portable backups.

**Core technologies:**
- **Electron 40.x**: Desktop shell — Most mature cross-platform framework; bundled Chromium ensures consistent rendering; extensive documentation for edge cases
- **React 19.x**: UI framework — Industry standard with excellent TypeScript support; hooks architecture ideal for complex forms
- **TypeScript 5.x**: Type safety — First-class inference catches calculation errors at compile time; essential for scientific applications
- **SQLite + better-sqlite3**: Local database — Single-file database ideal for desktop apps; synchronous API simpler than async; ACID compliant for data integrity
- **Vite 6.x**: Build tool — Fast HMR with native ESM; electron-vite integration for seamless Electron development
- **decimal.js 10.x**: Precision math — Arbitrary precision decimals prevent floating-point errors in concentration calculations
- **Drizzle ORM 0.39.x**: Type-safe queries — Lightweight with excellent TypeScript inference; simpler than Prisma for SQLite use cases
- **shadcn/ui + Tailwind 4.x**: UI components — Copy-paste components provide full control; Radix primitives ensure accessibility
- **Zustand 5.x**: State management — Minimal boilerplate (3KB); hook-based; perfect for medium complexity apps
- **React Hook Form 7.x + Zod 3.x**: Form handling — Best performance with uncontrolled components; runtime validation syncs with TypeScript types
- **@react-pdf/renderer 4.x**: PDF generation — React component syntax for prep recipes and run documentation

**Critical version notes:**
- better-sqlite3 requires `electron-rebuild` post-install for native module compilation
- Electron 40.x bundles Node 24.x and Chromium 144 — do not install separate Node
- Tailwind 4.x and shadcn/ui are recently updated for compatibility

### Expected Features

The feature landscape divides cleanly into table stakes (users expect these), differentiators (competitive advantage), and anti-features (commonly requested but problematic). This is fundamentally a LIMS-lite tool, not a full LIMS or analysis platform.

**Must have (table stakes):**
- **Dilution Calculator** — Core C1V1=C2V2 calculations; users currently do this in Excel or mental math
- **Reagent Volume Calculator** — Exact volumes for mastermixes with 10-20% overage for pipetting loss
- **96-Well Plate Visualization** — Industry standard format; operators must see sample placement visually
- **Standard Curve Serial Dilution** — 7-point serial dilutions are universal in Luminex assays; automating this is expected
- **Prep Recipe Generation** — Step-by-step operator instructions with exact volumes, timing, well assignments
- **Printable Prep Sheets** — Operators work at bench, not computer; need printed instructions
- **Run Metadata Capture** — Date, operator, platform, assay kit, lot numbers for troubleshooting
- **Run History/Search** — Labs need to reference previous runs for troubleshooting and comparison
- **Multiple Platform Support** — Labs use Milliplex, BioRad, ProCartaPlex, R&D Systems; cannot lock to one vendor

**Should have (competitive differentiators):**
- **Unified Calculator + Documentation** — Unique value proposition; competitors are either calculators (no docs) or LIMS (no calculation)
- **Assay-Specific Templates** — Pre-built templates for common Luminex kits with correct default dilutions
- **Smart Overage Calculation** — Automatically add pipetting loss buffer; often forgotten manually
- **Export to xPONENT/Bio-Plex Manager** — Generate import files for Luminex instrument software
- **Cross-Run Comparison** — Compare QC values across runs to detect drift (Levey-Jennings trending)
- **Barcode Scanning** — Scan kit lot numbers to reduce transcription errors

**Defer (v2+):**
- **Protocol Version Control** — ELN-style versioning of prep protocols; adds complexity
- **Cloud Sync** — Multi-user sharing requires authentication, sync conflicts, server infrastructure
- **21 CFR Part 11 Compliance** — Requires audit trails, e-signatures, validation docs; separate "Pro" tier
- **Real-Time Instrument Integration** — Requires proprietary SDKs; xPONENT already handles this
- **AI-Powered Recommendations** — Dilution calculations are deterministic; AI adds complexity without value

**Anti-features (avoid):**
- **Full LIMS Functionality** — Scope creep into sample chain of custody, instrument integration; existing LIMS (LabWare, SLIMS) already do this
- **Data Analysis/Curve Fitting** — This is what xPONENT, Bio-Plex Manager, Quantist do well; don't duplicate
- **Mobile App** — Mobile interfaces are poor for data entry; bench work happens at workstation; printable sheets are the mobile solution
- **Unlimited Customization** — Configuration complexity defeats simplicity; 80% of users should need no configuration

### Architecture Approach

The architecture follows MVVM pattern with clear separation between main process (Node.js for filesystem, database) and renderer process (Chromium for UI). Communication via strongly-typed IPC channels. Repository pattern abstracts data persistence. Calculation engine is pure functions with no side effects, isolated in lib/calculations/ for testability. Domain events create immutable audit trail for run modifications.

**Major components:**
1. **Calculation Engine** — Pure functions for dilutions, volumes, concentrations; stateless, no side effects; testable in isolation
2. **Run Manager** — Persists run records with full audit trail; coordinates file storage for photos; transaction management
3. **Platform Config Store** — Stores platform-specific parameters (stock concentrations, analyte lists, bead region mappings, combination rules)
4. **Plate Mapper** — Visual 96-well plate editor with drag-and-drop well assignment; exports layouts compatible with Luminex software
5. **Recipe Generator** — Combines calculation results with plate layouts to produce step-by-step operator instructions
6. **Search Service** — Indexes and queries run history with full-text search on lot numbers, notes, operator names
7. **File Storage** — Manages plate photos on local filesystem; stores references in database (not BLOBs)

**Project structure:**
- `src/main/` — Electron main process (database, file I/O, IPC handlers, migrations)
- `src/renderer/` — React UI with feature-based organization (calculator, run-docs, history, settings)
- `src/renderer/lib/calculations/` — Pure calculation functions (no UI dependencies)
- `src/shared/` — Types and constants shared between main and renderer processes

**Key architectural patterns:**
- **MVVM with hooks** — ViewModels as custom hooks with observable state; clear separation of concerns
- **IPC Message Passing** — Security via process separation; renderer has no direct filesystem access
- **Repository Pattern** — Abstract storage behind interfaces; easy to swap implementations or add audit hooks
- **Domain Events** — Immutable audit records for all run modifications (who, what, when)

### Critical Pitfalls

The research identified 8 critical pitfalls with specific prevention strategies and phase assignments.

1. **Floating-Point Arithmetic in Volume Calculations** — Dilution and volume calculations produce subtly incorrect results (0.1 + 0.2 = 0.30000000000000004). Errors compound through serial dilutions. **Prevention:** Use decimal.js for ALL calculations; store volumes as integers in microliters; round at presentation layer only; test against known-correct manual calculations. **Phase:** Phase 1 (Core Engine) — must be architected correctly from start.

2. **Serial Dilution Error Propagation Blindness** — Each dilution step compounds errors from previous steps; software doesn't account for correlated errors in confidence intervals. **Prevention:** Document that concentrations assume perfect technique; provide error budget calculations; flag volumes below pipette minimum accuracy range (< 1 uL); add extra volume to compensate for pipetting error. **Phase:** Phase 2 (Dilution Calculator).

3. **Unit Conversion Catastrophes** — Mixing units (mL/uL, mg/mL/ug/mL) causes 1000x errors. Different manufacturers use different units in documentation. **Prevention:** Always display units prominently; use unit-aware data types internally; require explicit unit selection; convert to canonical units internally; add sanity checks flagging extreme values. **Phase:** Phase 1 (Data Models) — unit-awareness in type system.

4. **Bead Region Collision in Multiplex Assays** — Combining singleplex kits with multiplex premix panels assigns two analytes to same bead region; Luminex instrument produces garbage data. **Prevention:** Require bead region input for every analyte; validate uniqueness before panel creation; display visual bead region map; warn on potential conflicts. **Phase:** Phase 2 (Platform Config).

5. **Premix/Singles Combination Rule Violations** — Platform-specific rules (e.g., "max 5 singles with premix") aren't encoded; software allows invalid configurations. **Prevention:** Encode platform-specific rules as validation logic; block invalid configurations with clear error messages; provide manufacturer documentation links. **Phase:** Phase 2 (Platform Config).

6. **Lot Number Traceability Gaps** — When troubleshooting months later, operators cannot determine which reagent lots were used. **Prevention:** Make lot number entry mandatory for all reagents; capture lots at moment of use; barcode scanning for efficiency; link lots to run records immutably; provide lot deviation reports. **Phase:** Phase 3 (Documentation).

7. **Well Mapping Mental Model Mismatches** — Software displays wells one way (row-major A1, A2, A3) but operator reads plate differently (column-major A1, B1, C1); 0-indexed vs 1-indexed confusion. **Prevention:** Always show visual plate map; use consistent A1-H12 notation everywhere (never 0-indexed in UI); mark plate orientation clearly; match output format to Luminex software. **Phase:** Phase 2 (Plate Layout).

8. **Recipe Ambiguity in Operator Instructions** — Generated recipes are technically correct but ambiguous ("Add 10 uL of standard" — which standard? all points?). **Prevention:** Generate step-by-step instructions with explicit quantities, well positions, timing; include verify checkpoints; use terminology matching kit docs; test with actual operators. **Phase:** Phase 3 (Recipe Generation).

**Technical debt to avoid:**
- Hardcoding platform rules (use configuration instead)
- Storing final calculated values without derivation audit trail
- Optional lot numbers (must be required)
- Floating-point for volumes (use decimal library)
- Storing photos as database BLOBs (use filesystem)

## Implications for Roadmap

Based on research, suggested phase structure follows natural dependency flow and risk mitigation:

### Phase 1: Foundation & Data Models
**Rationale:** Foundational architecture decisions (Electron, SQLite, IPC) must be established first. Data model design (unit-aware types, decimal arithmetic) prevents pitfalls that are expensive to retrofit. Platform configuration must exist before calculator can function because calculations depend on platform-specific parameters.

**Delivers:**
- Electron + React + TypeScript project scaffolding with hot reload
- SQLite database with migration system
- IPC infrastructure with typed channels
- Data models with unit-aware types (prevents unit conversion pitfalls)
- Decimal arithmetic library integration (prevents floating-point errors)
- Basic shell UI with navigation

**Addresses (from FEATURES.md):**
- Data Persistence (table stakes)
- Multiple Platform Support (table stakes, foundational)

**Avoids (from PITFALLS.md):**
- Pitfall 1: Floating-Point Arithmetic — decimal.js integrated from start
- Pitfall 3: Unit Conversion Catastrophes — unit-aware type system
- Database corruption — WAL mode, automatic backups

**Research flags:** Standard patterns, skip `/gsd:research-phase`. Electron + React + SQLite is well-documented with established best practices.

---

### Phase 2: Platform Configuration & Plate Layout
**Rationale:** Calculator depends on platform configuration (stock concentrations, analyte lists, bead regions, combination rules). Plate layout is independent of calculations but shares visual components with calculator. Both are prerequisites for run documentation.

**Delivers:**
- Platform/assay definition CRUD UI
- Seeded reference data for common platforms (Milliplex, BioRad, ProCartaPlex, R&D)
- Bead region validation (uniqueness checks, visual mapping)
- Premix/singles combination rule enforcement
- 96-well plate visualization component (reusable across features)
- Plate layout editor with drag-and-drop well assignment
- Well position utilities (A1-H12 canonical representation)

**Addresses (from FEATURES.md):**
- Multiple Platform Support (table stakes)
- 96-Well Plate Visualization (table stakes)
- Plate Layout Planning (table stakes)

**Uses (from STACK.md):**
- React + shadcn/ui for platform CRUD forms
- Drizzle ORM for platform config persistence
- react-well-plates or custom SVG for plate visualization
- Zustand for plate editor state

**Implements (from ARCHITECTURE.md):**
- Platform Config Store component
- Plate Mapper component with undo stack

**Avoids (from PITFALLS.md):**
- Pitfall 4: Bead Region Collisions — validation prevents duplicates
- Pitfall 5: Premix/Singles Rule Violations — rules enforced in configuration
- Pitfall 7: Well Mapping Mismatches — visual plate map with clear A1 orientation

**Research flags:** May need `/gsd:research-phase` for bead region validation rules. Platform-specific combination rules are niche; vendor documentation may be inconsistent.

---

### Phase 3: Calculator Core
**Rationale:** With platform config and data models in place, calculator logic can be built as pure functions. This is the core value proposition and should be validated early (after dependencies are met). Keeping calculations pure and isolated enables comprehensive testing.

**Delivers:**
- Dilution calculator (C1V1=C2V2, serial dilutions)
- Reagent volume calculator with overage (10-20% pipetting loss buffer)
- Standard curve serial dilution setup (7-point + blank)
- Input validation with Zod schemas
- Calculator UI with platform selection
- Real-time calculation preview
- Minimum pipettable volume warnings (< 1 uL flags)

**Addresses (from FEATURES.md):**
- Dilution Calculator (table stakes)
- Reagent Volume Calculator (table stakes)
- Standard Curve Serial Dilution Setup (table stakes)
- Smart Overage Calculation (differentiator)

**Uses (from STACK.md):**
- decimal.js for all arithmetic
- mathjs for unit conversions
- React Hook Form + Zod for form handling
- Zustand for calculator state

**Implements (from ARCHITECTURE.md):**
- Calculation Engine (pure functions in lib/calculations/)
- Calculator ViewModels (custom hooks)

**Avoids (from PITFALLS.md):**
- Pitfall 1: Floating-Point Arithmetic — decimal.js ensures precision
- Pitfall 2: Serial Dilution Error Propagation — document assumptions, flag risky volumes
- Pitfall 3: Unit Conversion — explicit unit selection, sanity checks

**Research flags:** Standard patterns, skip `/gsd:research-phase`. Dilution formulas and volume calculations are well-established.

---

### Phase 4: Run Documentation & Audit Trail
**Rationale:** With calculator producing results and plate layout defined, run documentation can tie everything together. This phase requires careful design of audit trail (immutability, change tracking) because retrofitting is difficult. Photo storage must use filesystem (not BLOBs) from start.

**Delivers:**
- Run record data model with audit fields
- Run form UI integrating calculator results + plate layout
- Lot number entry (mandatory, not optional)
- Photo upload and filesystem storage (not database BLOBs)
- Audit trail implementation (domain events for all changes)
- Run save/load functionality
- Prep recipe generation from combined data
- PDF export for prep sheets (@react-pdf/renderer)

**Addresses (from FEATURES.md):**
- Run Metadata Capture (table stakes)
- Lot Number Tracking (table stakes)
- Prep Recipe Generation (differentiator)
- Printable Prep Sheets (table stakes)
- Sample Dilution Factor Tracking (differentiator)

**Uses (from STACK.md):**
- Drizzle ORM for run records persistence
- better-sqlite3 for transactional saves
- @react-pdf/renderer for PDF generation
- Electron dialog API for file selection
- sharp for photo compression

**Implements (from ARCHITECTURE.md):**
- Run Manager service
- Run Repository with audit hooks
- Audit Service (domain events)
- Recipe Generator component
- File Storage service

**Avoids (from PITFALLS.md):**
- Pitfall 6: Lot Traceability Gaps — lot numbers required, not optional
- Pitfall 8: Recipe Ambiguity — step-by-step instructions with explicit details
- Anti-Pattern 2: Storing Photos in Database — filesystem storage with path references
- Anti-Pattern 3: Mutable Run Records Without Audit — immutable with amendments

**Research flags:** Standard patterns for most functionality. May need `/gsd:research-phase` for PDF recipe generation layout — ensuring clarity and usability requires user testing with actual operators.

---

### Phase 5: History, Search & Export
**Rationale:** Needs existing runs to search. This phase is less critical for MVP validation (can search manually in database if needed) but important for production usability. Search performance optimization (indexes, pagination) is easier to add than retrofit.

**Delivers:**
- Search service with SQLite full-text search (FTS5)
- Search UI with filters (date range, platform, operator, lot numbers)
- Pagination for large result sets
- Run detail view with full metadata display
- Cross-run comparison (QC trending)
- Excel export for run history
- Export to xPONENT/Bio-Plex Manager formats

**Addresses (from FEATURES.md):**
- Run History/Search (table stakes)
- Cross-Run Comparison (differentiator)
- Export to xPONENT/Bio-Plex Manager (differentiator)

**Uses (from STACK.md):**
- TanStack Table for data grids
- SQLite FTS5 for full-text search
- Drizzle ORM for complex queries

**Implements (from ARCHITECTURE.md):**
- Search Service component
- Search/Filter ViewModels

**Avoids (from PITFALLS.md):**
- Performance Trap: Loading full history on startup — pagination, lazy-load
- Performance Trap: No database indexes — index search fields from start

**Research flags:** May need `/gsd:research-phase` for xPONENT/Bio-Plex export formats. File format specifications may require reverse-engineering or vendor documentation research.

---

### Phase Ordering Rationale

- **Phase 1 before 2-5:** Foundation and data models must be established first. Decimal arithmetic and unit-aware types prevent pitfalls that are expensive to retrofit. Database and IPC infrastructure are prerequisites for all features.

- **Phase 2 before 3:** Calculator depends on platform configuration (stock concentrations, analytes). Platform must exist before calculations can be parameterized.

- **Phase 2 and 3 can partially overlap:** Plate layout (Phase 2) and calculator core (Phase 3) are mostly independent. Both can proceed once data models (Phase 1) are complete.

- **Phase 4 after 2 and 3:** Run documentation integrates calculator results with plate layouts. Cannot proceed until both inputs exist.

- **Phase 5 last:** Search and export require existing run data to query. This is the least critical for MVP validation and can be deferred if timeline pressure exists.

**Critical path dependencies:**
1. Phase 1 (Foundation) blocks everything
2. Phase 2 (Platform Config) blocks Phase 3 (Calculator) and Phase 4 (Run Docs)
3. Phase 3 (Calculator) blocks Phase 4 (Run Docs)
4. Phase 4 (Run Docs) blocks Phase 5 (History/Search)

**Pitfall prevention timeline:**
- Phase 1 addresses: Floating-point arithmetic, unit conversion, database corruption
- Phase 2 addresses: Bead region collisions, rule violations, well mapping mismatches
- Phase 3 addresses: Serial dilution error propagation, calculation precision
- Phase 4 addresses: Lot traceability gaps, recipe ambiguity, audit trail
- Phase 5 addresses: Search performance traps

### Research Flags

**Phases likely needing deeper research during planning:**
- **Phase 2 (Platform Configuration):** Bead region validation rules and premix/singles combination rules are platform-specific and niche. Vendor documentation may be inconsistent or incomplete. Recommend `/gsd:research-phase` focused on manufacturer specifications for Milliplex, BioRad, ProCartaPlex, R&D Systems.

- **Phase 4 (Prep Recipe Generation):** PDF layout and instruction clarity requires user testing with actual lab operators. Recommend `/gsd:research-phase` focused on recipe usability patterns, including examples from published protocols and operator feedback if available.

- **Phase 5 (xPONENT/Bio-Plex Export):** File format specifications may require reverse-engineering. Vendor documentation quality unknown. Recommend `/gsd:research-phase` if this feature is prioritized; otherwise defer to v2.

**Phases with standard patterns (skip research-phase):**
- **Phase 1 (Foundation):** Electron + React + SQLite + TypeScript is well-documented with established best practices. Stack research already comprehensive.

- **Phase 3 (Calculator Core):** Dilution formulas (C1V1=C2V2) and serial dilution calculations are standard chemistry. No novel domain knowledge required beyond what's in STACK.md and PITFALLS.md.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Core technologies (Electron, React, TypeScript, SQLite) verified via official documentation. Version compatibility confirmed. better-sqlite3 and decimal.js are battle-tested for desktop apps and scientific computing respectively. |
| Features | MEDIUM | Feature set derived from LIMS research, Luminex software documentation, and domain understanding, but no direct user research. Table stakes features validated against competitor analysis. Differentiators are logical but need market validation. |
| Architecture | MEDIUM | MVVM pattern, IPC message passing, repository pattern are proven for Electron apps. Architecture verified against Microsoft Calculator open source and LIMS examples. Specific implementation details will require validation during build. |
| Pitfalls | MEDIUM-HIGH | Critical pitfalls (floating-point, serial dilution error, unit conversion) verified from multiple sources including peer-reviewed publications and vendor documentation. Mitigation strategies validated against domain best practices. |

**Overall confidence:** MEDIUM-HIGH

### Gaps to Address

**Gap 1: Platform-specific combination rules**
- **Issue:** Each manufacturer (Milliplex, BioRad, ProCartaPlex, R&D) has different rules for combining premix panels with singles. Documentation quality and specificity unknown until deeper research.
- **Handling:** Phase 2 should include `/gsd:research-phase` focused on manufacturer specifications. Start with well-documented platforms (Milliplex) and expand based on user demand. Allow admin override for undocumented cases.

**Gap 2: Operator workflow and recipe usability**
- **Issue:** Recipe generation format and clarity assumptions not validated with actual bench operators. What's "clear" to a developer may be ambiguous to an operator.
- **Handling:** Phase 4 planning should include user testing with sample recipes. Consider recruiting lab operator for feedback during development. Start with conservative, verbose instructions and iterate based on feedback.

**Gap 3: xPONENT/Bio-Plex import file format specifications**
- **Issue:** File format specs may be proprietary or poorly documented. Success of export feature depends on reverse-engineering or vendor documentation quality.
- **Handling:** Defer to Phase 5 or v2 if format research is blocked. Provide manual workarounds (CSV export) as fallback. Consider this a "nice to have" rather than MVP blocker.

**Gap 4: Barcode scanner hardware integration**
- **Issue:** Camera access and barcode decoding in Electron requires native module integration. Hardware compatibility testing needed.
- **Handling:** Defer barcode scanning to v1.x (post-MVP). Manual lot number entry is acceptable for MVP validation. Add only if user pain point is validated.

**Gap 5: Performance at scale**
- **Issue:** Performance assumptions (100 runs before slowdown, 500 runs before indexing needed) are estimates. Actual thresholds depend on usage patterns.
- **Handling:** Implement with performance monitoring from start. Add indexes proactively in Phase 1. Monitor query performance during beta testing and optimize as needed.

## Sources

### Primary (HIGH confidence)
- **STACK.md** — Technology recommendations verified against official documentation (Electron, SQLite, better-sqlite3, decimal.js, TanStack Table)
- **FEATURES.md** — Feature landscape derived from LIMS research, Luminex software documentation, dilution calculator examples
- **ARCHITECTURE.md** — Architectural patterns verified from Microsoft Calculator open source, LIMS architecture examples, Electron best practices
- **PITFALLS.md** — Critical pitfalls sourced from peer-reviewed publications on serial dilution error, LIMS implementation guides, Luminex troubleshooting documentation

### Secondary (MEDIUM confidence)
- Domain expertise inference from lab software research
- Competitive positioning based on LIMS vs calculator tool comparison
- Feature prioritization based on table stakes vs differentiator classification

### Tertiary (LOW confidence, needs validation)
- Platform-specific combination rules (manufacturer documentation quality unknown)
- Recipe usability assumptions (no operator testing conducted)
- xPONENT/Bio-Plex file format compatibility (vendor specs not verified)

---
*Research completed: 2026-01-22*
*Ready for roadmap: yes*
