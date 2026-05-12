# Phase 14: Smoke 3 — Plate Page Input Expansion + UI Cleanup — Context

**Gathered:** 2026-05-12
**Status:** Ready for planning

<domain>
## Phase Boundary

Surface three Smoke 3 operator inputs on the Plate page (Old Beads, Old Antibodies, Number of Setups), wire them into the Phase-12 calculator surface that already accepts `numberOfSetups`, restructure the Calculator Inputs panel so the critical-input set (samples + plates) is explicit, switch the "Selected Analytes" sidebar from a panel/singles grouping to a single flat list sorted by bead region (SMK3-14), preserve previously-picked singles when a premix is deselected so member analytes return to the singles pool without auto-add (SMK3-13), strip stock-concentration labels from PlatformCard + PlatformSelector (SMK3-01), and switch the duplicate plate layout from the existing horizontal-pair + col-12-vertical-special-case to a uniform vertical-pair-within-column layout across cols 4-12 (SMK3-RPL-02).

**In-scope:**
1. New Plate-page inputs: Number of Plates, Old Beads (mL), Old Antibodies (mL), Number of Setups — wired to `calculatorStore` (SMK3-02, SMK3-03, SMK3-04)
2. 20%-cap validation + confirm-once override modal for old-reagent inputs
3. Floor-to-0.1 mL rounding on Old Beads / Old Antibodies inputs (deliberate asymmetry vs. the calculator's 0.1 mL ceiling output rule)
4. Stock-concentration label removal from `PlatformCard` + `PlatformSelector` (SMK3-01)
5. Premix-deselection behavior change: previously-picked singles survive the deselect; member analytes return to the singles pool as candidates; CALC-05 max-5 cap still applies (SMK3-13)
6. Flat bead-region list replaces the panel/singles grouping in `SelectedAnalytesList` (SMK3-14)
7. Duplicate plate layout overhaul: uniform vertical-pair-within-column across cols 4-12 — updates `usePlateLayout`, `getDuplicatePair`, `computeSampleIndexMap` (SMK3-RPL-02)
8. Unit tests for the new layout geometry + auto-fill order

**Out-of-scope:**
- PE volume formula, SAPE Name display, run-document audit trail — Phase 15 (SMK3-12, SMK3-15, SMK3-16, SMK3-17)
- Windows installer build + UAT — Phase 16
- Multi-premix selection (PRD §Hierarchy "multiple premixes can be selected") — current `selectionStore` is single-premix; this phase does NOT introduce multi-premix support. If the lab needs it before UAT, file a follow-up phase.
- Vendor-singles-term UI rollout (VTRM-01, VTRM-02) — out of Smoke 3 scope; PRD didn't speak to it; deferred.

The calculator math is already Smoke 3 (Phase 12: 0.1 mL ceiling output, dead volume = setups × 2 mL, concentration-keyed diluent). Phase 13 schema (`master_panel_reagents`) is available but Phase 14 doesn't need to read from it directly — `calculatorStore` already resolves `volumePerWell` through the existing channel.

</domain>

<decisions>
## Implementation Decisions

### Calculator Inputs Panel — Restructure (SMK3-02 / SMK3-03 / SMK3-04)

- **D-01: Input ordering** matches PRD §Third Step literally:
  1. Number of Plates (NEW)
  2. Replicate Mode (existing radios — Singles / Duplicates)
  3. Number of Samples (existing `SampleCountInput` slider)
  4. Old Beads — mL (NEW)
  5. Old Antibodies — mL (NEW)
  6. Number of Setups (NEW)
  7. Request Type badge (existing read-only)
- **D-02: Critical-input contract.** Only **Number of Samples** and **Number of Plates** are required to compute volumes. Per-plate well assignment in `PlatePanel` is a non-critical planning aid — operators may leave wells unassigned; the calculator does not gate on `samplesRemaining`.
- **D-03: Number of Plates input.** Numeric `<input type="number" min="1" step="1">`. Bidirectionally linked with `plateStore.plateCount` — typing edits the same value the existing `PlateToolbar` Add Plate / Remove Plate buttons manage. Both surfaces reflect the same live value. Per-plate well assignments survive when count grows; when count shrinks, plates beyond the new count get cleared via existing `removePlate` behavior.
- **D-04: Old Beads / Old Antibodies inputs.** Numeric `<input type="number" min="0" step="0.1">`, mL units displayed inline. Default 0.
- **D-05: Number of Setups input.** Numeric `<input type="number" min="1" step="1">`, default 1, no upper bound (Phase 12 calc surface already accepts this).
- **D-06: All three new inputs feed `calculatorStore`** via existing `setNumberOfSetups` action plus two new actions (`setOldBeads`, `setOldAntibodies`). `calculatorStore` adds two `number` fields with the same `runStore.loadRun` snapshot-fidelity contract that `numberOfSetups` already has (Phase 12-04 / SMK3-16 — historical runs reload as-saved, never recompute).

### Input Validation & Rounding

- **D-07: Floor-to-0.1 mL on Old Beads / Old Antibodies.** Whatever the operator types is floor-rounded to 0.1 mL precision before being stored or used in calc: `1.51 → 1.5`, `1.59 → 1.5`, `1.50 → 1.5`. Deliberate asymmetry vs. the calculator's `Decimal.toDP(1, ROUND_CEIL)` output rule (SMK3-06) — old reagents are conservative (round DOWN so the operator never claims more than they have on hand); new reagents are conservative the other way (round UP so prep volume is sufficient).
- **D-08: When does floor-rounding kick in.** Store the raw typed value in `calculatorStore` state; floor-round at **calculator-input time** (when `calculatorStore.getOutputs()` consumes it). Input field continues to display whatever the operator typed. Calculator outputs and run-document displays use the floor-rounded value. This preserves author intent (operator can type 1.51, see 1.51 in the field on revisit) while the math uses 1.5.
- **D-09: 20% per-reagent cap.** Each old-reagent input is independently capped at 20% of its own total reaction volume:
  - Old Beads cap = `0.20 × (sampleCount × bead_volume_per_well + dead_volume)`
  - Old Antibodies cap = `0.20 × (sampleCount × antibody_volume_per_well + dead_volume)`
  - "Total reaction volume" includes dead volume (= `numberOfSetups × 2 mL`). Cap recomputes live as samples / setups / volume_per_well changes.
- **D-10: Cap UX = soft-block + confirm-once override.**
  - On input exceeding the cap: red border on the input + helper text `Max 1.4 mL (20% of 7.0 mL total). Override?`
  - First time a value exceeds the cap, a confirm-once modal appears: `Old Beads (2.5 mL) exceeds 20% (1.4 mL). Override?` — buttons: `[Yes, override]` / `[Cancel]`.
  - Cancel → input snaps back to the cap value.
  - Override → input keeps the typed value, red border becomes amber 'overridden' badge, validation clears, calculator computes with the typed value.
  - Re-typing a still-over value doesn't re-prompt until the operator leaves the field and returns (override sticks within the focused session, re-prompts on next focus).
  - Calculator computation is **paused** (no outputs displayed) while the input is in red-border state. Once override accepted OR value lowered to the cap, computation resumes.
- **D-11: Calculator math when override accepted.** If override allows old-reagent > calculated new-reagent volume, new-reagent floor-clamps to 0. Total reagent reported = old-reagent + dead volume. No "no new reagent needed" banner — the calculator output simply shows new-reagent = 0 and total = old-reagent + dead.

### Stock-Concentration Label Cleanup (SMK3-01)

- **D-12: `PlatformCard.tsx` lines 42-49** — strip the entire footer block including the `border-t` separator. Card becomes Title + Selected badge + Description only. No replacement micro-fact, no preserved spacer.
- **D-13: `PlatformSelector.tsx` lines 50-63** — drop the `Stock concentration: Xx` line (line 57) AND the `Ready to proceed with reagent calculations.` line (lines 59-61). Keep the green-bordered box + `Platform Selected: {selectedPlatform.name}` heading (line 54). Resulting block: a single heading inside the green container.

### Selected-Analytes Sidebar → Flat Bead-Region List (SMK3-14)

- **D-14: Replace** `SelectedAnalytesList.tsx`'s panel/singles grouping with a **single flat list sorted by bead region ascending**. Premix members and standalone singles render in the same section, no expand/collapse, no `Panel` vs `Individual Additions` headers, no panel-name badge.
- **D-15: Sort key** = `analyte.beadRegion` numeric ascending. Ties broken alphabetically by analyte name. Bead region is already a string column (`analytes.bead_region`); coerce to number for sort if all values parse as numeric, else fall back to lexical sort.
- **D-16: Row content** per analyte: name + bead region badge (existing styling). Drop the per-analyte remove button on premix-member rows (those are owned by the premix); keep it on standalone-singles rows (current behavior).
- **D-17: Component name + location** stays `SelectedAnalytesList.tsx` (renaming risks orphaning imports). Internal structure is what changes. The TA (Total Analytes) count badge in the header continues to show `panelAnalytes.length + singleAnalytes.length`.

### Premix Deselection (SMK3-13)

- **D-18: Override D-4.1-04 for the premix-deselect case.** When a premix is deselected (`selectPanel(null)` or switching to a different premix), `selectedSingleIds` is **preserved** rather than cleared. The previously-picked singles survive. CALC-05 max-5 cap still applies if the operator manually re-picks members.
- **D-19: Member analytes return to the singles pool as candidates** via the existing `getAvailableSingles()` logic — when `selectedPanel === null`, all panel-member analytes show up in the singles grid. No visual ceremony (no toast, no flash, no "returnable" badge); the singles grid simply has more candidates after deselect.
- **D-20: Edge case — switching FROM premix A TO premix B.** Existing D-4.1-04 stale-singles risk: a single previously picked for premix A might be a member of premix B. Resolution: when the new premix is selected, prune any `selectedSingleIds` that are members of the new premix (those become panel-members, not singles). Non-member singles survive. This is a refinement of D-4.1-04, not a full override.

### Duplicate Plate Layout Overhaul (SMK3-RPL-02)

- **D-21: New pair geometry — vertical pairs within column, uniform across cols 4-12.** Each column holds 4 sample-pairs: `(A,B)`, `(C,D)`, `(E,F)`, `(G,H)`. Same pattern in every unknown column 4-12. The old col-12-special-case (vertical pairs A↔E, B↔F, C↔G, D↔H) and the old horizontal pairs in cols 4-5/6-7/8-9/10-11 are retired.
- **D-22: Auto-fill order = column-first** (matches singles snake): col 4 fills samples 1-4 top-to-bottom by pair, then col 5 fills 5-8, …, col 12 fills 33-36. 9 cols × 4 samples = 36 — exactly the duplicate cap.
- **D-23: `getDuplicatePair(row, col)`** rewrite:
  - Standard cols (col 0-2 / 1-indexed 1-3) → `null` (unchanged)
  - All unknown cols (col 3-11 / 1-indexed 4-12) → return the adjacent-row pair partner in the SAME column:
    - Row 0 (A) ↔ Row 1 (B)
    - Row 2 (C) ↔ Row 3 (D)
    - Row 4 (E) ↔ Row 5 (F)
    - Row 6 (G) ↔ Row 7 (H)
- **D-24: `usePlateLayout`** duplicate-branch rewrite: for each col 4-12, iterate the 4 row-pairs top-to-bottom, assign `globalSampleIndex` to both wells in the pair, increment, advance to next pair (or next column if all 4 pairs done).
- **D-25: `computeSampleIndexMap` in `PlatePanel.tsx`** duplicate-branch: same column-first, pair-by-pair iteration. When the operator manually selects/deselects wells, the index map recomputes from the same geometry — clicking a single well auto-includes its pair partner (existing `useWellSelection` already does this via `getDuplicatePair`).
- **D-26: Existing constants to retire:** `DUPLICATE_HORIZONTAL_PAIRS` and `DUPLICATE_VERTICAL_COL` in `src/shared/constants/calculator.ts` become unused. Delete them (and any test files referencing them) — no backwards-compat needed because the duplicate layout was never end-user-locked under SMK3 rules; Phase 12 only touched volume math, not geometry.
- **D-27: Sample-count cap unchanged.** `UNKNOWN_WELLS_DUPLICATES = 36` (existing) still equals 9 cols × 4 pairs.

### Claude's Discretion

- File splits — whether the override modal lives in `features/plate/components/OldReagentCapModal.tsx`, gets bundled into `CalculatorForm.tsx`, or uses a generic confirm-modal primitive. Recommendation: dedicated component because the modal needs the live cap value + reagent label, and the calculator-input flow is the only caller.
- Visual treatment of the floor-rounding asymmetry — whether to surface a tooltip on the input ("Inputs round down to 0.1 mL; outputs round up") or stay silent. Recommendation: tooltip on the field label, since the asymmetry is unusual.
- Exact bead-region sort tiebreaker if string sort detects non-numeric values (e.g. some panels have `25`, others `25a`) — the panel data is numeric in all 17 fixtures, so this should never trigger; fall through to lexical sort if it does.
- Whether `setOldBeads` / `setOldAntibodies` actions accept the typed value (preserving author intent per D-08) or the floor-rounded value. Recommendation: store typed; floor at consumption — gives the planner room to add an "auto-format on blur" later if needed.
- Whether to add a per-input "20% cap = X.X mL" helper text below the field at all times (informative) or only when exceeded (alerting). Recommendation: always-on helper text, secondary muted color when below cap, red when over.
- Bidirectional Number-of-Plates input vs PlateToolbar buttons: whether the input is debounced (avoid creating/destroying plates on every keystroke). Recommendation: debounce 250ms or apply only on blur, with arrow-key/spinner clicks applying immediately.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Authoritative product spec
- `.planning/SMOKE-3-PRD.md` — full PRD; especially §Hierarchy of UI interaction → First Step (stock-conc label removal), §Hierarchy → Second Step (premix member highlighting/deselection), §Hierarchy → Third Step (plate inputs: Old Reagents + Setups + sample count), §Calculation → Old Reagents + Dead volume.
- `.planning/INGEST-RESOLUTIONS.md` §E — resolution lineage for SMK3-01, SMK3-02, SMK3-03, SMK3-04, SMK3-13, SMK3-14, SMK3-RPL-02.

### Requirements
- `.planning/REQUIREMENTS.md` §v2.1 Smoke 3 PRD Adoption → Plate Page Input Expansion (SMK3-02, SMK3-03, SMK3-04), UI Behavior (SMK3-01, SMK3-13, SMK3-14), Replicate Mode (SMK3-RPL-01, SMK3-RPL-02). Plus carryover CALC-05 (max-5 cap), CALC-03 (dead volume — Phase 12 extension).

### Roadmap entry
- `.planning/ROADMAP.md` §Phase 14 — the 6 Success Criteria (three numeric inputs above sample count, calculator wiring, premix deselection returns members as selectable, bead region flat list, UI label cleanup, duplicate plate layout vertical-pair-within-column).

### Prior phase contexts (locked decisions, do NOT re-litigate)
- `.planning/phases/12-smoke-3-calculator-rules/12-CONTEXT.md` — Phase 12 added `numberOfSetups` to `calculatorStore` (default 1, min 1, no max) + 0.1 mL ceiling output + concentration-keyed diluent. Phase 14 reuses this calculator surface; do NOT modify the calculator math itself.
- `.planning/phases/12-smoke-3-calculator-rules/12-VERIFICATION.md` — Phase 12 shipped 2026-05-12. `runStore.loadRun` reapplies `numberOfSetups` on load (SMK3-16 snapshot-fidelity contract). Phase 14's two new fields (`oldBeads`, `oldAntibodies`) MUST honor the same snapshot-fidelity contract — persist + reload as-saved, no recompute on load.
- `.planning/phases/13-smoke-3-panel-xlsx-parser-v3/13-CONTEXT.md` — Phase 13 introduced `master_panel_reagents` (per-reagent Concentration + Diluent + Volume/well). Phase 14 does NOT directly read this table — `calculatorStore` already resolves `volumePerWell` through its existing path.
- `.planning/phases/04.1-smoke-test-fixes/04.1-CONTEXT.md` — D-4.1-04 (clear singles on panel switch to avoid stale state). Phase 14 **refines** this rule per D-18 + D-20 above: deselect-to-null preserves singles; switch-to-new-premix prunes singles that are members of the new premix.

### Codebase locations — read before modifying
- `src/renderer/src/features/calculator/components/CalculatorForm.tsx` — current Calculator Inputs panel (Sample Count, Replicate Mode, Request Type). Restructure per D-01.
- `src/renderer/src/features/calculator/hooks/useCalculator.ts` — exposes calculator state to CalculatorForm. Add `oldBeads`, `oldAntibodies`, `setOldBeads`, `setOldAntibodies`, `plateCount`, `setPlateCount` bindings.
- `src/renderer/src/stores/calculatorStore.ts` — current `numberOfSetups`, `setNumberOfSetups` (Phase 12). Add `oldBeads: number`, `oldAntibodies: number`, `setOldBeads`, `setOldAntibodies` actions; wire them into `getOutputs()` per the Phase-12 calc surface (calculator function signature already exists; pass through).
- `src/renderer/src/stores/plateStore.ts` — current `plateCount` lives here, managed by `addPlate` / `removePlate`. Add `setPlateCount(n: number)` action for bidirectional Number-of-Plates input.
- `src/renderer/src/lib/calculator.ts` — `createCalculatorInputs(sampleCount, replicateMode, volumePerWell, numberOfPlates, numberOfSetups)`. Old-reagent subtraction is NOT yet plumbed into this function; Phase 14 extends the signature OR adds a separate `applyOldReagentSubtraction(outputs, oldBeads, oldAntibodies)` step. Researcher to recommend.
- `src/renderer/src/features/platform/components/PlatformCard.tsx` lines 42-49 — strip per D-12.
- `src/renderer/src/features/platform/components/PlatformSelector.tsx` lines 56-61 — strip per D-13.
- `src/renderer/src/features/selection/components/SelectedAnalytesList.tsx` — replace grouping with flat sorted list per D-14/D-15/D-16/D-17.
- `src/renderer/src/features/selection/components/AnalyteSelectionPanel.tsx` — parent of SelectedAnalytesList; verify no upstream coupling to the panel/singles split.
- `src/renderer/src/stores/selectionStore.ts` `selectPanel` action (lines 172-203) — current code clears `selectedSingleIds: []` on panel switch. Refine per D-18/D-20.
- `src/renderer/src/features/plate/hooks/usePlateLayout.ts` — duplicate-branch rewrite per D-24.
- `src/renderer/src/features/plate/components/PlatePanel.tsx` `computeSampleIndexMap` (lines 15-68) — duplicate-branch rewrite per D-25.
- `src/shared/constants/calculator.ts` `getDuplicatePair`, `DUPLICATE_HORIZONTAL_PAIRS`, `DUPLICATE_VERTICAL_COL`, `UNKNOWN_WELLS_DUPLICATES` — rewrite per D-23, retire per D-26.
- `src/renderer/src/features/plate/hooks/useWellSelection.ts` — consumes `getDuplicatePair` for manual well clicks; should "just work" with the new geometry, but verify.
- `src/renderer/src/features/run/hooks/useRunSnapshot.ts` — Phase 12 persists `numberOfSetups`. Phase 14 adds `oldBeads` + `oldAntibodies` to the snapshot. Mirror the `runStore.loadRun` reapply pattern.

### Tests to extend / add
- Existing: `src/renderer/src/lib/__tests__/calculator.integration.test.ts` (Phase 12 added Groups D + E for CALC-05 + numberOfSetups). Add Groups F + G for old-reagent subtraction and 20%-cap behavior.
- New: `src/renderer/src/features/plate/__tests__/usePlateLayout.test.ts` covering the 36-sample duplicate layout (col 4 = samples 1-4, …, col 12 = 33-36; pair geometry A-B / C-D / E-F / G-H per column).
- New: `src/shared/constants/__tests__/getDuplicatePair.test.ts` — every (row, col) in cols 4-12 has the right adjacent-row partner; cols 1-3 return null.
- New: `src/renderer/src/features/calculator/__tests__/CalculatorForm.test.tsx` (or extend existing) — input ordering, floor-rounding behavior, 20%-cap override modal flow.

### Project-level invariants
- `CLAUDE.md` — commit protocol (dev/v1-01 branch; Conventional Commits; three-strike debug rule; Windows-only deployment so test cycle is `npm run build:win` → install on Windows workstation).
- `.planning/PROJECT.md` §Domain Rules — Smoke 3 PRD source of truth; plate snake fill rule; 0.1 mL ceiling rounding (outputs); dead-volume formula.

### Just-completed phase
- `.planning/phases/13-smoke-3-panel-xlsx-parser-v3/13-VERIFICATION.md` — Phase 13 shipped 2026-05-12 with 216/216 tests green. Phase 14 doesn't depend on Phase 13 schema reads directly, but the per-reagent `volume_per_well` is the source of truth for `calculatorStore.volumePerWell` once a panel is loaded.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`calculatorStore.setNumberOfSetups`** (lines ~137) and `calculatorStore.numberOfSetups` field (line ~42, default 1) — Phase 12 already shipped. Phase 14 adds two parallel actions (`setOldBeads`, `setOldAntibodies`) and two parallel fields with the same min/validation/snapshot-fidelity contract.
- **`runStore.loadRun`** (lines ~138-141) — Phase 12 reapply pattern for `numberOfSetups` on run reload. Phase 14 mirrors this for `oldBeads` + `oldAntibodies`.
- **`useRunSnapshot`** (`features/run/hooks/useRunSnapshot.ts`) — persists `numberOfSetups` for SMK3-16 snapshot fidelity. Extend with two more fields.
- **Existing AskUserQuestion / modal patterns** — `electron-vite` + React; check `features/manage/` for existing modal primitives (TBD — researcher to identify) before building OldReagentCapModal from scratch.
- **`useWellSelection`** hook + `getDuplicatePair` — manual well clicks already auto-include the pair partner. Once D-23's geometry change ships, manual click behavior auto-adapts.
- **`Decimal` from `decimal.js`** — already used in `lib/calculator.ts` and `lib/decimal.ts`. Use `Decimal.toDP(1, ROUND_FLOOR)` for the input floor-rounding per D-07/D-08.
- **`validationError` banner pattern in `CalculatorForm.tsx`** lines 73-78 — extend (or compose) for 20%-cap red-border + helper text.
- **TailwindCSS color tokens** (`var(--color-primary)`, `var(--color-border)`, etc.) — consistent across all existing components; reuse for new modal + helper text.

### Established Patterns
- **`zustand` actions with simple setters** — `calculatorStore` already does `setSampleCount`, `setReplicateMode`, etc. Add `setOldBeads(value: number)`, `setOldAntibodies(value: number)`, `setPlateCount(value: number)` following the same shape.
- **Validation message accumulation on the store** — `calculatorStore.validationError: string | null`. Phase 14's 20%-cap exceeded state should set this same field with a structured error so the existing red-banner downstream just works. Override-acceptance clears it.
- **Numeric input components** — `SampleCountInput.tsx` (slider + editable field) is the existing pattern for `sampleCount`. The 4 new inputs are simpler (just `<input type="number">`) — no slider needed. Match the existing label styling for visual consistency.
- **Per-reagent volume math is independent for beads vs antibodies** — already true in `lib/calculator.ts`. The 20% cap (D-09) and old-reagent subtraction (D-11) preserve this per-reagent independence.

### Integration Points
- `CalculatorForm.tsx` is rendered inside `PlatePanel.tsx` (or its parent layout — verify). Phase 14 doesn't move the rendering location, just restructures the form's internal layout.
- `SelectedAnalytesList.tsx` is rendered inside `AnalyteSelectionPanel.tsx`. The selection page (`features/selection/components/AnalyteSelectionPanel.tsx`) is the only consumer.
- `PlatformCard.tsx` is rendered by `PlatformSelector.tsx`. Both surfaces strip in the same phase change.
- Plate layout changes (`usePlateLayout`, `getDuplicatePair`, `computeSampleIndexMap`) are consumed by `PlateGrid.tsx`, `useWellSelection.ts`, and any test fixtures — no DB or IPC implications.

</code_context>

<specifics>
## Specific Ideas

### Concrete expected outputs (test fixtures)

**Duplicate layout — PRD reference (operator's mental model):**

| Col 4 (samples 1-4)       | Col 5 (samples 5-8)       | … | Col 12 (samples 33-36)     |
|---------------------------|---------------------------|---|----------------------------|
| (A4,B4) = sample 1        | (A5,B5) = sample 5        |   | (A12,B12) = sample 33      |
| (C4,D4) = sample 2        | (C5,D5) = sample 6        |   | (C12,D12) = sample 34      |
| (E4,F4) = sample 3        | (E5,F5) = sample 7        |   | (E12,F12) = sample 35      |
| (G4,H4) = sample 4        | (G5,H5) = sample 8        |   | (G12,H12) = sample 36      |

**Old-reagent math (per-reagent, with override OFF — within cap):**

| Inputs | Cap | New = Calc − Old | Total = Old + New + Dead |
|---|---|---|---|
| sampleCount=148, beadVPW=0.05, setups=1, oldBeads=0.5 | 0.20 × (7.4 + 2.0) = 1.88 mL | 7.4 − 0.5 = 6.9 mL | 0.5 + 6.9 + 2.0 = 9.4 mL (rounded UP at output) |
| sampleCount=148, beadVPW=0.05, setups=3, oldBeads=2.0 | 0.20 × (7.4 + 6.0) = 2.68 mL | 7.4 − 2.0 = 5.4 mL | 2.0 + 5.4 + 6.0 = 13.4 mL |

**Old-reagent math (override accepted, Old > Calc):**

| Inputs | Cap | New (clamped to 0) | Total |
|---|---|---|---|
| sampleCount=20, beadVPW=0.05, setups=1, oldBeads=5.0 (override of cap 0.6 mL) | 0.20 × (1.0 + 2.0) = 0.60 mL | max(0, 1.0 − 5.0) = 0 mL | 5.0 + 0 + 2.0 = 7.0 mL |

**Floor rounding on inputs:**

| Operator types | Field displays | Calculator uses |
|---|---|---|
| 1.51 | 1.51 | 1.5 |
| 1.59 | 1.59 | 1.5 |
| 1.50 | 1.50 | 1.5 |
| 0.04 | 0.04 | 0.0 (= 0) |
| 0.00 | 0.00 | 0.0 |

### Coexistence with shipped behavior

- Existing `numberOfSetups` field stays in `calculatorStore` (default 1). Phase 14 adds the UI; calc surface is unchanged.
- Existing manual well-click + drag behavior on `PlatePanel` continues to work — `getDuplicatePair` returns the new adjacent-row partner; the rest of the click/drag flow auto-adapts.
- Pre-Smoke-3 historical runs (saved before Phase 14 ships) reload through `runStore.loadRun`; the new `oldBeads`/`oldAntibodies` fields default to 0 if not present on the persisted run (SMK3-16 snapshot fidelity preserved).
- v0.7.0-imported panels (pre-Phase-13) coexist; their `volumePerWell` resolves to the legacy single-volume field. Phase 14 doesn't change panel data resolution.

### Override modal — concrete copy

```
┌─────────────────────────────────────────────────┐
│  Old Reagent Exceeds Recommended Limit          │
├─────────────────────────────────────────────────┤
│                                                 │
│  Old Beads: 2.5 mL                              │
│  Recommended max: 1.4 mL (20% of 7.0 mL total)  │
│                                                 │
│  Using more than 20% old reagent may affect     │
│  assay reliability. Are you sure?               │
│                                                 │
│              [ Cancel ]  [ Yes, override ]      │
└─────────────────────────────────────────────────┘
```

After override accepted, the input field shows an amber 'overridden' badge inline. The validationError banner clears.

### Test discipline

- Vitest under `src/renderer/src/lib/__tests__/`, `src/shared/constants/__tests__/`, `src/renderer/src/features/plate/__tests__/`, `src/renderer/src/features/calculator/__tests__/`.
- One new file per concern (see Canonical Refs §Tests).
- Update Phase 12's calculator.integration.test.ts to add Groups F (old-reagent subtraction) + G (20%-cap override flow).
- Snapshot test the duplicate layout: feed `sampleCount=36, replicateMode='duplicates', plateCount=1` to `usePlateLayout` and assert the 36-sample placement matches the table above.

</specifics>

<deferred>
## Deferred Ideas

### Punted to later phases or future milestones
- **Multi-premix selection** (PRD §Hierarchy "multiple premixes can be selected") — current `selectionStore.selectedPanelId` is a single ID. Phase 14 does NOT introduce multi-premix UI. If needed before UAT, file a follow-up.
- **Vendor singles term in UI** (VTRM-01, VTRM-02) — out of Smoke 3 scope; PRD silent; deferred to v2.1+.
- **Tooltip explaining the floor/ceiling asymmetry** — Claude's Discretion; add if planner thinks it's worth the surface area, otherwise skip.
- **Per-reagent override audit log** — record in the run document that an override was used, with the typed value and the cap. Belongs in Phase 15 (run-document audit trail / SMK3-15) rather than here.
- **Override re-prompt policy refinement** — D-10 says re-prompt on next focus. If lab feedback says "this is too sticky" or "this isn't sticky enough", revisit in v2.1.
- **Always-on per-input cap helper text vs. on-exceed only** — Claude's Discretion; if helper-text-always feels noisy, planner can switch to alert-on-exceed.
- **`Number of Plates` debounce vs blur-only commit** — Claude's Discretion; small UX detail.

### Open questions deferred to research / planning
- Whether `lib/calculator.ts` accepts `oldBeads` + `oldAntibodies` as new function parameters OR a separate `applyOldReagentSubtraction(outputs, …)` post-processing step. Researcher to recommend.
- Whether `calculatorStore.validationError` is sufficient for the 20%-cap state, or whether a structured `validationErrors: { oldBeads: string | null, oldAntibodies: string | null }` is needed for per-input red-border granularity. Planner to choose.
- Whether the override modal uses an existing modal primitive (if any exists in `features/manage/`) or a new bespoke one.

</deferred>

---

*Phase: 14-smoke-3-plate-page-input-expansion-ui-cleanup-inserted-2026-*
*Context gathered: 2026-05-12*
