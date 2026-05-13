---
phase: 15-smoke-3-run-document-audit-trail-inserted-2026-05-11
reviewed: 2026-05-12T00:00:00Z
depth: standard
files_reviewed: 26
files_reviewed_list:
  - drizzle/migrations/0009_chemical_prism.sql
  - drizzle/migrations/meta/0009_snapshot.json
  - drizzle/migrations/meta/_journal.json
  - src/main/db/__tests__/migration.test.ts
  - src/main/db/repositories/__tests__/masterPanel.test.ts
  - src/main/db/repositories/__tests__/run.test.ts
  - src/main/db/repositories/masterPanel.ts
  - src/main/db/repositories/run.ts
  - src/main/db/schema.ts
  - src/main/ipc/panel.ts
  - src/preload/index.d.ts
  - src/preload/index.ts
  - src/renderer/src/features/calculator/components/CalculatorForm.tsx
  - src/renderer/src/features/run/components/AuditTrailSection.tsx
  - src/renderer/src/features/run/components/FinalizedRunHeader.tsx
  - src/renderer/src/features/run/components/FinalizedRunView.tsx
  - src/renderer/src/features/run/components/HistoricalRunBanner.tsx
  - src/renderer/src/features/run/hooks/__tests__/useRunSnapshot.test.ts
  - src/renderer/src/features/run/hooks/useRunSnapshot.ts
  - src/renderer/src/features/run/lib/__tests__/auditTrail.test.ts
  - src/renderer/src/features/run/lib/auditTrail.ts
  - src/renderer/src/lib/__tests__/calculator.integration.test.ts
  - src/renderer/src/stores/calculatorStore.ts
  - src/renderer/src/stores/runStore.ts
  - src/shared/constants/channels.ts
  - src/shared/types/run.ts
  - src/shared/validation/run.ts
findings:
  critical: 0
  warning: 7
  info: 6
  total: 13
status: issues_found
---

# Phase 15: Code Review Report

**Reviewed:** 2026-05-12T00:00:00Z
**Depth:** standard
**Files Reviewed:** 26
**Status:** issues_found

## Summary

Phase 15 introduces a snapshot-at-save audit trail by adding 10 new columns to the
`runs` table (8 nullable master-panel-derived fields plus 2 boolean override flags)
and rendering them through three new renderer components: `AuditTrailSection`,
`FinalizedRunHeader` (extended with SAPE Name row), and `HistoricalRunBanner`. The
DB migration (0009) is correctly nullable + non-destructive, the type / Zod schema /
repository / preload bridge all agree on the same field surface, and the test
coverage exercises happy-path snapshot persistence, custom-assay no-IPC path, IPC
failure, and pre-Phase-15 default behavior.

No critical issues, no security vulnerabilities, no crashes. The implementation is
internally consistent (TS types ↔ Zod schema ↔ Drizzle insert/update ↔ test
fixtures all match). The findings below are mostly UI polish, magic-string
de-duplication, and one functional gap in the `loadRun` cascade that doesn't
restore the override flags into calculatorStore — the audit trail still renders
correctly because it reads directly from `RunRecord`, but the form UI loses the
"overridden" badge state on reload.

Visual rendering correctness is explicitly routed to Phase 16 UAT per the phase
VALIDATION.md, so layout / formatting concerns flagged below are advisory.

## Warnings

### WR-01: `loadRun` cascade does not restore `oldBeadsOverride` / `oldAntibodiesOverride` into the calculator form

**File:** `src/renderer/src/stores/runStore.ts:142-159`
**Issue:** The `loadRun` rehydration sequence restores `volumePerWell`, `numberOfSetups`,
`oldBeads`, and `oldAntibodies` into `calculatorStore`, but it does NOT call
`useCalculatorStore.setState({ oldBeadsOverride, oldAntibodiesOverride })` for the
two new Phase-15 override booleans persisted on the run. Result: reopening a run
where the operator confirmed an over-cap override at save time will:
- correctly render the `OVERRIDE` chip in the audit trail (reads `RunRecord.oldBeadsOverride` directly), and
- correctly render the value-cell red border on the calculator input (re-derived from `oldBeads > capML`), but
- LOSE the "overridden" amber badge next to the input AND re-trigger the cap modal on the first interaction, because `CalculatorForm.tsx`'s local `beadsOverrideAccepted` / `antibodiesOverrideAccepted` state starts at `false` (and the store flags also start at `false` per `initialState`).

