---
phase: 02-calculator-core
plan: 03
subsystem: ui
tags: [calculator, zustand, react, real-time-updates]

# Dependency graph
requires:
  - phase: 02-01
    provides: Pure calculation functions
  - phase: 02-02
    provides: Single analyte calculations, validation schemas
provides:
  - Calculator UI with real-time updates
  - Zustand store for calculator state
  - Integration with platform selection
  - Phase 2 success criteria fully met
affects: [03-01, 03-02, 03-03]

# Tech tracking
tech-stack:
  added:
    - react-to-print: ^3.2.0
  patterns:
    - Zustand store with derived calculations
    - Feature folder structure (features/calculator/)
    - Custom hooks for component state access

key-files:
  created:
    - src/renderer/src/stores/calculatorStore.ts
    - src/renderer/src/features/calculator/hooks/useCalculator.ts
    - src/renderer/src/features/calculator/components/CalculatorForm.tsx
    - src/renderer/src/features/calculator/components/VolumeDisplay.tsx
    - src/renderer/src/features/calculator/components/SingleAnalyteManager.tsx
    - src/renderer/src/features/calculator/components/CalculatorPanel.tsx
  modified:
    - src/renderer/src/App.tsx
    - src/renderer/src/assets/index.css
    - src/shared/constants/calculator.ts

key-decisions:
  - "Zustand store holds calculator inputs, singles, and derived outputs"
  - "useCalculator hook provides formatted values for display"
  - "Calculator only visible after platform selection"
  - "Real-time updates via store subscription"
  - "Default dead volume changed to 2000 µL (2 mL)"

---

## What Was Built

Complete calculator UI with real-time updates:

1. **Calculator store** (`src/renderer/src/stores/calculatorStore.ts`):
   - Manages inputs: sampleCount, replicateMode, plateCount, requestType
   - Manages singles array with add/remove actions
   - Derives outputs via `getOutputs()` and `getSinglesWithVolumes()`
   - Validates sample count against plate capacity

2. **useCalculator hook** (`hooks/useCalculator.ts`):
   - Combines calculator and platform stores
   - Formats volumes for display (µL and mL)
   - Provides `isValid` computed state

3. **UI Components**:
   - `CalculatorForm` - inputs for samples, replicate mode, plates, request type
   - `VolumeDisplay` - well counts, raw volume, final volume (rounded)
   - `SingleAnalyteManager` - add/remove singles with calculated volumes
   - `CalculatorPanel` - composes all calculator components

4. **App integration**:
   - Calculator panel shown only when platform selected
   - Prompt message when no platform selected
   - Footer updated to show Phase 2 status

## Requirements Addressed

- CALC-04: Calculations update immediately as inputs change
- All Phase 2 success criteria met

## Verification

Full UI flow verified:
- Platform selection → calculator appears
- Input changes → immediate volume recalculation
- Singles mode → add up to 5, see calculated volumes
- Custom mode → unlimited singles
- All validation messages display correctly

## Duration

~25 minutes
