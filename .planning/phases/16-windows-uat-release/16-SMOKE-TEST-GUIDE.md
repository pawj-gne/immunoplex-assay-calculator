# Phase 16 — Windows UAT (Smoke 3) — Smoke Test Guide

Thanks for helping verify v1.0! This is the first Windows install of the Smoke 3
calculator on a real lab PC against real panel data. You'll walk through a full
run end-to-end, then tick a per-requirement matrix.

**Estimated time:** ~30 minutes.

**If anything fails:** stop, note exactly what you saw in Section C (and screenshot
any errors). A single FAIL blocks the v1.0.0 tag — but it also gives us a clean
bug report for a quick fix loop. Don't try to work around issues.

---

## What you need

- Installer: `immunoplex-assay-calculator-1.0.0-x64-setup.exe`
- Panel fixture: `templates/panels/all-panels.xlsx` (transfer alongside the installer)
- This guide on-screen + `16-HAND-CALC.md` on-screen (or printed)
- An x64 Windows lab PC (any recent Intel/AMD Windows workstation — not ARM)
- ~30 min

---

## Section A — End-to-end run flow

### Step 0. Clear stale user data (CRITICAL — UAT precondition)

If the Windows lab PC ever had a prior version of this app installed (v0.5.x / v0.6.x / v0.7.x), its SQLite database persists across uninstalls in `%APPDATA%` and will carry stale pre-Smoke-3 panel rows into v1.0.0. Smoke 3's per-reagent schema is additive — old rows are preserved, not migrated — which is correct for real-world v0.7.x → v1.0.0 upgrades but blocks the fresh-import verification required by SMK3-08/09/10/11. Skip this step ONLY if this Windows PC has never had the app installed.

1. Press `Win + R`, type `%APPDATA%`, hit Enter.
2. Locate the folder **`Immunoplex Assay Calculator`** (title case, with spaces — this is the Electron `productName`).
3. Delete the entire folder (drag to Recycle Bin, or `Shift+Delete` for permanent delete).
4. Verify: re-open `%APPDATA%` and confirm `Immunoplex Assay Calculator` is gone.

**✅ Pass:** Folder deleted; AppData no longer contains the app's data directory.
**❌ Report if:** Folder won't delete (a previous app instance is still running — close it via Task Manager and retry), or if you cannot locate the folder (skip this step — likely a clean machine).

### Step 1. Install the app

1. Uninstall any prior Immunoplex Assay Calculator version via Windows Settings → Apps.
2. Double-click `immunoplex-assay-calculator-1.0.0-x64-setup.exe`.
3. Windows SmartScreen will probably complain ("Windows protected your PC" /
   "unrecognized app"). Click **More info** → **Run anyway**. Expected — the installer
   isn't code-signed yet (deferred polish item).
4. Click through with defaults. Desktop + Start Menu shortcuts appear.

**✅ Pass:** Installer finishes, shortcuts appear.
**❌ Report if:** Installer errors out, hangs, or shortcuts don't appear.

### Step 2. First launch — confirm v1.0.0

1. Double-click the desktop shortcut.
2. The app window appears within ~5 seconds.
3. Confirm the title bar or app footer shows **v1.0.0** (NOT v0.7.0).

**✅ Pass:** App opens, v1.0.0 visible.
**❌ Report if:** Title shows wrong version, app crashes, UI is blank.

### Step 3. Import panel data

1. Navigate to **Manage** → find the **Import Panel XLSX** button.
2. Select `templates/panels/all-panels.xlsx`.
3. After import, a banner reports how many panels were imported.

**✅ Pass:** Banner reports **16 panels imported** (Table sheet is decorative and ignored).
No error.
**❌ Report if:** Banner reports a different count, any panel fails, or an error toast appears.

### Step 4. Pick platform / species / panel (PRD worked example)

1. Navigate to the Calculator wizard, Step 1.
2. **Platform:** Thermofisher
3. **Species:** Human
4. **Panel:** Panel 1 (the importer normalizes `Panel I` → `Panel 1`; this is the PRD
   worked-example panel, "Thermofisher Human Panel I" in the fixture xlsx — covers
   D-16-15(a) all-4-audit-blocks)

**✅ Pass:** Next button enables; SAPE Name field visible somewhere on the metadata
header for this panel (expected: `SA-PE`).

### Step 5. Pick analytes

1. The premix for Panel 1 is shown ("Premix Panel I 34-plex") — select it.
2. Note the total analyte count (TA) in the sidebar (expected: 34).

**✅ Pass:** Selection registers; bead region list shows a flat list (not grouped by panel).

### Step 6. Calculations — PRD case 1 (Singles, Setups=1)

