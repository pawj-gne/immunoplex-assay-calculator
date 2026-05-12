---
type: PRD
title: Smoke 3 — Calculator UI flow + calculation rules
status: SOURCE OF TRUTH
source: Smoke 3.docx
ingested_from: .planning/inbox/Smoke 3.docx
ingested_on: 2026-05-11
supersedes:
  - PANEL-UPLOAD-V2-SPEC.md (where it conflicts)
  - REQUIREMENTS.md CALC-06 (rounding rule → see SMK3-06)
  - REQUIREMENTS.md MPAN-01 / CALV-01 (single reagent_volume_per_well → see SMK3-08)
  - REQUIREMENTS.md MPAN-05 (upsert-with-orphan re-upload → see SMK3-11)
  - PROJECT.md §Domain Rules diluent rule (request-type-keyed → concentration-keyed; see SMK3-07)
  - STATE.md decision 02-01 (round-to-mL → round-to-0.1-mL; see SMK3-06)
resolutions: INGEST-RESOLUTIONS.md
images: .planning/inbox/smoke-3-images/ (gitignored — promote per phase if needed)
---

# Smoke 3

## Database

- I have updated the database for uniformity.
- The database is in 1 sheet with multiple tabs.
- Table tab summarizes the elements of each criteria.
- Tabs are labeled based on this criteria: Platform, Species, Panel.
- Besides the table, each tab corresponds to a specific Platform, Species, and Panel.

## Hierarchy of UI interaction

### First Step: Criteria

- On the first UI page selects Platform, Species, Panel.
- This criteria will determine which tab to fetch information for down the line data.
- The First UI page walk through and adjustment.
- **Action:** remove stock concentration labels in each platform.

> *Original docx embedded mockup image here (smoke-3-images/image1.png).*

- Example step 1: user picks a platform.
- In this example user picks Millipore.
- Once the user picks the platform (Millipore), "Platform Selected" verification prompt appears but modified from previous display.

> *Original docx embedded mockup image here (smoke-3-images/image2.png).*

- **Action:** remove stock concentration and "Ready to proceed with reagent calculations" on display information and change just "Platform selected: Millipore" as shown above.

- Select Species Prompt appears.
- On this example Species Mouse is selected.
- **Action:** No next step until "select panel is selected."

> *Original docx embedded mockup image here (smoke-3-images/image3.png).*

- Selection of panel should appear.
- The "table" tab in the sheet can be used to determine which panels from specific platform from specific species will be available for selection.
- In this example since Millipore Mouse is selected, Panel 1 through 5 should be options to be selected.

> *Original docx embedded mockup image here (smoke-3-images/image4.png).*

- After Panel is selected the Next UI page option now should be available.

### Second Step: Category

- The information in the tab is divided into 3 areas: Criteria, Values, Category.
- Second Step corresponds to the Category table where the user after fulfilling the criteria prompts it can select to the category of analytes.
- There are 2 category of analytes: Single Analytes and Premix (see tab datasheet).
- Once the criteria is selected (Platform, Species, Panel), Display of categories should be displayed with **Premix first then the Single Analytes**.
- Users can pick single analytes alone, premix alone or single analytes and premix combination.

> *Original docx embedded mockup image here (smoke-3-images/image5.png).*

- Once premix selections are selected (multiple premixes can be selected), it should highlight the specific analyte that is part of the premix.
- For example, **Jammate F** is selected and Jammate F contains IL-1a, IL-6, GM-CSF, and IL-10 — then these analytes should be highlighted and **cannot be available for selection**.

> *Original docx embedded mockup image here (smoke-3-images/image6.png).*

- Additional analytes can still be selected apart from the premixes selection as long as they are not part of the premix selected already.

> *Original docx embedded mockup image here (smoke-3-images/image7.png).*

- For example figure on top, **JAMmate F 4-plex** is selected — the user can still pick IL-2 and IFN-g for their final selection as shown above.
- So, even though the user only picked 3 selections (TSC) the total analytes (TA) used are actually 6.
- Final submitted selection is 3 (TSC) and the total analytes are 6 (TA). This is critical because reagent calculations that involves values will be based on **3 selections (TSC), not 6 analytes (TA)** — but for bead region display all 6 analytes are critical to be illustrated.

### Third Step: Plate & Sample Count

- Third UI page.
- First input should be number of plates.
- Second input should be Replicate Mode.
- Third should be the number of samples per plate.
- Plate layout should be **snaked by columns** starting at A4 to H4, then A5 to H5 and so on.
- Volume of Old Reagent (Beads and Antibodies) must be accounted in this UI page.
- Number of setups must be accounted in this UI page.

> *End of User Input.*

## Calculation

### Variables

- **Total Selected Count (TSC)**
  - Fetch information from the tab: base on "criteria" → in the "category" area → the concentration for Premix or Single analytes.
  - If Premix is used, evaluate concentration of the TSCs. If one of the premix has a concentration equal to 1 and additional selections are made (either single analytes, other premix, or combinations of single analytes and premix), the **1× premix will be the final Diluent** for Beads or Antibodies.
  - If Single Analytes or Premix or combination of Single Analytes and Premix with concentration **greater than 1**, use "Values" table in the tab for type of diluent to use.

- **Total Well Count**
  - Sum of all well counts per plate.
  - Each plate has a fixed standard well count — each plate has **24 standard wells** automatically counted towards total well count.
  - Example: user requested 2 plates with 100 samples. 1 plate has 60 and the second plate has 40. For 2 plates the total standard wells count is 48; the total sample count the user requested is 100 wells; therefore the total well count is **148**.

- **Volume/well**
  - Located in the tab → "value" area.
  - This is the volume of reagent needed per well.
  - Depending on the Platform, volumes/well varies.
  - To calculate the volume needed for each reagent, volume/well is multiplied by the total number of wells.
  - Example: Thermofisher/Human/Panel 1 criteria, 2 plates of 100 samples → accounting for wells for standards we have a total of 148 wells. Base on the "value" table the volume/well for beads is 0.05 mL and for antibodies is 0.025 mL. Therefore the total bead volume is 148 × 0.05 = **7.4 mL**. For the antibodies the calculation is 148 × 0.025 = **3.7 mL**.
  - **Round off all calculated values to the 10th decimals.**

### Limits

- **Replicate – Single:** maximum sample capacity **72 samples**.
- **Replicate – Duplicate:** maximum sample capacity **36 samples**.

### Old Reagents

- Volume of old reagents that can be reused for beads or antibodies. It can be of value from "0" or more.
- It will be added towards the total volume but **not** on the volume calculation for the new reagent creation.

### Dead volume

- Each set-up requires **2 mL** of dead volume.

### Total Reaction Volume

- Is the total calculated value including the dead volume, old reagent volume and the new reagent volume.
- **n/a** in the database signifies no calculation needed due to not being part of the protocol to be calculated.

### Calculation

- There are 2 calculations:
  - The total volume of the assay
  - The calculation of the reagents of beads or antibodies

- **Calculation of the Dead volume**
  - `# of setups × 2 mL`

- **Total reagent volume (beads or antibodies)**
  - `Total reagent = New reagent + Old reagent`
  - The New reagent is calculated by calculating the total volume of the assay minus the old reagent.

- **Calculation of PE volume**
  - `Total Volume of the assay ÷ concentration`

- **Calculation of total volume of the assay**
  - `Total of reagent volume + Dead volume`

- **Show all calculation work on the final document.**

## Summary workflow

> *Original docx embedded summary diagram here (smoke-3-images/image8.png, image9.png).*
