---
gsd_state_version: 1.0
milestone: v2.0
milestone_name: Release
status: completed
stopped_at: Phase 13 context gathered
last_updated: "2026-05-12T15:00:37.375Z"
last_activity: 2026-05-12
progress:
  total_phases: 21
  completed_phases: 9
  total_plans: 48
  completed_plans: 41
  percent: 85
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-01-22)

**Core value:** Accurate reagent calculations with clear prep recipes - operators must be able to trust the math and follow the instructions without second-guessing.
**Current focus:** Phase 12 complete — next: Phase 13 (Smoke 3 — Panel XLSX Parser v3)

## Current Position

Milestone: v2.0 (Panel XLSX Upload + Master-Panel Data Model) — **scope shifted 2026-05-11 by Smoke 3 PRD adoption**
Phase: 12 (smoke-3-calculator-rules) — **COMPLETE** (4/4 plans shipped; 11/11 must-haves verified after 12-04 gap closure)
Plan: 12-04 complete (gap closure: WR-01/WR-03/WR-04 all closed; 94 → 105 tests)
Status: Phase 12 complete; ready to start Phase 13 (Panel XLSX Parser v3) or Phase 13 discuss
Last activity: 2026-05-12

Progress: [█████████▓] 98%

## Performance Metrics

**Velocity:**

- Total plans completed: 35 (23 planned + 1 ad-hoc 03.3-06); Phase 4 fully implemented; Windows physical smoke test pending HUMAN-UAT
- Released versions: v0.1.0, v0.2.0, v0.3.0, v0.4.0, v0.4.1, v0.4.2, v0.5.0

**By Phase:**

| Phase | Plans | Status | Released |
|-------|-------|--------|----------|
| 01-foundation | 3/3 | Complete | v0.1.0 (2026-01-26) |
| 02-calculator-core | 3/3 | Complete | v0.1.0 (2026-01-26) |
| 03-plate-visualization | 3/3 | Complete | v0.2.0 (2026-01-27) |
| 03.1-panel-data-import | 2/2 | Complete | v0.4.0 (2026-01-29) |
| 03.2-panel-data-management | 3/3 | Complete | v0.4.0 (2026-01-29) |
| 03.3-analyte-selection-redesign | 6/6 | Complete (includes ad-hoc 03.3-06) | v0.5.0 (2026-02-04) |
| 04-run-documentation-persistence-deployment | 5/5 | Code-complete (04-01 + 04-02 + 04-03 + 04-04 + 04-05); Windows smoke test pending HUMAN-UAT | - |
| 04.1-smoke-test-fixes | 4/5 | Code-complete; awaiting Windows smoke retest (HUMAN-UAT-04.1-05-01) | - |
| 05-master-panel-schema-repository | 0/TBD | Not started | - |
| 06-xlsx-parser-validator | 0/TBD | Not started | - |
| 07-master-panel-importer-ipc-ui | 0/TBD | Not started | - |
| 08-vendor-term-calculator-wiring | 0/TBD | Not started | - |
| 09-windows-uat-v2-release | 0/TBD | Not started | - |

**Doc debt:** None — all SUMMARY files present. 03-03, 03.3-05, 03.3-06 were backfilled from git history on 2026-04-22; each carries a backfill banner noting that exact execution timing and live deviation notes are not available.
| Phase 04-run-documentation-persistence-deployment P01 | 7m 17s | 5 tasks | 17 files |
| Phase 04-run-documentation-persistence-deployment P05 | 4m 0s | 4 tasks | 5 files |
| Phase 04-run-documentation-persistence-deployment P02 | 10m 39s | 6 tasks | 12 files |
| Phase 04-run-documentation-persistence-deployment P04 | 9m 0s | 5 tasks | 7 files |
| Phase 04-run-documentation-persistence-deployment P03 | ~25m | 2 of 3 tasks (Task 3 deferred to HUMAN-UAT) | 1 file |
| Phase 12-smoke-3-calculator-rules P01 | 4m 17s | 2 tasks | 7 files |
| Phase 12-smoke-3-calculator-rules P02 | ~6m | 2 tasks | 3 files |
| Phase 12-smoke-3-calculator-rules P03 | ~5m 24s | 2 tasks | 8 files |

## Accumulated Context

### Roadmap Evolution

