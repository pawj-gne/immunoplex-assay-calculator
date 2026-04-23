# Phase 5: Master-Panel Schema & Repository Foundation - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-23
**Phase:** 05-master-panel-schema-repository-foundation
**Areas discussed:** Release-gating ODs (1/2/3/7), Riding ODs (4/5/6/8), Schema & migration mechanics, Pitfall-1 adoption-upsert API, Real vendor fixture reopen (reagent volumes + sub-panel conc)

---

## Area Selection

| Option | Description | Selected |
|--------|-------------|----------|
| Release-gating ODs (1/2/3/7) | OD-1 v1 coexistence, OD-2 calc strictness, OD-3 vendor-term placement, OD-7 col C mapping. Must lock before Phase 5 planning exits. | ✓ |
| Riding ODs (4/5/6/8) | OD-4 premix-drop, OD-5 validation strictness, OD-6 A5 version marker, OD-8 name overwrite. | ✓ |
| Schema & migration mechanics | Nullable FKs, composite unique index, FK cascade rules, migration split, PRAGMA foreign_keys = ON. | ✓ |
| Pitfall-1 adoption-upsert API | upsertByNameInMaster contract: v1 adoption vs update vs create, return shape. | ✓ |

**User's choice:** All four areas.

---

## Release-gating Open Decisions

### OD-1: v1 CSV importer fate after v2 ships

| Option | Description | Selected |
|--------|-------------|----------|
| Coexist (v2.0 default) | Ship v2 alongside v1. Label v1 as "Legacy CSV import". Remove in v2.1. | |
| Replace (hard cut) | Remove v1 UI trigger in the same phase that ships v2. v1 IPC handler stays but unreachable. | ✓ |
| Coexist with v1 guard | v1 importer refuses to update analytes with non-null master_panel_id. | |

**User's choice:** Replace (hard cut).
**Notes:** Deviation from ROADMAP-suggested "coexist." Eliminates Pitfalls 21/22 by design. Forces clean switchover; current dummy data makes this low-cost.

### OD-2: Calculator behavior when no master panel exists

| Option | Description | Selected |
|--------|-------------|----------|
| Graceful + provenance | Fallback to DEFAULT_VOLUME_PER_WELL=25 with mandatory UI provenance ("Platform default — no master"). | |
| Strict (block until re-import) | Calculator throws visible error when no master exists for the (platform, species). | ✓ |
| Graceful, no provenance UI | Silent fallback. | |

**User's choice:** Strict.
**Notes:** User clarified "all runs in this lab will reference some master panel. no analyte exists without master." Follow-up confirmed: current DB data is dummy/blank-slate, so when v2 ships there's no transition window. Fallback becomes dead code; Pitfall-4 provenance still required for the pass-case. Phase 8 SC #3 ROADMAP wording (currently "graceful priority order") needs retroactive edit when Phase 8 plans.

### OD-3: Vendor singles term placement

| Option | Description | Selected |
|--------|-------------|----------|
| AnalyteGrid header + No-Premix chip only | Narrow rollout. Fall back to generic labels when master is NULL. | ✓ |
| AnalyteGrid + Manage + wizard | Full rollout everywhere singles get named. | |
| AnalyteGrid header only (skip chip) | Narrower than recommended. | |

**User's choice:** AnalyteGrid header + No-Premix chip only.
**Notes:** Matches ROADMAP suggestion + VTRM-01 / VTRM-02 as-written. Wizard / Manage / cross-panel views stay generic.

### OD-7: xlsx col C concentration mapping

| Option | Description | Selected |
|--------|-------------|----------|
| single_conc; premix_conc = 1.0 default | Map col C → analytes.single_conc. | ✓ (lock deferred to end of session) |
| premix_conc; single_conc = same | Conflates single vs premix semantics. | |
| Add third column on analytes | analytes.vendor_stock_conc. | |

**User's choice:** "I just realized the premixes are of different concentrations. most are 1x. there are also something called JAMMate mixes (A,B,C...), i need to confirm these. not sure where to put" — parked pending screenshot.
**Notes:** Parked initially. Screenshot confirmed Row 13 C header = "Single Concentration" → OD-7 locked as single_conc. premix_conc becomes dead for xlsx path. JAMMate concerns resolved via new `premix_panels.sub_panel_conc` column (see reopened schema area below).

---

## Riding Open Decisions

### OD-4: Premix-drop semantics on re-import

| Option | Description | Selected |
|--------|-------------|----------|
| Orphan (leave alone) | Dropped premix stays with master_panel_id set. Historical runs preserved. | ✓ |
| Soft-delete (active=0 flag) | Add active column. | |
| Hard-delete with cascade | Breaks historical runs. | |

**User's choice:** Orphan. Matches ROADMAP.

### OD-5: Validation strictness

| Option | Description | Selected |
|--------|-------------|----------|
| Strict: reject whole file | Collect all errors, zero DB writes if any error. Single tx on happy path. | ✓ |
| Partial: per-tab commit | Tab 1 + 3 import, tab 2 skipped. | |

**User's choice:** Strict file-level reject. Matches ROADMAP + Pitfall 27.

### OD-6: A5 format-version marker

| Option | Description | Selected |
|--------|-------------|----------|
| Defer to v2.1 | No marker in v2.0. | ✓ |
| Add A5 version marker now | Parser rejects missing/wrong version. | |

**User's choice:** Defer. Matches ROADMAP.

### OD-8: Operator name-edit overwrite on re-import

