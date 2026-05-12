import { describe, it, expect } from 'vitest'
import { Decimal } from 'decimal.js'
import {
  calculateFinalVolume,
  createCalculatorInputs,
  calculateVolumes
} from '../calculator'

describe('calculateFinalVolume (0.1-mL ceiling per SMK3-06)', () => {
  it('passes a value already at 0.1 mL precision through unchanged (7400 µL)', () => {
    const result = calculateFinalVolume(new Decimal(7400))
    expect(result.equals(new Decimal(7400))).toBe(true)
  })

  it('rounds 7401 µL UP to 7500 µL', () => {
    const result = calculateFinalVolume(new Decimal(7401))
    expect(result.equals(new Decimal(7500))).toBe(true)
  })

  it('keeps exact zero as zero', () => {
    const result = calculateFinalVolume(new Decimal(0))
    expect(result.equals(new Decimal(0))).toBe(true)
  })
})

describe('createCalculatorInputs (numberOfSetups → deadVolume per SMK3-05)', () => {
  it('defaults numberOfSetups to 1 → deadVolume = 2000 µL', () => {
    const inputs = createCalculatorInputs(60, 'singles', 1)
    expect(inputs.deadVolume.equals(new Decimal(2000))).toBe(true)
    expect(inputs.numberOfSetups).toBe(1)
  })

  it('explicit numberOfSetups=1 → deadVolume = 2000 µL', () => {
    const inputs = createCalculatorInputs(60, 'singles', 1, 25, 1)
    expect(inputs.deadVolume.equals(new Decimal(2000))).toBe(true)
    expect(inputs.numberOfSetups).toBe(1)
  })

  it('numberOfSetups=3 → deadVolume = 6000 µL', () => {
    const inputs = createCalculatorInputs(60, 'singles', 1, 25, 3)
    expect(inputs.deadVolume.equals(new Decimal(6000))).toBe(true)
    expect(inputs.numberOfSetups).toBe(3)
  })

  it('numberOfSetups=5 → deadVolume = 10000 µL', () => {
    const inputs = createCalculatorInputs(60, 'singles', 1, 25, 5)
    expect(inputs.deadVolume.equals(new Decimal(10000))).toBe(true)
    expect(inputs.numberOfSetups).toBe(5)
  })

  it('rejects numberOfSetups = 0 with a "numberOfSetups" error', () => {
    expect(() => createCalculatorInputs(60, 'singles', 1, 25, 0)).toThrow(/numberOfSetups/)
  })

  it('rejects negative numberOfSetups with a "numberOfSetups" error', () => {
    expect(() => createCalculatorInputs(60, 'singles', 1, 25, -1)).toThrow(/numberOfSetups/)
  })

  it('rejects non-integer numberOfSetups (1.5) with a "numberOfSetups" error', () => {
    expect(() => createCalculatorInputs(60, 'singles', 1, 25, 1.5)).toThrow(/numberOfSetups/)
  })

  it('rejects numberOfSetups > 1000 (sanity cap — guards against legacy callers passing deadVolume)', () => {
    expect(() => createCalculatorInputs(60, 'singles', 1, 25, 2000)).toThrow(/numberOfSetups/)
  })
})

describe('calculateVolumes (end-to-end PRD worked example)', () => {
  it('PRD worked example: 100 samples, singles, 2 plates, 50 µL/well, setups=1 → 9.4 mL', () => {
    const inputs = createCalculatorInputs(100, 'singles', 2, 50, 1)
    const outputs = calculateVolumes(inputs)
    // 100 samples × 1 (singles) = 100 unknown wells
    // 24 standard wells × 2 plates = 48 standard wells
    // total = 148 wells
    expect(outputs.totalWells).toBe(148)
    // raw = 148 wells × 50 µL/well + 2000 µL dead = 7400 + 2000 = 9400 µL
    expect(outputs.rawVolume.equals(new Decimal(9400))).toBe(true)
    // 9400 µL = 9.4 mL — already at 0.1 mL, passes through unchanged
    expect(outputs.finalVolume.equals(new Decimal(9400))).toBe(true)
    expect(outputs.finalVolumeML).toBe(9.4)
  })

  it('PRD worked example with setups=3: dead volume scales → 13.4 mL', () => {
    const inputs = createCalculatorInputs(100, 'singles', 2, 50, 3)
    const outputs = calculateVolumes(inputs)
    expect(outputs.totalWells).toBe(148)
    // raw = 148 × 50 + (3 × 2000) = 7400 + 6000 = 13400 µL
    expect(outputs.rawVolume.equals(new Decimal(13400))).toBe(true)
    expect(outputs.finalVolume.equals(new Decimal(13400))).toBe(true)
    expect(outputs.finalVolumeML).toBe(13.4)
  })
})
