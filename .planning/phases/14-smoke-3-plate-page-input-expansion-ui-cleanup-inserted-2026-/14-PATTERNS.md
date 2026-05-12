# Phase 14: Smoke 3 — Plate Page Input Expansion + UI Cleanup — Pattern Map

**Mapped:** 2026-05-12
**Files analyzed:** 14 modified + 4 new = 18 files
**Analogs found:** 18 / 18 (10 exact, 7 role-match, 1 partial — modal primitive reuse)
**Source of file list:** 14-CONTEXT.md §Canonical References (Codebase locations + Tests to extend / add)

> Project-instruction note (CLAUDE.md): Phase ships on `dev/v1-01` branch, Windows-only deployment (`npm run build:win` → install on Windows workstation), Conventional Commits, three-strike debug rule. **Vitest config only includes `*.test.ts` (NOT `*.test.tsx`)** — see vitest.config.ts line 7. New CalculatorForm test must therefore be written as `*.test.ts` driving the store layer (lib/integration pattern) OR vitest.config.ts must be extended to include `.test.tsx`. Recommendation: extend config; planner decides.

---

## File Classification

| # | File (new / modified) | Role | Data Flow | Closest Analog | Match Quality |
|---|-----------------------|------|-----------|----------------|---------------|
| 1 | `src/renderer/src/stores/calculatorStore.ts` (mod) | store | request-response | (self — existing `setNumberOfSetups` / `setVolumePerWell`) | exact |
| 2 | `src/renderer/src/stores/plateStore.ts` (mod) | store | request-response | (self — existing `setSampleCount`/`addPlate`/`removePlate`) | exact |
| 3 | `src/renderer/src/stores/selectionStore.ts` (mod, `selectPanel` only) | store | request-response | (self — current `selectPanel` lines 172-203) | exact (refinement, not rewrite) |
| 4 | `src/renderer/src/features/run/hooks/useRunSnapshot.ts` (mod) | hook | request-response | (self — existing `numberOfSetups` lines 101-106) | exact |
| 5 | `src/renderer/src/features/calculator/hooks/useCalculator.ts` (mod) | hook | request-response | (self — existing destructure lines 13-26 + return shape 65-99) | exact |
| 6 | `src/renderer/src/features/calculator/components/CalculatorForm.tsx` (mod, restructure) | component | request-response | (self + `SampleCountInput.tsx` for `<input type="number">` pattern) | role-match |
| 7 | `src/renderer/src/features/platform/components/PlatformCard.tsx` (mod, strip lines 42-49) | component | render | (self — lines 42-49 are deleted; rest unchanged) | exact (deletion) |
| 8 | `src/renderer/src/features/platform/components/PlatformSelector.tsx` (mod, strip lines 56-61) | component | render | (self — lines 56-61 are deleted; rest unchanged) | exact (deletion) |
| 9 | `src/renderer/src/features/selection/components/SelectedAnalytesList.tsx` (mod, replace internals) | component | render | (self — outer shell preserved; panel/singles grouping torn out) | role-match (structural rewrite) |
| 10 | `src/renderer/src/features/plate/hooks/usePlateLayout.ts` (mod, duplicate branch) | hook | derive-from-store | (self — singles branch lines 65-81 is the pattern to mirror) | role-match |
| 11 | `src/renderer/src/features/plate/components/PlatePanel.tsx` `computeSampleIndexMap` (mod) | helper | derive | (self lines 15-68; uses `getDuplicatePair`) | exact (geometry change only) |
| 12 | `src/shared/constants/calculator.ts` `getDuplicatePair` (mod) + retire `DUPLICATE_HORIZONTAL_PAIRS`, `DUPLICATE_VERTICAL_COL` | shared-constant | pure-fn | (self lines 65-89) | exact (rewrite preserving signature) |
| 13 | `src/renderer/src/lib/calculator.ts` (mod — add old-reagent subtraction) | lib | pure-fn | (self — `calculateVolumes` lines 82-105, `createCalculatorInputs` lines 146-172) | role-match |
| 14 | `src/renderer/src/lib/decimal.ts` (mod, add `floorToTenthML`) | lib | pure-fn | (self — `ceilToTenthML` lines 44-48) | exact |
| 15 | **NEW** `src/renderer/src/features/plate/components/OldReagentCapModal.tsx` | component | event-driven | `src/renderer/src/features/run/components/EditWarningModal.tsx` (wraps `ConfirmModal`) | role-match |
| 16 | **NEW** `src/renderer/src/features/plate/__tests__/usePlateLayout.test.ts` | test | unit | `src/renderer/src/lib/__tests__/calculator.test.ts` (vitest, pure-fn) | role-match |
| 17 | **NEW** `src/shared/constants/__tests__/getDuplicatePair.test.ts` | test | unit | `src/renderer/src/lib/__tests__/calculator.test.ts` (vitest, pure-fn) | role-match |
| 18 | **NEW** `src/renderer/src/features/calculator/__tests__/CalculatorForm.test.ts` (or extend integration test) | test | integration | `src/renderer/src/lib/__tests__/calculator.integration.test.ts` Group F + Group G | role-match |
| — | `src/renderer/src/lib/__tests__/calculator.integration.test.ts` (mod, ADD Groups F'+G' for old-reagent math + 20%-cap) | test | integration | (self Groups F + G) | exact |

---

## Pattern Assignments

### 1. `src/renderer/src/stores/calculatorStore.ts` (store, request-response)

**Analog:** self — existing `setNumberOfSetups` (lines 125-138) + `setVolumePerWell` (lines 152-160).

**State-field pattern** (lines 28-66 — TS interface) — add `oldBeads: number` and `oldAntibodies: number` as parallel siblings to `numberOfSetups: number`:
```typescript
// existing (line 42)
numberOfSetups: number
// add (alongside, same shape)
oldBeads: number      // mL units; raw typed value, floor-rounded at consumption per D-08
oldAntibodies: number // mL units; raw typed value, floor-rounded at consumption per D-08
```

**Initial state pattern** (lines 68-76):
```typescript
const initialState = {
  sampleCount: 1,
  replicateMode: 'singles' as ReplicateMode,
  requestType: 'premix' as RequestType,
  volumePerWell: DEFAULT_VOLUME_PER_WELL,
  numberOfSetups: 1,
  // add:
  oldBeads: 0,
  oldAntibodies: 0,
  singles: [] as SingleAnalyte[],
  validationError: null as string | null
}
```

**Action pattern — validating setter** (lines 125-138, the canonical Phase-12 shape):
```typescript
setNumberOfSetups: (n: number) => {
  if (!Number.isInteger(n) || n < 1 || n > 1000) {
    set({
      validationError: `Number of setups must be an integer between 1 and 1000 (got ${n})`
    })
    return
  }
  set({ numberOfSetups: n, validationError: null })
},
```

**Mirror with relaxed validation for old-reagent setters** — `oldBeads`/`oldAntibodies` are `number ≥ 0` (no upper bound at the store; 20% cap enforced at consumption + UI):
```typescript
setOldBeads: (mL: number) => {
  if (!Number.isFinite(mL) || mL < 0) {
    set({ validationError: `Old beads must be a non-negative number (got ${mL})` })
    return
  }
  set({ oldBeads: mL, validationError: null })
},
setOldAntibodies: (mL: number) => {
  if (!Number.isFinite(mL) || mL < 0) {
    set({ validationError: `Old antibodies must be a non-negative number (got ${mL})` })
    return
  }
  set({ oldAntibodies: mL, validationError: null })
},
```

