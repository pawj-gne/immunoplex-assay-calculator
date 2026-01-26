---
phase: 02-calculator-core
plan: 02
subsystem: lib
tags: [calculator, validation, zod, single-analytes]

# Dependency graph
requires:
  - phase: 02-01
    provides: Pure calculation functions, plate geometry constants
provides:
  - Single analyte addition volume calculations
  - Zod validation schemas for calculator inputs
  - Max 5 singles rule enforcement
affects: [02-03]

# Tech tracking
tech-stack:
  added:
    - zod: ^3.24.2
  patterns:
    - Zod schemas for runtime validation
    - Validation functions return error messages or null

key-files:
  created:
    - src/shared/validation/calculator.ts
  modified:
    - src/renderer/src/lib/calculator.ts
    - src/shared/types/calculator.ts

key-decisions:
  - "Zod for runtime validation of calculator inputs"
  - "Single addition formula: master_mix_volume / stock_concentration"
  - "Premix mode: 0 singles allowed"
  - "Premix + singles mode: max 5 singles"
  - "Custom mode: unlimited singles"

---

## What Was Built

Single analyte calculations and validation schemas:

1. **Zod validation schemas** (`src/shared/validation/calculator.ts`):
   - `replicateModeSchema` - 'singles' | 'duplicates'
   - `requestTypeSchema` - 'premix' | 'premix_singles' | 'custom'
   - `singleAnalyteSchema` - id, name, stockConcentration
   - `calculatorInputsSchema` - full input validation
   - `validateAddSingle()` - enforces max singles rule

2. **Single analyte calculations** (added to `calculator.ts`):
   - `calculateSingleAdditionVolume()` - master_mix / stock_concentration
   - `calculateSingleAdditions()` - processes all singles
   - `canAddSingle()` - checks against request type limit
   - `getRemainingSingles()` - remaining capacity
   - `validateSinglesForRequestType()` - validates on type change

3. **Extended types** (`src/shared/types/calculator.ts`):
   - `SingleAnalyteWithVolume` interface
   - `FullCalculatorOutputs` interface

## Requirements Addressed

- CALC-02: Single analyte addition = master_mix_volume / stock_concentration
- CALC-05: Max 5 singles when premix is selected

## Verification

Single addition calculations verified:
- 5000 µL master mix, 20x stock → 250 µL addition
- 5000 µL master mix, 25x stock → 200 µL addition
- 3000 µL master mix, 20x stock → 150 µL addition

Max singles rule verified:
- Premix: blocks all singles
- Premix + singles: allows exactly 5
- Custom: no limit

## Duration

~12 minutes
