# Immunoplex Assay Calculator — Workflow UI Overhaul Proposal

**For review by:** [Colleague name]
**Prepared by:** Jonathan Paw
**Drafted:** 2026-06-24
**Status:** ⏳ Awaiting approval before code changes begin

---

## What this document is

A page-by-page proposal capturing the workflow UI changes you walked through, restructured into a single 5-step wizard. **Nothing in the app has been touched yet** — this is the design intent, written down for sign-off so we don't end up correcting it in code review (or worse, after the lab is using it).

For each step you'll find:
1. **What stays / what changes** — plain English
2. **Proposed mockup** — see the clickable preview (link below)
3. **Confirmation box** — your sign-off
4. **Notes / questions** — write back any concerns

At the end:
- **Open questions** that only you can answer
- **Bugs found** during the walkthrough — for each, a "patch in v1.1 vs wait for the full overhaul" decision

---

## 🖥️ Clickable mockup

Open the companion HTML file in any browser to walk through the proposed wizard:

📂 [`.planning/proposals/UI-OVERHAUL-MOCKUPS.html`](UI-OVERHAUL-MOCKUPS.html)

The mockup is interactive — click the step buttons at the top, or use the Next / Previous buttons at the bottom of each page. It's a single self-contained HTML file with no dependencies; just double-click to open.

---

## Overall workflow shape

```
  ┌─────────┐     ┌──────────┐     ┌────────────┐     ┌───────────────┐     ┌────────┐
  │ Step 1  │ ──► │  Step 2  │ ──► │   Step 3   │ ──► │    Step 4     │ ──► │ Step 5 │
  │Platform │     │ Analytes │     │ Calculator │     │ Documentation │     │ Output │
  │ Species │     │          │     │   Inputs   │     │     Entry     │     │        │
  │  Panel  │     │          │     │  + Work    │     │               │     │        │
  └─────────┘     └──────────┘     └────────────┘     └───────────────┘     └────────┘
```

Five sequential steps. Each step has Previous / Next buttons at the bottom. Wizard footer shows "Step N of 5 — [section title]". No skipping ahead — fields validate before Next is enabled.

---

## Step 1 — Platform, Species & Panel

> Mockup: open `UI-OVERHAUL-MOCKUPS.html` → click **Step 1 — Platform / Species / Panel**

### What stays the same
- Platform cards with vendor name + description (Millipore, Bio-Rad, Thermofisher)
- Species pills (Mouse / Human / Rat)
- Panel pills (Panel 1 – 5)
- Green confirmation echo under each selector ("Platform Selected: Millipore", etc.)
- Progressive enable behavior — Species options react to Platform, Panel options react to Species

### What changes
- All three selectors (Platform, Species, Panel) now live on **one page** instead of three separate screens
- **New field added at the top: Request Number** — moved here from Step 4 per your "should be entered at the beginning" feedback
- Single "Next →" button at the bottom replaces three separate "Next" actions

### ✅ Confirmation

> ☐ **Approved as drawn**
> ☐ **Approved with notes** (write below)
> ☐ **Reject** (write below)

**Notes from colleague:**

```
[Your notes here]
```

---

## Step 2 — Analyte Selection

> Mockup: open `UI-OVERHAUL-MOCKUPS.html` → click **Step 2 — Analytes**

### What stays the same
- Premix panels shown as pill buttons
- Analyte grid with bead region badge + concentration label (20×)
- "Selected Analytes" panel on the right showing the running selection

### What changes (this is the biggest set of changes)
1. **Premix list is scoped to the selected (Platform, Species, Panel) tab.** Only premixes that belong to Millipore Mouse Panel 1 appear. Out-of-panel premixes (Premix Panel II / IV / V / VI) are gone.
2. **The "No Premix (Custom Assay)" tile is removed.** Individual analyte selection from the grid works on its own; the tile was redundant.
3. **Analyte grid is also scoped to the selected tab** (only Panel 1 analytes appear, not the global list).
4. **Selecting a premix auto-fills the "Selected Analytes" panel** with the premix's members.
5. **Premix members are locked.** They came pre-mixed in one vial — they cannot be cherry-picked individually. The right panel shows a 🔒 icon next to each premix member to make this visible.
6. **Premix members still appear in the analyte grid below**, but greyed out and disabled with the label "in premix" — so the operator can see why they can't pick them as singles.
7. **Other Panel 1 analytes remain selectable** as additional singles, up to the existing 5-singles-per-assay cap.
8. **Deselecting the premix** clears the auto-filled members and restores the empty Selected Analytes state.

### ✅ Confirmation

> ☐ **Approved as drawn**
> ☐ **Approved with notes**
> ☐ **Reject**

**Notes from colleague:**

```
[Your notes here]
```

---

## Step 3 — Calculator Inputs & Work

