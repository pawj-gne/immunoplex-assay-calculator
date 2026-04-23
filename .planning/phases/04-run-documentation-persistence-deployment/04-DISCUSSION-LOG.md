# Phase 4: Run Documentation, Persistence & Deployment — Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in `04-CONTEXT.md` — this log preserves the alternatives considered.

**Date:** 2026-04-22
**Phase:** 04-run-documentation-persistence-deployment
**Areas discussed:** Save/Load UI placement, Plate layout serialization + run model, Run editability + load safety
**Areas deferred by user at selection time:** Windows installer polish (explicitly "for sure later")

---

## Pre-discussion — Phase state and prior plans

| Item | Description | Selected |
|---|---|---|
| Continue + replan after | Capture context, then re-run /gsd-plan-phase 4 | ✓ |
| View existing plans first | Show plan summaries before deciding | |
| Cancel | Skip discuss-phase | |

**Notes:** Phase 4 already had RESEARCH.md and 3 plans (04-01/02/03) drafted without a CONTEXT.md. User chose to continue discussion and regenerate plans afterward.

---

## Area 1: Save/Load UI placement

### Q1.1 — Where should Save Run + Run List live in the UI?

| Option | Description | Selected |
|---|---|---|
| Wizard step 4 (Recommended) | New "Document & Save" page after Calculations | ✓ |
| Third top-level mode (Runs) | Add Runs alongside calculator/manage | |
| Inline on Calculations page | Form appears below PlatePanel; Run List in drawer | |
| Header modal | 'Runs' button in header opens modal with tabs | |

### Q1.2 — Sample type field

| Option | Description | Selected |
|---|---|---|
| Free text (Recommended) | Plain text input | |
| Dropdown with fixed list | Predefined enum | ✓ |
| Dropdown + free text fallback | Dropdown with 'Other' text | |

**Follow-up:** User specified canonical list: **Supernatant, Lysate, Lavage, Plasma, Serum** (overrode all three prepared option sets).

### Q1.3 — Number of plates

| Option | Description | Selected |
|---|---|---|
| Auto-derived, not a form field (Recommended) | Read plateStore.getPlateCount() at save | ✓ |
| Operator-entered field on form | Manually typed | |
| Auto-derived + read-only display | Computed but shown for sanity-check | |

### Q1.4 — Read-only "Run Source" summary layout

| Option | Description | Selected |
|---|---|---|
| One-line dense (Recommended) | Single-line summary | |
| Two-line structured | Two-line grouping | |
| Bordered card with labeled rows | Each field on own row with label | ✓ |

### Q1.5 — After successful save

| Option | Description | Selected |
|---|---|---|
| Green banner + stay on page (Recommended) | Inline success; Past Runs updates | |
| Toast + auto-return to step 1 | Reset to Platform after save | |
| Green banner + 'Start New Run' button | Banner + explicit reset button | |
| **User's response (free-form)** | Navigate to a new page = finalized "one-pager" for the operator to perform the assay; read-only calculations; warning on going back to edit | ✓ |

**Notes:** Major scope clarification — post-save becomes a finalized bench-sheet view (step 5) with print + edit warning + "Start New Run".

### Q1.6 — Finalized run view content

| Option | Description | Selected |
|---|---|---|
| Full assay sheet (Recommended) | Metadata + prep recipe + plate layout + bead regions + checklist | ✓ |
| Metadata + prep + bead regions only | Skip plate layout | |
| Metadata + calculations only | Text-only summary | |

### Q1.7 — Edit warning trigger

| Option | Description | Selected |
|---|---|---|
| On Back button / wizard step change (Recommended) | Modal interrupts | ✓ |
| Persistent banner on earlier pages | Yellow banner, no modal | |
| Both: banner + modal on Save | Belt and suspenders | |

### Q1.8 — Print on finalized view

| Option | Description | Selected |
|---|---|---|
| Print button on finalized view (Recommended) | Reuses Phase 3 print IPC | ✓ |
| No print in v1 | Screen-only | |
| Print exists but deferred polish | Default browser print | |

### Q1.9 — Start-new-run flow

| Option | Description | Selected |
|---|---|---|
| 'Start New Run' button on finalized view (Recommended) | Resets stores + back to step 1 | ✓ |
| Navigate via top nav only | No explicit button | |
| Auto-return after N seconds | Timed auto-reset | |

### Q1.10 — Validation error surfacing

