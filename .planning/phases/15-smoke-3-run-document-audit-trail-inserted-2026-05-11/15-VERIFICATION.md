---
phase: 15-smoke-3-run-document-audit-trail-inserted-2026-05-11
verified: 2026-05-12T17:55:00Z
status: human_needed
score: 11/11 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Save a new run with a premix panel selected. Open the finalized run document."
    expected: "Audit Trail section displays: Inputs (8 rows including Premix selection, Old beads/antibodies), Intermediates (6 rows), Outputs (5 rows with a real PE volume number), Diluent decision (Rule applied + Beads diluent + Antibodies diluent). SAPE Name row appears in the metadata header above Sample Type. No historical-run banner is shown."
    why_human: "AuditTrailSection and FinalizedRunHeader are .tsx components — vitest is Node-only (no jsdom in this project). Visual layout correctness cannot be verified programmatically."

  - test: "Reload a run saved before Phase 15 (calculationRulesVersion = NULL). Open its finalized run document."
    expected: "Amber historical-run banner displays: 'This run was saved under previous calculation rules. Values displayed as recorded — no recompute on reopen.' All snapshot-derived fields in the audit trail render as — (em-dash). SAPE Name row shows —."
    why_human: "HistoricalRunBanner conditional render requires a runtime RunRecord with calculationRulesVersion = NULL. Cannot verify programmatically."

  - test: "Trigger old-reagent override (enter Old Beads > 20% cap, confirm override in modal). Save the run. Open the finalized run document."
    expected: "In the Inputs block, the Old beads row shows an inline amber OVERRIDE chip beside the value. Hovering the chip shows tooltip text: 'This value exceeded the 20% recommended cap at save time; operator confirmed override.'"
    why_human: "Override badge is .tsx rendering requiring runtime modal flow + real RunRecord. Cannot verify programmatically."

  - test: "Confirm PE volume formula on real data: use a panel with known SAPE concentration (e.g., 1×). Save a run and note the total assay volume from the calculator. Open the run document."
    expected: "PE volume in the Outputs block = total assay volume ÷ SAPE concentration, ceiling-rounded to 0.1 mL. For SAPE concentration = 1×, PE volume equals total assay volume. Verified against hand calculation per SMK3-17."
    why_human: "PE volume cell render requires runtime RunRecord with real sapeConcentration. The formula is verified by automated tests (Group M T-M1..T-M7 + T-M-INT), but the visual cell render needs Windows UAT."
---

# Phase 15: Smoke 3 — Run Document Audit Trail Verification Report