> Mockup: open `UI-OVERHAUL-MOCKUPS.html` → click **Step 3 — Calculator**

### What stays the same
- Number of Plates, Replicate Mode, Number of Samples inputs
- Old Beads, Old Antibodies inputs
- Number of Setups input
- Volume math (per-well × samples + dead volume etc.)

### What changes
1. **Well selector is removed.** The calculator runs before samples are submitted, so the operator doesn't know the well layout yet. Only sample count is needed.
2. **Plate visualization is removed** from the calculator page AND from the saved run document — at least for now.
3. **No "Old SA-PE" input** — SA-PE is returned to the bottle each time; no old/new distinction needed.
4. **Hard cap: ≤20 total plates** per day (5 Hamiltons × 4 plates each — your lab's physical capacity).
5. **Setup × Plates matrix** enforced as the validation rule:
   | Setups | Min plates | Max plates |
   |---|---|---|
   | 1 | 1 | 4 |
   | 2 | 2 | 8 |
   | 3 | 3 | 12 |
   | 4 | 4 | 16 |
   | 5 | 5 | 20 |
   Invalid combos hard-block "Next". The two dropdowns dynamically constrain each other (typing in one narrows the other).
6. **New old-volume UX:** First ask "Old volume available? Yes / No". If Yes, the input field appears with the max-allowed amount shown as a hint (e.g. "Max: 1.8 mL — 20% of 9 mL total").
7. **The calculator work is now visible** to the right of the inputs. Three blocks per reagent class (Beads / Antibodies / SA-PE):
   - **Grey block** — per-well × samples + dead volume → top-off subtotal
   - **Yellow block** — subtract old, get new reagent needed
   - **Final table** — per-analyte stock volume (at 20×) + buffer top-off

### ✅ Confirmation

> ☐ **Approved as drawn**
> ☐ **Approved with notes**
> ☐ **Reject**

**Notes from colleague:**

```
[Your notes here]
```

---

## Step 4 — Documentation Entry

> Mockup: open `UI-OVERHAUL-MOCKUPS.html` → click **Step 4 — Documentation**

### What stays the same
- Free-entry text fields for things like Operator, Sample Type, Dilution Factor, Comments
- Form-style layout for a single review-before-save page

### What changes
1. **Fields reordered into your specified order** (13 fields total):
   1. Request Number *(read-only — captured on Step 1)*
   2. Requester (User)
   3. Operator
   4. Date
   5. Platform *(read-only — from Step 1)*
   6. Species *(read-only — from Step 1)*
   7. Panel *(read-only — from Step 1)*
   8. Sample Type
   9. Sample count *(read-only — from Step 3)*
   10. Replicate mode *(read-only — from Step 3)*
   11. Plate Count *(read-only — from Step 3)*
   12. Dilution Factor
   13. Comments

2. **Fields derived from earlier steps are read-only** (greyed). To change them, the operator goes back to the relevant step.

3. **Fields removed from the form:**
   - **Hamilton** — deferred to a future Hamilton-assignment feature (its own seed for later).
   - **Run plate position** — tied to the removed well selector.
   - **Standard position** — tied to the removed well selector.

### ✅ Confirmation

> ☐ **Approved as drawn**
> ☐ **Approved with notes**
> ☐ **Reject**

**Notes from colleague:**

```
[Your notes here]
```

---

## Step 5 — Output / Run Documentation

> Mockup: open `UI-OVERHAUL-MOCKUPS.html` → click **Step 5 — Output**

### What this is
The final assembled run document — what gets saved, printed, and exported. Three sections per the spec:

1. **Documentation** — echo of the Step 4 form values (operator, date, platform, etc.)
2. **Table of Bead Regions** — each selected analyte with its bead region number, sourced from the analyte data (already in the app)
3. **Calculation Documentation** — the grey/yellow/blue blocks from Step 3 rolled into a single table per reagent class

### What needs your input
You said "Step 5 is defined as is for now — awaiting further instructions." The mockup is a working draft based on the three artifacts you listed. **What's missing / wrong / extra?** Specifically:
- Save / Print / Export — what's the actual delivery? (PDF? Print directly? Export to LIMS?)
- Do you want a "Send for approval" or "Lock for record" action before Save?
- Anything about audit trail or version-tracking that should appear here?

### ✅ Confirmation

> ☐ **Approved as drawn** (with the understanding that Step 5 will be further specified before build)
> ☐ **Approved with notes**
> ☐ **Reject**

**Notes from colleague:**

```
[Your notes here]
```

---

## ❓ Open questions — only you can answer these

These came up during the walkthrough and need your call before we plan the build. Each blocks one specific decision.

### Q1. Round-up rule reconciliation

**The conflict:** Today's code rounds reagent volumes **up to the nearest 0.1 mL** (this rule was locked in during a previous calculator-rules cycle). Your spec says **up to the nearest 1.0 mL**.

**The screenshots show both** — the per-well intermediate `Reagents total` displays at 0.1 mL precision (e.g. 4.35 mL), but the final prep volumes display at 1.0 mL (e.g. 9 mL).

**Three possible answers:**
- **(a)** 1.0 mL replaces 0.1 mL **everywhere** — the 0.1 mL rule was wrong
- **(b)** Two rules coexist: **0.1 mL** for intermediates (per-well × samples), **1.0 mL** for final prep volumes (Reagents+dead, New Reagents)
- **(c)** Some other split — please describe

**Your answer:**

```
[ ] (a)   [ ] (b)   [ ] (c) — describe:
```

---

### Q2. Multi-setup handling — what does it actually do?

**Context:** "Number of Setups" already feeds the dead-volume formula (`setups × 2 mL`), but **the rest of the multi-setup behavior is undefined** in the current code. The setup × plates constraint matrix (from your Yes/No table) is new logic to add.

**The question:** When the operator enters 2+ setups, what does the **output** look like?
- **(a)** One combined recipe — all setups blended into a single prep, one volume per reagent
- **(b)** Per-setup breakdown — separate volumes printed for each setup
- **(c)** Operator chooses at output time

**Your answer:**

```
[ ] (a)   [ ] (b)   [ ] (c)   Notes:
```

---

### Q3. Where exactly does the Request Number get captured?

You said "should be entered at the beginning." Three places it could live:
- **(a)** Top of Step 1 (alongside Platform / Species / Panel — as drawn in the mockup)
- **(b)** A separate Step 0 / "Start a new request" page before Step 1
- **(c)** Modal popup that the operator dismisses to enter the wizard

If it's (b), the workflow becomes **6 steps** instead of 5.

**Your answer:**

```
[ ] (a)   [ ] (b)   [ ] (c)   Notes:
```

---

### Q4. Plate visualization — gone forever, or just for now?

You said "removed at least for now."
- **(a)** Gone for good — the calculator is meant to run pre-submission, so the plate layout was misleading
- **(b)** Gone for the v1.x overhaul, but plant a seed for a future "view plate layout after run" feature
- **(c)** Could come back as an *optional* side-panel view operators can toggle, even in this overhaul

**Your answer:**

```
[ ] (a)   [ ] (b)   [ ] (c)   Notes:
```

---

## 🐛 Bugs found during the walkthrough

While walking through your feedback, we identified four issues in the current calculator that are **independently fixable** — they don't require the full UI overhaul to land. For each, please mark whether you'd like it patched in v1.1 (before the overhaul) or kept until the overhaul ships.

| # | Bug | Current behavior | Desired behavior | Severity |
|---|---|---|---|---|
| **B1** | Old volume not subtracted from new-volume calc | Operator enters Old Beads = 1 mL → calculator still computes new beads as if old = 0 | Subtract old from total to get new needed | 🔴 High — math is wrong |
| **B2** | "20% cap" hint shows wrong value | Hint reads "20% cap: 1.4 mL" when correct max for 9 mL total = 1.8 mL | Hint computed against correct base | 🟡 Medium — misleads operator |
| **B3** | Premix selection filters analyte grid to only members | Selecting JAMmate E hides all other Panel 1 analytes from the grid | Premix members lock, but other Panel 1 analytes remain selectable as singles | 🔴 High — blocks valid workflows |
| **B4** | Premix list shows premixes from all panels | Premix Panel II / IV / V / VI appear regardless of which Panel was selected | Scope to selected panel's premixes only | 🟡 Medium — operator confusion |

### Patch vs wait decision

For each bug, mark one:

| Bug | Patch in v1.1 (ASAP) | Wait for overhaul |
|---|---|---|
| B1 | ☐ | ☐ |
| B2 | ☐ | ☐ |
| B3 | ☐ | ☐ |
| B4 | ☐ | ☐ |

**Notes:**

```
[Anything to flag, e.g. "B1 + B3 are blockers for v1.0 UAT — patch before release"]
```

---

## What happens after you approve

1. Jonathan + Claude consolidate your sign-off and notes into a build plan
2. Bugs marked "patch in v1.1" get atomic fix PRs that ship before the overhaul
3. Approved sections become the spec for the workflow UI overhaul milestone (likely v1.2 or v2.0)
4. Open questions get reflected in the milestone's success criteria so the build can't drift

**No code changes happen until you sign off.**

---

## Reference

The full conversation history, raw colleague feedback per step, and design rationale are captured in [`.planning/seeds/SEED-001-workflow-ui-overhaul.md`](../seeds/SEED-001-workflow-ui-overhaul.md) — that's the internal planning document. This proposal is the colleague-facing summary distilled from it.

For questions while reviewing, reach out to Jonathan directly.
