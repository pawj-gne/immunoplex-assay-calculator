# Immunoplex Assay Calculator — Smoke Test Guide

Thanks for helping test this! The app is a calculator + run documentation tool for our Luminex/Immunoplex assays. It replaces the paper workflow: pick platform → pick analytes → enter sample count → get reagent volumes → save the run for later.

This is the first time it's ever been installed on a Windows PC, so I need you to walk through a full run end-to-end and make sure everything works. **It should take ~15 minutes.**

---

## What you need

- The installer: `immunoplex-assay-calculator-0.5.0-x64-setup.exe` (87 MB)
- A Windows PC (any recent Intel/AMD Windows laptop or workstation — not ARM)
- ~15 min

---

## 1. Install the app

1. Double-click `immunoplex-assay-calculator-0.5.0-x64-setup.exe`.
2. Windows SmartScreen will probably complain ("Windows protected your PC" / "unrecognized app"). Click **More info** → **Run anyway**. This is expected — the installer isn't code-signed yet (that's a later polish task).
3. Click through the installer with defaults. It should create a desktop shortcut and a Start Menu entry.

**✅ Pass:** Installer finishes without errors. Desktop + Start Menu shortcuts appear.

**❌ Report if:** Installer errors out, hangs, or you don't see shortcuts.

---

## 2. First launch

1. Double-click the desktop shortcut.
2. The app window should appear within ~5 seconds. You should see a wizard-style interface with step labels at the top ("Platform & Species", "Analytes", "Calculations", "Document & Save", "Finalized Run").

**✅ Pass:** App opens, main UI is visible, no flash-and-crash.

**❌ Report if:** Window flashes and disappears, a Windows error dialog pops up, or the UI renders but is broken (blank, missing text, etc.). **If you see any error text, please screenshot it.**

---

## 3. Walk through a full run — "Request 9421"

Please use this exact test data so the results are consistent and I can reproduce any issue you hit.

### Step 3a — Pick platform & species

- Pick **Milliplex** as the platform.
- Pick **Human** as the species (or whatever species shows up first — the app was seeded with our standard list).
- Click **Next** (should enable once both are picked).

### Step 3b — Pick analytes

- Pick any premix panel (whichever is in the list — e.g., a cytokine panel). You should see the selected analytes render in a sidebar or summary.
- Alternatively, toggle on at least one single analyte.
- Click **Next**.

### Step 3c — Calculations

- Enter sample count = **40**.
- The plate grid should auto-fill, and you should see itemized reagent volumes display (master mix volume, per-analyte singles volume if any, dead volume, etc. — the usual prep sheet numbers).
- Click **Next**.

### Step 3d — Document & Save

This is the new part — fill out the run metadata form with these exact values:

| Field | Value |
|---|---|
| Request Number | `9421` |
| "Ad-hoc run (no request number)" checkbox | leave **unchecked** |
| User | your name |
| Operator | pick **Joven** from the dropdown |
| Date | today (should be default) |
| Sample Type | **Supernatant** |
| Dilution Factor | `5` |
| Hamilton | `1` |
| Run Plate Position | `1` |
| Standard Position | `1` |
| Trough Position | `1` |
| Comments | `smoke test run` |

Click **Save**.

**✅ Pass:** No error toast. The app automatically navigates you to step 5 (Finalized Run View).

**❌ Report if:** Save button does nothing, an error appears, or you stay on step 4.

### Step 3e — Finalized Run View

You should now see a read-only "bench sheet" view of the run. Check these:

