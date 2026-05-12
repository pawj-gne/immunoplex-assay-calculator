---
phase: 12-smoke-3-calculator-rules
plan: 02
subsystem: calculator
tags: [calculator, diluent, smoke-3, tdd, pure-function, types]
requires:
  - "12-01 (CalculatorInputs shape: stable; Plan 12-02 does not touch calculator.ts)"
provides:
  - "src/shared/types/diluent.ts exports DiluentResult discriminated union (premix | values_table | legacy) + DiluentKind + SelectedPremixForDiluent + PanelValuesDiluent"
  - "src/renderer/src/lib/diluentResolver.ts exports resolveDiluent(args) — pure function implementing SMK3-07 concentration-keyed diluent rule + SMK3-DIL-01 verbatim-string contract"
  - "Plan-level tiebreaker decision: multi 1× premixes → FIRST in input-array wins (deterministic; caller controls ordering)"
affects:
  - "(none — new files only; no existing file modified)"
tech-stack:
  added: []
  patterns:
    - "Pure-function module decoupled via structural input shape (SelectedPremixForDiluent — zero imports from PremixPanel / Analyte / calculator)"
    - "Discriminated union (`kind: 'premix' | 'values_table' | 'legacy'`) for type-safe caller narrowing"
    - "Shared-types pattern: DiluentResult lives in src/shared/types/ so renderer + main + future phases (13/14/15) share one source of truth without duplication"
    - "Type re-export from the implementation module so callers can `import { resolveDiluent, type DiluentResult } from 'diluentResolver'` (single-path convenience)"
    - "TDD red-green per task: tests authored first, RED confirmed (Failed to load url ../diluentResolver), then implementation added; GREEN confirmed (14/14 pass)"
key-files:
  created:
    - "src/shared/types/diluent.ts (49 lines, 4 exports)"
    - "src/renderer/src/lib/diluentResolver.ts (73 lines incl. JSDoc, 1 function + 4 type re-exports)"
    - "src/renderer/src/lib/__tests__/diluentResolver.test.ts (14 tests across 4 groups + 1 root describe)"
    - ".planning/phases/12-smoke-3-calculator-rules/12-02-SUMMARY.md"
  modified: []
decisions:
  - "Tiebreaker for multi 1× premixes = INPUT-ARRAY-ORDER (FIRST wins). Locks in deterministic resolution without coupling the resolver to PremixPanel ordering semantics; CALLER (Plan 12-03 calculatorStore) is responsible for the policy (panel-authored order in Phase 12)."
  - "Resolver lives in src/renderer/src/lib/diluentResolver.ts (NEW file), not folded into calculator.ts — per CONTEXT §Claude's Discretion §file-organization: distinct domain concern, will grow as Phase 13 lands panel data, easier to test in isolation."
  - "DiluentResult type lives in src/shared/types/ (not src/renderer/src/lib/) so future Phases 13/14/15 — which span both main (panel-data IPC) and renderer (run-doc display) — share one source of truth. Resolver re-exports from there for single-path convenience."
  - "Resolver accepts a structural SelectedPremixForDiluent input (just `name` + `concentration`) rather than the full PremixPanel — keeps the resolver decoupled from panel-schema growth. Phase 13's per-reagent rows on master_panels (R-02) will not break this contract."
  - "Verbatim string contract per SMK3-DIL-01 — no normalization (no trim, no case fold, no enum check). T-B3 explicitly locks both whitespace ('  L-AB ') AND case ('N/A') preservation."
  - "Strict equality (concentration === 1, not <= 1) — T-D2 (concentration 0) + T-D3 (0.5) lock the boundary so future 'less than 1×' edge cases route to values_table/legacy, not to the 1×-premix branch."
metrics:
  duration: "~6m"
  date_completed: "2026-05-12"
  tasks_completed: 2
  files_changed: 3
  tests_added: 14
  commits:
    - "6c2b233: feat(12-02): add DiluentResult discriminated union in shared/types"
    - "f6ace9a: feat(12-02): implement resolveDiluent with concentration-keyed algorithm + 14 vitest cases"
---

# Phase 12 Plan 02: Smoke 3 Diluent Resolver Summary