**`getOutputs()` integration pattern** (lines 201-220) — Phase 14 extends this to apply old-reagent subtraction. Per CONTEXT D-08, the floor-rounding happens HERE at consumption (NOT in the setter):
```typescript
getOutputs: () => {
  const { sampleCount, replicateMode, volumePerWell, numberOfSetups, validationError } = get()
  const plateCount = usePlateStore.getState().getPlateCount()
  if (validationError || sampleCount <= 0) return null
  const inputs = createCalculatorInputs(sampleCount, replicateMode, plateCount, volumePerWell, numberOfSetups)
  return calculateVolumes(inputs)
}
```
**Add: floor-round oldBeads/oldAntibodies before passing into calculator (D-07/D-08).** Use `floorToTenthML` (new, see file #14) — pattern in `lib/decimal.ts` line 44-48 mirror but with `Decimal.ROUND_FLOOR`.

**Reset cascade pattern** (lines 186-199) — `oldBeads`/`oldAntibodies` reset to 0 automatically via `set(initialState)`. No code change needed if added to `initialState`.

---

### 2. `src/renderer/src/stores/plateStore.ts` (store, request-response)

**Analog:** self — existing `addPlate` (lines 265-273) + `removePlate` (lines 275-292).

**Existing plate-count surface** (the bidirectional contract is between `plateStore.plates` keys and `getPlateCount()` line 328-330):
```typescript
addPlate: () => {
  const { plates } = get()
  const plateNumbers = Object.keys(plates).map(Number)
  const nextPlate = Math.max(...plateNumbers, 0) + 1
  set({
    plates: { ...plates, [nextPlate]: new Set<string>() },
    activePlate: nextPlate
  })
},

removePlate: (plateNumber: number) => {
  const { plates, activePlate } = get()
  const newPlates = { ...plates }
  delete newPlates[plateNumber]
  // Ensure at least one plate exists
  const remaining = Object.keys(newPlates).map(Number)
  if (remaining.length === 0) {
    newPlates[1] = new Set<string>()
  }
  const validActive = activePlate === plateNumber
    ? Math.min(...Object.keys(newPlates).map(Number))
    : activePlate
  set({ plates: newPlates, activePlate: validActive })
},
```

**NEW: `setPlateCount(n)` action pattern** (per CONTEXT D-03 — bidirectional with PlateToolbar Add/Remove buttons; per-plate well assignments survive when count grows, plates beyond new count get cleared on shrink):
```typescript
setPlateCount: (n: number) => {
  if (!Number.isInteger(n) || n < 1) return // silent reject per validating-setter convention
  const { plates, activePlate } = get()
  const currentMax = Math.max(...Object.keys(plates).map(Number), 0)
  if (n === currentMax) return // no-op
  const newPlates: Record<number, Set<string>> = {}
  // Preserve existing assignments up to min(currentMax, n)
  for (let p = 1; p <= Math.min(currentMax, n); p++) {
    newPlates[p] = plates[p] ?? new Set<string>()
  }
  // Add empty slots for growth
  for (let p = currentMax + 1; p <= n; p++) {
    newPlates[p] = new Set<string>()
  }
  // Shrink: anything > n is dropped (mirrors removePlate's behavior of just deleting keys)
  const validActive = activePlate > n ? Math.min(...Object.keys(newPlates).map(Number)) : activePlate
  set({ plates: newPlates, activePlate: validActive })
},
```

**autoFill duplicate-branch rewrite** (lines 130-151 — the lines being retired per D-21/D-26):
```typescript
// BEFORE (retire): horizontal pairs in cols 4-5/6-7/8-9/10-11 + vertical pairs in col 12
for (const [col1, col2] of DUPLICATE_HORIZONTAL_PAIRS) {
  for (let rowIndex = 0; rowIndex < ROWS.length; rowIndex++) {
    if (samplesAssigned >= sampleCount) return
    plateWells.add(wellId(rowIndex, col1))
    plateWells.add(wellId(rowIndex, col2))
    samplesAssigned++
  }
}
// Vertical pairs in column 12: A/E, B/F, C/G, D/H
for (let topRow = 0; topRow < 4; topRow++) { /* ... */ }
```

**REPLACEMENT pattern (D-21/D-22 — uniform vertical pairs in cols 4-12, column-first):**
```typescript
// Duplicates mode (replacement): vertical pairs (A,B)(C,D)(E,F)(G,H) within each col 4-12
const UNKNOWN_COLS = [4, 5, 6, 7, 8, 9, 10, 11, 12] as const
const PAIR_TOP_ROWS = [0, 2, 4, 6] as const // A, C, E, G (paired with B, D, F, H)
for (const col of UNKNOWN_COLS) {
  for (const topRow of PAIR_TOP_ROWS) {
    if (samplesAssigned >= sampleCount) return
    plateWells.add(wellId(topRow, col))
    plateWells.add(wellId(topRow + 1, col))
    samplesAssigned++
  }
}
```

---

### 3. `src/renderer/src/stores/selectionStore.ts` `selectPanel` (store, request-response)

**Analog:** self — existing `selectPanel` (lines 172-203, the D-4.1-04 implementation).

**Existing pattern (lines 172-203)** — clears `selectedSingleIds: []` on EVERY panel switch including null:
```typescript
selectPanel: async (panelId: string | null) => {
  // Per D-4.1-04: switching between premix selections (including to "No Premix")
  // must clear stale singles so analytes scoped to the prior premix do not
  // survive the switch. Clear optimistically; re-applied even on fetch error.
  if (panelId === null) {
    set({
      selectedPanelId: null,
      selectedPanel: null,
      selectedSingleIds: []  // <-- THIS clears the singles; Phase 14 D-18 preserves them when panelId === null
    })
    return
  }
  set({
    panelLoading: true,
    panelError: null,
    selectedSingleIds: []   // <-- THIS clears on switch-to-new-premix; Phase 14 D-20 prunes only members of new premix
  })
  try {
    const panelWithAnalytes = await window.electronAPI.panel.getWithAnalytes(panelId)
    set({
      selectedPanelId: panelId,
      selectedPanel: panelWithAnalytes,
      panelLoading: false
    })
  } catch (err) {
    // ...
  }
}
```

**REFINEMENT per D-18 (panel deselect → null preserves singles) + D-20 (switch from A → B prunes only members of B):**
```typescript
selectPanel: async (panelId: string | null) => {
  // D-18: deselect-to-null PRESERVES previously-picked singles so member analytes
  // return to the singles pool as candidates without auto-add.
  if (panelId === null) {
    set({
      selectedPanelId: null,
      selectedPanel: null
      // selectedSingleIds: intentionally NOT cleared (D-18)
    })
    return
  }
  // D-20: switching to a new premix prunes any singles that are members of the
  // new premix (they become panel-members, not singles); non-member singles survive.
  set({ panelLoading: true, panelError: null })
  try {
    const panelWithAnalytes = await window.electronAPI.panel.getWithAnalytes(panelId)
    const { selectedSingleIds } = get()
    const newPanelMemberIds = new Set(panelWithAnalytes?.analytes.map((a) => a.id) ?? [])
    const prunedSingles = selectedSingleIds.filter((id) => !newPanelMemberIds.has(id))
    set({
      selectedPanelId: panelId,
      selectedPanel: panelWithAnalytes,
      selectedSingleIds: prunedSingles,
      panelLoading: false
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to load panel details'
    set({ panelError: message, panelLoading: false })
    console.error('Failed to load panel details:', err)
  }
}
```

**Note on `getAvailableSingles` (lines 295-306)** — already returns `availableAnalytes` (full list) when `selectedPanel === null`. No change needed; D-19 "members return to singles pool as candidates" automatically Just Works after D-18 preserves the IDs.

---

### 4. `src/renderer/src/features/run/hooks/useRunSnapshot.ts` (hook, request-response)

**Analog:** self — existing `numberOfSetups` handling at lines 101-106.

**Existing pattern (lines 101-106 of `buildRunSnapshot`):**
```typescript
deadVolume: calculator.numberOfSetups * 2000,
numberOfSetups: calculator.numberOfSetups,
```

**Mirror pattern for Phase 14 (add `oldBeads` + `oldAntibodies` to the snapshot for SMK3-16 fidelity):**
```typescript
// Inside buildRunSnapshot, alongside numberOfSetups (snapshot-fidelity contract):
deadVolume: calculator.numberOfSetups * 2000,
numberOfSetups: calculator.numberOfSetups,
oldBeads: calculator.oldBeads,          // NEW — raw typed value, NOT floor-rounded (D-08 preserves author intent)
oldAntibodies: calculator.oldAntibodies, // NEW — raw typed value
```

**Note on `RunCreate` / `RunRecord` shape:** `src/shared/types/run.ts` lines 23-34 + 66-73 already extended `numberOfSetups?` as optional with `?? 1` default in `runStore.loadRun` line 141. Mirror the same pattern: add `oldBeads?: number` + `oldAntibodies?: number` to both interfaces (and the Zod schema in `src/shared/schemas/run.ts` if it exists — verify; not in CONTEXT canonical refs list, planner to spot-check). `runStore.loadRun` calls `setOldBeads(run.oldBeads ?? 0)` + `setOldAntibodies(run.oldAntibodies ?? 0)` mirroring the `?? 1` defaulting pattern.

**runStore.loadRun cascade pattern** (from `src/renderer/src/stores/runStore.ts` lines 125-142, the Phase-12 cascade — VERBATIM target to extend):
```typescript
// 6. Calculator — replicateMode FIRST, sampleCount SECOND.
calculator.setReplicateMode(run.replicateMode)
calculator.setSampleCount(run.sampleCount)
// SMK3-16 (snapshot-frozen contract): restore volumePerWell BEFORE setNumberOfSetups
calculator.setVolumePerWell(run.volumePerWell)
calculator.setNumberOfSetups(run.numberOfSetups ?? 1)
// ADD per Phase 14:
calculator.setOldBeads(run.oldBeads ?? 0)
calculator.setOldAntibodies(run.oldAntibodies ?? 0)
```

---

### 5. `src/renderer/src/features/calculator/hooks/useCalculator.ts` (hook, request-response)

**Analog:** self — existing destructure (lines 13-26) + return shape (lines 65-99).

**Existing destructure pattern (lines 13-26):**
```typescript
const {
  sampleCount,
  replicateMode,
  volumePerWell,
  numberOfSetups,
  validationError,
  setSampleCount,
  setReplicateMode,
  reset,
  getOutputs
} = useCalculatorStore()
```

**Mirror for Phase 14 (add `oldBeads`, `oldAntibodies`, `setOldBeads`, `setOldAntibodies`, `plateCount` linkage):**
```typescript
const {
  sampleCount,
  replicateMode,
  volumePerWell,
  numberOfSetups,
  oldBeads,            // NEW
  oldAntibodies,       // NEW
  validationError,
  setSampleCount,
  setReplicateMode,
  setNumberOfSetups,   // ADD — currently used only by runStore; UI needs it now
  setOldBeads,         // NEW
  setOldAntibodies,    // NEW
  reset,
  getOutputs
} = useCalculatorStore()
```

**Existing plateCount linkage (line 32):**
```typescript
// Read plateCount from plateStore (auto-calculated)
const plateCount = usePlateStore().getPlateCount()
```

**Mirror for Phase 14 — expose `setPlateCount` from `plateStore` (NEW action per file #2 above):**
```typescript
const plateCount = usePlateStore().getPlateCount()
const setPlateCount = usePlateStore((s) => s.setPlateCount)
```

**Return shape pattern (lines 65-99) — extend with the new inputs:**
```typescript
return {
  // Inputs
  sampleCount,
  replicateMode,
  plateCount,
  volumePerWell,
  numberOfSetups,
  oldBeads,        // NEW
  oldAntibodies,   // NEW
  // ...
  setSampleCount,
  setReplicateMode,
  setNumberOfSetups,  // NEW
  setOldBeads,        // NEW
  setOldAntibodies,   // NEW
  setPlateCount,      // NEW
  reset
}
```

---

### 6. `src/renderer/src/features/calculator/components/CalculatorForm.tsx` (component, request-response)

**Analog:** self (existing 81 lines, lines 22-80) + `SampleCountInput.tsx` (the `<input type="number">` + slider pattern at lines 70-80).

**Existing label-and-input pattern (lines 30-58, the Replicate Mode block):**
```typescript
<div>
  <label className="block text-sm font-medium text-[var(--color-foreground)] mb-1">
    Replicate Mode
  </label>
  <div className="flex gap-4">
    {/* ... */}
  </div>
</div>
```

**Existing read-only block pattern (lines 60-71, Request Type):**
```typescript
<div>
  <label className="block text-sm font-medium text-[var(--color-foreground)] mb-1">
    Request Type
  </label>
  <div className="px-3 py-2 bg-gray-50 border border-[var(--color-border)] rounded-md text-sm text-[var(--color-foreground)]">
    {requestTypeLabel}
    <span className="text-xs text-[var(--color-muted)] ml-2">
      (determined by analyte selection)
    </span>
  </div>
</div>
```

**Existing validation banner pattern (lines 73-78 — to compose with the 20%-cap red-border):**
```typescript
{validationError && (
  <div className="p-3 bg-red-50 border border-red-200 rounded-md">
    <p className="text-sm text-red-700">{validationError}</p>
  </div>
)}
```

**Numeric input pattern to mirror — from `SampleCountInput.tsx` lines 69-90 (the existing two-state `displayValue`/`value` pattern for typed-vs-committed-number-input friction):**
```typescript
const [displayValue, setDisplayValue] = useState(value === 0 ? '' : String(value))

useEffect(() => {
  setDisplayValue(value === 0 ? '' : String(value))
}, [value])

const commitValue = useCallback((raw: string) => {
  const parsed = parseInt(raw, 10)  // or parseFloat for old-reagent mL inputs
  if (isNaN(parsed) || parsed < 0) {
    onChange(0)
    setDisplayValue('')
  } else {
    const clamped = Math.min(parsed, max)
    onChange(clamped)
    setDisplayValue(clamped === 0 ? '' : String(clamped))
  }
}, [max, onChange])

// onBlur + Enter commit
<input
  type="number"
  min={0}
  step={0.1}            // for old-reagent mL inputs; step={1} for integer inputs (plates, setups)
  value={displayValue}
  onChange={handleFieldChange}
  onBlur={handleFieldBlur}
  onKeyDown={handleFieldKeyDown}
  className="w-24 px-3 py-2 border border-[var(--color-border)] rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
/>
```

**NEW input-ordering structure per D-01** (`CalculatorForm.tsx` restructure target — 7 inputs in this order):
1. Number of Plates `<input type="number" min="1" step="1">` (bidirectional to `plateStore.setPlateCount` per file #2)
2. Replicate Mode (existing radios, no change)
3. Number of Samples (existing `<SampleCountInput>`)
4. Old Beads — mL `<input type="number" min="0" step="0.1">` (calls `setOldBeads`)
5. Old Antibodies — mL `<input type="number" min="0" step="0.1">` (calls `setOldAntibodies`)
6. Number of Setups `<input type="number" min="1" step="1">` (calls `setNumberOfSetups`)
7. Request Type read-only (existing block, no change)

**20%-cap red-border helper text pattern per D-10** (compose with existing validation banner at lines 73-78):
```typescript
// Compute cap inline; per D-09 cap = 0.20 × (sampleCount × volumePerWell + numberOfSetups × 2000) / 1000 (mL)
const beadsCap = 0.20 * (sampleCount * volumePerWell + numberOfSetups * 2000) / 1000
const beadsExceeds = oldBeads > beadsCap && !beadsOverrideAccepted

<input
  className={`w-24 px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 ${
    beadsExceeds
      ? 'border-red-500 ring-red-500'
      : 'border-[var(--color-border)] focus:ring-[var(--color-primary)]'
  }`}
  // ...
/>
{beadsExceeds && (
  <p className="text-xs text-red-600 mt-1">
    Max {beadsCap.toFixed(1)} mL (20% of {(beadsCap / 0.2).toFixed(1)} mL total). Override?
  </p>
)}
```

---

### 7. `src/renderer/src/features/platform/components/PlatformCard.tsx` (component, render — deletion)

**Analog:** self — lines 42-49 are deleted; everything else preserved.

**Deletion target (lines 42-49):**
```typescript
<div className="flex items-center gap-2 pt-2 border-t border-[var(--color-border)]">
  <span className="text-xs font-medium text-[var(--color-muted)] uppercase tracking-wide">
    Stock Concentration:
  </span>
  <span className="text-sm font-semibold text-[var(--color-foreground)]">
    {platform.stockConcentration}x
  </span>
</div>
```

Result: card is Title + Selected badge + Description (existing lines 24-41) only. Per D-12, no replacement micro-fact, no preserved spacer.

---

### 8. `src/renderer/src/features/platform/components/PlatformSelector.tsx` (component, render — deletion)

**Analog:** self — lines 56-61 are deleted; line 54 (the heading) preserved.

**Deletion target (lines 56-61):**
```typescript
<p className="text-sm text-green-700">
  Stock concentration: <strong>{selectedPlatform.stockConcentration}x</strong>
</p>
<p className="text-sm text-green-600 mt-2">
  Ready to proceed with reagent calculations.
</p>
```

**Result block (per D-13):**
```typescript
{selectedPlatform && (
  <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
    <h3 className="font-medium text-green-800 mb-2">
      Platform Selected: {selectedPlatform.name}
    </h3>
  </div>
)}
```

Note: CONTEXT canonical-refs cites lines 56-61, REQUIREMENTS-table cites lines 57+60. Both ranges resolve to the same two `<p>` blocks. Verified above against the actual file.

---

### 9. `src/renderer/src/features/selection/components/SelectedAnalytesList.tsx` (component, render — structural rewrite)

**Analog:** self — outer container (lines 21-32) preserved; lines 46-129 (panel section + singles section) replaced with a single flat list.

**Preserve (lines 21-32, the shell + header + count badge):**
```typescript
<div className="w-72 shrink-0 sticky top-0 self-start">
  <div className="border border-[var(--color-border)] rounded-lg overflow-hidden bg-white">
    {/* Header */}
    <div className="px-4 py-3 bg-gray-50 border-b border-[var(--color-border)]">
      <h4 className="text-sm font-medium text-[var(--color-foreground)]">
        Selected Analytes
        {totalCount > 0 && (
          <span className="ml-2 text-xs text-[var(--color-muted)]">({totalCount})</span>
        )}
      </h4>
    </div>
```

**Empty state preserved (lines 34-43):**
```typescript
{totalCount === 0 && (
  <div className="px-4 py-6 text-center">
    <p className="text-sm text-[var(--color-muted)]">No analytes selected.</p>
    <p className="text-xs text-[var(--color-muted)] mt-1">
      Choose a premix panel or add individual analytes.
    </p>
  </div>
)}
```

**Replace (lines 46-129) with a single flat-sorted list per D-14/D-15/D-16:**

Sort key (D-15) — `beadRegion` numeric ascending, lexical fallback if any value doesn't parse:
```typescript
function sortByBeadRegion(a: Analyte, b: Analyte): number {
  const aNum = Number(a.beadRegion)
  const bNum = Number(b.beadRegion)
  if (!Number.isNaN(aNum) && !Number.isNaN(bNum) && aNum !== bNum) return aNum - bNum
  // Numeric tie OR non-numeric — fall back to lexical
  const beadCompare = String(a.beadRegion).localeCompare(String(b.beadRegion))
  if (beadCompare !== 0) return beadCompare
  return a.name.localeCompare(b.name) // alphabetic tiebreaker
}

const flatList = useMemo(() => {
  return [...panelAnalytes, ...singleAnalytes].sort(sortByBeadRegion)
}, [panelAnalytes, singleAnalytes])

// Track which IDs are panel members vs standalone singles for D-16 conditional remove button
const panelMemberIds = useMemo(() => new Set(panelAnalytes.map((a) => a.id)), [panelAnalytes])
```

Row content per D-16 — drop the per-analyte remove button on premix-member rows; keep on singles rows. Mirror the existing singles-row style (lines 97-126) but conditional on `panelMemberIds.has(analyte.id)`:
```typescript
<div className="divide-y divide-[var(--color-border)]">
  {flatList.map((analyte) => {
    const isPanelMember = panelMemberIds.has(analyte.id)
    return (
      <div key={analyte.id} className="px-4 py-2 flex items-center justify-between group">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-sm text-[var(--color-foreground)] truncate">{analyte.name}</span>
          <span className="text-xs text-[var(--color-muted)] bg-gray-100 px-2 py-0.5 rounded shrink-0">
            {analyte.beadRegion}
          </span>
        </div>
        {!isPanelMember && (
          <button
            type="button"
            onClick={() => onRemoveSingle(analyte.id)}
            className="opacity-0 group-hover:opacity-100 text-red-500 hover:text-red-700 transition-opacity p-1 rounded hover:bg-red-50 shrink-0 ml-2"
            title="Remove analyte"
          >
            {/* X icon, lines 116-124 unchanged */}
          </button>
        )}
      </div>
    )
  })}
</div>
```

**Per D-17, component name + file location unchanged.** The `panelName` prop becomes unused but kept on the interface (consumer is `AnalyteSelectionPanel.tsx` line 72 — `panelName={selectedPanel?.name ?? null}`). Decision for planner: drop the prop and update the caller, or keep it as an inert prop for binary-compat. Recommendation: drop it (single caller, simple update).

---

### 10. `src/renderer/src/features/plate/hooks/usePlateLayout.ts` (hook, derive-from-store)

**Analog:** self — singles branch (lines 65-81) is the cleanest pattern; duplicate branch (lines 82-132) is the rewrite target.

**Singles-branch pattern to mirror (lines 65-81, column-first iteration):**
```typescript
if (replicateMode === 'singles') {
  // Singles: fill down columns first, then across
  // 9 unknown columns (4-12) x 8 rows = 72 wells per plate
  for (const col of unknownCols) {
    for (let rowIndex = 0; rowIndex < ROWS.length; rowIndex++) {
      if (globalSampleIndex > sampleCount) break
      wells[rowIndex][col - 1] = {
        id: `${ROWS[rowIndex]}${col}`,
        row: ROWS[rowIndex],
        col,
        type: 'unknown',
        sampleIndex: globalSampleIndex
      }
      globalSampleIndex++
    }
    if (globalSampleIndex > sampleCount) break
  }
}
```

**Duplicate-branch retire target (lines 82-132 — the entire `else` block with `DUPLICATE_HORIZONTAL_PAIRS` outer loop + col-12 special case).**

**REPLACEMENT pattern per D-22/D-24 (column-first, 4 vertical pairs per col 4-12):**
```typescript
} else {
  // Duplicates: vertical pairs (A,B)(C,D)(E,F)(G,H) within each unknown column 4-12.
  // 9 cols × 4 pairs/col = 36 samples per plate (= UNKNOWN_WELLS_DUPLICATES cap).
  const PAIR_TOP_ROWS = [0, 2, 4, 6] as const // row 0=A pairs with 1=B; 2=C with 3=D; 4=E with 5=F; 6=G with 7=H
  for (const col of unknownCols) {
    for (const topRow of PAIR_TOP_ROWS) {
      if (globalSampleIndex > sampleCount) break
      const bottomRow = topRow + 1
      wells[topRow][col - 1] = {
        id: `${ROWS[topRow]}${col}`,
        row: ROWS[topRow],
        col,
        type: 'unknown',
        sampleIndex: globalSampleIndex
      }
      wells[bottomRow][col - 1] = {
        id: `${ROWS[bottomRow]}${col}`,
        row: ROWS[bottomRow],
        col,
        type: 'unknown',
        sampleIndex: globalSampleIndex
      }
      globalSampleIndex++
    }
    if (globalSampleIndex > sampleCount) break
  }
}
```

**Imports cleanup (lines 6-10) — drop `DUPLICATE_HORIZONTAL_PAIRS` and `DUPLICATE_VERTICAL_COL` per D-26:**
```typescript
// REMOVE this import block entirely after rewrite:
import {
  DUPLICATE_HORIZONTAL_PAIRS,
  DUPLICATE_VERTICAL_COL
} from '../../../../../shared/constants/calculator'
```

---

### 11. `src/renderer/src/features/plate/components/PlatePanel.tsx` `computeSampleIndexMap` (helper, derive)

**Analog:** self lines 15-68; uses `getDuplicatePair` from `shared/constants/calculator.ts`.

**Existing pattern (lines 15-68) — already calls `getDuplicatePair` and sorts column-first.** Per D-25, the function itself does NOT need a rewrite: once `getDuplicatePair` returns the new vertical-pair partner (file #12 below), `computeSampleIndexMap` "just works" because:
1. The wells set comes from `plateStore` (which after `autoFill` rewrite from file #2 will contain the new geometry).
2. The sort (lines 25-31) is already column-first.
3. The pair lookup (lines 52-54) delegates to `getDuplicatePair`.

**Verification target for planner:** confirm `computeSampleIndexMap` produces the canonical samples-1-to-36-in-cols-4-to-12 ordering after `getDuplicatePair` is rewritten. Best path: snapshot test in `PlatePanel.test.ts` (NEW; not strictly required by CONTEXT canonical refs but a low-cost belt-and-suspenders).

---

### 12. `src/shared/constants/calculator.ts` `getDuplicatePair` (shared-constant, pure-fn)

**Analog:** self — current implementation (lines 65-89, the col-12-special-case branch).

**Current signature (PRESERVE — line 65-68):**
```typescript
export function getDuplicatePair(
  row: number,
  col: number
): { row: number; col: number } | null {
```

**Current body (lines 70-88) — full retire/rewrite per D-23:**
```typescript
// RETIRE — current horizontal-pair + col-12-special-case logic:
if (col <= 2) return null
if (col === 11) {
  return { row: row < 4 ? row + 4 : row - 4, col: 11 }
}
const oneIndexedCol = col + 1
if (oneIndexedCol % 2 === 0) return { row, col: col + 1 }
else return { row, col: col - 1 }
```

**REPLACEMENT (D-23 — all cols 3-11 / 1-indexed 4-12 return the adjacent-row partner in the SAME column):**
```typescript
export function getDuplicatePair(
  row: number,
  col: number
): { row: number; col: number } | null {
  // Standard columns (0-indexed 0/1/2 = 1-indexed 1/2/3) have no pairs.
  if (col <= 2) return null
  // Unknown columns 0-indexed 3-11 (1-indexed 4-12): adjacent-row pair in SAME column.
  // Row 0 (A) ↔ Row 1 (B); Row 2 (C) ↔ Row 3 (D); Row 4 (E) ↔ Row 5 (F); Row 6 (G) ↔ Row 7 (H).
  const partnerRow = row % 2 === 0 ? row + 1 : row - 1
  return { row: partnerRow, col }
}
```

**Retire (lines 42-53) per D-26:**
```typescript
// DELETE: no longer referenced after Phase 14
export const DUPLICATE_HORIZONTAL_PAIRS: readonly [number, number][] = [...]
export const DUPLICATE_VERTICAL_COL = 12
```

**Preserve (line 15) per D-27:**
```typescript
export const UNKNOWN_WELLS_DUPLICATES = 36 // = 9 cols × 4 pairs (unchanged)
```

**Grep verification target:** after retiring `DUPLICATE_HORIZONTAL_PAIRS` and `DUPLICATE_VERTICAL_COL`, run `grep -rn "DUPLICATE_HORIZONTAL_PAIRS\|DUPLICATE_VERTICAL_COL" src/` and confirm zero hits outside the deleted lines. Current consumers (to update):
- `src/renderer/src/stores/plateStore.ts` lines 5-7 (autoFill imports — being rewritten in file #2)
- `src/renderer/src/features/plate/hooks/usePlateLayout.ts` lines 7-9 (duplicate branch — being rewritten in file #10)

---

### 13. `src/renderer/src/lib/calculator.ts` (lib, pure-fn — add old-reagent subtraction)

**Analog:** self — `calculateVolumes` (lines 82-105) + `createCalculatorInputs` (lines 146-172) for the function-signature pattern.

**Existing `createCalculatorInputs` pattern (lines 146-172) — the canonical SMK3-05 sanity-cap shape:**
```typescript
export function createCalculatorInputs(
  sampleCount: number,
  replicateMode: ReplicateMode,
  plateCount: number,
  volumePerWellUL: number = 25,
  numberOfSetups: number = 1
): CalculatorInputs {
  if (!Number.isInteger(numberOfSetups) || numberOfSetups < 1) {
    throw new Error(`createCalculatorInputs: numberOfSetups must be an integer >= 1 (got ${numberOfSetups})`)
  }
  if (numberOfSetups > 1000) {
    throw new Error(`createCalculatorInputs: numberOfSetups ${numberOfSetups} exceeds sanity cap of 1000`)
  }
  const deadVolumeUL = numberOfSetups * DEAD_VOLUME_PER_SETUP_UL
  return {
    sampleCount,
    replicateMode,
    plateCount,
    numberOfSetups,
    volumePerWell: createVolume(volumePerWellUL, 'uL'),
    deadVolume: createVolume(deadVolumeUL, 'uL')
  }
}
```

**Existing `calculateVolumes` pattern (lines 82-105):**
```typescript
export function calculateVolumes(inputs: CalculatorInputs): CalculatorOutputs {
  const { sampleCount, replicateMode, plateCount, volumePerWell, deadVolume } = inputs
  const { totalWells, unknownWells, standardWells } = calculateTotalWells(sampleCount, replicateMode, plateCount)
  const rawVolume = calculateRawVolume(totalWells, volumePerWell, deadVolume)
  const finalVolume = calculateFinalVolume(rawVolume)
  const finalVolumeML = finalVolume.dividedBy(1000).toNumber()
  return { totalWells, unknownWells, standardWells, rawVolume, finalVolume, finalVolumeML }
}
```

**RECOMMENDED EXTENSION (per CONTEXT deferred-open-question §"Whether `lib/calculator.ts` accepts `oldBeads` + `oldAntibodies` as new function parameters OR a separate `applyOldReagentSubtraction`"):**

Recommend `applyOldReagentSubtraction(outputs, oldBeadsUL, oldAntibodiesUL): { newBeads, newAntibodies, totalBeads, totalAntibodies }` as a SEPARATE pure function — keeps `calculateVolumes`'s signature stable and isolates the floor-clamping logic from the main pipeline. Pattern shape (mirror `calculateRawVolume` lines 61-67 / `calculateFinalVolume` lines 75-77 — single-purpose pure fns):
```typescript
/**
 * Apply old-reagent subtraction per Smoke 3 PRD §Calculation → Old Reagents.
 * - Old reagent volumes are floor-rounded to 0.1 mL at consumption (D-08).
 * - New reagent volume = max(0, calc - old) (D-11 floor-clamp to 0).
 * - Total reagent reported = old + new + dead (output rounding is the caller's job).
 *
 * Independent per-reagent (beads vs antibodies). Caller applies ceilToTenthML at
 * the OUTPUT boundary; inputs use floorToTenthML (asymmetric per D-07).
 */
export function applyOldReagentSubtraction(
  rawVolumeUL: Decimal,    // from calculateRawVolume — the "new-reagent calc" before subtraction
  oldReagentUL: Decimal    // operator-typed value, already floor-rounded to 0.1 mL by caller
): { newReagentUL: Decimal; totalReagentUL: Decimal } {
  const newReagentUL = Decimal.max(new Decimal(0), rawVolumeUL.minus(oldReagentUL))
  const totalReagentUL = oldReagentUL.plus(newReagentUL) // dead vol already inside rawVolumeUL
  return { newReagentUL, totalReagentUL }
}
```

**Wire-in point:** `calculatorStore.getOutputs()` (lines 201-220 of `calculatorStore.ts`) — between the existing `calculateVolumes` call and the return, the store calls `applyOldReagentSubtraction` once per reagent (beads + antibodies) using the floor-rounded old-reagent values, then includes the four new fields (`newBeadsUL`, `newAntibodiesUL`, `totalBeadsUL`, `totalAntibodiesUL`) in the outputs object. The `CalculatorOutputs` type (`src/shared/types/calculator.ts` lines 25-38) gains four new fields.

---

### 14. `src/renderer/src/lib/decimal.ts` (lib, pure-fn — add `floorToTenthML`)

**Analog:** self — `ceilToTenthML` (lines 44-48).

**Existing pattern (the ceil-to-tenth-mL helper Plan 12-01 shipped):**
```typescript
/**
 * Round volume UP to nearest 0.1 mL (ceiling at 0.1 mL precision).
 */
export function ceilToTenthML(volumeUL: Decimal): Decimal {
  const mL = volumeUL.dividedBy(1000)
  const roundedML = mL.toDecimalPlaces(1, Decimal.ROUND_CEIL)
  return roundedML.times(1000)
}
```

**Mirror with `ROUND_FLOOR` per D-07/D-08:**
```typescript
/**
 * Round volume DOWN to nearest 0.1 mL (floor at 0.1 mL precision).
 *
 * Asymmetric counterpart to ceilToTenthML — used for Old Beads / Old Antibodies
 * inputs per Smoke 3 D-07: operator's typed value is floor-rounded so they
 * never claim more on-hand reagent than they actually have. Calculator outputs
 * still ceiling-round (SMK3-06 / ceilToTenthML) so prep volume is sufficient.
 *
 * Examples (mL → mL):
 *   1.51 → 1.5
 *   1.59 → 1.5
 *   1.50 → 1.5
 *   0.04 → 0.0
 *   0.00 → 0.0
 */
export function floorToTenthML(volumeML: Decimal | number): Decimal {
  const mL = volumeML instanceof Decimal ? volumeML : new Decimal(volumeML)
  return mL.toDecimalPlaces(1, Decimal.ROUND_FLOOR)
}
```

**Note on input units:** Old Beads / Old Antibodies are entered in **mL** by the operator (per D-04). `ceilToTenthML` takes **µL** in (and returns µL). `floorToTenthML` should take **mL** in (and return **mL**) to match the input domain — different unit contract intentionally. Planner should document this in the JSDoc clearly. If the planner wants µL symmetry, name it `floorToTenthMLFromUL(volumeUL): Decimal` instead — but the asymmetric mL-domain version is simpler for the UI consumer.

---

### 15. **NEW** `src/renderer/src/features/plate/components/OldReagentCapModal.tsx` (component, event-driven)

**Analog:** `src/renderer/src/features/run/components/EditWarningModal.tsx` (the thin wrapper around `ConfirmModal`).

**Existing `EditWarningModal` pattern (the full file — 39 lines — the canonical thin-wrapper-around-`ConfirmModal` shape):**
```typescript
import { ConfirmModal } from './ConfirmModal'

interface Props {
  open: boolean
  onKeepViewing: () => void
  onEditAnyway: () => void
}

export function EditWarningModal({ open, onKeepViewing, onEditAnyway }: Props): JSX.Element {
  return (
    <ConfirmModal
      open={open}
      title="Edit saved run?"
      body="This run is saved. Going back to edit will modify the saved record. Continue?"
      primaryLabel="Keep viewing"
      secondaryLabel="Edit anyway"
      primaryStyle="default"
      secondaryStyle="destructive"
      onPrimary={onKeepViewing}
      onSecondary={onEditAnyway}
    />
  )
}
```

**Existing `ConfirmModal` props (from `src/renderer/src/features/run/components/ConfirmModal.tsx` lines 1-21 — full prop surface):**
```typescript
interface ConfirmModalProps {
  open: boolean
  title: string
  body: string
  primaryLabel: string
  secondaryLabel: string
  primaryStyle?: 'default' | 'destructive'
  secondaryStyle?: 'default' | 'destructive'
  onPrimary: () => void
  onSecondary: () => void
}
```

**NEW `OldReagentCapModal` (mirror — per CONTEXT §"Override modal — concrete copy" + §Claude's Discretion recommendation "dedicated component because the modal needs the live cap value + reagent label"):**
```typescript
import { ConfirmModal } from '../../run/components/ConfirmModal'

interface Props {
  open: boolean
  reagentLabel: 'Old Beads' | 'Old Antibodies'
  typedValueML: number   // e.g., 2.5
  capValueML: number     // e.g., 1.4
  totalReactionVolumeML: number  // e.g., 7.0 (= cap / 0.20)
  onOverride: () => void
  onCancel: () => void
}

export function OldReagentCapModal({
  open, reagentLabel, typedValueML, capValueML, totalReactionVolumeML, onOverride, onCancel
}: Props): JSX.Element {
  const body =
    `${reagentLabel}: ${typedValueML.toFixed(1)} mL\n` +
    `Recommended max: ${capValueML.toFixed(1)} mL (20% of ${totalReactionVolumeML.toFixed(1)} mL total)\n\n` +
    `Using more than 20% old reagent may affect assay reliability. Are you sure?`

  return (
    <ConfirmModal
      open={open}
      title="Old Reagent Exceeds Recommended Limit"
      body={body}
      primaryLabel="Yes, override"
      secondaryLabel="Cancel"
      primaryStyle="destructive"
      secondaryStyle="default"
      onPrimary={onOverride}
      onSecondary={onCancel}
    />
  )
}
```

**Note on body multiline:** `ConfirmModal`'s body renders as `<p>{body}</p>` (lines 61-63). Newlines in the prop won't render as `<br>` — either accept paragraph-collapsed display or extend `ConfirmModal` to accept `body: string | JSX.Element` (planner decides). Simplest path: pass a single-line summary body and let the surface render fine.

---

### 16. **NEW** `src/renderer/src/features/plate/__tests__/usePlateLayout.test.ts` (test, unit)

**Analog:** `src/renderer/src/lib/__tests__/calculator.test.ts` (lines 1-80) for the vitest pattern.

**Existing pattern (lines 1-66 of `calculator.test.ts` — the canonical `describe` / `it` / `expect.equals()` shape):**
```typescript
import { describe, it, expect } from 'vitest'
import { Decimal } from 'decimal.js'
import { calculateFinalVolume, createCalculatorInputs, calculateVolumes } from '../calculator'

describe('calculateFinalVolume (0.1-mL ceiling per SMK3-06)', () => {
  it('passes a value already at 0.1 mL precision through unchanged (7400 µL)', () => {
    const result = calculateFinalVolume(new Decimal(7400))
    expect(result.equals(new Decimal(7400))).toBe(true)
  })
  it('rounds 7401 µL UP to 7500 µL', () => {
    const result = calculateFinalVolume(new Decimal(7401))
    expect(result.equals(new Decimal(7500))).toBe(true)
  })
})
```

**NEW file shape (mirror — exercising `usePlateLayout` through the store layer; `usePlateLayout` is a hook so test it by driving `useCalculatorStore` + `usePlateStore` directly and reading the derived layout via `renderHook` OR via a thin pure helper):**

Driving via store is the simpler pattern (no React-testing-library setup; matches Group F/G of `calculator.integration.test.ts` lines 169-222). The test file should:
- `import { useCalculatorStore } from '../../../stores/calculatorStore'`
- `import { usePlateStore } from '../../../stores/plateStore'`
- `import { usePlateLayout } from '../hooks/usePlateLayout'` (if pure-readable) OR refactor the inner pure layout-derivation into an exported helper for testability

**Test groups required by CONTEXT §"Test discipline" + §"Specific Ideas → Duplicate layout":**
- `sampleCount=36, replicateMode='duplicates', plateCount=1` → col 4 = samples 1-4 in (A4,B4)/(C4,D4)/(E4,F4)/(G4,H4); col 5 = 5-8; …; col 12 = 33-36
- `sampleCount=37, replicateMode='duplicates', plateCount=2` → first 36 on plate 1, sample 37 on plate 2 col 4 (A4,B4)
- `sampleCount=4, replicateMode='duplicates'` → only col 4 filled (4 pairs)
- `sampleCount=1, replicateMode='duplicates'` → only (A4,B4) filled

**Vitest config gotcha:** `vitest.config.ts` line 7 → `include: ['src/**/*.test.ts']`. Test file MUST be `.test.ts` (NOT `.test.tsx`). If the test absolutely needs JSX, planner must extend the include pattern.

---

### 17. **NEW** `src/shared/constants/__tests__/getDuplicatePair.test.ts` (test, unit)

**Analog:** `src/renderer/src/lib/__tests__/calculator.test.ts` (same vitest pattern as file #16).

**Directory creation note:** `src/shared/constants/__tests__/` does NOT currently exist. Planner creates it. (Verified via `ls src/shared/constants/__tests__/` → no such dir.)

**Test groups required by CONTEXT:**
- Standard cols (0-indexed 0/1/2 → 1-indexed 1/2/3) return `null` regardless of row
- For each col in 0-indexed 3-11 (1-indexed 4-12):
  - Row 0 (A) → partner is Row 1 (B), same col
  - Row 1 (B) → partner is Row 0 (A), same col
  - Row 2 (C) → partner is Row 3 (D), same col
  - …
  - Row 6 (G) → partner is Row 7 (H), same col
  - Row 7 (H) → partner is Row 6 (G), same col

Skeleton:
```typescript
import { describe, it, expect } from 'vitest'
import { getDuplicatePair } from '../calculator'

describe('getDuplicatePair (SMK3-RPL-02 vertical-pair-within-column)', () => {
  describe('standard columns (0-indexed 0-2 = 1-indexed 1-3) return null', () => {
    it('col=0 returns null for every row', () => {
      for (let row = 0; row < 8; row++) {
        expect(getDuplicatePair(row, 0)).toBeNull()
      }
    })
    // …col=1, col=2
  })

  describe('unknown columns 4-12 (0-indexed 3-11): adjacent-row partner in same column', () => {
    const UNKNOWN_COLS_ZERO_INDEXED = [3, 4, 5, 6, 7, 8, 9, 10, 11]
    const PAIRS = [[0, 1], [1, 0], [2, 3], [3, 2], [4, 5], [5, 4], [6, 7], [7, 6]] as const

    for (const col of UNKNOWN_COLS_ZERO_INDEXED) {
      describe(`col=${col} (1-indexed ${col + 1})`, () => {
        for (const [row, expectedPartnerRow] of PAIRS) {
          it(`row=${row} → partner row=${expectedPartnerRow}, same col`, () => {
            expect(getDuplicatePair(row, col)).toEqual({ row: expectedPartnerRow, col })
          })
        }
      })
    }
  })
})
```

---

### 18. **NEW** `src/renderer/src/features/calculator/__tests__/CalculatorForm.test.ts` OR EXTEND `calculator.integration.test.ts`

**Analog:** `src/renderer/src/lib/__tests__/calculator.integration.test.ts` Groups F (lines 226-364) + G (lines 366-552).

**Choose-the-pattern guidance for planner:**
- **Vitest `*.test.tsx` is NOT included by default** (`vitest.config.ts` line 7). To unit-test the `CalculatorForm` component directly, planner extends the include pattern + adds `@testing-library/react` devDep.
- **Cheaper path:** extend `calculator.integration.test.ts` with new groups F' (`old-reagent subtraction at the store layer`) + G' (`20%-cap override via store-level state, no component render`). This piggybacks on Phase 12's vi.stubGlobal pattern for `window.electronAPI` (lines 432-484).

**Group F' pattern target — `oldBeads`/`oldAntibodies` subtraction through the store (mirror Group F lines 232-265):**
```typescript
describe("Group F': Old reagent subtraction at the store layer (SMK3-02/03)", () => {
  beforeEach(() => {
    useCalculatorStore.getState().reset()
  })

  it("T-F'1: PRD §Specific Ideas row 1 — sampleCount=148, beadVPW=0.05, setups=1, oldBeads=0.5 → newBeads = 6.9 mL, totalBeads = 9.4 mL", () => {
    useCalculatorStore.getState().setSampleCount(148)
    useCalculatorStore.setState({ volumePerWell: 50 }) // 0.05 mL = 50 µL
    useCalculatorStore.getState().setNumberOfSetups(1)
    useCalculatorStore.getState().setOldBeads(0.5)

    const outputs = useCalculatorStore.getState().getOutputs()
    expect(outputs).not.toBeNull()
    // ... assert newBeadsUL, totalBeadsUL match 6900 µL / 9400 µL
  })

  it("T-F'2: floor-rounding — oldBeads=1.59 mL → calculator consumes 1.5 mL (D-08)", () => {
    // ...
  })
})
```

**Group G' pattern target — 20%-cap override flow at the store layer (validation behavior):**
```typescript
describe("Group G': 20%-cap validation + override (SMK3-02/03 D-09 to D-11)", () => {
  it("T-G'1: oldBeads exceeding cap sets validationError (red-border trigger)", () => { /* ... */ })
  it("T-G'2: override flag clears validationError, calculator proceeds with typed value", () => { /* ... */ })
  it("T-G'3: override + Old > Calc → new-reagent floor-clamps to 0 (D-11)", () => {
    // PRD §Specific Ideas row 3: sampleCount=20, beadVPW=0.05, setups=1, oldBeads=5.0 (over cap 0.6 mL)
    // → max(0, 1.0 - 5.0) = 0 mL new beads; total = 5.0 + 0 + 2.0 = 7.0 mL
  })
})
```

**Test scaffold — vi.stubGlobal for `window.electronAPI`** (mirror Group G lines 432-484 if cross-store interaction is needed; not required if test stays purely within `calculatorStore`).

---

## Shared Patterns

### Pattern S1: Zustand store with validating setters

**Source:** `src/renderer/src/stores/calculatorStore.ts` lines 125-138 (setNumberOfSetups) + lines 152-160 (setVolumePerWell).

**Apply to:** all new store actions in files #1 (`setOldBeads`, `setOldAntibodies`), #2 (`setPlateCount`).

**Canonical shape (the Phase-12 validating-setter convention):**
```typescript
setX: (input: T) => {
  if (/* invalid */) {
    set({ validationError: `descriptive message (got ${input})` })
    return // state unchanged
  }
  set({ x: input, validationError: null })
}
```

### Pattern S2: Snapshot-fidelity for run save/load (SMK3-16)

**Source:** `src/shared/types/run.ts` lines 26-34 + `src/renderer/src/features/run/hooks/useRunSnapshot.ts` lines 101-106 + `src/renderer/src/stores/runStore.ts` lines 138-141.

**Apply to:** every new persisted field (Phase 14: `oldBeads`, `oldAntibodies`).

**Canonical contract:**
1. `RunRecord` + `RunCreate` interfaces: declare the new field as `optional` (`fieldName?: T`) — pre-Smoke-3 runs lack it.
2. `runStore.loadRun`: call `calculator.setX(run.fieldName ?? defaultValue)` AFTER `setVolumePerWell` / `setNumberOfSetups` (the order is already established; just append).
3. `buildRunSnapshot`: include `fieldName: calculator.fieldName` so saved runs round-trip.
4. Zod schema in `src/shared/schemas/run.ts` (if it exists): mirror the optional with a default — `.default(0)` for the new fields.

### Pattern S3: Pure-fn helpers in `lib/` with single responsibility

**Source:** `src/renderer/src/lib/calculator.ts` — every exported function is ≤ 30 lines and does ONE thing (`calculateTotalWells`, `calculateRawVolume`, `calculateFinalVolume`, `calculateSingleAdditionVolume`, etc.).

**Apply to:** `floorToTenthML` (file #14), `applyOldReagentSubtraction` (file #13).

### Pattern S4: Modal as thin wrapper around `ConfirmModal`

**Source:** `src/renderer/src/features/run/components/EditWarningModal.tsx` (entire file, 39 lines).

**Apply to:** `OldReagentCapModal.tsx` (file #15). Compose `ConfirmModal` with `primaryStyle="destructive"` for the "Yes, override" affirmative-destructive action.

### Pattern S5: Vitest test file structure (`*.test.ts` only)

**Source:** `src/renderer/src/lib/__tests__/calculator.test.ts` + `calculator.integration.test.ts` (all 552 lines). `vitest.config.ts` line 7 → `include: ['src/**/*.test.ts']`.

**Apply to:** all new test files (#16, #17, #18). Use `describe → describe (Group letter) → it ('T-X1: ...')` nesting matching the existing fixture-style naming.

**Concrete `vi.stubGlobal` template (from Group G lines 432-484)** is reusable when a test needs to drive `runStore.loadRun` or any other code path that touches `window.electronAPI`.

### Pattern S6: Tailwind tokens — never raw colors

**Source:** every component reviewed — `var(--color-primary)`, `var(--color-border)`, `var(--color-foreground)`, `var(--color-muted)`, `var(--color-surface-hover)`. Direct utility classes for red/amber/green status (`bg-red-50`, `border-red-200`, `text-red-700`, `bg-amber-100 text-amber-700`, `bg-green-50`, etc.).

**Apply to:** all new UI (file #6 CalculatorForm restructure, file #15 modal, file #9 SelectedAnalytesList rewrite). Match existing token usage; don't introduce new color tokens for Phase 14 unless the planner has a strong reason.

### Pattern S7: Two-state input pattern (typed displayValue vs. committed numeric value)

**Source:** `src/renderer/src/features/calculator/components/SampleCountInput.tsx` lines 22-91 (the entire component is the canonical reference for the typed-input-without-friction shape).

**Apply to:** the new numeric inputs in CalculatorForm (file #6) — especially `oldBeads`/`oldAntibodies` where the operator's typed value must remain visible (D-08 "preserves author intent") while the calculator consumes a floor-rounded version.

---

## No Analog Found

None. Every Phase 14 file maps to either an exact self-analog (rewrite/refinement) or a strong role-match elsewhere in the codebase. The closest "weak match" was the modal flow — but `ConfirmModal` + `EditWarningModal` exists and the wrap pattern is clean.

---

## Cross-Phase Verification Targets (call out to planner)

1. **After file #12 ships:** `grep -rn "DUPLICATE_HORIZONTAL_PAIRS\|DUPLICATE_VERTICAL_COL" src/` must return zero hits (per D-26). Current callsites: `plateStore.ts` lines 5-7, `usePlateLayout.ts` lines 7-9. Both are rewritten in files #2 and #10.

2. **After files #1 + #4 ship:** `runStore.loadRun` cascade must extend the Phase-12 pattern (volumePerWell → numberOfSetups → oldBeads → oldAntibodies). Mirror the placement-comment style from `runStore.ts` lines 130-141.

3. **After file #14 ships:** `floorToTenthML` MUST take **mL** in (not µL) — unit-asymmetric with `ceilToTenthML` to match the Old Beads / Old Antibodies UI input domain. Cross-check JSDoc.

4. **Vitest config gotcha:** if any test ends up needing `.test.tsx`, extend `vitest.config.ts` line 7 to `include: ['src/**/*.test.{ts,tsx}']` AND add the `@testing-library/react` + `@testing-library/jest-dom` + `jsdom` devDeps. Default path: stay in `.test.ts` and drive stores directly (cheaper, matches Phase-12 idiom).

5. **Smoke 3 PRD invariant — SMK3-16 snapshot fidelity:** historical runs (saved before Phase 14 ships) reload with `oldBeads ?? 0` and `oldAntibodies ?? 0` defaults. Run document carries no "Computed under previous calculation rules" advisory until Phase 15. Confirm by adding a `T-F'_legacy: pre-Phase-14 run with no oldBeads field reloads with oldBeads === 0` test mirroring Group G T-G2 lines 520-550.

---

## Metadata

**Analog search scope:**
- `src/renderer/src/stores/` (all 7 zustand stores)
- `src/renderer/src/features/calculator/` + `features/plate/` + `features/platform/` + `features/selection/` + `features/run/` + `features/manage/`
- `src/renderer/src/lib/` (calculator, decimal, diluentResolver)
- `src/shared/constants/calculator.ts`, `src/shared/types/calculator.ts`, `src/shared/types/run.ts`
- `src/renderer/src/lib/__tests__/` (existing vitest patterns)

**Files scanned (read in full or targeted):** 23

**Strong reusable analogs (highest-value to planner):**
1. `calculatorStore.setNumberOfSetups` / `setVolumePerWell` — validating-setter template
2. `EditWarningModal` + `ConfirmModal` — modal wrap pattern (file #15)
3. `ceilToTenthML` — mirror with `ROUND_FLOOR` (file #14)
4. `SampleCountInput` two-state pattern (file #6 inputs)
5. `runStore.loadRun` Phase-12 cascade (snapshot fidelity contract, S2)
6. `calculator.integration.test.ts` Groups F + G (vi.stubGlobal pattern for #18)

**Pattern extraction date:** 2026-05-12
