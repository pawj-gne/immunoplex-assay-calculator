# Phase 2: Calculator Core - Research

**Researched:** 2026-01-23
**Domain:** Reagent volume calculations, well mathematics, single analyte additions, real-time UI updates
**Confidence:** HIGH

## Summary

Phase 2 implements the core calculation engine that transforms operator inputs (sample count, replicate mode, plate count) into accurate reagent volumes. This phase directly addresses CALC-01 through CALC-06, building on the decimal arithmetic and platform configuration from Phase 1.

The calculation domain is well-defined by established lab protocols. Key formulas are straightforward but must be precise—operators trust these numbers for reagent preparation. The UI must update in real-time as inputs change, giving immediate feedback without requiring a "calculate" button.

**Primary recommendation:** Implement pure calculation functions first (testable, no UI), then build the calculator store with derived state, then wire up the UI components. Use Zustand's computed selectors for real-time derived values.

## Domain Model

### Plate Geometry (Fixed Constants)

| Constant | Value | Notes |
|----------|-------|-------|
| TOTAL_WELLS | 96 | Standard 96-well microtiter plate |
| STANDARD_WELLS | 24 | Reserved for protein standards (never changes) |
| UNKNOWN_WELLS_SINGLES | 72 | 96 - 24 = wells available for singles mode |
| UNKNOWN_WELLS_DUPLICATES | 36 | 72 / 2 = wells when running duplicates |

### Replicate Modes

| Mode | Samples per Plate | Description |
|------|-------------------|-------------|
| Singles | 72 | Each sample in one well |
| Duplicates | 36 | Each sample in two adjacent wells for QC |

### Request Types

| Type | Single Limit | Diluent | Use Case |
|------|-------------|---------|----------|
| Premix Only | 0 | N/A | Standard panels, no customization |
| Premix + Singles | Max 5 | Premix | Minor additions to premix panel |
| Full Custom | Unlimited | Assay Buffer | Building panel from scratch |

The "max 5 singles" rule exists because each single addition dilutes the premix. More than 5 singles would dilute analyte concentrations below acceptable thresholds.

### Volume Calculation Formula

```
Total Volume = (Well Count × Volume Per Well) + Dead Volume
Final Volume = ceil(Total Volume to nearest mL)
```

Where:
- **Well Count** = (Samples × Replicate Factor) + Standard Wells (across all plates)
- **Volume Per Well** = Platform-specific constant (typically 25-50 µL)
- **Dead Volume** = Accounts for pipetting loss, multi-channel dead volume, etc.

### Single Analyte Addition Formula

```
Addition Volume = Master Mix Volume ÷ Stock Concentration
```

Example: If master mix is 5000 µL and stock is 20x, addition = 5000 / 20 = 250 µL

## Input Parameters

### Operator-Provided Inputs

| Input | Type | Validation | Default |
|-------|------|------------|---------|
| Sample Count | number | > 0, ≤ plate capacity | — |
| Replicate Mode | enum | "singles" \| "duplicates" | "singles" |
| Plate Count | number | ≥ 1 | 1 |
| Request Type | enum | "premix" \| "premix_singles" \| "custom" | "premix" |
| Platform ID | string | Must exist in platforms table | — (from Phase 1) |

### Platform-Provided (from Phase 1)

| Field | Source | Used For |
|-------|--------|----------|
| Stock Concentration | Platform.stockConcentration | Single analyte calculations |

### Constant Parameters (Configurable)

| Parameter | Typical Value | Notes |
|-----------|---------------|-------|
| Volume Per Well | 25 µL | May vary by reagent type |
| Dead Volume | 500 µL | Per reagent, accounts for pipetting loss |

## Output Values

### Calculated Outputs

| Output | Formula | Display |
|--------|---------|---------|
| Total Wells | (samples × replicate_factor × plates) + (standards × plates) | Integer |
| Raw Volume | total_wells × volume_per_well + dead_volume | µL |
| Final Volume | ceil(raw_volume / 1000) × 1000 | mL (rounded up) |
| Singles Remaining | max_singles - singles_added | Integer (0-5) |

### Per-Single Outputs

| Output | Formula | Display |
|--------|---------|---------|
| Addition Volume | master_mix_volume / stock_concentration | µL |

## Architecture

### Pure Calculation Module

Create `src/renderer/src/lib/calculator.ts` with pure functions:

```typescript
// All inputs and outputs use Decimal for precision
interface CalculatorInputs {
  sampleCount: number
  replicateMode: 'singles' | 'duplicates'
  plateCount: number
  volumePerWell: Decimal  // µL
  deadVolume: Decimal     // µL
}

interface CalculatorOutputs {
  totalWells: number
  rawVolume: Decimal      // µL
  finalVolume: Decimal    // µL (rounded to mL)
}

function calculateTotalWells(inputs: CalculatorInputs): number
function calculateRawVolume(totalWells: number, volumePerWell: Decimal, deadVolume: Decimal): Decimal
function calculateFinalVolume(rawVolume: Decimal): Decimal
function calculateSingleAddition(masterMixVolume: Decimal, stockConcentration: Decimal): Decimal
```

