# Phase 16 — Operator Hand-Calc Reference (Smoke 3)

Use this sheet to verify calculator output during Section A of `16-SMOKE-TEST-GUIDE.md`.
If the on-screen number matches the expected value here within 0.1 mL, the calculator
is working. If not, mark the affected Section A step as FAIL in
`16-SMOKE-TEST-RETEST.md` and note the on-screen value vs. expected.

All values are ceiling-rounded to 0.1 mL (the Smoke 3 rule).

## Fixture Coverage Map

| D-16-15 item | Panel name (sheet in `all-panels.xlsx`) | Why this panel |
|---|---|---|
| (a) all-4-audit-blocks premix panel | **Thermofisher Human Panel I** (normalized to `Panel 1` in-app) | PRD worked-example panel; Values block carries Beads + Antibodies + SAPE per-reagent rows; "Premix Panel I 34-plex" exercises the premix-selection path and drives the 1× diluent rule on Beads + Antibodies |
| (c) override-trigger panel | **Millipore Human Panel 1** | Volume/well for Beads = 0.025 mL; at 100 samples × 2 plates (148 wells), new bead volume = 3.7 mL → 20% cap = 0.74 mL → entering Old Beads = 1.0 mL trips the cap modal |
| (d) SAPE-concentration-1 panel | **Thermofisher Human Panel I** (same as (a)) | SAPE row in Values block: concentration = 1, SAPE Name = `SA-PE` → PE volume equals total assay volume (no division step visible to operator). Reusing the PRD panel keeps the operator on a familiar Step 6 fixture |

---

## PRD case 1 — Thermofisher / Human / Panel 1, 100 samples × 2 plates, Singles, Setups=1, Old=0/0

**Inputs:**
- Samples = 100, plates = 2, replicate = Singles
- Old Beads = 0 mL, Old Antibodies = 0 mL, Setups = 1
- Volume/well (Beads) = 0.05 mL (from panel Values block)
- Volume/well (Antibodies) = 0.025 mL
- Volume/well (SAPE) = 0.05 mL
- SAPE concentration = 1

**Calculation:**
- Total wells = 100 + (24 × 2) = **148**
- Bead volume = 148 × 0.05 = 7.40 mL → **7.4 mL** (ceiling at 0.1)
- Antibody volume = 148 × 0.025 = 3.70 mL → **3.7 mL**
- SAPE volume (used inside total assay volume) = 148 × 0.05 = **7.4 mL**
- Dead volume = 1 × 2 = **2.0 mL**
- Total assay volume = Bead + Antibody + SAPE + Dead = 7.4 + 3.7 + 7.4 + 2.0 = **20.5 mL**
- PE volume = total assay volume ÷ SAPE concentration (1) = **20.5 mL** (identical to total assay volume)

*(Note: total-assay-volume composition is approximate to the on-screen sum. If the
on-screen value differs by more than 0.1 mL because of a slightly different reagent
inclusion model, mark Step 6 as a soft fail with the on-screen value noted; the key
gates are the per-reagent rows: 7.4 mL beads, 3.7 mL antibodies, 2.0 mL dead volume,
and PE volume = total assay volume.)*

## PRD case 1 — Setups = 3

Same inputs as PRD case 1 except Number of Setups = 3.

- Dead volume = 3 × 2 = **6.0 mL** (was 2.0 mL with setups=1)
- Total assay volume bumps by 4.0 mL vs setups=1 → **24.5 mL**
- Bead and Antibody volumes are unchanged (volume/well × wells is independent of setups)
- PE volume rescales because total assay volume changed → **24.5 mL** (still equals total assay
  volume since SAPE concentration = 1)

## D-16-15(c) — override-trigger panel: Millipore Human Panel 1

**Inputs:**
- Samples = 100, plates = 2, replicate = Singles, Setups = 1
- Volume/well (Beads) = 0.025 mL (from panel Values block)
- Volume/well (Antibodies) = 0.025 mL
- SAPE concentration = 1

**Threshold:**
- Total wells = **148**
- New bead volume (before old-bead subtraction) = 148 × 0.025 = **3.7 mL**
- 20% reuse cap = 20% × 3.7 = **0.74 mL**
- Enter **Old Beads = 1.0 mL** (≈ 27% of new bead volume — above the cap)
- Cap modal triggers → click **Override** → amber **OVERRIDE** badge appears in the
  calculator output.
- Total bead volume after subtraction = max(3.7 − 1.0, 0) added back to 1.0 = **3.7 mL**
  (the override does not change the gross volume; it documents that 1.0 mL of old beads
  will be reused).

## D-16-15(d) — SAPE concentration = 1 panel: Thermofisher Human Panel I (reused)

**Inputs:**
- Samples = 100, plates = 2, replicate = Singles, Setups = 1
- (Reuse PRD case 1's panel; this panel's SAPE row has concentration = 1.)

**PE volume check:**
- SAPE concentration in panel Values block = **1**
- Total assay volume per PRD case 1 = **20.5 mL**
- PE Volume on screen = 20.5 ÷ 1 = **20.5 mL** (PE Volume row equals Total Volume of
  Assay row — the division step is a no-op when SAPE concentration is 1).
- Operator confirms PE Volume row equals Total Volume of Assay row.

---

*Hand-calc reference generated 2026-05-13 for Phase 16 Wave 1. If the fixture xlsx
changes (e.g., new Values-block volume/well per reagent), regenerate via
`npm run fixtures:panels` and re-derive these tables.*