- Phase 4.1 inserted after Phase 4: Smoke test bug fixes (BUG-01/02/03 + UI-01) — URGENT, blocks v1.0 release. Source: 04-SMOKE-TEST-RESULTS.md (2026-04-23)
- Phases 5-9 appended 2026-04-23: v2.0 milestone roadmap (5 phases, 21 requirements mapped). Derived from research SUMMARY.md §Roadmap Implications; critical gates embedded — Pitfall 1 adoption-upsert in Phase 7, Pitfall 4 provenance-display in Phase 8. Open decisions OD-1/2/3/7 gate Phase 5 planning; OD-4/5/6/8 ride the same discuss-phase session.

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- **01-01:** Used electron-vite for build tooling (optimized Electron + Vite integration)
- **01-01:** Removed @electron-toolkit dependencies (caused runtime issues)
- **01-01:** Tailwind CSS v4 with CSS-first configuration approach
- **01-01:** Explicit electron externalization in vite config
- **01-02:** Used better-sqlite3 for synchronous database operations in main process
- **01-02:** Repository pattern isolates database access from IPC handlers
- **01-02:** Zod validation on IPC boundary ensures type safety from renderer
- **01-02:** Decimal.js utilities use microliters as internal unit for precision
- **01-03:** Zustand store holds platform list, selection state, loading/error state
- **01-03:** Feature folder structure (features/platform/) for scalability
- **01-03:** Migration path fix: __dirname in bundled code is out/main/, use ../../
- **02-01:** Pure functions for all calculations (testable, reusable)
- **02-01:** ~~Final volume always rounds UP to nearest mL~~ — **SUPERSEDED 2026-05-11 by Phase 12-03 + SMK3-06: final volumes round UP to nearest 0.1 mL (ceiling at 0.1 mL precision). See .planning/phases/12-smoke-3-calculator-rules/12-01-PLAN.md and 12-03-PLAN.md.**
- **02-02:** Zod for runtime validation of calculator inputs
- **02-02:** Single addition = master_mix_volume / stock_concentration
- **02-03:** Zustand store for calculator with derived outputs
- **02-03:** ~~Default dead volume changed to 2000 uL (2 mL)~~ — **EXTENDED 2026-05-11 by Phase 12 + SMK3-05: dead volume now `numberOfSetups × 2 mL`; constant renamed DEFAULT_DEAD_VOLUME → DEAD_VOLUME_PER_SETUP_UL (still 2000 µL). Default setups = 1 so v1.0 callsites are backwards-compatible.**
- **03-01:** Standards occupy columns 1-3 (24 wells per plate)
- **03-01:** Column 12 uses vertical pairs in duplicates mode (A/E, B/F, C/G, D/H)
- **03-01:** Sample numbering continues across plates
- **03-02:** Checkbox state is local (useState) - not persisted for print
- **03-02:** BeadRegionList uses placeholder until Platform type extended
- **03-02:** PrepSheet accepts contentRef prop for react-to-print integration
- **03.1-01:** Used xlsx library for CSV/Excel parsing
- **03.1-01:** Validation returns errors before any DB writes (fail-fast)
- **03.1-01:** Panel description taken from first row in each panel group
- **03.2-03:** Segmented button toggle in header for Calculator vs Manage Data mode
- **03.3-01:** STANDARD_COLS corrected from [10,11,12] to [1,2,3]
- **03.3-01:** Duplicate pairs: horizontal (4-5, 6-7, 8-9, 10-11) + vertical (col 12) = 36 samples
- **03.3-01:** plateStore uses Set<string> for O(1) well toggle operations
- **03.3-01:** getDuplicatePair utility with 0-indexed row/col input
- **03.3-02:** panelAnalyteMap stored as Record<string, string[]> in store, resolved via computed method
- **03.3-02:** Unassigned analytes = availableAnalytes minus all panel member IDs
- **03.3-02:** AnalyteSelector.tsx deleted, replaced by AnalyteCard + AnalyteGrid
- **03.3-03:** useRef for isDragging/dragStart/dragAction, useState only for hoveredWells
- **03.3-03:** useWellSelection delegates to onSelectionChange callback (does not own state)
- **03.3-03:** Interactive mode on PlateGrid detected by presence of selectedWells/hoveredWells props
- **03.3-04:** Two-state input pattern for SampleCountInput (string displayValue for field, number value for slider)
- **03.3-04:** calculatorStore reads plateCount from plateStore (removed manual plateCount input)
- **03.3-04:** calculatorStore.setSampleCount/setReplicateMode propagate to plateStore for auto-fill
- **03.3-04:** calculatorStore.reset cascades to plateStore.reset
- **03.3-05:** Decisions not captured in a SUMMARY doc (see commits 4ea29e1..b6b1f67 for changes)
- **03.3-06:** Column header click-and-drag selection and layout consolidation (see commit d8e613a)
- 04-01: RunUpdate = RunCreate alias propagated through type/schema/IPC/preload to keep contract internally consistent (ISSUE 3)
- 04-01: requestType/platformId/speciesId immutable after create — enforced at repository layer by omitting from Drizzle SET clause
- 04-01: Operators use soft-delete via active=0 to preserve FK integrity for historical runs (D-Discretion)
- 04-01: Migration kept under drizzle-kit auto-generated name 0003_damp_prima.sql to avoid hand-editing _journal.json
- 04-01: WELL_ID and PLATE_KEY regex validation in Zod for plates record catches malformed JSON before DB write
- 04-05: OperatorsSection rendered below existing platform/species-filtered ManagePage content (operators are global, not scoped)
- 04-05: App.tsx init-time loadOperators({includeInactive:true}) so FinalizedRunHeader (04-04) resolves hidden operator names
- 04-05: Refresh-after-mutate pattern in operatorsStore — every mutation awaits loadOperators with current includeInactive scope
- 04-05: Hide-confirm copy carries D-20 explanatory sentence verbatim on a single source line for grep-verifiable acceptance
- 04-02: runStore is an orchestrator — reads via .getState() on save, writes via action methods on load, never duplicates upstream state
- 04-02: Dirty tracking centralized in runStore (D-22) — JSON.stringify of 4-store slices + metadata, cheap compare
- 04-02: isDirtyNow returns currentRunId !== null when lastCleanSnapshot === null — closes the load-gap where a fast operator could click Load before markClean fires
- 04-02: plex = getAllSelectedAnalytes().length (panel + singles); singleAnalyteIds holds only singles per D-19
- 04-02: ConfirmModal exposes symmetric primaryStyle + secondaryStyle props — Plan 04-04's EditWarningModal consumes secondaryStyle=destructive for D-12 'Edit anyway'
- 04-02: App.tsx owns setCurrentPage(4) via onAfterSave callback — keeps routing authoritative in App not scattered across feature components
- 04-02: Wizard chrome + Next-button gating use PAGE_LABELS.length so Plan 04-04 can extend to 5 without revisiting App.tsx chrome
- 04-02: Circular import (runStore → useRunSnapshot → calculatorStore → runStore) broken via registerRunStoreResetHook late-binding shim (avoids Vite dynamic-import chunking warning)
- 04-02: useRunSnapshot uses useMemo wrapping buildRunSnapshot — passes tsconfig.web strict noUnusedLocals without eslint-disable comments on selector subscriptions
- 04-04: PlateGrid read-only mode is a third rendering path gated on `interactive === false && selectedWells !== undefined` — keeps PlatePanel's step-3 behavior and the usePlateLayout fallback byte-for-byte identical
- 04-04: FinalizedRunView builds its own 8x12 WellData grid rather than using usePlateLayout — preserves D-02 round-trip fidelity for operator-customized plate layouts (usePlateLayout regenerates the deterministic auto-fill output and would clobber any rearrangement)
- 04-04: WellCell retains base green for filled cells in read-only mode (drops only the flashy ring-2 ring-green-300 selection indicator) so the finalized bench sheet clearly shows the saved layout — D-06 "no selection indicator" interpreted as dropping the ring, NOT dropping the fill coloring
- 04-04: Start New Run uses inline multi-store reset (calculator cascade + platformStore.clearSelection + selectionStore.resetAllSelections) rather than extending calculatorStore.reset's cascade — minimal-intrusion path, keeps calculator reset contract narrow
- 04-04: App.tsx handleBack reads useRunStore.getState().currentRunId imperatively instead of subscribing — the conditional only fires on explicit user click, no re-render needed
- 04-04: Aggregate label in FinalizedRunHeader ("Request XXXXX — N plate(s)") + per-plate label in FinalizedRunView ("Request XXXXX — Plate N of M") split — identity in the header, layout scoping inline with each grid
- 04-04: EditWarningModal is a thin ConfirmModal wrapper using the symmetric secondaryStyle='destructive' prop that Plan 04-02 Task 4 shipped — no inline JSX fallback needed for D-12 'Edit anyway' destructive rendering
- 04-04: FinalizedRunView renders PrepSheet + ReagentChecklist + BeadRegionList as three separate sibling sections per D-06 even though PrepSheet already embeds the latter two — preserves PrepSheet's public API (plan truth #5) and satisfies Task 3 acceptance greps. Potential cosmetic revisit for Plan 04-03 Windows smoke test.
- 04-03: Explicit win.target.arch [x64, arm64] in electron-builder.yml — electron-builder default behavior on Apple Silicon macOS hosts emits arm64-only installers, which would silently ship the wrong arch to Intel/AMD lab Windows PCs. Caught at config audit (Task 1) before any build pass.
- 04-03: ${arch} added to nsis.artifactName so per-arch installers don't collide on the same output filename.
- 04-03: D-26 deferrals (custom appId, icon, code signing, auto-updater URL) untouched as designed; Windows SmartScreen click-through accepted for v1 internal deployment.
- 04-03: Windows physical workstation smoke test (14 steps from Plan 04-03 Task 3) deferred to HUMAN-UAT — macOS dev host cannot exercise a Windows .exe per CLAUDE.md §Testing Windows-only. Not a methodology failure; it is the documented project test cycle.
- 04-03: Plan text labels build "v0.6.0 (Phase 4 bundle)" but package.json is still 0.5.0 — version bump and tag handled separately by .claude/release.md when ready to cut the actual v0.6.0 release.
- 12-01: ceilToTenthML uses Decimal.toDecimalPlaces(1, ROUND_CEIL) — supersedes STATE 02-01 'round up to nearest mL' per SMK3-06
- 12-01: DEFAULT_DEAD_VOLUME renamed to DEAD_VOLUME_PER_SETUP_UL — semantic shift per SMK3-05 (per-setup contribution, not total)
- 12-01: createCalculatorInputs sanity cap (numberOfSetups > 1000 throws) is intentional forcing function — calculatorStore.getOutputs() throws at runtime until Plan 12-03 reworks the store
- 12-01: CalculatorInputs keeps both numberOfSetups (input) and deadVolume (computed Decimal) — dual-field design preserves useRunSnapshot read of inputs.deadVolume
- 12-02: Multi-1×-premix tiebreaker = INPUT-ARRAY-ORDER (FIRST wins). Locked by two opposing-order tests (T-A4 + T-A5). Caller (Plan 12-03 calculatorStore) controls ordering policy (recommend panel-authored order)
- 12-02: resolveDiluent lives in src/renderer/src/lib/diluentResolver.ts (NEW), not folded into calculator.ts — per CONTEXT §Claude's Discretion: distinct domain concern, will grow in Phase 13, easier to test in isolation
- 12-02: DiluentResult discriminated union lives in src/shared/types/diluent.ts so renderer + main + Phases 13/14/15 share one source of truth without re-defining
- 12-02: Resolver accepts structural SelectedPremixForDiluent (just `name` + `concentration`) — zero imports from PremixPanel / Analyte / calculator.ts; Phase 13's master_panels schema growth (R-02) won't break this contract
- 12-02: SMK3-DIL-01 verbatim string contract locked by T-B3 — Values-table strings returned with whitespace AND case preserved (no trim, no case fold, no enum check); Phase 15 display layer owns sanitization if/when added
- 12-02: Strict equality `concentration === 1` (NOT `<= 1`) locked by T-D2 (concentration 0 → values_table) + T-D3 (0.5 → legacy when no valuesTable)
- 12-03: calculatorStore now exposes `numberOfSetups: number` (default 1) with validating `setNumberOfSetups` action; the broken transitional state from 12-01 (getOutputs() passing deadVolume=2000 as 5th arg → sanity-cap throw) is repaired. Sanity cap from 12-01 never triggers at runtime
- 12-03: Run-snapshot JSON gains a `numberOfSetups` field (optional, schema default 1) so Smoke 3 runs round-trip their dead volume on reload — SMK3-16 enabler. DB schema untouched; Phase 13 owns the runs-table column delta. Pre-Smoke-3 saved runs surface `undefined` which the loader defaults to 1 (equivalent to v1.0)
- 12-03: useCalculator.ts hook destructured the renamed `deadVolume` store field; Rule-3 deviation swapped destructure + return shape to `numberOfSetups`. No external consumer of useCalculator() reads .deadVolume — safe rename, dead-surface preservation. Phase 14 may rework input surface when Plate page exposes the field
- 12-03: Diluent resolver from Plan 12-02 NOT yet wired into calculatorStore — deferred to Phase 13/14/15 once per-reagent panel data (SMK3-08) and selectionStore's premix-concentration surface land. Resolver is consumable as-is via `import { resolveDiluent } from '../lib/diluentResolver'`
- 12-03: Integration test file `src/renderer/src/lib/__tests__/calculator.integration.test.ts` locks in PRD worked example end-to-end through the Zustand store (9.4 mL setups=1; 13.4 mL setups=3) + boundary rounding + CALC-05 cap regression at both lib AND store layers (canAddSingle + addSingle action) — canonical reference for any future calculator refactor