The override-acceptance state was deliberately lifted into the store (Plan 15-03
Task 1) so that `buildRunSnapshot` could read it. The symmetric "read it back on
load" path is missing.

**Fix:**
```ts
// In runStore.ts, after `calculator.setOldAntibodies(...)` on line 154, add:
useCalculatorStore.setState({
  oldBeadsOverride: run.oldBeadsOverride ?? false,
  oldAntibodiesOverride: run.oldAntibodiesOverride ?? false
})
// And bubble the same values into CalculatorForm's local override-accepted
// state via a useEffect that watches the store flags on mount.
```

Alternatively, fold the local `beadsOverrideAccepted` / `antibodiesOverrideAccepted`
React state in `CalculatorForm.tsx:76-77` into the store entirely (single source
of truth), and have `loadRun` set them.

---

### WR-02: `useRunSnapshot.ts` silently swallows `getWithReagents` returning `null`

**File:** `src/renderer/src/features/run/hooks/useRunSnapshot.ts:139-156`
**Issue:** When `masterPanelId` is set (premix path) but the IPC returns `null`
(unknown id — caught by `masterPanelRepository.getByIdWithReagents` returning null
for missing rows), all 6 master-panel-derived fields silently stay `null` and the
run is saved with calculation-rules-version = `'smoke3'` even though the audit
trail will be missing data. The user sees no error, and the audit trail renders
`—` for SAPE name, diluents, vol/well — indistinguishable from a custom-assay
save. The comment on line 175-176 of `masterPanelRepository` calls this case
"defensive — should not happen in normal flow," but if it does happen (DB drift,
race with import wholesale-replace, etc.) the operator gets no signal.

**Fix:**
```ts
if (masterPanelId) {
  try {
    const result = await window.electronAPI.masterPanel.getWithReagents(masterPanelId)
    if (!result) {
      return { error: `Master panel ${masterPanelId} not found — cannot snapshot audit trail` }
    }
    // …existing happy-path code…
  } catch (e) {
    return { error: `Failed to snapshot master panel: ${(e as Error).message}` }
  }
}
```

---

### WR-03: `'smoke3'` calculation-rules marker is a duplicated magic string

**File:** `src/renderer/src/features/run/hooks/useRunSnapshot.ts:214`, `src/renderer/src/features/run/components/HistoricalRunBanner.tsx:14`, `src/main/db/schema.ts:221` (comment), `src/main/db/repositories/__tests__/run.test.ts:224, 239, 252`
**Issue:** The literal `'smoke3'` is the discriminant between Phase-15-and-later
runs (full audit trail) and pre-Phase-15 runs (historical banner). It appears
hardcoded in both the write path (`useRunSnapshot.ts:214`) and the read-path
discriminant (`HistoricalRunBanner.tsx:14`). A future rename or version bump
(e.g., `'smoke4'`) requires two coordinated edits with no compile-time guard.

**Fix:**
```ts
// In src/shared/constants/calculator.ts (or a new src/shared/constants/run.ts):
export const CURRENT_CALCULATION_RULES_VERSION = 'smoke3' as const
export type CalculationRulesVersion = typeof CURRENT_CALCULATION_RULES_VERSION

// useRunSnapshot.ts:214 →
calculationRulesVersion: CURRENT_CALCULATION_RULES_VERSION

// HistoricalRunBanner.tsx:14 →
if (currentRun.calculationRulesVersion === CURRENT_CALCULATION_RULES_VERSION) return null
```

---

### WR-04: Dead-volume cell hardcodes "setup" (singular) and the `2 mL` magic number

**File:** `src/renderer/src/features/run/components/AuditTrailSection.tsx:168-171`
**Issue:** The dead-volume display always says `"… setup × 2 mL"` with singular
`setup` and a hardcoded `2 mL` literal. Two problems:
1. Pluralization: a run with `numberOfSetups = 3` renders as `"6.0 mL (= 3 setup × 2 mL)"` — should be `setups`.
2. Magic number: `useRunSnapshot.ts:180` already pulls `DEAD_VOLUME_PER_SETUP_UL`
   from `../../../shared/constants/calculator` to compute the persisted µL
   value. The audit-trail display reverse-engineers the same constant as a
   hardcoded `"2 mL"` string. A future tuning of `DEAD_VOLUME_PER_SETUP_UL`
   (e.g., to 2.5 mL) would silently desync the persisted µL value and the
   rendered explanation.