| Option | Description | Selected |
|---|---|---|
| Save button disabled + helper text (Recommended) | Button gated; helper explains | ✓ |
| Per-field inline errors on blur | Field-level errors on focus-out | |
| Show errors only on Save click | Always clickable, errors on attempt | |

### Q1.11 — Form defaults

| Option | Description | Selected |
|---|---|---|
| Date today, others blank (Recommended) | runDate = today's ISO; rest empty | ✓ |
| Date today + remember last operator/user | Carry operator/user from prior save | |
| Everything blank | No auto-fill including date | |

---

## Area 2: Plate layout serialization + run model

### Q2.1 — Plate serialization (initial framing)

| Option | Description | Selected |
|---|---|---|
| Store + fully restore (Recommended) | Save plateStore.plates, rehydrate on load | |
| Don't store — auto-fill on load | Only sampleCount + replicateMode saved | |
| Store only for archive; don't rehydrate | Persist but dead data | |
| **User's response (free-form)** | Pivoted to: "The user request system assigns request numbers. So the operator would just be entering that into this app." | ✓ |

**Notes:** User's response reframed the discussion — surfaced external request-number workflow.

### Q2.2 — Request number model

| Option | Description | Selected |
|---|---|---|
| Per-well request numbers | Type request # into each well | |
| Run-level metadata field | One text/textarea on form | |
| Start / end request number range | First + last request # fields | |
| Both — list + optional per-well | Required list + optional per-well | |
| **User's response (free-form)** | "A request is a defined as a group of samples that a user submits to the lab. That group of samples can span across multiple plates. For Request 1234 with 2 plates, it would be Req: 1234 P1, 1234 P2. Samples numbered sequentially 1-80 across 2 plates, independent of plate number." | ✓ |

**Notes:** Locked the run model: one request = one app run; samples numbered 1..N sequentially across all plates in the request.

### Q2.3 — Run model confirmation

| Option | Description | Selected |
|---|---|---|
| One run = one request (Recommended) | Single record spanning multiple plates | ✓ |
| One run = one plate | Multi-plate requests save as multiple records | |
| One run = batch of requests | Request number becomes a list | |

### Q2.4 — Plate layout serialization (re-asked)

| Option | Description | Selected |
|---|---|---|
| Store + fully restore (Recommended) | Serialize per-plate layout, rehydrate | |
| Store + restore only for finalized view | Hybrid restore semantics | |
| Don't store — auto-fill on load | Reconstruct from sampleCount | |
| **User's response (free-form)** | "Wells must always be continuous, starting from A4, B4, C4 ... to H12. Can't skip wells. BUT the sequence can end early on a plate and start a new one. So 80 wells can go 40 in p1 and 40 in p2" | ✓ |

**Notes:** Confirms plate state is fully describable by per-plate sample counts given continuous-fill rule. Layout must still be serialized to preserve operator's plate-distribution choice (e.g., 40/40 vs 72/8).

### Q2.5 — Request number field location

| Option | Description | Selected |
|---|---|---|
| New required field on Document & Save page (Recommended) | Dedicated `requestNumber` column | ✓ |
| Inside existing Hamilton assignment field | Free-text reuse | |
| Required + plate label suffix auto-generated | Field + auto plate labels | |

### Q2.6 — Request number format

| Option | Description | Selected |
|---|---|---|
| Integer only (Recommended) | z.number().int().positive() | |
| Free-form string | Any text | |
| String with required numeric prefix pattern | Regex-constrained | |
| **User's response (free-form)** | "it's a 4 digit number. it's in the high 9000s and we are not sure if the numbers will go to 10000 or 0000. Let's plan for a 5 digit request number with a hidden leading zero for <10000 requests" | ✓ |

### Q2.7 — Plate label format

| Option | Description | Selected |
|---|---|---|
| 'Request 1234 — Plate 1 of 2' (Recommended) | Verbose and unambiguous | ✓ |
| '1234 P1' | Compact suffix | |
| Just 'Plate 1' with request number in header | Shortest labels | |

### Q2.8 — Request number required?

| Option | Description | Selected |
|---|---|---|
| Required — save disabled until filled (Recommended) | Hard gate | |
| Optional with warning | Save allowed with warning banner | |
| Required but allow override checkbox | Checkbox bypass | ✓ |

### Q2.9 — Paper sheet review (after user uploaded run-sheet image)

User uploaded the actual paper run-documentation sheet. Surfaced several new fields not in existing plans.