1. Enter **Sample count = 100**. Plate count should auto-fill to **2**.
2. **Replicate mode = Singles**
3. **Old Beads = 0**, **Old Antibodies = 0**, **Number of Setups = 1**
4. Compare on-screen output to `16-HAND-CALC.md` § PRD case 1:
   - Total wells = **148**
   - Total bead volume = **7.4 mL**
   - Total antibody volume = **3.7 mL**
   - Dead volume = **2.0 mL**
   - PE volume = total assay volume (because SAPE concentration = 1)

**✅ Pass:** Every value matches the hand-calc within 0.1 mL.
**❌ Report if:** Any value drifts; note the on-screen value vs. expected.

### Step 7. Bump Setups to 3 — verify dead volume scales

1. Change **Number of Setups** to **3**.
2. Dead volume should become **6.0 mL** (3 × 2 mL).
3. Total assay volume increases by 4 mL vs Step 6.

**✅ Pass:** Dead volume and total scale linearly with setups.

### Step 8. Override badge (D-16-15(c) — override-trigger panel)

1. Switch the wizard to **Millipore / Human / Panel 1** (the override-trigger panel
   from `16-HAND-CALC.md` § D-16-15(c) — smaller volume/well = 0.025 mL, so a modest
   Old Beads value crosses the 20% cap).
2. Re-enter the same inputs as Step 6 (samples = 100, plates = 2, Singles, Setups = 1).
3. The new bead volume at this panel = 148 × 0.025 = 3.7 mL. The 20% cap = 0.74 mL.
4. Enter **Old Beads = 1.0 mL** (≈ 27%, above the cap).
5. A cap modal should appear — click **Override**.
6. The calculator output should show an **amber OVERRIDE badge**.

**✅ Pass:** Cap modal triggers; override badge visible after confirm.
**❌ Report if:** Modal doesn't appear, or badge isn't visible.

### Step 9. SAPE concentration = 1 (D-16-15(d))

1. Switch the wizard back to **Thermofisher / Human / Panel 1** (the PRD panel from
   Step 4 — its SAPE row in the Values block has concentration = 1, so PE volume
   should equal Total Volume of Assay).
2. Re-enter the inputs from Step 6 (Old Beads = 0, Old Antibodies = 0, Setups = 1).
3. Confirm **PE Volume** on screen equals the **Total Volume of Assay** value (because
   SAPE concentration = 1, the division step is a no-op).

**✅ Pass:** PE Volume = Total Assay Volume.

### Step 10. Document & Save — metadata form

Fill the run metadata with these exact values:

| Field | Value |
|---|---|
| Request Number | `16001` |
| "Ad-hoc run (no request number)" | leave **unchecked** |
| User | your name |
| Operator | **Joven** |
| Date | today |
| Sample Type | **Supernatant** |
| Dilution Factor | `5` |
| Hamilton | `1` |
| Run Plate Position | `1` |
| Standard Position | `1` |
| Trough Position | `1` |
| Comments | `smoke 3 UAT` |

Click **Save**.

**✅ Pass:** No error; auto-navigates to Finalized Run View.

### Step 11. Audit Trail rendering — 4 blocks, real mL values

On the Finalized Run View, scroll to the **Audit Trail** section. It should render
**four labeled blocks**:

1. **Inputs:** plates, samples, replicate mode, selections, old beads, old antibodies, setups
2. **Intermediates:** total wells, volume/well per reagent, total bead/antibody volume, dead volume
3. **Outputs:** new beads, new antibodies, total bead volume, total antibody volume, PE volume — each with a real "X.X mL" value (NOT an em-dash)
4. **Diluent decision:** which premix won (1× diluent rule), or which Values-table diluent applied per reagent

**✅ Pass:** All 4 blocks render; the 6 rows that used to be em-dashes now show real
"X.X mL" values (Phase 15.1 WR-06 fix).
**❌ Report if:** Any row shows `—` (em-dash) where a number is expected; any block missing.

### Step 12. SAPE Name visible

