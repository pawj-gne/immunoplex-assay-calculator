# Phase 15: Smoke 3 — Run Document Audit Trail — Context

**Gathered:** 2026-05-12
**Status:** Ready for planning

<domain>
## Phase Boundary

Deliver the finalized run document's full calculation work — the operator-facing audit trail (inputs → intermediates → outputs → diluent decision), SAPE Name display in the metadata header, PE volume computation (`Total Volume of the Assay ÷ SAPE concentration`), and snapshot-frozen treatment of historical runs with an advisory banner — so Phase 16 Windows UAT can verify SMK3-12, SMK3-15, SMK3-16, and SMK3-17 end-to-end on real lab hardware.

**In-scope:**
1. Schema delta on `runs` table to denormalize panel data captured at save time (SMK3-16 snapshot fidelity): `sapeName`, `sapeConcentration`, `beadsDiluent`, `antibodiesDiluent`, `beadsVolumePerWell`, `antibodiesVolumePerWell`, `premixConcentration` (the selected premix's concentration at save time, or null when no premix selected), `oldBeadsOverride`, `oldAntibodiesOverride`, `calculationRulesVersion` (new marker column).
2. `buildRunSnapshot` extension in [src/renderer/src/features/run/hooks/useRunSnapshot.ts](src/renderer/src/features/run/hooks/useRunSnapshot.ts) to fetch master-panel + master-panel-reagents at save time and populate the new fields.
3. New `Calculation Audit Trail` section in [src/renderer/src/features/run/components/FinalizedRunView.tsx](src/renderer/src/features/run/components/FinalizedRunView.tsx) rendered between `FinalizedRunHeader` and `PrepSheet`. Four sequential labeled blocks: Inputs, Intermediates, Outputs, Diluent decision. PRD-literal field mapping.
4. SAPE Name field added to `FinalizedRunHeader`'s metadata grid (SMK3-12).
5. PE volume formula (`finalVolume ÷ sapeConcentration`, default `1×` when null/0/undefined) computed in renderer at audit-trail render time, rendered in the Outputs block, rounded UP to 0.1 mL via the existing `ceilToTenthML` utility (SMK3-17).
6. Pre-Smoke-3 detection via `calculationRulesVersion !== 'smoke3'`; advisory banner ("This run was saved under previous calculation rules. Values displayed as recorded — no recompute on reopen.") renders above the audit trail.
7. Missing snapshotted fields render as `—` (em-dash) in their value cell; the historical-run banner provides explanatory context.
8. 20%-cap override badges rendered inline under the Old Beads / Old Antibodies lines in the Inputs block when `oldBeadsOverride` / `oldAntibodiesOverride` is true (deferred from Phase 14).
9. Diluent decision row uses branch label + per-reagent rows: top line names the rule applied (concentration-keyed wins / Values-table fallback), then a 2-row mini table shows each reagent's diluent string.

**Out-of-scope:**
- Wiring `resolveDiluent` into the live calculator output path — Phase 15 calls it for the audit-trail render only; the existing PrepSheet/VolumesSummary path keeps its current behavior. Reconciling the two displays is a future v1.x task.
- Updating Phase 3 `PrepSheet` / `VolumesSummary` to use the new PE volume formula — keeps Phase 4-04's read-only reuse contract intact.
- Master-panel renderer store / live IPC fetch path — snapshot-at-save makes this unnecessary for Phase 15. If a later phase needs live master-panel data in the renderer (e.g. for editing panels in-place), file it as a follow-up.
- Backfilling pre-Phase-15 historical runs' snapshotted fields — they stay null + render `—`. Banner explains why.
- Multi-premix handling in the audit trail (the resolver supports multi-premix-1× tiebreaker but `selectionStore` is still single-premix per Phase 14 — selectedPanelId is a single ID). Audit trail snapshots one premix's concentration; multi-premix can be revisited if/when Phase 14's selection model grows.
- Windows installer build + UAT — Phase 16.

</domain>

<decisions>
## Implementation Decisions

### Panel data flow — snapshot at save (SMK3-16 fidelity)

- **D-15-01:** Master-panel data reaches the audit trail by **snapshot-at-save**, not live fetch. The renderer reads `master_panels` + `master_panel_reagents` rows at save time, denormalizes the operator-visible fields onto the `runs` row, and the audit trail reads exclusively from `RunRecord`. SMK3-16 fidelity is automatic — re-importing a panel later does not rewrite history.
- **D-15-02:** Snapshot capture point = `buildRunSnapshot` in [src/renderer/src/features/run/hooks/useRunSnapshot.ts](src/renderer/src/features/run/hooks/useRunSnapshot.ts). Extends the existing pattern that already snapshots `volumePerWell`, `deadVolume`, `numberOfSetups`, `oldBeads`, `oldAntibodies` (Phase 12-04 / Phase 14-04). Renderer-side capture, single code path, mirrors what Save already does.
- **D-15-03:** Snapshotted fields on each new run (all nullable, default null at the DB layer so pre-Phase-15 rows tolerate the migration without backfill):
  - `sapeName: text` — from `master_panels.sape_name` (SMK3-12)
  - `sapeConcentration: real` — from `master_panel_reagents` where `reagent_kind = 'sape'` (SMK3-17)
  - `beadsDiluent: text` — from `master_panel_reagents` where `reagent_kind = 'beads'`, `.diluent` column (free text; SMK3-DIL-01 verbatim contract)
  - `antibodiesDiluent: text` — same shape, `reagent_kind = 'antibodies'`
  - `beadsVolumePerWell: real` — from `master_panel_reagents` where `reagent_kind = 'beads'`, `.volume_per_well`
  - `antibodiesVolumePerWell: real` — same shape, `reagent_kind = 'antibodies'`
  - `premixConcentration: real | null` — the selected premix's concentration at save time (read from `premix_panels.concentration` if it exists, else from `master_panel_reagents`); null when no premix was selected (custom assay). Needed so the audit trail can show "Panel III (1×) wins" on reopen.
  - `oldBeadsOverride: boolean (integer 0/1)` — true when the operator accepted the 20%-cap override for Old Beads at save time. Phase 14 deferred this to Phase 15.
  - `oldAntibodiesOverride: boolean (integer 0/1)` — mirror for Old Antibodies.
  - `calculationRulesVersion: text` — marker column. Default `'smoke3'` for new saves (any Phase 15 save). Pre-Phase-15 rows migrate with value `null` (or `'pre-smoke3'` — planner's call; the renderer treats anything except `'smoke3'` as pre-Smoke-3).
- **D-15-04:** Pre-Phase-15 historical runs lack the snapshotted fields. Audit trail tolerates null/undefined: every value cell renders `—` (em-dash). The historical-run banner from D-15-08 explains why. No backfill from current master-panel data — that would risk silent drift after a panel re-import.

### Audit trail rendering — location, style, fields

- **D-15-05:** Location = **new `<section>` between `FinalizedRunHeader` and `PrepSheet`** inside `FinalizedRunView`. Doesn't touch `PrepSheet`, `ReagentChecklist`, `BeadRegionList`, or `VolumesSummary`. Print-friendly (`@media print` styles inherited from `FinalizedRunView`).
- **D-15-06:** Style = **four sequential labeled blocks** with `<h3>` headings:
  1. Inputs
  2. Intermediates
  3. Outputs
  4. Diluent decision
  Each block uses the same 2-column definition-list (`<dl>`) layout that `FinalizedRunHeader` uses for metadata, for visual consistency.
- **D-15-07:** Field mapping per block = **PRD-literal** ([SMOKE-3-PRD.md](.planning/SMOKE-3-PRD.md) §Calculation; matches REQUIREMENTS.md SMK3-15 verbatim):
  - **Inputs:** plate count, sample count, replicate mode, premix selection (panel name + concentration), singles selection (count + names), old beads (mL, with override badge if overridden), old antibodies (mL, with override badge if overridden), number of setups.
  - **Intermediates:** total wells, beads vol/well, antibodies vol/well, dead volume (= setups × 2 mL), raw bead volume before old-reagent subtraction, raw antibodies volume before old-reagent subtraction.
  - **Outputs:** new beads, new antibodies, total bead volume, total antibody volume, PE volume.
  - **Diluent decision:** per D-15-09 below.
- **D-15-08:** Override badge under Inputs (deferred from Phase 14): inline amber `OVERRIDE` chip beside the Old Beads / Old Antibodies value rows when the corresponding `*Override` flag on the run record is true. Tooltip text: `This value exceeded the 20% recommended cap at save time; operator confirmed override.`
- **D-15-09:** Diluent decision row format:
  - **Top line (branch label):** Either `Rule applied: Concentration-keyed (Panel III @ 1× wins)` when the resolver picked a 1× premix as the diluent, or `Rule applied: Per-reagent fallback (no 1× premix in selection)` otherwise.
  - **Per-reagent rows:** 2-row mini table — `Beads diluent: <string>` / `Antibodies diluent: <string>`. Values are the verbatim strings from `beadsDiluent` / `antibodiesDiluent` snapshotted at save time (SMK3-DIL-01).
  - The branch label is derived at render time from the snapshotted `premixConcentration` (null or ≠ 1 → fallback branch; === 1 → concentration-keyed branch).

### Historical-run detection + advisory note

- **D-15-10:** Detection = **schema marker column** `runs.calculationRulesVersion`. Default `'smoke3'` for new saves. Existing rows in the live DB migrate with `null` (or `'pre-smoke3'`; planner picks the cleaner of the two). Renderer treats anything except `'smoke3'` as pre-Smoke-3 and renders the advisory banner.
- **D-15-11:** Advisory banner location = **above the audit trail**, between `FinalizedRunHeader` and the new audit-trail section. Yellow/amber background, banner-style (existing pattern for status indicators in the app, e.g. `OfflineBanner` from Phase 6 if it ships, or freshly built with a simple `bg-amber-50 border-amber-300 text-amber-900` Tailwind treatment). Copy: `This run was saved under previous calculation rules. Values displayed as recorded — no recompute on reopen.`
- **D-15-12:** Missing snapshotted-field handling = **em-dash placeholder** (`—`). Every value cell in the audit trail must tolerate null/undefined and render `—` when the field is absent. The banner from D-15-11 provides context.

### PE volume formula + edge cases

- **D-15-13:** PE volume input = **`finalVolume` (the 0.1-mL ceiling-rounded total)**. Operator's mental model: "the prep volume" ÷ SAPE concentration. Hand calc with displayed numbers reproduces the displayed PE volume.
- **D-15-14:** PE volume math: `PE volume (mL) = finalVolume (mL) / (sapeConcentration ?? 1)`. When `sapeConcentration` is null, undefined, or `0`, treat as `1×` per PRD note ("typically 1×"). Silent fallback — no banner, no warning, because the PRD calls 1× the common case. Pre-Phase-15 runs (which have `sapeConcentration: null`) get PE volume = finalVolume automatically.
- **D-15-15:** PE volume display location = **Outputs block of the audit trail only**. PrepSheet's existing `VolumesSummary` keeps its current Phase 3 SA-PE volume rendering untouched. Reconciling the two displays is a future v1.x task. Keeps Phase 4-04's read-only reuse contract intact.
- **D-15-16:** PE volume rounding = **ceiling-to-0.1-mL** via the existing `ceilToTenthML` utility in [src/renderer/src/lib/decimal.ts](src/renderer/src/lib/decimal.ts). Consistent with SMK3-06 — every output volume rounds UP to 0.1 mL. Operator never under-preps.

### Claude's Discretion

- **Audit trail component split.** Whether the audit-trail section lives as a single `AuditTrailSection` component inside `FinalizedRunView`, or splits into `AuditInputsBlock` / `AuditIntermediatesBlock` / `AuditOutputsBlock` / `DiluentDecisionBlock`. Recommendation: single component for v1.0 — fewer files, easier to read top-to-bottom. Split if any block grows over ~80 lines.
- **CSS naming for the override badge.** Reuse `bg-amber-100 text-amber-900 ring-1 ring-amber-300 px-1.5 py-0.5 rounded text-xs uppercase` or build a `<Badge variant="override">` primitive. Recommendation: inline Tailwind for v1.0 — single use site, no abstraction needed yet.
- **Whether the audit trail prints on `Ctrl-P`.** Default = yes (lives inside `FinalizedRunView`, picks up the existing print stylesheet). Planner can wrap in `@media print` guard if operators want to print only the prep recipe.
- **Migration column for `calculationRulesVersion` — null vs `'pre-smoke3'`.** Planner picks one; renderer treats both the same.
- **PE volume field name in the runs schema.** Phase 15 computes PE volume at render time, not at save time — so no new column for PE volume itself. Snapshotted SAPE concentration is enough. (Planner: confirm before writing the schema delta.)
- **Test discipline.** New audit-trail render tests live under `src/renderer/src/features/run/__tests__/FinalizedRunView.test.tsx` (or a sibling `AuditTrail.test.tsx`). Schema-delta tests extend `src/main/db/__tests__/migration.test.ts` with column-presence assertions for the 10 new columns. Snapshot-fidelity round-trip extends `run.test.ts` to assert each snapshotted field persists + reloads.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Authoritative product spec
- [.planning/SMOKE-3-PRD.md](.planning/SMOKE-3-PRD.md) §Calculation (PE volume formula, "Show all calculation work on the final document"); §Hierarchy → Second Step (premix/single selection semantics; TSC vs TA terms inform Inputs block labels)
- [.planning/INGEST-RESOLUTIONS.md](.planning/INGEST-RESOLUTIONS.md) — R-PE, R-SAPE-NAME, R-AUDIT, R-HIST decision lineage

### Requirements
- [.planning/REQUIREMENTS.md](.planning/REQUIREMENTS.md) §v2.1 Smoke 3 PRD Adoption → SMK3-12 (SAPE Name display), SMK3-15 (audit trail), SMK3-16 (snapshot-frozen historical runs), SMK3-17 (PE volume formula), SMK3-DIL-01 (verbatim diluent string contract)

### Roadmap entry
- [.planning/ROADMAP.md](.planning/ROADMAP.md) §Phase 15 — 4 Success Criteria (audit trail, SAPE Name display, PE volume formula, snapshot-frozen historical runs)

### Prior phase contexts (locked decisions, do NOT re-litigate)
- [.planning/phases/12-smoke-3-calculator-rules/12-CONTEXT.md](.planning/phases/12-smoke-3-calculator-rules/12-CONTEXT.md) — Phase 12 added 0.1-mL ceiling output rounding (SMK3-06) + `numberOfSetups` (SMK3-05) + the `resolveDiluent` resolver in [src/renderer/src/lib/diluentResolver.ts](src/renderer/src/lib/diluentResolver.ts). Phase 15 calls `resolveDiluent` for the audit-trail render only — does NOT change calculator math.
- [.planning/phases/13-smoke-3-panel-xlsx-parser-v3/13-CONTEXT.md](.planning/phases/13-smoke-3-panel-xlsx-parser-v3/13-CONTEXT.md) — Phase 13 introduced `master_panel_reagents` (per-reagent rows: beads / antibodies / sape with their own concentration + diluent + volume/well) and `master_panels.sape_name`. Phase 15 reads these at save time to populate the snapshot.
- [.planning/phases/14-smoke-3-plate-page-input-expansion-ui-cleanup-inserted-2026-/14-CONTEXT.md](.planning/phases/14-smoke-3-plate-page-input-expansion-ui-cleanup-inserted-2026-/14-CONTEXT.md) — Phase 14 added `oldBeads` / `oldAntibodies` to `calculatorStore`, 20%-cap override flow, and the deferred-items note routing the override-audit entry to Phase 15. Phase 14-08 added `oldBeads` / `oldAntibodies` / `numberOfSetups` columns to the `runs` table — Phase 15's schema delta sits on top of that migration (0008).
- [.planning/phases/16-windows-uat-release/16-CONTEXT.md](.planning/phases/16-windows-uat-release/16-CONTEXT.md) — Phase 16 UAT exercises Phase 15's output in Section A Step 8 (reopen-and-verify-snapshot) and Section B rows SMK3-12 / SMK3-15 / SMK3-16 / SMK3-17. Phase 15 is a hard precondition for Phase 16.

### Codebase locations — read before modifying
- [src/renderer/src/features/run/components/FinalizedRunView.tsx](src/renderer/src/features/run/components/FinalizedRunView.tsx) — composes the run document. Phase 15 adds the audit-trail section between header and PrepSheet, and the historical-run banner above the audit trail.
- [src/renderer/src/features/run/components/FinalizedRunHeader.tsx](src/renderer/src/features/run/components/FinalizedRunHeader.tsx) — metadata grid (lines 70-138). Add SAPE Name row (D-15-03 SMK3-12).
- [src/renderer/src/features/run/hooks/useRunSnapshot.ts](src/renderer/src/features/run/hooks/useRunSnapshot.ts) — `buildRunSnapshot`. Extend per D-15-02 to fetch master-panel + master-panel-reagents and write the new fields. Phase 14-04 pattern (`oldBeads`/`oldAntibodies`/`numberOfSetups`) is the closest analog.
- [src/renderer/src/stores/runStore.ts](src/renderer/src/stores/runStore.ts) — `loadRun` reapply pattern (Phase 12-04 + 14-04). Audit-trail data is rendered from `RunRecord` directly; no reapply into a store needed (audit trail is computed-from-record at render time).
- [src/shared/types/run.ts](src/shared/types/run.ts) — `RunRecord` + `RunCreate` interfaces. Add the new optional fields (all nullable). Mirror the comment style Phase 14 used.
- [src/main/db/schema.ts](src/main/db/schema.ts) — `runs` table. Add the 10 new columns per D-15-03. All nullable, no NOT NULL constraints so the migration tolerates pre-Phase-15 rows.
- [src/main/db/repositories/run.ts](src/main/db/repositories/run.ts) — `runRepository.create()` + `update()`. Extend to write the new columns when supplied. Phase 14-08 added `numberOfSetups`/`oldBeads`/`oldAntibodies`; same pattern.
- [src/main/db/repositories/masterPanel.ts](src/main/db/repositories/masterPanel.ts) — read methods for the renderer save-time snapshot fetch. May need a new method (e.g. `getByPlatformSpeciesWithReagents`) that returns the master panel + its reagents in one call.
- [src/main/ipc/](src/main/ipc/) — may need a new IPC channel (`MASTER_PANEL_GET_BY_PLATFORM_SPECIES`) so the renderer can fetch at save time. Planner to confirm whether one already exists (Phase 13 may have added one for the importer flow).
- [src/preload/index.ts](src/preload/index.ts) — preload bridge for the new IPC channel.
- [src/renderer/src/lib/diluentResolver.ts](src/renderer/src/lib/diluentResolver.ts) — `resolveDiluent` from Phase 12. Audit trail calls this at render time to produce the branch label (`Concentration-keyed (Panel III @ 1× wins)` vs `Per-reagent fallback`). Accepts structural input — won't drag in `PremixPanel` / `Analyte` types.
- [src/renderer/src/lib/decimal.ts](src/renderer/src/lib/decimal.ts) — `ceilToTenthML` for PE volume rounding (D-15-16).
- [src/main/db/migrations/](src/main/db/migrations/) — Phase 15 generates migration 0009 (assuming 0008 is the Phase 14-08 runs schema delta). Planner runs `drizzle-kit generate` and verifies migration name.

### Tests to extend / add
- Existing: [src/renderer/src/lib/__tests__/calculator.integration.test.ts](src/renderer/src/lib/__tests__/calculator.integration.test.ts) — extend with a Group M for PE volume math (typical 1× SAPE → PE volume = finalVolume; 0.5× SAPE → PE volume doubled; null SAPE → PE volume = finalVolume).
- New: `src/renderer/src/features/run/__tests__/FinalizedRunView.audit-trail.test.tsx` — renders a Smoke 3 run + asserts every Inputs/Intermediates/Outputs/Diluent line is present with the expected values; renders a pre-Phase-15 run + asserts the banner appears + every snapshotted field renders `—`.
- New: `src/renderer/src/features/run/__tests__/useRunSnapshot.audit.test.ts` — given a fixture master-panel with known SAPE/diluent/vol-per-well values, `buildRunSnapshot` populates the new fields on the returned `RunCreate` payload.
- Extend: [src/main/db/__tests__/migration.test.ts](src/main/db/__tests__/migration.test.ts) — column-presence assertions for the 10 new columns; round-trip assertion that pre-Phase-15 rows survive the migration with the new columns set to null.
- Extend: [src/main/db/__tests__/run.test.ts](src/main/db/__tests__/run.test.ts) — round-trip assertions for each of the 10 new fields.

### Project-level invariants
- [CLAUDE.md](CLAUDE.md) — commit protocol (dev/v1-01 branch; Conventional Commits; three-strike debug rule; Windows-only deployment so test cycle is `npm run build:win` → install on Windows workstation).
- [.planning/PROJECT.md](.planning/PROJECT.md) §Domain Rules — Smoke 3 PRD source of truth; PE volume formula; SMK3-DIL-01 verbatim diluent contract.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`buildRunSnapshot`** ([src/renderer/src/features/run/hooks/useRunSnapshot.ts](src/renderer/src/features/run/hooks/useRunSnapshot.ts)) — Phase 12-04 + Phase 14-04 already use this for `numberOfSetups`/`oldBeads`/`oldAntibodies`. Phase 15 extends with the panel-data snapshot fetch (master_panel + master_panel_reagents).
- **`resolveDiluent`** ([src/renderer/src/lib/diluentResolver.ts](src/renderer/src/lib/diluentResolver.ts)) — Phase 12-02 module. Audit trail calls it at render time with the snapshotted `premixConcentration` + diluent strings. Accepts structural input (`name` + `concentration`), zero coupling to PremixPanel/Analyte types.
- **`ceilToTenthML`** ([src/renderer/src/lib/decimal.ts](src/renderer/src/lib/decimal.ts)) — for PE volume rounding (D-15-16).
- **`FinalizedRunHeader`'s `<dl>` definition-list layout** — reuse the exact same 2-column grid styling for the audit-trail blocks (D-15-06).
- **Phase 14-08 migration pattern** — adding nullable columns to `runs` with `DEFAULT` clauses + extending `runRepository.create/update` to write them is the closest analog Phase 15 follows. Migration 0008 is the precedent.
- **`OfflineBanner`-style amber banner** (if Phase 6 ships before Phase 15 — unlikely on the current roadmap). Fall back to Tailwind `bg-amber-50 border-amber-300 text-amber-900` for the historical-run advisory.

### Established Patterns
- **Snapshot fidelity via runStore.loadRun's reapply pattern** — Phase 12-04 + Phase 14-04 store every Smoke-3-relevant field as raw data on the run; loadRun cascades it back into the renderer stores. Phase 15's snapshotted fields go straight onto `RunRecord` and are read from there at render time, not reapplied into any store. This is intentional — audit-trail data is RENDER-ONLY, never user-editable, so no store roundtrip needed.
- **Nullable-with-default migration pattern** — Phase 14-08's migration 0008 added `number_of_setups REAL NOT NULL DEFAULT 1`, `old_beads REAL NOT NULL DEFAULT 0`, etc. Phase 15 follows the same shape, except SAPE/diluent/premix fields default to `NULL` because there's no sensible numeric default.
- **Verbatim diluent string handling** — Phase 12-02's T-B3 test locks in the SMK3-DIL-01 contract: diluent strings round-trip with whitespace + case preserved. Phase 15 snapshots them verbatim; the audit trail renders them verbatim too.
- **Conditional badge inline in metadata grid** — `FinalizedRunHeader` already conditionally renders `(hidden)` after the operator name when the operator is soft-deleted. Same pattern for the override badge under Old Beads / Old Antibodies in the Inputs block.

### Integration Points
- **`FinalizedRunView` is mounted by `App.tsx` as wizard step 5.** Phase 15 changes the composition (adds banner + audit-trail section + SAPE Name row in header). No routing changes.
- **`useRunSnapshot` is called by `DocumentAndSavePage.tsx`** — the existing Save handler already handles "build returns error" gracefully. Phase 15's added master-panel fetch + snapshot must surface failures the same way (returns `{ error: '...' }` rather than throwing).
- **The `runRepository.create` + `update` IPC chain** — renderer → preload `runs.create` / `runs.update` → main IPC handler → repository → SQLite. Phase 14-08 already extended this chain for `numberOfSetups`/`oldBeads`/`oldAntibodies`; Phase 15 extends it again for the 10 new fields.
- **Phase 16 UAT touches the audit trail** — any change to field labels, banner copy, or block ordering between Phase 15 ship and Phase 16 plan time invalidates Section A Step 8 + Section B SMK3-15 row. Phase 16 plan must read Phase 15's final field list before locking the UAT script copy.

</code_context>

<specifics>
## Specific Ideas

### Concrete expected audit-trail output (worked example)

Input run (matches PRD Thermofisher Human Panel 1 worked example, 2 plates of 100 samples, 1 setup, no old reagents, no overrides):

```
Calculation Audit Trail

1. Inputs
   Plates                 2
   Sample count           100
   Replicate mode         Singles
   Premix selection       Panel I (1×)
   Singles selection      3 (IL-2, IFN-γ, IL-17)
   Old beads              0.0 mL
   Old antibodies         0.0 mL
   Number of setups       1

2. Intermediates
   Total wells            196 (148 unknown + 48 standard)
   Beads vol/well         0.05 mL
   Antibodies vol/well    0.025 mL
   Dead volume            2.0 mL (= 1 setup × 2 mL)
   Raw bead volume        9.8 mL (= 196 × 0.05, before subtraction)
   Raw antibody volume    4.9 mL (= 196 × 0.025, before subtraction)

3. Outputs
   New beads              9.8 mL
   New antibodies         4.9 mL
   Total bead volume      9.8 mL (= new + old)
   Total antibody volume  4.9 mL
   PE volume              9.8 mL (= 9.8 mL ÷ 1×)

4. Diluent decision
   Rule applied:          Concentration-keyed (Panel I @ 1× wins)
   Beads diluent          Panel I
   Antibodies diluent     Panel I
```

For a pre-Phase-15 historical run, the banner above the audit trail renders:

```
⚠ This run was saved under previous calculation rules.
   Values displayed as recorded — no recompute on reopen.
```

And the SAPE Name row in `FinalizedRunHeader`, plus every snapshotted-field cell in the audit trail's Inputs/Intermediates/Outputs/Diluent blocks, renders `—`.

### Override badge example

When `oldBeadsOverride = true` on the run record, the Old beads line renders:

```
   Old beads              2.5 mL  [OVERRIDE]
```

Where `[OVERRIDE]` is a small amber chip. Tooltip on hover: `This value exceeded the 20% recommended cap at save time; operator confirmed override.`

### PE volume edge cases (covered by Group M tests)

| `finalVolume` | `sapeConcentration` snapshot | PE volume rendered |
|---|---|---|
| 9.8 mL | 1.0 | 9.8 mL |
| 9.8 mL | 0.5 | 19.6 mL |
| 9.8 mL | 2.0 | 4.9 mL |
| 9.8 mL | null (pre-Phase-15) | 9.8 mL (silent default to 1×) |
| 9.8 mL | 0 (malformed panel data) | 9.8 mL (silent default to 1×) |
| 9.8 mL | undefined | 9.8 mL (silent default to 1×) |
| 9.83 mL (pre-ceiling) | 1.0 | 9.9 mL (ceiling-to-0.1-mL applied after division) |

### Diluent decision branch examples

| `premixConcentration` snapshot | Branch label rendered |
|---|---|
| 1.0 + selectedPanelId set | `Rule applied: Concentration-keyed (<panel name> @ 1× wins)` |
| 5.0 + selectedPanelId set | `Rule applied: Per-reagent fallback (no 1× premix in selection)` |
| null (no premix selected — custom assay) | `Rule applied: Per-reagent fallback (no premix selected)` |

</specifics>

<deferred>
## Deferred Ideas

### Punted to later phases or future milestones
- **Wiring `resolveDiluent` into the live calculator output path** — Phase 15 calls it for audit-trail render only; PrepSheet's VolumesSummary keeps its current Phase 3 behavior. Reconciling the two displays is a future v1.x task once the lab is using the audit trail in production.
- **Updating PrepSheet's VolumesSummary to use the new PE volume formula** — keeps Phase 4-04's read-only reuse contract intact; reconcile later.
- **Master-panel renderer store / live IPC fetch path** — snapshot-at-save makes this unnecessary for Phase 15. File as follow-up if a later phase needs editable master-panel data in the renderer.
- **Backfilling pre-Phase-15 historical runs' snapshotted fields** — would risk silent drift after a panel re-import. Banner + em-dash is the v1.0 strategy.
- **Multi-premix snapshotting** — `selectionStore` is still single-premix per Phase 14. The audit trail snapshots one `premixConcentration`. If/when Phase 14's selection model grows to multi-premix, revisit how the audit trail shows multi-premix tiebreaker logic.
- **Audit trail printability toggle** — defaulting to "yes, prints with `Ctrl-P`." If operators want prep-recipe-only printing, add a toggle in v1.x.
- **Snapshot freshness check on save** — Phase 15 fetches master-panel data once at save time; if a parallel re-import happens between fetch and INSERT, the snapshot could be stale. Tolerable for v1.0 (single-machine app); revisit if Phase 6 networking ships and concurrent re-imports become possible.

### Open questions deferred to research / planning
- IPC channel naming for the save-time master-panel fetch (`MASTER_PANEL_GET_BY_PLATFORM_SPECIES` vs reusing an existing one if Phase 13 already exposed it). Researcher to verify.
- Whether the schema marker column value for pre-existing rows is `null` or `'pre-smoke3'` (renderer treats them the same; planner picks the cleaner of the two).
- Whether `premixConcentration` reads from `premix_panels.concentration` (if that column exists post-Phase-13) or from `master_panel_reagents` keyed off the panel's master_panel_id. Researcher to confirm the Phase 13 schema shape.
- Audit-trail component split: single `AuditTrailSection.tsx` vs four block-component files. Recommendation: single component for v1.0.

</deferred>

---

*Phase: 15-smoke-3-run-document-audit-trail-inserted-2026-05-11*
*Context gathered: 2026-05-12*