### Q2.10 — Per-plate variation within a request

| Option | Description | Selected |
|---|---|---|
| Plates always match within a request (Recommended) | Single platform/species/panel per run | | 
| Plates can differ | Per-plate platform/species/panel/dilution | |
| Sample type + count + dilution per plate, rest per request | Partial per-plate | |
| **User's response (free-form)** | "Multiple requests can be run on the same hamilton if they are from the same platform. But that is out of the scope of this app. We just need to run the calculations for this request and be able to designate the hamilton and position it was run on. No tracking of that needed" | ✓ |

**Notes:** Confirms one-run-per-request model; cross-request Hamilton batching is real but out of scope.

### Q2.11 — Operator field

| Option | Description | Selected |
|---|---|---|
| Dropdown with seed list, editable (Recommended) | Seeded CRUD via Manage page | ✓ |
| Dropdown, hardcoded 9 names only | Constants in code | |
| Free text with autocomplete | Text + suggestions | |

### Q2.12 — Positions (Hamilton/plate/standard/trough)

| Option | Description | Selected |
|---|---|---|
| Integer picker with fixed ranges (Recommended) | 1-5 / 1-4 / 1-2 / 1-2 | ✓ |
| Keep as free text (Plan 04-01 as-is) | Unconstrained | |
| Integer picker but ranges configurable in Manage | Flexible ranges | |

### Q2.13 — New paper-sheet fields (Dilution, Plex, Notes)

| Option | Description | Selected |
|---|---|---|
| All of them (Recommended) | Dilution + Plex + Standards Docs + Documentation | | 
| Dilution + notes; skip Plex | Plex is derivable | |
| Dilution only; notes deferred to v2 | Minimal | |
| **User's response (free-form)** | "option 1 but we dont need standards documentation. Maybe a free comment area for whatever would be good." | ✓ |

**Notes:** Landed on Dilution Factor + Plex (auto-derived, stored) + one unified Comments textarea (merges Standards Documentation + Documentation).

---

## Area 3: Run editability + load safety

### Q3.1 — Edit model

| Option | Description | Selected |
|---|---|---|
| Overwrite the same run (Recommended) | UPDATE existing, bump updatedAt | ✓ |
| Always save as new | Each save = new record | |
| Prompt on save: 'Update existing or save as new?' | User-chosen per save | |

### Q3.2 — Load safety

| Option | Description | Selected |
|---|---|---|
| Confirm modal only if dirty (Recommended) | Smart dirty-state check | ✓ |
| Always confirm | Always nag | |
| Silent replace | No confirmation | |
| Block Load until explicit Reset | Disabled until Reset | |

### Q3.3 — Edit scope on loaded run

| Option | Description | Selected |
|---|---|---|
| Any change = editing the saved run (Recommended) | All mutations target loaded run | ✓ |
| Metadata edits = update; calculator edits = new | Hybrid semantics | |
| Always new run, regardless | Loads are reference-only | |

### Q3.4 — Delete safety

| Option | Description | Selected |
|---|---|---|
| Confirm modal with request number (Recommended) | One-click confirm citing request # | ✓ |
| Typed confirmation | Operator types the request # | |
| Soft delete | Flag row, keep in DB | |

---

## Claude's Discretion

Areas where user deferred to Claude or the planner:

- Exact request-number display format (`padStart(4/5, '0')`, or render as plain int)
- `operators` hard-delete vs soft-delete (`active` flag)
- Dirty-state diff algorithm (shallow compare vs JSON-stringify reference)
- Comments field character limit (unbounded in v1)
- Modal styling (reuse any existing confirm modal pattern)

---

## Deferred Ideas

### Out of Phase 4 (deferred to v2 or later)
- Search / filter on RunList (HIST-01, HIST-02)
- Run export to CSV / PDF (HIST-03)
- Lot numbers on reagents (DOCM-02)
- Camera photo attachment (DOCM-03)
- Audit trail of run modifications (DOCM-04)
- Interactive 96-well drag-drop (PLAT-02/03/04)
- Cross-request Hamilton batching (intentionally ignored by app)
- Cloud sync / multi-user

### Deferred within Phase 4
- Windows installer branding (appId, icon, code signing, auto-updater URL)
- "Remember last operator" form auto-fill
- Comments field character limit
- Operator soft-delete pattern

---

## Reviewed Todos

None — no pending todos matched Phase 4 at discussion time.