**Fix:**
```ts
import { DEAD_VOLUME_PER_SETUP_UL } from '../../../../../shared/constants/calculator'

const deadVolumePerSetupML = DEAD_VOLUME_PER_SETUP_UL / 1000
const setupsCount = r.numberOfSetups ?? null
const deadVolumeText =
  r.deadVolume > 0 && setupsCount !== null
    ? `${(r.deadVolume / 1000).toFixed(1)} mL (= ${setupsCount} setup${setupsCount === 1 ? '' : 's'} × ${deadVolumePerSetupML.toFixed(1)} mL)`
    : '—'
```

---

### WR-05: `premixSelection` renders `"Panel I (—×)"` when `premixConcentration` is null but `panelName` exists

**File:** `src/renderer/src/features/run/components/AuditTrailSection.tsx:139-144`
**Issue:** The fallback branch:
```ts
panelName
  ? `${panelName} (—×)`
  : '—'
```
produces output like `"Panel I (—×)"` which is awkward (an em-dash sits inside
parentheses next to `×`). In practice this branch is unreachable for valid
Phase-15 saves — `panelId !== null` always pairs with a non-null
`premixConcentration` per `buildRunSnapshot.ts:129`. For pre-Phase-15 runs,
`premixConcentration` IS null, and the historical-run banner is the operator's
signal that values may be incomplete; rendering `"Panel I (—×)"` adds visual noise
without information.

**Fix:** Drop the trailing `(—×)` when premixConcentration is null:
```ts
const premixSelection =
  panelName && r.premixConcentration !== null && r.premixConcentration !== undefined
    ? `${panelName} (${r.premixConcentration}×)`
    : panelName ?? '—'
```

---

### WR-06: Six Intermediates / Outputs rows hardcoded to `"—"` with no TODO marker

**File:** `src/renderer/src/features/run/components/AuditTrailSection.tsx:214-228`
**Issue:** Six rows render literal `value="—"` with no derivation code:
- `Raw bead volume` (line 214)
- `Raw antibody volume` (line 215)
- `New beads` (line 225)
- `New antibodies` (line 226)
- `Total bead volume` (line 227)
- `Total antibody volume` (line 228)

The Plan 15-05 SUMMARY and CONTEXT.md mention these as part of the audit trail
spec (D-15-01..16). Either:
- These fields are intentionally deferred to a later sub-phase, in which case the
  code needs a `// TODO(15-XX): ...` marker so they don't ship to UAT as visible
  blanks; OR
- The Plan was complete and these fields should derive from the snapshotted
  `rawVolume` / `newBeadsUL` / `totalBeadsUL` / etc. (already computed by
  `calculatorStore.getOutputs` but NOT snapshotted onto `RunRecord`).

The empty-string placeholders look like a copy-paste scaffold that was never
filled in. Recommend either implementing the derivations (compose from
`calculateRawVolume` + `applyOldReagentSubtraction` against snapshotted inputs,
mirroring the existing `finalVolumeML` derivation at lines 86-97) or adding an
explicit TODO so Phase 16 UAT knows these are placeholders.

**Fix:**
```tsx
{/* TODO(Phase 16): derive Raw/New/Total reagent volumes from snapshotted
    rawVolume + oldBeadsUL + oldAntibodiesUL using applyOldReagentSubtraction.
    Currently rendered as '—' because rawVolume is not stored on RunRecord. */}
<Row label="Raw bead volume" value="—" />
```
Or implement the derivation against the existing snapshotted fields.

---

### WR-07: `AuditTrailSection` falls back to raw UUID for `panelName` when panel was wholesale-replaced