- The header shows **`Request 09421`** (with leading zero padding to 5 digits).
- You can see the prep sheet with reagent volumes, the reagent checklist, the bead region list, and the plate grid(s).
- The plate grid is **not clickable** (read-only — this is intentional; it's the "take this to the bench" view).
- Each plate is labeled **`Request 09421 — Plate 1 of N`**.
- There's a **Print** button somewhere on this view.

Click **Print**. A Windows print dialog should appear. You can **cancel** it — I just want to confirm the button works.

**✅ Pass:** All elements visible, label formatting correct, Print dialog opens.

**❌ Report if:** Label reads wrong (e.g., "Request 9421" without padding), anything renders empty, Print does nothing.

---

## 4. Edit the saved run (verify it updates, doesn't duplicate)

1. Click the **Back** button (toward step 4).
2. A modal should appear: **"This run is saved. Going back to edit will modify the saved record. Continue?"** with two buttons — **Keep viewing** and **Edit anyway** (the "Edit anyway" button should look different/destructive, e.g., red or styled as a warning).
3. Click **Edit anyway** → you should return to the Document & Save form with everything you entered still there.
4. Change Comments to: `edited after save`
5. Click **Save** again → back to step 5.
6. Click **Back** → **Edit anyway** → back to step 4 form.
7. In the **Past Runs** list (should be on this page somewhere, maybe collapsed — expand it), find Request 09421. There should be **exactly ONE row** for it, and the comment should read "edited after save" (not two rows).

**✅ Pass:** The row count stays at 1 and the comment is the new one.

**❌ Report if:** Two rows appear for Request 09421, or the comment is the old one.

---

## 5. Close and reopen (persistence check)

1. Close the app entirely (Alt+F4 or the X button).
2. Wait a few seconds, then reopen from the desktop shortcut.
3. Walk back to step 4 (Document & Save).
4. Expand the **Past Runs** list.

**✅ Pass:** Request 09421 is still there, with the "edited after save" comment.

**❌ Report if:** The run is gone, or the comment reverted.

Now click **Load** on Request 09421.
- A dirty-state confirm modal may pop up (asking if you want to discard unsaved changes) — accept it.
- The wizard should populate back to step 4 with all the saved data, and the plate grid (if you peek at step 3) should match what you originally set up.

**✅ Pass:** All fields populate correctly, plate layout matches the original.

**❌ Report if:** Any fields are blank or wrong.

---

## 6. Operators management

1. From the top nav, click **Manage** (or similar — it's a mode toggle away from the calculator).
2. Find the **Operators** section.
3. Try these three things:
   - **Add**: create a new operator called `TestUser`.
   - **Rename**: pick any existing operator (not Joven — we used that already) and rename them to anything.
   - **Hide/soft-delete**: hide one operator. A confirm dialog should mention that existing runs referencing this operator will keep the name.
4. Go back to step 4 of the wizard (Document & Save). The Operator dropdown should:
   - Show `TestUser` as a new option
   - Show the renamed operator with the new name
   - **Not** show the hidden operator in the active list

5. Close the app, reopen it, check the Operators section again.

**✅ Pass:** All three changes persist after restart.

**❌ Report if:** Any change doesn't save, or the dropdown doesn't reflect the change.

---

## 7. Start New Run

1. Go to the Finalized Run View (step 5) for any saved run, OR walk through a new run to step 5.
2. Click **Start New Run**.
3. You should be bounced back to step 1 of the wizard with everything cleared out (no platform selected, no analytes, plate grid empty, etc.).
4. However — the **Operator dropdown** and the **Past Runs list** should still be populated. Those are app-wide data and shouldn't reset.

**✅ Pass:** Wizard clears, but operators + past runs still there.

**❌ Report if:** Operators or past runs disappear.

---

## How to report results

When you're done, send me back:

1. **If everything passed:** just reply with "all 7 sections passed" and I'll close it out.
2. **If something failed:** for each failed step, tell me:
   - Which section number (e.g., "Section 4 step 3")
   - What you saw (the actual behavior)
   - What was expected (the ✅ criteria)
   - Whether the app crashed or stayed open
   - A screenshot of any error dialog or error text

Don't try to debug or work around issues — just capture what you see and send it back. I'll diagnose on my end.

---

## Questions you might hit

**Q: The SmartScreen warning worries me — is this safe?**
Yes. It's because we haven't paid for a Windows code-signing certificate yet. The installer is built from the same code you'd see if you cloned the repo. We'll sign it before public release.

**Q: Where does the data go?**
The app creates a SQLite database in your Windows user folder (`%APPDATA%\immunoplex-assay-calculator\`). Everything you save — runs, operator edits — lives there.

**Q: Can I delete the test run and operator I created afterward?**
Yes — use the Delete button in the Past Runs list for Request 09421, and toggle "Show hidden" in Operators to find `TestUser` and delete it. But honestly I'd rather leave them in the DB so I can inspect on the next release if needed.

**Q: Can I uninstall afterward?**
Yes, standard Windows "Add or Remove Programs". The DB in `%APPDATA%` will stay behind; delete that folder manually if you want a truly clean removal.

Thanks!