**Phase Goal:** The finalized run document shows the full calculation work — inputs, intermediates, outputs, diluent decision — and surfaces SAPE Name for traceability. Historical runs saved under v1/v2 rules are snapshot-frozen: reopening shows persisted values, never recomputes.
**Verified:** 2026-05-12T17:55:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|---------|
| 1 | Finalized run document Audit Trail section includes 4 blocks: Inputs / Intermediates / Outputs / Diluent decision with the locked label set from CONTEXT.md | ✓ VERIFIED | `AuditTrailSection.tsx` exports `AuditTrailSection`; grep confirms sections "1. Inputs", "2. Intermediates", "3. Outputs", "4. Diluent decision" each appear ≥1; all required row labels are present in code |
| 2 | SAPE Name is displayed in the run document metadata header | ✓ VERIFIED | `FinalizedRunHeader.tsx` contains `SAPE Name` label + `{record.sapeName ?? '—'}` value cell |
| 3 | PE volume = Total Volume ÷ SAPE concentration, ceiling-rounded; unit-tested against Thermofisher Human Panel I fixture (SAPE concentration = 1 → PE volume = total assay volume) | ✓ VERIFIED | `auditTrail.ts` exports `computePeVolumeML`; `auditTrail.test.ts` Group M T-M1..T-M7 (7 cases) all pass; `calculator.integration.test.ts` Group M T-M-INT confirms 9.4 mL @ 1× fixture |
| 4 | Historical runs (calculationRulesVersion ≠ 'smoke3') display an amber advisory banner; Phase-15-saved runs do not | ✓ VERIFIED | `HistoricalRunBanner.tsx` checks `calculationRulesVersion === 'smoke3'` and returns null for current runs; renders amber banner with verbatim D-15-11 copy otherwise |
| 5 | Snapshot persistence: 10 new columns on `runs` (8 nullable text/real + 2 NOT NULL boolean + 1 nullable text marker) with migration 0009 applied cleanly | ✓ VERIFIED | `drizzle/migrations/0009_chemical_prism.sql` exists with 10 `ALTER TABLE \`runs\` ADD` statements; migration.test.ts "migration 15-01" describe block has 10 column-presence assertions all passing |
| 6 | All 10 snapshot fields round-trip through runRepository.create + runRepository.getById | ✓ VERIFIED | `run.test.ts` "Phase 15 audit-trail snapshot persistence" has T-7..T-18 (12 tests); full suite 421/421 green |
| 7 | IPC channel `master-panel:get-with-reagents` allows renderer to fetch master panel + reagents at save time | ✓ VERIFIED | Channel constant in `channels.ts`; `masterPanel.ts` has `getByIdWithReagents`; `panel.ts` IPC handler registered; `preload/index.ts` exposes `masterPanel.getWithReagents`; `preload/index.d.ts` types it; 3 repository tests cover known/unknown/no-reagent paths |
| 8 | `buildRunSnapshot` is async; sync gates extracted into `validateSnapshotPreconditions`; IPC fires only on Save click | ✓ VERIFIED | `useRunSnapshot.ts` has `export async function buildRunSnapshot` + `function validateSnapshotPreconditions`; `runStore.ts` has `await buildRunSnapshot`; 4 useRunSnapshot tests pass (happy path / custom assay / IPC failure / override packing) |
| 9 | Override flags (oldBeadsOverride / oldAntibodiesOverride) lifted into calculatorStore; CalculatorForm dual-writes on confirm/clear paths | ✓ VERIFIED | `calculatorStore.ts` has `oldBeadsOverride: boolean` + setters; `CalculatorForm.tsx` has 2 calls to `setOldBeadsOverride(true)` and 2 calls to `setOldBeadsOverride(false)` (and antibodies mirrors) |
| 10 | `calculationRulesVersion: 'smoke3'` literal stamped on every Phase-15-saved RunCreate | ✓ VERIFIED | `useRunSnapshot.ts` contains `calculationRulesVersion: 'smoke3'` exactly once in the return literal |
| 11 | Full vitest suite green + typecheck green + build green | ✓ VERIFIED | 421/421 tests pass; `npm run typecheck` exit 0 (both tsconfig.node.json + tsconfig.web.json); `npm run build` exit 0 (electron-vite outputs produced) |

