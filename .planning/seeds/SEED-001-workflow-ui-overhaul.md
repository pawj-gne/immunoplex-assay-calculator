---
id: SEED-001
status: dormant
planted: 2026-06-22
planted_during: v1.0 Smoke 3 Release — Phase 16 (Windows UAT & Release)
trigger_when: After v1.0.0 ships to the lab PC and operators have used it for ~1–2 weeks of real assay setup work
scope: Large
---

# SEED-001: Workflow UI overhaul — re-sequence the app around the bench workflow

## Why This Matters

Today's screen order was driven by **data-model dependencies** (platform → species → panel → analytes → samples → plate), not by **how an operator actually sets up a plate at the bench**. Operators have to mentally translate between the order they think in and the order the app forces, which adds cognitive load and slows first-time use.

The overhaul re-sequences screens, navigation, and inputs around the real bench workflow so the app feels like an assistant walking alongside the operator instead of a form to be filled in dependency order.

This is a **product-shape change**, not a coat of paint — affects routing, screen composition, navigation primitives, and likely the selection store. It is NOT a Phase 3.3-style single-screen redesign.

## When to Surface

**Trigger:** After v1.0.0 ships to the lab PC and operators have used it for ~1–2 weeks of real assay setup work.

This seed should be presented during `/gsd-new-milestone` when the milestone scope matches any of these conditions:
- The next milestone is being framed around **operator feedback** from real v1.0 use
- The next milestone touches **navigation, screen flow, page composition, or selection store ordering**
- The next milestone is the **first v1.1+ feature milestone** after the v1.0 lab rollout settles
- The conversation mentions any of: "workflow", "friction", "screen order", "wizard", "ux", "operator usability", "training time"

## Scope Estimate

**Large** — A full milestone of its own (likely v1.2 or v2.0 — sequencing TBD relative to Phase 6 Network Layer, Phase 7 Audit Trail, and the Master-Panel v2.0 arc).

Anticipated phase shape (NOT a commitment — to be derived at milestone-planning time from actual lab feedback):
- Phase A: Bench-workflow audit — observe / interview lab use of v1.0, produce a documented "real workflow order"
- Phase B: Information architecture redesign — route map, screen inventory, selection-store reshape
- Phase C: Screen-by-screen rebuild aligned to the new order, applying the Phase 3.3 visual-grid pattern consistently
- Phase D: Navigation primitives (back/forward through the workflow, save/resume mid-flight, finalize → run-document handoff)
- Phase E: UAT against the same lab PC + operators that surfaced the friction

## Breadcrumbs

Related code, decisions, and context in the current codebase at plant time:

- `.planning/phases/03.3-analyte-selection-redesign/` — Phase 3.3 was a single-screen visual-grid redesign; informs the **visual** target but did NOT touch workflow order. The rest of the app has not caught up.
- `src/renderer/` — current route structure / screen composition (platform → species → panel → analytes → samples → plate flow)
- `src/renderer/stores/selectionStore.*` — selection ordering is currently encoded here; a workflow re-sequence almost certainly reshapes this store
- `.planning/PROJECT.md` §Current Milestone — locked to v1.0 Smoke 3 Release as of plant time; this seed deliberately defers until that ships
- `.planning/ROADMAP.md` — Phase 6 (Network Layer / v1.1), Phase 7 (Audit Trail / v1.2), and Phases 8–11 (v2.0 Master Panel arc) are the existing post-v1.0 commitments — this seed competes with them for milestone slot ordering
- `.planning/phases/16-windows-uat-release/16-SMOKE-TEST-GUIDE.md` — the Smoke 3 UAT script is itself an implicit record of the current workflow; comparing it to operator notes post-UAT will produce the "real workflow order" input for Phase A above

## Notes

- Planted while Phase 16 Wave 1 was in progress; the user initially invoked `/gsd-new-milestone "workflow UI overhaul"` but v1.0 is not yet shipped — seeding rather than committing the new milestone preserves the idea without disturbing the active release work.
- The "Match real lab workflow order" framing was chosen deliberately over "modernize visual design" — visual modernization can ride along but is not the driver.
- When this seed surfaces, re-evaluate whether it should be **v1.2 (slot in before Audit Trail)** or **v2.0+ (slot in after Master Panel arc)** based on which user value is more pressing at that moment.
- Consider whether parts of this should land **incrementally** alongside other milestones (e.g. a navigation primitive built during the Network Layer milestone) vs being held back as a single coherent overhaul.

