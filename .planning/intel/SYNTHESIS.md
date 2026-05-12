# Ingest Synthesis Summary

Generated: 2026-05-11
Mode: merge
Orchestrator: /gsd-ingest-docs → gsd-doc-synthesizer

## Doc counts

- PRD: 1
- ADR: 0
- SPEC: 0 (PANEL-UPLOAD-V2-SPEC.md is existing-context-only, NOT in this ingest set)
- DOC: 0
- UNKNOWN / low-confidence: 0
- Total ingested: 1

## Inputs

- `/Users/pawj/Lab_Dev/immunoplex-assay-calculator/.planning/inbox/smoke-3.md` — PRD — manifest-tagged — Smoke 3 — Calculator UI flow + calculation rules — covers criteria selection, category selection, plate & sample inputs, replicate-mode limits, reagent volume calc, dead volume, old reagent handling, PE volume, plate snaking.

## Decisions locked

None. The ingest set contained no ADRs.

Existing locked decisions in the project (untouched by this synthesizer, included here for cross-reference):

- PROJECT.md §Domain Rules — premix-is-diluent rule, max-5-singles rule, dead-volume formula, rounding rule
- REQUIREMENTS.md — CALC-01 through CALC-07 (v1, shipped v0.1.0), v2.0 PIMP / MPAN / CALV / VTRM IDs
- STATE.md §Decisions — 01-01..04-05 shipped decisions
- PANEL-UPLOAD-V2-SPEC.md — treated as LOCKED for synthesis per orchestrator instruction

## Requirements extracted

13 requirements, namespaced `REQ-smoke3-*`:

1. REQ-smoke3-db-single-sheet-multi-tab
2. REQ-smoke3-criteria-hierarchy
3. REQ-smoke3-category-premix-and-singles
4. REQ-smoke3-plate-sample-inputs
5. REQ-smoke3-replicate-mode-caps
6. REQ-smoke3-tsc-driven-calculation
7. REQ-smoke3-total-well-count
8. REQ-smoke3-reagent-volume-formula
9. REQ-smoke3-old-reagent-handling
10. REQ-smoke3-dead-volume
11. REQ-smoke3-pe-volume
12. REQ-smoke3-total-assay-volume
13. REQ-smoke3-show-work
14. REQ-smoke3-na-skips-calc

(Final count 14 — REQ-smoke3-show-work and REQ-smoke3-na-skips-calc are smaller-scope acceptance notes but tracked as their own requirements for traceability.)

The roadmapper should re-namespace into the canonical CALC- / PLAT- / RECP- / DOCM- scheme when merging into REQUIREMENTS.md.

## Constraints captured

6 constraint blocks in `constraints.md`:

- schema: panel-data file shape (PRD view) — contradicts v2 spec, see BLOCKER #1
- schema: per-reagent volume/well, diluent, SAPE Name — contradicts v2 spec, see BLOCKER #2
- schema: premix Count column — redundant with v2 implicit count, see INFO #4
- protocol: plate-layout snake direction — matches shipped 03-01
- protocol: replicate-mode capacities — matches shipped CALC-01
- protocol: dead volume per setup — matches shipped 02-03; per-setup multiplier is new (WARNING #3)
- protocol: rounding precision — contradicts shipped CALC-06, see BLOCKER #3

## Context topics

1 doc-style topic captured in `context.md` (summary-workflow diagrams pointer). No DOC-type ingest content.

## Conflicts

- BLOCKERS: 4
  1. Panel-data file shape contradicts LOCKED v2 spec
  2. Per-reagent fields (volume/well, diluent, SAPE Name) contradict LOCKED v2 spec
  3. Rounding precision contradicts LOCKED CALC-06 (0.1 mL nearest vs 1 mL ceiling)
  4. Calculator diluent semantics contradict LOCKED domain rules
- WARNINGS: 3
  1. "Premix + singles max 5" rule (CALC-05) — PRD silent
  2. Three incompatible importer formats now in the codebase / planning set
  3. "Number of setups" as user input is new
- INFO: 5
  1. Plate snake direction matches shipped behavior
  2. Replicate-mode caps match shipped CALC-01
  3. Dead volume per setup = 2 mL aligns with 02-03
  4. Premix Count column redundant with v2 implicit count
  5. TSC vs TA vocabulary new but consistent with v2 model

Detail: `/Users/pawj/Lab_Dev/immunoplex-assay-calculator/.planning/INGEST-CONFLICTS.md`

## Per-type intel files

- `/Users/pawj/Lab_Dev/immunoplex-assay-calculator/.planning/intel/decisions.md`
- `/Users/pawj/Lab_Dev/immunoplex-assay-calculator/.planning/intel/requirements.md`
- `/Users/pawj/Lab_Dev/immunoplex-assay-calculator/.planning/intel/constraints.md`
- `/Users/pawj/Lab_Dev/immunoplex-assay-calculator/.planning/intel/context.md`

## Status

**STATUS: BLOCKED** — 4 BLOCKERs must be resolved before this ingest can be routed to `gsd-roadmapper`. The single most consequential blocker is the panel-data file-shape contradiction (BLOCKER #1): until the canonical schema is picked (Smoke 3 sectioned vs v2-spec B1–B4 vs shipped v0.7.0 parser), all of Phase 8 (XLSX parser), Phase 9 (importer + IPC + UI), and Phase 10 (calculator wiring) are unable to begin planning.