Pure-function diluent resolver landed as a standalone module (`src/renderer/src/lib/diluentResolver.ts`) implementing the SMK3-07 concentration-keyed rule: ANY selected premix at 1× wins as the diluent for both Beads and Antibodies; else fall back to the panel's Values-table per-reagent strings (verbatim per SMK3-DIL-01); else `kind: 'legacy'` for v0.7.0 panels with no per-reagent data. The DiluentResult discriminated union ships in `src/shared/types/diluent.ts` so downstream phases (12-03 calculatorStore wiring + 13/14/15 schema/UI/run-doc) consume a single source of truth. 14 vitest cases land green; full suite 74/74; typecheck clean. **No existing file modified.**

## Objective Recap

Implement the Smoke 3 PRD's concentration-keyed diluent resolution rule (SMK3-07) as a standalone, pure, fully-tested module — separate from `lib/calculator.ts` because diluent resolution is a distinct domain concern that will grow as Phase 13 lands panel data, and easier to test in isolation. The resolver accepts the selected premix list + an optional Values-table struct; the caller (Plan 12-03 calculatorStore) is responsible for obtaining the latter from the panel data model.

## What Shipped

### Task 1 — DiluentResult discriminated union (commit `6c2b233`)

- Created `src/shared/types/diluent.ts` (49 lines, types only — no runtime code).
- Exports:
  - `type DiluentKind = 'premix' | 'values_table' | 'legacy'`
  - `type DiluentResult` (discriminated union; 3 branches)
  - `interface SelectedPremixForDiluent` (structural input: `name` + `concentration`)
  - `interface PanelValuesDiluent` (per-reagent shape: `beads` + `antibodies`)
- File location chosen so renderer + main + future Phases 13/14/15 share one source of truth without duplicating the diluent contract.
- Typecheck passed (both `tsconfig.node.json` and `tsconfig.web.json`).

### Task 2 — resolveDiluent function + 14-case vitest suite (commit `f6ace9a`)

- Created `src/renderer/src/lib/__tests__/diluentResolver.test.ts` first (RED). Confirmed failure: `Failed to load url ../diluentResolver`.
- Created `src/renderer/src/lib/diluentResolver.ts` (73 lines incl. JSDoc).
  - Exports `function resolveDiluent({ selectedPremixes, valuesTable })` returning `DiluentResult`.
  - Re-exports `DiluentResult`, `DiluentKind`, `SelectedPremixForDiluent`, `PanelValuesDiluent` from the shared-types path so callers can import everything from one module path if they prefer.
  - JSDoc documents the algorithm step-by-step + the tiebreaker decision + the decoupling rationale.
- GREEN confirmed: 14/14 new tests pass.
- Full suite: 74/74 tests pass (11 test files).
- Typecheck: clean (node + web).

## Test Fixture Inventory (14 cases — extends, doesn't duplicate)

For Plans 12-03 and Phases 13/14/15 to extend (rather than re-author) coverage, the fixture inventory is:

| ID | Group | Inputs | Expected |
|---|---|---|---|
| T-A1 | 1× wins | `[{F,1}]`, no values | `{ kind: 'premix', name: 'JAMmate F' }` |
| T-A2 | 1× wins | `[{F,1},{A,20}]`, no values | `{ kind: 'premix', name: 'JAMmate F' }` |
| T-A3 | 1× wins | `[{A,20},{F,1}]`, no values | `{ kind: 'premix', name: 'JAMmate F' }` |
| T-A4 | tiebreaker | `[{F,1},{A,1}]`, no values | `{ kind: 'premix', name: 'JAMmate F' }` (first wins) |
| T-A5 | tiebreaker reverse | `[{A,1},{F,1}]`, no values | `{ kind: 'premix', name: 'JAMmate A' }` (first wins — confirms input-order, not alphabetical) |
| T-A6 | 1× beats values | `[{F,1}]`, `{beads:'L-AB',ab:'L-AB'}` | `{ kind: 'premix', name: 'JAMmate F' }` |
| T-B1 | values fallback | `[{A,20},{B,20}]`, `{L-AB,L-AB}` | `{ kind: 'values_table', beads: 'L-AB', antibodies: 'L-AB' }` |
| T-B2 | empty + values | `[]`, `{Assay Buffer,n/a}` | `{ kind: 'values_table', beads: 'Assay Buffer', antibodies: 'n/a' }` |
| T-B3 | verbatim free text | `[{A,20}]`, `{'  L-AB ','N/A'}` | beads = `'  L-AB '` (ws preserved); antibodies = `'N/A'` (case preserved) |
| T-C1 | legacy | `[{A,20}]`, no values | `{ kind: 'legacy', beads: null, antibodies: null }` |
| T-C2 | legacy empty | `[]`, no values | `{ kind: 'legacy', beads: null, antibodies: null }` |
| T-D1 | strict 1 | `[{Exact1x,1}]`, `{X,X}` | `{ kind: 'premix', name: 'Exact1x' }` (1× wins even when values provided) |
| T-D2 | concentration 0 | `[{Weird,0}]`, `{X,X}` | `{ kind: 'values_table', beads: 'X', antibodies: 'X' }` (0 ≠ 1) |
| T-D3 | fractional 0.5 | `[{HalfX,0.5}]`, no values | `{ kind: 'legacy', beads: null, antibodies: null }` (0.5 ≠ 1) |