| Option | Description | Selected |
|--------|-------------|----------|
| Overwrite: xlsx is authoritative | Name overwrites on every upload. | ✓ |
| Preserve operator edits (name_locked flag) | Add name_locked column; UI sets it on manual edit. | |

**User's choice:** Overwrite. Matches ROADMAP; document in UI help text.

---

## Schema & Migration Mechanics

### En bloc approval

| Option | Description | Selected |
|--------|-------------|----------|
| Approve as-is | All 6 points as Claude's discretion. | ✓ |
| Approve with comments | Lock direction but flag specific items. | |
| Reopen — discuss one or more | Walk through cascade semantics, migration split, or rename question. | |

**User's choice:** Approve as-is.
**Notes:** The 6 approved points: (1) PRAGMA foreign_keys = ON in client.ts, (2) composite uniqueIndex().on() form (Pitfall 14), (3) onDelete: 'set null' downward / 'restrict' upward on new FKs (Pitfall 13), (4) single migration file, (5) keep premix_panels name (Pitfall 15), (6) existing pre-v2 FKs stay as-is.

---

## Pitfall-1 Adoption-Upsert API

### Upsert return shape

| Option | Description | Selected |
|--------|-------------|----------|
| { id, action: 'created'\|'adopted'\|'updated' } | Rich discriminator. Phase 7 banner surfaces adoption count. | ✓ |
| { id, wasCreated: boolean } | Simple binary; loses adoption-vs-update distinction. | |
| Just id (current style) | Phase 7 counts via pre/post SQL diff. | |

**User's choice:** `{ id, action: 'created' | 'adopted' | 'updated' }`.
**Notes:** 'adopted' = existing v1 row received master_panel_id for the first time — the Pitfall-1 critical gate signal. Applies to both upsert methods.

---

## Wrap-up Check

| Option | Description | Selected |
|--------|-------------|----------|
| Wait for screenshot | Hold CONTEXT.md; reopen schema/upsert if screenshot changes analytes shape. | ✓ |
| I'm ready for context | Write CONTEXT.md now; treat any schema change as Phase 5 deviation. | |
| Explore more gray areas | Something else worth discussing. | |

**User's choice:** Wait for screenshot.
**Notes:** User sent screenshot of real Millipore Mouse Panel 1 fixture shortly after. Schema area reopened.

---

## Reopened Area: Real Vendor Fixture (2026-04-23)

Screenshot analysis revealed three deltas vs PANEL-UPLOAD-V2-SPEC.md:

1. **Three reagent volumes (B6/B7/B8)** — Beads / Ab / SAPE — not one B4 single value.
2. **Per-premix sub-panel concentration (Row 11)** — E11=1 for "Premix PANEL I 33-plex", F11=20 for "JAMMate A", G11=20 for "JAMMate B".
3. **Vendor singles term moved A6 → A10** ("Mapmates" for Millipore). "Single Concentration" explicit label on C13 locks OD-7.

### Reagent volume storage

| Option | Description | Selected |
|--------|-------------|----------|
| Three explicit columns | beads_volume_per_well / ab_volume_per_well / sape_volume_per_well. REAL NOT NULL. SQL-queryable. | ✓ |
| JSON blob | reagent_volumes TEXT storing JSON. Extensible but loses type-safety. | |
| Separate table | master_panel_reagent_volumes table. Over-normalized for fixed 3-value schema. | |

**User's choice:** Three explicit columns.

### Sub-panel concentration storage

| Option | Description | Selected |
|--------|-------------|----------|
| New column on premix_panels | Add sub_panel_conc REAL NOT NULL. Deprecates analytes.premix_conc in xlsx path. | ✓ |
| New column, keep analytes.premix_conc | Redundant; premix_conc unused by xlsx importer. | |
| Parse but don't persist for Phase 5 | Defer DB column to Phase 8. | |

**User's choice:** New column on premix_panels.

---

## Claude's Discretion (locked without user input)

- Drizzle `relations()` declarations for new FKs.
- TypeScript inferred type exports (`MasterPanel`, `NewMasterPanel`, updates to existing types).
- `shared/types/` updates — new `masterPanel.ts`, additions to `panel.ts` / `analyte.ts`.
- Migration filename suffix (drizzle-kit auto-generated).
- Statement ordering within the migration file.
- Test fixture structure (in-memory `better-sqlite3` DB, matches existing repo test conventions).
- `crypto.randomUUID()` PK generation for new master_panels rows (matches existing repository convention).

---

## Deferred Ideas

- **Doc debt (before Phase 6 discuss):** rewrite PANEL-UPLOAD-V2-SPEC.md §Per-tab layout; update MPAN-01, PIMP-02 wording in REQUIREMENTS.md; update Phase 8 SC #3 in ROADMAP.
- **Phase 8:** JAMMate dilution math — calculator reads `premix_panels.sub_panel_conc` and divides master_mix_volume by it (analogous to single-addition math at premix scope). New vs v1's hardcoded 1× premix assumption.
- **v2.1:** drop dead `analytes.premix_conc` column; add orphan-premix cleanup admin action; add A5 format-version marker alongside canonical template update.
- **Future cleanup phase:** declare explicit `onDelete` rules on all pre-v2 FKs for hygiene.
- **Pending domain confirmation (not a blocker):** user's colleague will verify exact single_conc and sub_panel_conc values on their computer later. Dummy values acceptable for Phase 5 planning / execution.
