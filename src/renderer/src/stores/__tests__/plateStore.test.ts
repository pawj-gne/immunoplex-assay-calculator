import { describe, it, expect, beforeEach } from 'vitest'
import { usePlateStore } from '../plateStore'

/**
 * Phase 14-04 Task 2 — plateStore.setPlateCount (D-03)
 *
 * Bidirectional plate-count action driven by the Plate page's
 * `Number of Plates` numeric input (Plan 14-06). Mirrors the effect of
 * addPlate / removePlate but in one shot:
 *   - n > currentMax: grow — append empty plate slots.
 *   - n < currentMax: shrink — drop plate keys > n; plates 1..n preserved.
 *   - n === currentMax: no-op.
 *   - n < 1 or non-integer: silent reject (UI prevents these values; the
 *     store guards defensively).
 */
describe('plateStore.setPlateCount (Smoke 3 D-03 — bidirectional Number-of-Plates)', () => {
  beforeEach(() => {
    usePlateStore.getState().reset()
  })

  it('T-1: initial state has 1 plate; setPlateCount(3) creates plates 1,2,3 as empty Sets', () => {
    expect(Object.keys(usePlateStore.getState().plates).map(Number).sort()).toEqual([1])
    usePlateStore.getState().setPlateCount(3)
    const plates = usePlateStore.getState().plates
    expect(Object.keys(plates).map(Number).sort((a, b) => a - b)).toEqual([1, 2, 3])
    expect(plates[1].size).toBe(0)
    expect(plates[2].size).toBe(0)
    expect(plates[3].size).toBe(0)
  })

  it('T-2: growing from 2 → 3 preserves wells in plates 1 and 2', () => {
    // Seed plates 1 and 2 with wells directly via setState
    usePlateStore.setState({
      plates: { 1: new Set(['A4']), 2: new Set(['B4']) }
    })
    usePlateStore.getState().setPlateCount(3)
    const plates = usePlateStore.getState().plates
    expect(plates[1].has('A4')).toBe(true)
    expect(plates[2].has('B4')).toBe(true)
    expect(plates[3].size).toBe(0)
  })

  it('T-3: shrinking from 3 → 2 drops plate 3; plates 1 and 2 preserved', () => {
    usePlateStore.setState({
      plates: { 1: new Set(['A4']), 2: new Set(['B4']), 3: new Set(['C4']) }
    })
    usePlateStore.getState().setPlateCount(2)
    const plates = usePlateStore.getState().plates
    expect(Object.keys(plates).map(Number).sort((a, b) => a - b)).toEqual([1, 2])
    expect(plates[1].has('A4')).toBe(true)
    expect(plates[2].has('B4')).toBe(true)
  })

  it('T-4: shrinking from 3 → 1 drops plates 2 and 3', () => {
    usePlateStore.setState({
      plates: { 1: new Set(['A4']), 2: new Set(['B4']), 3: new Set(['C4']) }
    })
    usePlateStore.getState().setPlateCount(1)
    const plates = usePlateStore.getState().plates
    expect(Object.keys(plates).map(Number)).toEqual([1])
    expect(plates[1].has('A4')).toBe(true)
  })

  it('T-5: setPlateCount(0) silently rejects — state unchanged', () => {
    usePlateStore.setState({ plates: { 1: new Set(['A4']), 2: new Set() } })
    const beforeKeys = Object.keys(usePlateStore.getState().plates).length
    usePlateStore.getState().setPlateCount(0)
    const afterKeys = Object.keys(usePlateStore.getState().plates).length
    expect(afterKeys).toBe(beforeKeys)
    expect(usePlateStore.getState().plates[1].has('A4')).toBe(true)
  })

  it('T-6: setPlateCount(-1) silently rejects', () => {
    usePlateStore.getState().setPlateCount(-1)
    // Initial state has 1 plate; should still have exactly 1
    expect(Object.keys(usePlateStore.getState().plates).length).toBe(1)
  })

  it('T-7: setPlateCount(2.5) silently rejects (non-integer)', () => {
    usePlateStore.getState().setPlateCount(2.5)
    expect(Object.keys(usePlateStore.getState().plates).length).toBe(1)
  })

  it('T-8: setPlateCount(currentMax) is a no-op', () => {
    usePlateStore.setState({ plates: { 1: new Set(['A4']), 2: new Set(['B4']) } })
    usePlateStore.getState().setPlateCount(2) // already at 2
    expect(usePlateStore.getState().plates[1].has('A4')).toBe(true)
    expect(usePlateStore.getState().plates[2].has('B4')).toBe(true)
    expect(Object.keys(usePlateStore.getState().plates).length).toBe(2)
  })

  it('T-9: activePlate adjusts when shrinking past it', () => {
    usePlateStore.setState({
      plates: { 1: new Set(), 2: new Set(), 3: new Set() },
      activePlate: 3
    })
    usePlateStore.getState().setPlateCount(2)
    // dropped past — fallback to plate 1 (smallest remaining)
    expect(usePlateStore.getState().activePlate).toBe(1)
  })
})