**Total: 14 cases** (plan minimum: 13). T-A5 splits T-A4's tiebreaker into both directions to prove the rule is input-array-order, not alphabetical or first-by-name.

## Plan-Level Decisions for Downstream Phases

### 1. Tiebreaker for multi 1× premixes = INPUT-ARRAY-ORDER (FIRST wins)

When multiple selected premixes have `concentration === 1`, the resolver returns the FIRST one in the `selectedPremixes` array. The CALLER is responsible for passing premixes in a stable order.

- **Plan 12-03 contract:** When calculatorStore wires resolveDiluent, the input array order must reflect a meaningful, stable ordering. Recommended: panel-authored order (read `panel.analytes` ordering from selectionStore), which preserves the lab's source-of-truth xlsx ordering.
- **Why not alphabetical, panel-defined, or first-selected:** Alphabetical ignores lab's source-of-truth ordering; panel-defined would couple the resolver to PanelWithAnalytes shape; first-selected would require a separate selection-order tracker in selectionStore (Phase 12 store work for a degenerate case). Input-array-order keeps the resolver pure and decoupled.

### 2. Legacy branch contract — CALLER decides display fallback

When the panel was imported by the v0.7.0 parser (no per-reagent diluent data), the resolver returns `{ kind: 'legacy', beads: null, antibodies: null }`. The caller is responsible for the display fallback. Two reasonable choices:

- **Existing v1 behavior:** Fall back to the "Assay Buffer" string (currently emitted by `calculateItemizedVolumes` at `src/renderer/src/lib/calculator.ts:281-294` when no panel and no singles selected).
- **Advisory text:** Render "(legacy panel — diluent unspecified)" so the operator knows the panel pre-dates Smoke 3 and the diluent must be entered manually.

**Plan 15-Run-Doc owns this UX decision.** Plan 12-03 can defer it (just propagate the legacy branch into calculator outputs).

### 3. Verbatim-string contract per SMK3-DIL-01

The resolver returns the Values-table strings VERBATIM — no trim, no case fold, no enum check. This is locked by T-B3 (`'  L-AB '` and `'N/A'`). Downstream display (Phase 15) is where any normalization or sanitization would apply, NOT in the resolver. **Phase 13's parser is the canonical "scrub-on-import" location** if/when scrubbing is added; the resolver always passes through what it receives.

### 4. Resolver decoupling from PanelWithAnalytes / Analyte

The resolver accepts a structural `SelectedPremixForDiluent = { name, concentration }` rather than the full `PremixPanel`. This means:

- Plan 12-03 calculatorStore must map its selected-premix state into `SelectedPremixForDiluent[]` at the callsite (one-line map).
- Phase 13's `master_panels` schema growth (per-reagent Concentration + Diluent + Volume/well rows) will NOT break this contract — only the calculatorStore mapping layer needs to change.

## Deviations from Plan

### Auto-fixed Issues

None — plan executed exactly as written.

### Plan-allowed scope additions

- **Re-exported `DiluentKind` from diluentResolver.ts** (in addition to `DiluentResult`, `SelectedPremixForDiluent`, `PanelValuesDiluent`). The plan's `<artifacts>` `exports` list omitted `DiluentKind` but the shared-types file exports it (Task 1's mandate), so re-exporting it for caller convenience is a no-cost completeness fix. No deviation rule required — purely additive.
- **Delivered 14 tests instead of 13.** Plan minimum was 13; the 14th case naturally fell out of splitting T-A4 / T-A5 across two `it` blocks for the tiebreaker (the plan describes both directions as a single test but doing them as two separate `it`s yields cleaner failure messages and clearer intent).