---

## Colleague Feedback — 5-Step Walkthrough (captured 2026-06-22 / 2026-06-23)

The user's colleague provided page-by-page feedback for a 5-step linear wizard, with annotated screenshots of how they want each page to look. This section captures the spec verbatim of intent (not pixel-perfect) so that at milestone-planning time it can be translated into a phase breakdown.

**Workflow shape:** 5 sequential steps. Wizard footer shows "Step N of 5 — [section title]" with Previous / Next buttons. Single linear flow; no branching.

### Step 1 — Platform / Species / Panel (single page)

**Today:** Platform / Species / Panel are spread across separate screens.

**Desired:**
- All three selectors live on **one page**, stacked in order: Platform → Species → Panel.
- Keep existing control treatments: Platform = large cards with vendor descriptions; Species + Panel = compact pill buttons.
- Keep existing progressive-enable behavior (later selectors react to earlier choices).
- Keep the green confirmation echo under each selector ("Platform Selected: Millipore", etc.) — visual elements function as today, just rearranged.
- Single "Next →" at bottom-right of the page.

**Nature of change:** IA / page consolidation only. Not a control redesign.

---

### Step 2 — Analyte selection

**Today:** Premix panel list shows premixes from ALL panels (regardless of Step 1's Panel choice); analyte grid shows all analytes globally; selecting a premix filters the analyte grid to **only** the premix members (wrong — blocks adding singles).

**Desired (consolidated 2a–2d):**

1. **Scope premixes + analytes to the selected (Platform, Species, Panel) tab.** This maps 1:1 to the imported xlsx tab structure (per Phase 13 parser). Setup-time concern only — no impact on historical saved runs (those stay snapshot-frozen per Phase 15).
2. **Remove the "No Premix (Custom Assay)" tile entirely.** Individual analyte selection works on its own — the tile was redundant noise.
3. **Premix selected → its members auto-fill the "Selected Analytes" panel on the right**, and are **locked**. Domain reason: a premix is one physical vial — its members come pre-mixed and cannot be cherry-picked apart. (This is a vial-level constraint, not a UI choice.)
4. **Tile grid below shows the remaining (Panel \\ premix) analytes** — selectable as additional singles, subject to the existing CALC-05 max-5-singles cap (Phase 12).
5. **Premix-claimed analytes still appear in the tile grid but greyed/disabled** with a distinct visual treatment ("already in your premix").
6. **Deselecting the premix** clears the auto-filled members and restores the empty Selected Analytes state + full Panel analyte grid.

**Nature of change:** Scoping bug-fix + selection-model change. Not just visual.

---

### Step 3 — Calculator inputs

**Today:** Calculator inputs page also hosts well selection + plate visualization; old-volume inputs exist (Phase 14) but the calculator doesn't subtract them from new-volume calc; round-up rule is "to nearest 0.1 mL" (Phase 12).

**Desired (consolidated 3a–3f):**

**Inputs only** (in this order):
- Number of Plates
- Replicate Mode (Singles / Duplicates / Triplicates — 72 / 36 / 24 wells/plate)
- Number of Samples
- Old Bead Volume (mL)
- Old Antibody Volume (mL)
- Number of Setups

**No "Old SA-PE Volume" input** — SA-PE is returned to the bottle each time; no old/new distinction needed.

**Removed:**
- Well selector — the calculator runs **before** samples are submitted, so the operator doesn't know the well layout yet. Only sample count is needed for the math.
- Plate visualization — disappears from the calculator flow entirely. Also disappears from the run document (at least for now — could come back later).

**Hamilton field** — also removed from this milestone. A dedicated Hamilton-assignment feature is deferred (see SEED-002 candidate below).

**Constraints:**
- **Hard cap: ≤20 total plates** per day (5 Hamiltons × 4 plates each — lab's physical capacity).
- **Setup × Plates matrix** (from the colleague's Yes/No table):
  - 1 setup: 1–4 plates
  - 2 setups: 2–8 plates
  - 3 setups: 3–12 plates
  - 4 setups: 4–16 plates
  - 5 setups: 5–20 plates
  - **Rule:** `setups ≤ plates ≤ setups × 4` (each setup gets at least 1 plate and at most 4 plates)
- **Hard-block invalid combos** on Next. Dynamic UI — Plates and Setups dropdowns constrain each other in real time (typing a value in one narrows the other's valid options).
- **Number of Samples** is independent — not constrained by the setup matrix. Free entry, trust operator.

**Old-volume UX (new pattern):**
- First ask: "Old volume available? Yes / No"
- If Yes: input field appears with a suggestion alongside showing the max allowed (20% of total today's prep).
- If No: input defaults to 0 and the field doesn't appear.
- The 20% cap is the hard rule: no more than 20% of today's total reagent volume can come from old/leftover reagent. New reagent volume = total − old.

**Setup definition (domain glossary):** "a setup is one complete run of the calculator. A setup includes all the samples for that calculation, which can span multiple plates." (Maps conceptually 1:1 to a Hamilton run, even though Hamilton-machine assignment is deferred.)

**Show calculation work** on the page (and on Step 5, and on the saved run document — all three, to be pruned later once we see what's actually useful). Three blocks per reagent class:

1. **Grey block — per-reagent math:**
   - `Reagents` = volume per well of that reagent
   - `Reagents total` = per-well × number of samples
   - `Dead volume` = 2 mL × Hamiltons used (= 2 mL × setups, given Setup ↔ Hamilton 1:1)
   - `Reagents + dead` = total prep volume for that reagent, rounded **UP to nearest 1.0 mL** (the "top-off")
2. **Yellow block — new reagent volumes:**
   - `Vol of New Reagents (Beads)` = total − old beads
   - `Vol of New Reagents (Abs)` = total − old antibodies
   - `Reagent Concentration: 20X` (label — beads + antibodies arrive at 20X stock)
3. **Blue block — round-up + top-off:**
   - For Beads + Antibodies (20X reagents): per-analyte stock volume (e.g. 400 µL) + buffer top-off (e.g. 7.6 mL) → per-analyte 1X working volume (8 mL).
   - For SA-PE (1X reagent): total volume only, no per-analyte split, no top-off column.

**Reagent classes tracked:** Beads (a.k.a. Capture Beads), Antibodies (a.k.a. Detection Antibodies), SA-PE. Already present in the calculator as `saPEVolumeUL` / `saPEVolumeML` in [src/shared/types/calculator.ts:127-130](src/shared/types/calculator.ts#L127). SA-PE = Streptavidin-Phycoerythrin = "PE" in colleague's screenshots.

**Bug surfaced by Step 3 screenshots (3f):**
- With 174 wells × 0.025 mL/well + 4 mL dead volume = 8.35 mL total, **current calculator output** shows 420 µL per analyte (= 8.4 mL ÷ 20, i.e. rounded to **0.1 mL**) with NO deduction for the 1 mL of old reagent the operator entered.
- **Desired output** = 400 µL per analyte (= 8 mL ÷ 20, where 8 mL = round-up of 8.35 to **nearest 1.0 mL** = 9 mL, then minus 1 mL old = 8 mL new).
- **Two distinct issues in one screenshot:** (a) round-up rule (1.0 mL desired, 0.1 mL current per Phase 12); (b) old-volume input is captured but never subtracted from new-volume calculation.
- The "20% cap: 1.4 mL" hint shown in the screenshot is also wrong — 20% of 9 mL = 1.8 mL, not 1.4 mL. Hint is being computed against the wrong base.
- **Bug intercept candidate:** the missing old-volume deduction (and possibly the 20%-cap hint) may be small enough to fix in a v1.x patch ahead of the full overhaul. The round-up rule discrepancy is bigger — needs colleague confirmation before changing Phase 12's locked rule.

---

### Step 4 — Documentation entry

**Today:** [RunMetadataForm.tsx](src/renderer/src/features/run/components/RunMetadataForm.tsx) collects run metadata including `sampleType`, `dilutionFactor`, `hamilton`, `runPlatePosition`, `standardPosition`. [DocumentAndSavePage.tsx](src/renderer/src/features/run/components/DocumentAndSavePage.tsx) hosts the form + save action.

**Desired field list (in order, locked):**

1. **Request Number** — operator-entered. Should be captured **at the beginning** of the workflow (Step 1 or pre-Step 1), displayed read-only on Step 4. Treat as a workflow-routing change, not just an additive field.
2. **Requester (User)** — separate identity from Operator. New field.
3. **Operator** — likely already exists.
4. **Date** — auto / today.
5. **Platform** — read-only echo from Step 1.
6. **Species** — read-only echo from Step 1.
7. **Panel** — read-only echo from Step 1.
8. **Sample Type** — already exists.
9. **Sample count** — read-only echo from Step 3.
10. **Replicate mode** — read-only echo from Step 3.
11. **Plate Count** — read-only echo from Step 3.
12. **Dilution Factor** — already exists.
13. **Comments** — likely already exists.

**Fields removed:**
- `hamilton` — deferred to a future Hamilton-assignment feature.
- `runPlatePosition` — tied to the now-removed well selector.
- `standardPosition` — tied to the now-removed well selector.

**Derived fields are read-only on Step 4** — no last-mile edits. To change Platform / Samples / etc., operator goes back to the relevant step.

---

### Step 5 — Output

**Three artifacts assembled:**
1. **Documentation from Step 4 UI** — the captured form data.
2. **Table of Bead Regions** — table mapping each selected analyte to its bead region number (the red-circle numbers visible in Step 2 screenshots — `81`, `14`, `55`, etc.). The bead region data already lives in the analyte records; this table just surfaces it as a printable / saveable artifact.
3. **Calculation documentation** — the grey/yellow/blue blocks from Step 3's calc-work display, rendered into the saved run document.

**Step 5 spec is otherwise "as is for now"** — awaiting further instructions from the colleague before locking it down. Likely contains save / print / export actions.

---

### Cross-cutting open questions (resolve at milestone-planning time, NOT now)

1. **Round-up rule discrepancy** — Phase 12 says "round up to 0.1 mL"; colleague says "round up to 1.0 mL". Resolve which rule wins (or whether both apply at different stages: 0.1 mL for intermediates like Reagents total + per-analyte buffer top-off, 1.0 mL for final prep volumes). **Confirm with the colleague before changing Phase 12's locked rule.**
2. **Multi-setup handling** — the dead-volume math uses Number of Setups (`setups × 2 mL`) per Phase 12, but the rest of the multi-setup behavior is unclear. Does each setup produce its own per-setup recipe breakdown? One combined recipe? Per-setup volume sheet? Needs explicit spec when this milestone is planned.
3. **Where exactly does Request Number get captured?** Step 1 alongside Platform/Species/Panel, or a separate pre-Step 1 ("Request Setup") step? Affects whether the workflow is genuinely 5 steps or 5 + pre.
4. **Plate visualization permanence** — colleague said removed "at least for now." Whether it stays removed forever or comes back in a later milestone (e.g. as a side-by-side optional view) is undecided.

---

### Bug-shaped items potentially worth intercepting in v1.x (before the full overhaul)

These are independently shippable if scoped right — none of them require the full UI re-sequence to land:

| Bug | Phase context | Notes |
|---|---|---|
| Old volume not subtracted from new-volume calc | Phase 14 added the Old Bead / Old Antibody inputs; deduction logic never landed | Could be a v1.1 patch if the round-up rule discrepancy is also resolved |
| 20%-cap hint shows wrong number | Phase 14 | "20% cap: 1.4 mL" against 9 mL total — cap is computed against wrong base |
| Premix selection filters analyte grid to only members | Phase 14 / selection store | Currently blocks adding singles when a premix is selected — domain violation (premix + up to 5 singles is allowed) |
| Premix list shows all panels' premixes (not scoped to selected Panel) | Phase 14 | Setup-time-only concern |

**Decision deferred:** whether these intercept v1.0 (delay the release), v1.1 (after Phase 6 Network Layer), or wait for the full overhaul. Re-evaluate at recall time.

---

### Sequel-seed candidates

When this seed surfaces, also consider planting (or have already planted):

- **SEED-002: Hamilton liquid-handler assignment** — UI for assigning specific Hamilton machines (1–5) to setups, replacing the removed `hamilton` form field. Probably small (a phase), but worth its own seed because it has independent trigger conditions (e.g. when the lab adds a 6th Hamilton, or when audit-trail needs per-machine traceability).
- **SEED-00X: Plate-visualization return** — if operators miss the visual plate layout after this overhaul ships, capture the asks and re-introduce it as an optional view.