Benefits:
- Pure functions are easy to unit test
- No React/Zustand dependency
- Can be shared between renderer and (future) main process validation

### Calculator Store

Create `src/renderer/src/stores/calculatorStore.ts`:

```typescript
interface CalculatorState {
  // Inputs
  sampleCount: number
  replicateMode: 'singles' | 'duplicates'
  plateCount: number
  requestType: 'premix' | 'premix_singles' | 'custom'
  singles: SingleAnalyte[]

  // Computed (derived via selectors)
  totalWells: number
  rawVolume: Decimal
  finalVolume: Decimal
  canAddSingle: boolean

  // Actions
  setSampleCount: (count: number) => void
  setReplicateMode: (mode: 'singles' | 'duplicates') => void
  setPlateCount: (count: number) => void
  setRequestType: (type: 'premix' | 'premix_singles' | 'custom') => void
  addSingle: (analyte: SingleAnalyte) => void
  removeSingle: (id: string) => void
}
```

Use Zustand's `subscribeWithSelector` for efficient derived state updates.

### UI Components

| Component | Purpose | Location |
|-----------|---------|----------|
| CalculatorForm | Input fields for sample count, replicate mode, etc. | features/calculator/components/ |
| VolumeDisplay | Shows calculated volumes with units | features/calculator/components/ |
| SingleAnalyteList | Manages singles with add/remove | features/calculator/components/ |
| CalculatorPanel | Composes form + display + singles | features/calculator/components/ |

## Plan Breakdown

### Plan 02-01: Calculation Core
- Create pure calculation functions in `lib/calculator.ts`
- Add constants for plate geometry
- Unit tests for all formulas
- Covers: CALC-01, CALC-03, CALC-06

### Plan 02-02: Single Analyte Additions
- Create SingleAnalyte type and validation
- Add single addition calculations to calculator module
- Implement max 5 singles rule enforcement
- Covers: CALC-02, CALC-05

### Plan 02-03: Calculator UI
- Create Zustand calculator store
- Build form and display components
- Wire up real-time updates
- Integrate with platform selection from Phase 1
- Covers: CALC-04

## UI Patterns

### Real-Time Updates

Use controlled inputs with immediate store updates:

```tsx
// Input immediately updates store, which triggers recalculation
<input
  type="number"
  value={sampleCount}
  onChange={(e) => setSampleCount(Number(e.target.value))}
/>

// Derived values update automatically via Zustand selectors
<div>Final Volume: {volumeToDisplay(finalVolume, 'mL')} mL</div>
```

### Validation Feedback

- Invalid inputs: Show inline error, disable affected outputs
- Approaching limits: Show warning (e.g., "4/5 singles added")
- Over limits: Disable add button, show error message

### Input Constraints

| Input | Constraint | UI Feedback |
|-------|------------|-------------|
| Sample Count | 1 ≤ x ≤ wells_per_plate × plates | Number input with min/max |
| Plate Count | 1 ≤ x ≤ 10 | Number input with reasonable max |
| Singles Count | 0 ≤ x ≤ 5 (when premix_singles) | Counter with disabled state |

## Testing Strategy

### Unit Tests (calculator.ts)

```typescript
describe('calculateTotalWells', () => {
  it('calculates singles mode correctly', () => {
    expect(calculateTotalWells({ samples: 20, mode: 'singles', plates: 1 })).toBe(44)
    // 20 samples + 24 standards = 44 wells
  })

  it('calculates duplicates mode correctly', () => {
    expect(calculateTotalWells({ samples: 20, mode: 'duplicates', plates: 1 })).toBe(64)
    // 20 × 2 + 24 = 64 wells
  })
})

describe('calculateFinalVolume', () => {
  it('rounds up to nearest mL', () => {
    expect(calculateFinalVolume(new Decimal(1001))).toEqual(new Decimal(2000))
    expect(calculateFinalVolume(new Decimal(1000))).toEqual(new Decimal(1000))
  })
})
```

### Integration Tests (store)

- Changing sample count updates all derived values
- Adding 6th single in premix_singles mode is rejected
- Switching request types clears singles if over limit

## Dependencies

### From Phase 1
- `decimal.ts` utilities (createVolume, roundUpToNearestML, etc.)
- Platform store (selected platform with stock concentration)
- App shell (will add calculator below platform selector)

### New Dependencies
None - all needed libraries already installed.

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Formula errors | Low | High | Extensive unit tests, review against lab protocols |
| Floating-point precision | Low | High | Already using Decimal.js from Phase 1 |
| UI lag on rapid input | Low | Medium | Debounce not needed with Zustand's batched updates |
| Max singles confusion | Medium | Low | Clear UI messaging, disabled state feedback |

## Open Questions

1. **Volume per well**: Is this constant across all reagents, or does it vary? (Assuming constant for v1)
2. **Dead volume**: Same question - fixed constant or reagent-specific? (Assuming fixed for v1)
3. **Multi-plate distribution**: When samples span multiple plates, should standards be counted per plate? (Assuming yes - each plate needs its own standard curve)

---
*Research completed: 2026-01-23*
*Ready for plan creation*
