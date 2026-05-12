import { describe, it, expect } from 'vitest'
import { Decimal, createVolume, ceilToTenthML, floorToTenthML } from '../decimal'

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

describe('floorToTenthML (SMK3 D-07 floor-to-0.1-mL for operator inputs)', () => {
  it('T-1: 1.51 mL → 1.5 mL (round down across 0.05 boundary)', () => {
    expect(floorToTenthML(1.51).equals(new Decimal('1.5'))).toBe(true)
  })
  it('T-2: 1.59 mL → 1.5 mL (round down close to next tenth)', () => {
    expect(floorToTenthML(1.59).equals(new Decimal('1.5'))).toBe(true)
  })
  it('T-3: 1.50 mL → 1.5 mL (idempotent at boundary)', () => {
    expect(floorToTenthML(1.5).equals(new Decimal('1.5'))).toBe(true)
  })
  it('T-4: 0.04 mL → 0.0 mL', () => {
    expect(floorToTenthML(0.04).equals(new Decimal('0.0'))).toBe(true)
  })
  it('T-5: 0.00 mL → 0.0 mL', () => {
    expect(floorToTenthML(0.0).equals(new Decimal('0.0'))).toBe(true)
  })
  it('T-6: accepts a Decimal instance', () => {
    expect(floorToTenthML(new Decimal('2.78')).equals(new Decimal('2.7'))).toBe(true)
  })
  it('T-7: returns a Decimal instance (not number) for chainable consumption', () => {
    expect(floorToTenthML(1.5)).toBeInstanceOf(Decimal)
  })
  it('T-8: asymmetric with ceilToTenthML — floor(1.51 mL) = 1.5; ceil(1510 µL) = 1.6 (≠)', () => {
    // floor on mL-domain input
    const floored = floorToTenthML(1.51)
    // ceil on µL-domain input (1.51 mL = 1510 µL → rounds UP to 1600 µL = 1.6 mL)
    const ceiledML = ceilToTenthML(new Decimal(1510)).dividedBy(1000)
    expect(floored.equals(ceiledML)).toBe(false)
    expect(floored.equals(new Decimal('1.5'))).toBe(true)
    expect(ceiledML.equals(new Decimal('1.6'))).toBe(true)
  })
})