## Known Stubs

None — `resolveDiluent` is fully wired against its input contract. The CALLER (Plan 12-03 calculatorStore) has not yet consumed the resolver; that wiring is in scope for Plan 12-03 per the phase plan. This is by design, not a stub.

## Threat Flags

None — pure-function module. No I/O, no SQL, no HTML, no IPC. Input strings (premix names, diluent strings) are returned verbatim to caller. Downstream display layer (Phase 15) is where XSS hygiene would apply, NOT in this resolver. Phase 12 does not introduce any new trust boundary.

## Important Notes for Plan 12-03

The Plan-12-02 → Plan-12-03 handoff is purely additive:

1. **Import path:** `import { resolveDiluent, type DiluentResult } from '../lib/diluentResolver'` (calculatorStore lives in `src/renderer/src/stores/`, so the relative path is `../lib/diluentResolver`).
2. **Caller responsibilities:**
   - Map the current selectedPremixes state into `SelectedPremixForDiluent[]` with stable ordering (recommend panel-authored order).
   - Read `valuesTable` from the panel data model. In Phase 12 this will return `undefined` for v0.7.0-imported panels (legacy branch); in Phase 13 it becomes populated.
3. **Output surface on CalculatorState:** Add a `diluentResolution: DiluentResult` field to the store's derived outputs (or `CalculatorOutputs` if Plan 12-03 picks that layer). Consumers (run-doc / prep-sheet UI in later phases) read the discriminated union and switch on `kind`.
4. **No regression risk to existing calculator math:** The resolver is invoked alongside existing `calculateVolumes()` — it does not gate or modify the volume math. If the resolver's output is unused initially, that's fine.

## Verification Evidence

- `npx vitest run src/renderer/src/lib/__tests__/diluentResolver.test.ts`: **14/14 passed.**
- `npm test` (full vitest): **11 files, 74/74 passed.**
- `npm run typecheck` (node + web): **clean exit.**
- `grep -E "^export type DiluentKind" src/shared/types/diluent.ts`: 1 hit.
- `grep -E "^export type DiluentResult" src/shared/types/diluent.ts`: 1 hit.
- `grep -E "^export interface SelectedPremixForDiluent" src/shared/types/diluent.ts`: 1 hit.
- `grep -E "^export interface PanelValuesDiluent" src/shared/types/diluent.ts`: 1 hit.
- `grep -c "kind:" src/shared/types/diluent.ts`: 3 (one per branch).
- `grep -E "^export function resolveDiluent" src/renderer/src/lib/diluentResolver.ts`: 1 hit.
- `grep -E "^export type \{" src/renderer/src/lib/diluentResolver.ts`: 1 hit (the re-export block).
- `grep -c "^\s*it(" src/renderer/src/lib/__tests__/diluentResolver.test.ts`: 14.
- `grep -c "describe(" src/renderer/src/lib/__tests__/diluentResolver.test.ts`: 5 (root + 4 sub-groups).
- `grep -E "'  L-AB '|toBe.*'N/A'" src/renderer/src/lib/__tests__/diluentResolver.test.ts`: 3 hits (literal, beads assertion, antibodies assertion).
- `grep -E "from.*['\"]\.\./(.*panel|.*analyte|.*calculator)" src/renderer/src/lib/diluentResolver.ts`: **zero hits** (decoupling locked).
- `wc -l src/renderer/src/lib/diluentResolver.ts`: 73 lines (≥50 required).

## Self-Check: PASSED

Files created (verified present):
- FOUND: `src/shared/types/diluent.ts`
- FOUND: `src/renderer/src/lib/diluentResolver.ts`
- FOUND: `src/renderer/src/lib/__tests__/diluentResolver.test.ts`
- FOUND: `.planning/phases/12-smoke-3-calculator-rules/12-02-SUMMARY.md`

Commits (verified in git log):
- FOUND: `6c2b233` (Task 1: shared types)
- FOUND: `f6ace9a` (Task 2: resolver + tests)
