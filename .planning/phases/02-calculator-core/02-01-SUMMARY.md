---
phase: 02-calculator-core
plan: 01
subsystem: lib
tags: [calculator, decimal, pure-functions, volume-calculations]

# Dependency graph
requires:
  - phase: 01-03
    provides: Platform selection and decimal utilities
provides:
  - Pure calculation functions for well counting and volume math
  - Plate geometry constants (96 wells, 24 standards)
  - TypeScript interfaces for calculator inputs/outputs
affects: [02-02, 02-03]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Pure functions for testable calculations
    - Decimal.js for precision arithmetic
    - Constants extracted to shared module

key-files:
  created:
    - src/shared/constants/calculator.ts
    - src/shared/types/calculator.ts
    - src/renderer/src/lib/calculator.ts
  modified: []

key-decisions:
  - "Pure functions for all calculations (testable, reusable)"
  - "Decimal.js for all volume math to avoid floating-point errors"
  - "Constants define plate geometry in shared module"
  - "Final volume always rounds UP to nearest mL"

---

## What Was Built

Calculator core module with pure functions for reagent volume calculations:

1. **Plate geometry constants** (`src/shared/constants/calculator.ts`):
   - TOTAL_WELLS = 96
   - STANDARD_WELLS = 24
   - UNKNOWN_WELLS_SINGLES = 72, UNKNOWN_WELLS_DUPLICATES = 36
   - DEFAULT_VOLUME_PER_WELL = 25 µL
   - DEFAULT_DEAD_VOLUME = 2000 µL

2. **Calculator types** (`src/shared/types/calculator.ts`):
   - CalculatorInputs interface
   - CalculatorOutputs interface
   - SingleAnalyte interface
   - ReplicateMode and RequestType types

3. **Pure calculation functions** (`src/renderer/src/lib/calculator.ts`):
   - `calculateTotalWells()` - wells = samples × replicate_factor + standards
   - `calculateRawVolume()` - (wells × vol_per_well) + dead_volume
   - `calculateFinalVolume()` - rounds up to nearest mL
   - `calculateMaxSamples()` - plate capacity validation
   - `validateSampleCount()` - input validation

## Requirements Addressed

- CALC-01: Total reagent volume based on sample count, replicate mode, plate capacity
- CALC-03: Dead volume included in calculations
- CALC-06: Final volume rounded up to nearest mL

## Verification

All calculations verified against expected results:
- 20 samples, singles, 1 plate → 44 wells, 2600 µL raw, 3000 µL final (3 mL)
- 30 samples, duplicates, 1 plate → 84 wells, 4100 µL raw, 5000 µL final (5 mL)

## Duration

~15 minutes