**File:** `src/renderer/src/features/run/components/AuditTrailSection.tsx:43-45`
**Issue:**
```ts
const panel = r.panelId ? panels.find((p) => p.id === r.panelId) : null
const panelName = r.panelId ? (panel?.name ?? r.panelId) : null
```
The fallback `panel?.name ?? r.panelId` yields a raw UUID string when the panel
was wholesale-replaced (Phase 13 D-15 / Pitfall E: `runs.panel_id` is set to NULL
when premix panel is deleted, but the run may still hold the OLD UUID until the
SET NULL fires post-DELETE… actually no — the schema uses `onDelete: 'set null'`,
so `r.panelId` should be null in that case). However, there's a window when the
panel exists in DB but `selectionStore.panels` hasn't loaded it (e.g., if the
operator viewed a historical run on a different platform than `selectedPlatformId`).

This matches `FinalizedRunHeader.tsx:58-59`'s pattern, so the inconsistency is
not new in Phase 15. Still worth surfacing because the audit trail is the
"forensic" view — showing a UUID is worse than showing `"(panel data archived)"`.

**Fix:** Use a friendlier placeholder when the panel isn't in `selectionStore.panels`:
```ts
const panelName = r.panelId
  ? (panel?.name ?? '(panel data unavailable)')
  : null
```

---

## Info

### IN-01: Redundant null checks after gate in `buildRunSnapshot`

**File:** `src/renderer/src/features/run/hooks/useRunSnapshot.ts:115-118`
**Issue:** Lines 115-116 re-check `selectedPlatformId` / `selectedSpeciesId` after
the gate at line 108-109 already validated them. The inline comment explains
this is intentional TS narrowing because the gate logic was extracted into a
helper. Functional but verbose. Consider a typed predicate helper or a non-null
assertion with a clarifying comment.

### IN-02: `// prettier-ignore` one-line ternary in `runStore.saveCurrentRun`

**File:** `src/renderer/src/stores/runStore.ts:69-70`
**Issue:** The ternary that decides between `update` and `create` is kept on one
line via `// prettier-ignore`. Acceptable, but a regular if/else would be more
readable.

### IN-03: `migration.test.ts` uses brittle `__dirname`-relative path

**File:** `src/main/db/__tests__/migration.test.ts:7`
**Issue:** `path.join(__dirname, '../../../../drizzle/migrations')` will break if
this test file is moved or the directory depth changes. Consider exporting the
migrations path from a single helper module.

### IN-04: `auditTrail.test.ts` silent-fallback tests document intentional behavior

**File:** `src/renderer/src/features/run/lib/__tests__/auditTrail.test.ts:18-23`
**Issue:** Tests T-M5 and T-M6 verify that `computePeVolumeML` silently falls
back to 1× when `sapeConcentration === 0` or `undefined`. Per the function
docstring this is intentional (PRD: "typically 1×"). For a future maintainer,
consider whether `sapeConcentration === 0` is a data-quality signal that should
surface as a warning rather than silently coerce. Currently low-priority because
the PRD explicitly calls for this fallback.

### IN-05: `dash()` helper coerces `0` and `false` correctly but ambiguously

**File:** `src/renderer/src/features/run/components/AuditTrailSection.tsx:48-49`
**Issue:** `dash(0)` returns `"0"`, not `"—"`. This is correct for the current
call sites (`plateCount`, `sampleCount`, `numberOfSetups`, `totalWells` — all of
which can legitimately be 0 or 1+). Just flagging that a future reuse for a
field where 0 means "absent" would silently render `"0"` instead of `"—"`. A
docstring on `dash` clarifying the distinction would help.

### IN-06: `runRepository.update` ignores `requestType` / `platformId` / `speciesId` silently

**File:** `src/main/db/repositories/run.ts:142-164`
**Issue:** The repository's `update()` method intentionally omits these 3 fields
from its Drizzle `set()` call (immutable post-create per the comment). The TS
type `RunUpdate = RunCreate` allows callers to pass them, and they are silently
discarded at the repo layer. This is documented in the comment but easy to miss
— a caller could mistakenly pass a different `platformId` and never know it was
ignored. Consider either:
- splitting `RunUpdate` into a narrower type that omits the immutable fields, or
- adding a runtime guard in `update()` that throws if the new values differ from
  the existing row's values (defense in depth).

This is pre-Phase-15 behavior; Phase 15 inherits it. Low-priority.

---

_Reviewed: 2026-05-12T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
