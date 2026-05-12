import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { useCalculatorStore } from '../calculatorStore'
// Imported to ensure plateStore is loaded before calculatorStore.getOutputs()
// calls usePlateStore.getState() at runtime (defensive — they're already
// transitive deps, but explicit imports make module-load order obvious).
import '../plateStore'

describe('calculatorStore.capPaused (Smoke 3 SMK3-02/03 — D-10 output suppression)', () => {
  beforeEach(() => {
    useCalculatorStore.getState().reset()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  describe('state + setter', () => {
    it('T-1: initial capPaused is false', () => {
      expect(useCalculatorStore.getState().capPaused).toBe(false)
    })

    it('T-2: setCapPaused(true) flips the flag', () => {
      useCalculatorStore.getState().setCapPaused(true)
      expect(useCalculatorStore.getState().capPaused).toBe(true)
    })

    it('T-3: setCapPaused(false) flips it back', () => {
      useCalculatorStore.getState().setCapPaused(true)
      useCalculatorStore.getState().setCapPaused(false)
      expect(useCalculatorStore.getState().capPaused).toBe(false)
    })
  })

  describe('getOutputs() gating (D-10)', () => {
    it('T-4: returns null when capPaused === true even with valid inputs', () => {
      useCalculatorStore.getState().setSampleCount(20)
      // sanity: valid inputs would normally produce outputs
      expect(useCalculatorStore.getState().getOutputs()).not.toBeNull()
      // now pause
      useCalculatorStore.getState().setCapPaused(true)
      expect(useCalculatorStore.getState().getOutputs()).toBeNull()
    })

    it('T-5: returns CalculatorOutputs when capPaused === false (Phase 12 contract preserved)', () => {
      useCalculatorStore.getState().setSampleCount(20)
      useCalculatorStore.getState().setCapPaused(false)
      const outputs = useCalculatorStore.getState().getOutputs()
      expect(outputs).not.toBeNull()
      expect(outputs!.totalWells).toBeGreaterThan(0)
    })
  })

  describe('reset cascade', () => {
    it('T-6: reset() restores capPaused to false', () => {
      useCalculatorStore.getState().setCapPaused(true)
      useCalculatorStore.getState().reset()
      expect(useCalculatorStore.getState().capPaused).toBe(false)
    })
  })
})