On the same Finalized Run View, find the metadata header (top of the run document).
The **SAPE Name** field should be visible — for the PRD panel this should read
`SA-PE` (from the panel's Values block).

**✅ Pass:** SAPE Name field rendered with a non-empty value.

### Step 13. Reopen run — override badge persists + cap modal does not re-trigger

> Note: this step exercises a saved run that includes an override. Before saving in
> Step 10, you should have been on the **Millipore Human Panel 1** override path
> from Step 8 (amber badge visible). If you switched panels in Step 9, repeat
> Steps 8–10 first using the Millipore panel + Old Beads override so the save
> captures the override state.

1. Click **Back** → confirm "edit anyway" through the dirty-state modal → return to
   Past Runs.
2. Click **Load** on Request 16001.
3. Walk to the Calculator step:
   - **✅ Pass (D-15-08):** The amber OVERRIDE badge is still visible (Phase 15.1
     WR-01 fix restored the override flags on reopen).
   - **✅ Pass (D-15.1-keystroke):** Click into the Old Beads field — the cap modal
     does NOT re-trigger on the first keystroke (Phase 15.1 UAT-item #2 fix).
4. Verify the snapshot values (sample count, total bead volume, PE volume) match what
   you saw before saving.

**❌ Report if:** Override badge missing on reopen; cap modal re-triggers immediately;
any field reverts to default.

### Step 14. Print + Start New Run

1. Click **Print** → Windows print dialog opens → cancel it. (Just verify the button works.)
2. Click **Start New Run**:
   - Wizard returns to Step 1, all selections cleared.
   - **Operators** dropdown still populated; **Past Runs** list still shows Request 16001.

**✅ Pass:** Wizard clears; app-wide data survives.

### Step 15. Close + reopen (persistence check)

1. Close the app (Alt+F4 or X).
2. Reopen from the desktop shortcut.
3. Navigate to Past Runs → Request 16001 is still there → click Load → all values
   rehydrate.

**✅ Pass:** Run survives app restart.

---

## Section B — Per-requirement acceptance matrix

For each row, tick **Pass / Fail / N/A** in `16-SMOKE-TEST-RETEST.md` with a one-line
evidence note. Any **Fail** blocks the v1.0.0 tag.

| Requirement | Pass / Fail / N/A | Evidence (one-line) |
|---|---|---|
| SMK3-01 — Stock-concentration labels removed from platform-selection screens | | |
| SMK3-02 — Plate page exposes **Old Beads** input | | |
| SMK3-03 — Plate page exposes **Old Antibodies** input | | |
| SMK3-04 — Plate page exposes **Number of Setups** input (default 1, min 1) | | |
| SMK3-05 — Dead volume = setups × 2 mL (verified at Section A Step 7) | | |
| SMK3-06 — Final volumes round UP to nearest 0.1 mL (verified at Section A Step 6) | | |
| SMK3-07 — Concentration-keyed diluent rule (1× premix wins; else per-reagent Values-table) | | |
| SMK3-08 — Sectioned-xlsx panel importer (Criteria / Values / Category) accepts `all-panels.xlsx` | | |
| SMK3-09 — Roman → Arabic panel-name normalization on import | | |
| SMK3-10 — Master `Table` tab ignored on import (16 panels imported, not 17) | | |
| SMK3-11 — Wholesale-replace re-upload — re-import `all-panels.xlsx` twice → zero duplicate rows | | |
| SMK3-12 — SAPE Name visible in run document metadata header (verified at Section A Step 12) | | |
| SMK3-13 — Premix deselection re-enables members as singles (not auto-added) | | |
| SMK3-14 — Bead region display = single flat list sorted by bead region + duplicate plate col-pair fill correct | | |
| SMK3-15 — Audit Trail 4-block layout with per-reagent breakdown (verified at Section A Step 11) | | |
| SMK3-16 — Historical-run snapshot freeze | **N/A** | N/A — historical-run banner is code-verified (Phase 15 Group H); not user-observable on the lab PC without DB surgery, deferred to a future maintenance phase |
| SMK3-17 — PE volume = Total Volume of Assay ÷ SAPE concentration (verified at Section A Step 9) | | |
| D-15-08 — Override badge visible on reopen + cap modal does NOT re-trigger on first keystroke (verified at Section A Step 13) | | |

---

## Section C — Free-text observations + bugs found

*Anything the script didn't anticipate. Include screenshots if a UI element is broken.
Sections that took longer than expected, ambiguous wording in the script, etc.*

(operator fills in)

---

## Overall: PASS / FAIL

*(operator picks one when done)*

---

## FAQ

**Q: SmartScreen warned me — is this safe?**
Yes. The installer isn't code-signed yet (we'll sign before public release). Same build
pipeline as v0.5–v0.7.

**Q: Where does my data live?**
`%APPDATA%\Immunoplex Assay Calculator\immunoplex.db` (SQLite). Survives uninstall — delete the `Immunoplex Assay Calculator` folder manually for a clean wipe.

**Q: Can I delete the test run afterward?**
Yes — use the Delete button on Request 16001 in Past Runs. Honestly I'd rather leave
it so I can inspect on the next release if needed.

**Q: Can I uninstall afterward?**
Yes, Windows Settings → Apps. The DB in `%APPDATA%` stays behind; delete that folder
manually for a clean removal.

Thanks!
