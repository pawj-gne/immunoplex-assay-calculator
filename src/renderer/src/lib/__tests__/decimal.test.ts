import { describe, it, expect } from 'vitest'
import { Decimal, createVolume, ceilToTenthML } from '../decimal'

describe('ceilToTenthML', () => {
  it('returns a Decimal instance', () => {
    const result = ceilToTenthML(createVolume(7400, 'uL'))
    expect(result instanceof Decimal).toBe(true)
  })

  it('passes a value already at 0.1 mL precision through unchanged (7400 µL → 7400 µL)', () => {
    const result = ceilToTenthML(createVolume(7400, 'uL'))
    expect(result.equals(new Decimal(7400))).toBe(true)
  })

  it('rounds 7410 µL (7.41 mL) UP to 7500 µL (7.5 mL)', () => {
    const result = ceilToTenthML(createVolume(7410, 'uL'))
    expect(result.equals(new Decimal(7500))).toBe(true)
  })

  it('rounds 7401 µL UP to 7500 µL (any amount above 0.1 mL boundary rounds up)', () => {
    const result = ceilToTenthML(createVolume(7401, 'uL'))
    expect(result.equals(new Decimal(7500))).toBe(true)
  })

  it('rounds 7499 µL UP to 7500 µL (just below next 0.1 mL still rounds up)', () => {
    const result = ceilToTenthML(createVolume(7499, 'uL'))
    expect(result.equals(new Decimal(7500))).toBe(true)
  })

  it('rounds 50 µL (0.05 mL) UP to 100 µL (0.1 mL)', () => {
    const result = ceilToTenthML(createVolume(50, 'uL'))
    expect(result.equals(new Decimal(100))).toBe(true)
  })

  it('rounds 41 µL (0.041 mL) UP to 100 µL (0.1 mL)', () => {
    const result = ceilToTenthML(createVolume(41, 'uL'))
    expect(result.equals(new Decimal(100))).toBe(true)
  })

  it('keeps exact zero as zero (0 µL → 0 µL, no upward bump from 0)', () => {
    const result = ceilToTenthML(createVolume(0, 'uL'))
    expect(result.equals(new Decimal(0))).toBe(true)
  })

  it('passes PRD worked-example antibody volume 3700 µL through unchanged (already at 0.1 mL)', () => {
    const result = ceilToTenthML(createVolume(3700, 'uL'))
    expect(result.equals(new Decimal(3700))).toBe(true)
  })
})