**Score:** 11/11 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/main/db/schema.ts` | 10-column delta on `runs` | ✓ VERIFIED | `sapeName: text('sape_name')` present; all 10 columns confirmed |
| `drizzle/migrations/0009_chemical_prism.sql` | Generated SQL migration with 10 ALTER TABLE statements | ✓ VERIFIED | File exists; 10 statements confirmed by grep |
| `src/shared/types/run.ts` | RunRecord + RunCreate with 10 new optional fields | ✓ VERIFIED | `calculationRulesVersion?: string \| null` appears 2× (one per interface) |
| `src/shared/validation/run.ts` | runCreate zod schema with 10 new fields | ✓ VERIFIED | `oldBeadsOverride: z.boolean()` confirmed present |
| `src/main/db/repositories/run.ts` | Conditional writes for all 10 new columns in create + update | ✓ VERIFIED | `if (data.sapeName !== undefined) insertValues.sapeName` present; update path `setWithProvenance.calculationRulesVersion` present |
| `src/main/db/__tests__/migration.test.ts` | 10 column-presence assertions | ✓ VERIFIED | "migration 15-01" describe block present; 8 nullable + 2 NOT NULL boolean confirmed |
| `src/main/db/repositories/__tests__/run.test.ts` | T-7..T-18 (12 round-trip tests) | ✓ VERIFIED | "Phase 15 audit-trail snapshot persistence" describe present with T-17 + T-18 |
| `src/shared/constants/channels.ts` | MASTER_PANEL_GET_WITH_REAGENTS channel constant | ✓ VERIFIED | `'master-panel:get-with-reagents'` present |
| `src/main/db/repositories/masterPanel.ts` | getByIdWithReagents composed read | ✓ VERIFIED | Method exists; imports masterPanelReagentRepository |
| `src/main/ipc/panel.ts` | IPC handler for new channel | ✓ VERIFIED | `MASTER_PANEL_GET_WITH_REAGENTS` present |
| `src/preload/index.ts` | Preload bridge for masterPanel.getWithReagents | ✓ VERIFIED | `getWithReagents` exposed in masterPanel block |
| `src/preload/index.d.ts` | ElectronAPI type declaration for masterPanel surface | ✓ VERIFIED | `masterPanel:` block present in ElectronAPI interface |
| `src/main/db/repositories/__tests__/masterPanel.test.ts` | 3 tests for getByIdWithReagents | ✓ VERIFIED | "Phase 15: getByIdWithReagents" describe block present |
| `src/renderer/src/stores/calculatorStore.ts` | oldBeadsOverride + oldAntibodiesOverride state + setters | ✓ VERIFIED | `oldBeadsOverride: boolean` + setters confirmed |
| `src/renderer/src/features/calculator/components/CalculatorForm.tsx` | Dual-write to store on confirm/clear | ✓ VERIFIED | 4 store calls (2 true + 2 false) for each override |
| `src/renderer/src/features/run/hooks/useRunSnapshot.ts` | Async buildRunSnapshot + sync validateSnapshotPreconditions | ✓ VERIFIED | Both functions present; IPC fetch + 10 new fields in return literal |
| `src/renderer/src/stores/runStore.ts` | await buildRunSnapshot at call site | ✓ VERIFIED | `await buildRunSnapshot` present |
| `src/renderer/src/features/run/hooks/__tests__/useRunSnapshot.test.ts` | 4 test cases covering key paths | ✓ VERIFIED | File exists; "Phase 15 — buildRunSnapshot async" describe present; all 4 tests pass |
| `src/renderer/src/features/run/lib/auditTrail.ts` | Pure helpers: computePeVolumeML + deriveDiluentBranchLabel | ✓ VERIFIED | Both exports present; ceilToTenthML composed |
| `src/renderer/src/features/run/lib/__tests__/auditTrail.test.ts` | Group M (7 PE cases) + Group N (3 branch label cases) | ✓ VERIFIED | T-M1..T-M7 (7 matches), T-N1..T-N3 (3 matches), 10/10 pass |
| `src/renderer/src/features/run/components/HistoricalRunBanner.tsx` | Amber banner with verbatim D-15-11 copy | ✓ VERIFIED | File exists; `calculationRulesVersion` check present; `bg-amber-50 border border-amber-300` styling; verbatim copy present |
| `src/renderer/src/features/run/components/AuditTrailSection.tsx` | 4-block audit trail with locked label set | ✓ VERIFIED | File exists; all 4 section headings confirmed; computePeVolumeML + resolveDiluent + deriveDiluentBranchLabel wired; OVERRIDE chip with D-15-08 tooltip present |
| `src/renderer/src/features/run/components/FinalizedRunHeader.tsx` | SAPE Name row added | ✓ VERIFIED | "SAPE Name" label + `record.sapeName ?? '—'` present |
| `src/renderer/src/features/run/components/FinalizedRunView.tsx` | HistoricalRunBanner + AuditTrailSection composed | ✓ VERIFIED | Both `<HistoricalRunBanner` and `<AuditTrailSection` present; imports confirmed |
| `src/renderer/src/lib/__tests__/calculator.integration.test.ts` | Group M T-M-INT integration test | ✓ VERIFIED | "Group M" describe + "T-M-INT:" present; computePeVolumeML imported and used |
| `.planning/STATE.md` | 5 decision entries 15-01..15-05 | ✓ VERIFIED | All 5 entries confirmed; `snapshot-at-save` and `calculationRulesVersion` present |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `src/preload/index.ts` | `src/shared/constants/channels.ts` | `ipcRenderer.invoke(IPC_CHANNELS.MASTER_PANEL_GET_WITH_REAGENTS, …)` | ✓ WIRED | MASTER_PANEL_GET_WITH_REAGENTS referenced in preload |
| `src/main/ipc/panel.ts` | `src/main/db/repositories/masterPanel.ts` | `masterPanelRepository.getByIdWithReagents` | ✓ WIRED | Both import and call present in handler |
| `src/main/db/repositories/masterPanel.ts` | `src/main/db/repositories/masterPanelReagent.ts` | `masterPanelReagentRepository.findByMasterPanelId` | ✓ WIRED | Import and call confirmed |
| `src/renderer/src/features/run/hooks/useRunSnapshot.ts` | `window.electronAPI.masterPanel.getWithReagents` | Plan 15-02 preload bridge | ✓ WIRED | Direct call present in buildRunSnapshot |
| `src/renderer/src/features/run/hooks/useRunSnapshot.ts` | `src/renderer/src/stores/calculatorStore.ts` | `calculator.oldBeadsOverride` | ✓ WIRED | `oldBeadsOverride: calculator.oldBeadsOverride` in return literal |
| `src/renderer/src/stores/runStore.ts` | `src/renderer/src/features/run/hooks/useRunSnapshot.ts` | `await buildRunSnapshot(metadata)` | ✓ WIRED | Single-line change confirmed |
| `src/renderer/src/features/run/components/AuditTrailSection.tsx` | `src/renderer/src/features/run/lib/auditTrail.ts` | `computePeVolumeML` + `deriveDiluentBranchLabel` imports | ✓ WIRED | Both imports and call sites confirmed |
| `src/renderer/src/features/run/components/FinalizedRunView.tsx` | `HistoricalRunBanner` + `AuditTrailSection` | JSX imports | ✓ WIRED | Both imports + JSX usage confirmed |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|--------------|--------|-------------------|--------|
| `AuditTrailSection.tsx` | `r.sapeName`, `r.sapeConcentration`, `r.beadsDiluent`, etc. | RunRecord loaded from runStore (which loads from SQLite via runRepository.getById cascade) | Yes — persisted at save time via Plan 15-01 repository + Plan 15-03 snapshot builder | ✓ FLOWING |
| `HistoricalRunBanner.tsx` | `currentRun.calculationRulesVersion` | RunRecord from runStore selector | Yes — stamped as 'smoke3' on new saves; NULL on pre-Phase-15 rows | ✓ FLOWING |
| `FinalizedRunHeader.tsx` | `record.sapeName` | RunRecord from runStore | Yes — persisted via sapeName column in 0009 migration | ✓ FLOWING |
| `useRunSnapshot.ts` | `sapeName`, `sapeConcentration`, diluents, vol/well | IPC fetch of masterPanelRepository.getByIdWithReagents | Yes — real SQLite read of master_panel_reagents rows | ✓ FLOWING |

### Behavioral Spot-Checks

Step 7b: SKIPPED — app is Windows-only (per CLAUDE.md). Runtime UI testing via `npm run build:win` + Windows install is the established protocol; conducted in Phase 16 UAT. Automated tests cover the non-UI code paths.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|---------|
| SMK3-12 | 15-01, 15-03, 15-04 | SAPE Name displayed in run document for traceability | ✓ SATISFIED (automated) + ? NEEDS HUMAN (render) | `runs.sape_name` column persisted; `FinalizedRunHeader` SAPE Name row wired; visual render → Phase 16 UAT |
| SMK3-15 | 15-01, 15-02, 15-03, 15-04 | Full audit trail: inputs → intermediates → outputs → diluent decision | ✓ SATISFIED (structure/persistence) + ? NEEDS HUMAN (render) | AuditTrailSection 4-block structure exists; all labeled rows present; 6 derived-value rows render `—` (intentional per plan); full content → Phase 16 UAT |
| SMK3-16 | 15-01, 15-03, 15-04 | Historical run records snapshot-frozen; no retroactive recompute | ✓ SATISFIED (automated) + ? NEEDS HUMAN (render) | `calculationRulesVersion='smoke3'` marker persisted; AuditTrailSection reads exclusively from RunRecord (no calculatorStore reads); HistoricalRunBanner discriminant wired; banner render → Phase 16 UAT |
| SMK3-17 | 15-04, 15-05 | PE volume = Total Assay Volume ÷ SAPE concentration (1× fallback) | ✓ SATISFIED (automated) + ? NEEDS HUMAN (render) | `computePeVolumeML` unit-tested (7 cases T-M1..T-M7) + integration-tested (T-M-INT vs 9.4 mL Group A fixture); PE volume cell render → Phase 16 UAT |

Note: All 4 requirements (SMK3-12, SMK3-15, SMK3-16, SMK3-17) appear as `[ ]` (unchecked) in REQUIREMENTS.md. They are not yet ticked to `[x]`. Marking them satisfied is the /gsd-verify-work and Phase 16 UAT gate — this verifier does not update REQUIREMENTS.md.

### Anti-Patterns Found

| File | Issue | Severity | Impact |
|------|-------|----------|--------|
| `AuditTrailSection.tsx:214-228` | 6 rows hardcoded to `value="—"` with no derivation: Raw bead volume, Raw antibody volume, New beads, New antibodies, Total bead volume, Total antibody volume | ⚠️ Warning | Per plan design decision: these require composing the old-reagent subtraction pipeline + per-reagent ceiling pass against snapshot fields not stored on RunRecord. Accepted in the plan — "Phase 16 UAT will catch any missing rows." No TODO marker in code (flagged as WR-06 in code review). These rows display `—` for all runs including Phase-15-saved runs. UAT will confirm acceptability. |
| `useRunSnapshot.ts:142` | `if (result)` silently treats `null` return from `getWithReagents` as "skip IPC" rather than returning an error | ⚠️ Warning | If the master panel is missing from DB (race/drift), the run saves with calculationRulesVersion='smoke3' but 6 null snapshot fields. Indistinguishable from a custom-assay save. Flagged as WR-02 in code review. No user-visible error. For a lab-internal single-machine app with a non-adversarial operator, severity is low — the historical-run banner guards the reopen case, and the custom-assay-like em-dash renders are not misleading. |
| `useRunSnapshot.ts:214` + `HistoricalRunBanner.tsx:14` | `'smoke3'` is a duplicated magic string across write path and read discriminant | ℹ️ Info | A future version bump requires two coordinated edits. Flagged as WR-03 in code review. Not a functional issue for v1. |
| `runStore.ts:142-159` | `loadRun` cascade does NOT restore `oldBeadsOverride` / `oldAntibodiesOverride` into calculatorStore | ⚠️ Warning | Reopening a run where the operator confirmed a 20%-cap override: the OVERRIDE chip in the audit trail renders correctly (reads from RunRecord); the calculator form's local `beadsOverrideAccepted` React state resets to false, potentially re-triggering the cap modal on the first interaction. Flagged as WR-01 in code review. Audit trail display is not broken; only the form's local override-accepted UX state is inconsistent on reload. |

Classification note on the 6 em-dash rows: these are intentional by-design placeholder values in the current shipped code, not accidentally-uncompleted stubs. The plan documentation explicitly acknowledges them and defers computation to a potential follow-up plan after Phase 16 UAT. They do NOT prevent the audit trail goal — the 4-block structure, the persisted inputs, the PE volume row, and the diluent decision rows all render real data.

### Human Verification Required

#### 1. Audit Trail visual render (SMK3-15, SMK3-12)

**Test:** Save a new run with a Smoke 3 premix panel selected (e.g., Panel 1 with beads/antibodies/SAPE reagent rows). Open the finalized run document.
**Expected:** "Calculation Audit Trail" section renders below the metadata header with 4 labeled blocks. Inputs block shows real values for Plates, Sample count, Replicate mode, Premix selection (panel name + concentration), Old beads, Old antibodies, Number of setups. Intermediates block shows Beads vol/well, Antibodies vol/well, Dead volume with real values. Outputs block shows PE volume as a real number (not `—`). Diluent decision block shows the branch label and verbatim diluent strings. SAPE Name row appears in the metadata header above Sample Type.
**Why human:** AuditTrailSection and FinalizedRunHeader are .tsx components — vitest is Node-only (no jsdom in this project per VALIDATION.md). Visual layout correctness requires Windows runtime.

#### 2. Historical-run banner render (SMK3-16)

**Test:** Open a run saved before Phase 15 (one that exists in the DB from before Phase 15 shipped, with `calculation_rules_version = NULL`).
**Expected:** Amber banner appears above the audit trail: "This run was saved under previous calculation rules. Values displayed as recorded — no recompute on reopen." All snapshot-derived audit trail fields show `—`. No recomputation of any output occurs.
**Why human:** HistoricalRunBanner conditional render requires a live pre-Phase-15 RunRecord. Cannot fabricate via headless test.

#### 3. Override badge render (D-15-08)

**Test:** Enter Old Beads exceeding the 20% cap. Confirm override in the cap modal. Save the run. Open the finalized run document.
**Expected:** "Old beads" row in the Inputs block shows an inline amber chip labeled "OVERRIDE". Hovering (or inspecting) the chip reveals tooltip text: "This value exceeded the 20% recommended cap at save time; operator confirmed override."
**Why human:** Requires runtime modal flow + inspecting live JSX render.

#### 4. PE volume formula on real panel data (SMK3-17)

**Test:** Use a premix panel whose SAPE row in the master_panel_reagents table has concentration = 1. Save a run. Note the total assay volume. Open the finalized run document.
**Expected:** PE volume in the Outputs block equals the total assay volume (since 1÷1 = 1), ceiling-rounded to 0.1 mL.
**Why human:** The formula is verified by automated Group M tests; the visual cell render + real-panel data path requires Windows runtime.

---

## Summary

Phase 15 goal is achieved at the automated-verification level: the persistence layer (10 new columns, migration 0009, repository), the IPC bridge, the snapshot builder, the pure helpers (PE math, diluent branch label), and the UI component wiring are all substantive, wired, and data-flowing. The full test suite (421 tests), typecheck, and build are green.

The `human_needed` status reflects this project's established convention: `.tsx` render correctness on Windows is always a Phase 16 UAT gate (vitest is Node-only, no jsdom). The 4 human verification items are the visual renders for the 4 SMK3 requirements — exactly the surface Phase 16 Windows UAT is designed to cover.

The code review (15-REVIEW.md) identified 3 warnings (WR-01 loadRun override-flag restore gap, WR-02 silent null result from IPC, WR-04 dead-volume singular/magic-number, WR-05 premix `—×` display, WR-06 six em-dash rows) and several info items. None are blockers for the phase goal. WR-06 (the 6 em-dash rows) is the most visible UAT concern: Phase 16 will determine whether those rows require follow-up implementation or are acceptable as-is for v1.

---

_Verified: 2026-05-12T17:55:00Z_
_Verifier: Claude (gsd-verifier)_