#### 2026-05-11 — Smoke 3 PRD Ingest (orchestrator rule: PRD wins every blocker)

Full audit trail in [.planning/INGEST-RESOLUTIONS.md](./INGEST-RESOLUTIONS.md). Decision IDs reference that document.

- **2026-05-11 META:** Lab-owner-authored [SMOKE-3-PRD.md](./SMOKE-3-PRD.md) is the canonical product spec. When PRD requirements conflict with previously locked v1/v2 decisions, **PRD wins.** [PANEL-UPLOAD-V2-SPEC.md](./PANEL-UPLOAD-V2-SPEC.md) is preserved but marked SUPERSEDED.
- **R-01:** Panel-data file shape = sectioned `Criteria` / `Values` / `Category` xlsx (Smoke 3 lab format). Supersedes PANEL-UPLOAD-V2-SPEC.md + scheduled rewrite of v0.7.0 parser.ts (Phase 13).
- **R-02:** `master_panels` grows per-reagent rows (Beads / Antibodies / SAPE each with Concentration + Diluent + Volume/well; SAPE has SAPE Name field). Supersedes MPAN-01 single-`reagent_volume_per_well` model.
- **R-03:** Rounding precision = round UP to nearest 0.1 mL (ceiling at 0.1 mL). **Supersedes decision 02-01** ("Final volume always rounds UP to nearest mL"). Calculator core change scoped for Phase 12.
- **R-04:** Diluent rule = concentration-keyed: if ANY selected premix is 1×, that premix is the diluent for Beads + Antibodies; else fall back to per-reagent Values-table diluent (PRD-silent gap explicitly filled by operator). Supersedes PROJECT.md §Domain Rules request-type-keyed rule + Assay Buffer fallback.
- **R-05:** CALC-05 max-5-singles cap retained. PRD silence ≠ removal — operator confirmed cap stays. Annotated in REQUIREMENTS.md.
- **R-06:** Three-format codebase split resolved via R-01. v0.7.0 parser + panel-template.csv + sample-panel-import.csv scheduled for retirement in Phase 13.
- **R-07:** "Number of setups" accepted as a new user input on the Plate page. Default 1, min 1, no max. Dead volume = `setups × 2 mL` (extends shipped 02-03 constant).
- **R-08:** Old Reagent input = two separate fields (Old Beads + Old Antibodies). Each ≥ 0. Subtracted from respective new-reagent calc.
- **R-09:** Replicate Mode set = `Single` + `Duplicate` only (as shipped). No triplicate or custom counts.
- **R-10:** Duplicate plate layout = adjacent rows in the same column. Samples 1–4 in col 4 as `(A4,B4)(C4,D4)(E4,F4)(G4,H4)`, then col 5, …, col 12 (9 cols × 4 samples = 36 = CALC-01 cap). **Supersedes the prior horizontal-pair + col-12-vertical layout** from decision 03.3-01.
- **R-11:** Panel name normalization: Roman → Arabic on import (`Panel I` → `Panel 1`). Store + display Arabic; lab can author either form.
- **R-12:** Premix deselection re-enables members as singles selectable but does NOT auto-add. Honors CALC-05 cap.
- **R-13:** `variable` cell in Bead/Antibody Concentration of Values block is author shorthand. Importer reads concentration from per-analyte rows in the Category block, ignores the `variable` label.
- **R-14:** Master `Table` tab in the xlsx is decorative. Importer enumerates panels by scanning sheet names. Range strings like "1 through 7" are irrelevant.
- **R-15:** Diluent column values are open-ended free text. Whatever the lab writes (`L-AB`, `n/a`, etc.) is stored verbatim. No enum, no normalization.
- **R-RE-UPLOAD:** Re-upload of a (Platform, Species, Panel) triple wholesale-replaces the existing panel. **Supersedes MPAN-05** (upsert-with-orphans).
- **R-PE:** PE volume = `Total Volume of the Assay ÷ SAPE concentration` (read from SAPE row in panel's Values block; typically 1×).
- **R-SAPE-NAME:** SAPE Name displayed in run document for traceability. No calculation impact.
- **R-BEAD-LIST:** Bead region display = flat list of all analytes (TA), sorted by bead region. Premix members + standalone singles in one combined list.
- **R-AUDIT:** Run document calculation breakdown = full audit trail (inputs + intermediates + outputs + diluent decision).
- **R-HIST:** Historical run records snapshot-frozen. Reopening shows persisted values. No retroactive recompute when Smoke 3 rules ship.
- **R-LEGACY:** Legacy CSV templates (`templates/panel-template.csv` + `sample-panel-import.csv`) deleted in Phase 13.
- **R-UAT:** v2.0 release versioning deferred to Phase 16 (v0.8.0 vs v2.0.0 decided at UAT gate).

### Pending Todos

- HUMAN-UAT-04.1-05-01: Windows physical workstation smoke retest (14 steps + Phase 4.1 fix acceptance for BUG-01/02/03 + UI-01) — install dist/immunoplex-assay-calculator-0.6.0-x64-setup.exe (or arm64) on the Windows PC and follow `04.1-05-PLAN.md` Task 2 `<how-to-verify>`. This SUPERSEDES HUMAN-UAT-04-03-01 (the Phase 4.1 retest is the same 14-step smoke test + 4 fix acceptances, run on a bundle containing both the Phase 4 feature set and the Phase 4.1 fixes). Results recorded to `.planning/phases/04.1-smoke-test-fixes/04.1-SMOKE-TEST-RETEST.md` with `## Overall: PASS` or `## Overall: FAIL`. On PASS → resume Plan 04.1-05 Task 3; on FAIL → `/gsd-plan-phase 4.1 --gaps`.
- Phase 4.1 verification: pending the smoke retest outcome above before phase 4.1 can be marked Complete and a v0.6.0 release tagged.
- v2.0 Phase 5 kickoff: run `/gsd-discuss-phase 5` to lock OD-1 (replace-vs-coexist), OD-2 (calculator strict-vs-graceful), OD-3 (vendor term placement), OD-7 (col C → single_conc) as release-gating decisions; OD-4/5/6/8 can ride same session. Then `/gsd-plan-phase 5`.

### Blockers/Concerns

- **ELECTRON_RUN_AS_NODE env var:** Claude Code SDK sets this, causing Electron to run as Node. Application works correctly in normal terminal. Not a blocker for development, just affects testing within SDK.

## Session Continuity

Last session: --stopped-at
Stopped at: Phase 13 context gathered
Resume file: --resume-file
Resume intent: Phase 12 is complete (4/4 plans; 12-04 closed WR-01/WR-03/WR-04 from the prior 9/11 verification). Next options: (a) **Phase 13 — Panel XLSX Parser v3** (the longest single phase remaining; rewrites parser.ts for the sectioned Criteria/Values/Category format and grows master_panels per-reagent rows — start via `/gsd-discuss-phase 13`), or (b) close out v1.0 by completing HUMAN-UAT-04.1-05-01 on Windows and tagging v0.6.0 before Smoke 3 work continues. The diluent resolver from Plan 12-02 is consumable as `import { resolveDiluent } from 'src/renderer/src/lib/diluentResolver'` but is NOT yet wired into any store — Phase 13/14/15 picks that up.

## Releases

- **v0.1.0** (2026-01-26): Foundation + Calculator Core (Phases 1-2)
- **v0.2.0** (2026-01-27): Plate Visualization & Species/Analyte Selection (Phase 3 + species/analyte additions)
- **v0.3.0** (2026-01-29): Wizard Navigation & Build Config
- **v0.4.0** (2026-01-29): Panel Data Import and Management (Phases 3.1 + 3.2)
- **v0.4.1** (2026-01-29): Fix Bio-Rad platform name in seed data
- **v0.4.2** (2026-01-29): Remove R&D Systems, correct platform names
- **v0.5.0** (2026-02-04): Selection UX Redesign & Interactive Plate Grid (Phase 3.3)

**Planned Phase:** 13 (smoke-3-panel-xlsx-parser-v3) — 6 plans — 2026-05-12T15:00:37.363Z
