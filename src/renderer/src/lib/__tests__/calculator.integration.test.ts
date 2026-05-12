import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { Decimal } from 'decimal.js'
import {
  createCalculatorInputs,
  calculateVolumes,
  canAddSingle,
  getRemainingSingles
} from '../calculator'
import { getMaxSingles } from '../../../../shared/constants/calculator'
import { useCalculatorStore } from '../../stores/calculatorStore'
import { useRunStore } from '../../stores/runStore'
import type { RunRecord } from '../../../../shared/types/run'

/**
 * Phase 12 Plan 03 integration tests — wire the new numberOfSetups input
 * into the renderer state layer and lock in the Smoke 3 PRD worked example
 * end-to-end (createCalculatorInputs + calculateVolumes through the actual
 * Zustand store).
 *
 * Group A: PRD worked example, setups=1   (148 wells → 9.4 mL)
 * Group B: PRD worked example, setups=3   (148 wells → 13.4 mL)
 * Group C: Rounding boundary cases through full pipeline (SMK3-06)
 * Group D: CALC-05 lib-level — canAddSingle / getRemainingSingles cap (R-05)
 * Group E: CALC-05 store-level — addSingle action blocks the 6th single
 *
 * Why a separate integration file from calculator.test.ts:
 *   - calculator.test.ts (Plan 12-01) covers the pure-math layer.
 *   - This file proves the same fixture values land at the calculator's
 *     CONSUMER surface (the Zustand store + the canAddSingle/getRemainingSingles
 *     helpers wired into requestType-keyed enforcement). Plans 13/14/15 can
 *     extend either file without re-authoring fixtures.
 */

describe('Phase 12-03 calculator integration', () => {
  // --------------------------------------------------------------------------
  // GROUP A — PRD worked example, setups=1 (canonical Smoke 3 fixture)
  // --------------------------------------------------------------------------
  describe('Group A: PRD worked example (148 wells, setups=1, 50 µL/well → 9.4 mL)', () => {
    it('T-A1: 100 samples / singles / 2 plates / 50 µL/well / setups=1', () => {
      const inputs = createCalculatorInputs(100, 'singles', 2, 50, 1)

      // Inputs echo back the supplied setups value
      expect(inputs.numberOfSetups).toBe(1)
      // Dead volume derived from setups (1 × 2000 µL)
      expect(inputs.deadVolume.equals(new Decimal(2000))).toBe(true)

      const outputs = calculateVolumes(inputs)

      // Wells: 100 unknown + 24 standards × 2 plates = 100 + 48 = 148
      expect(outputs.totalWells).toBe(148)
      expect(outputs.unknownWells).toBe(100)
      expect(outputs.standardWells).toBe(48)

      // Raw = 148 × 50 + 2000 = 7400 + 2000 = 9400 µL
      expect(outputs.rawVolume.equals(new Decimal(9400))).toBe(true)
      // Final = 9400 µL (already at 0.1-mL precision; passes through unchanged)
      expect(outputs.finalVolume.equals(new Decimal(9400))).toBe(true)
      // Display value in mL — tolerate IEEE-754 (use toBeCloseTo to be safe)
      expect(outputs.finalVolumeML).toBeCloseTo(9.4, 1)
    })
  })

  // --------------------------------------------------------------------------
  // GROUP B — Setups variant (dead-volume scaling)
  // --------------------------------------------------------------------------
  describe('Group B: PRD worked example with setups=3 → 13.4 mL', () => {
    it('T-B1: same inputs as T-A1 with setups=3 → 13400 µL / 13.4 mL', () => {
      const inputs = createCalculatorInputs(100, 'singles', 2, 50, 3)

      expect(inputs.numberOfSetups).toBe(3)
      // Dead volume scales: 3 × 2000 = 6000 µL
      expect(inputs.deadVolume.equals(new Decimal(6000))).toBe(true)

      const outputs = calculateVolumes(inputs)

      expect(outputs.totalWells).toBe(148)
      // Raw = 148 × 50 + 6000 = 13400 µL
      expect(outputs.rawVolume.equals(new Decimal(13400))).toBe(true)
      expect(outputs.finalVolume.equals(new Decimal(13400))).toBe(true)
      expect(outputs.finalVolumeML).toBeCloseTo(13.4, 1)
    })
  })

  // --------------------------------------------------------------------------
  // GROUP C — Rounding boundary cases through the full pipeline (SMK3-06)
  // --------------------------------------------------------------------------
  describe('Group C: 0.1-mL ceiling boundary cases through full pipeline', () => {
    it('T-C1: 148 × 50.7 µL/well + 2000 dead = 9503.6 → ceils to 9600 µL / 9.6 mL', () => {
      const inputs = createCalculatorInputs(100, 'singles', 2, 50.7, 1)
      const outputs = calculateVolumes(inputs)

      // Raw: 148 × 50.7 = 7503.6; + 2000 dead = 9503.6 µL
      expect(outputs.rawVolume.equals(new Decimal(9503.6))).toBe(true)
      // Ceil to 0.1 mL: 9.5036 mL → 9.6 mL = 9600 µL
      expect(outputs.finalVolume.equals(new Decimal(9600))).toBe(true)
      expect(outputs.finalVolumeML).toBeCloseTo(9.6, 1)
    })

    it('T-C2: 148 × 50.001 + 2000 = 9400.148 → ceils to 9500 µL / 9.5 mL', () => {
      const inputs = createCalculatorInputs(100, 'singles', 2, 50.001, 1)
      const outputs = calculateVolumes(inputs)

      // Raw: 148 × 50.001 = 7400.148; + 2000 = 9400.148 µL
      expect(outputs.rawVolume.equals(new Decimal(9400.148))).toBe(true)
      // Any fractional past 9.4 mL ceils to 9.5 mL = 9500 µL
      expect(outputs.finalVolume.equals(new Decimal(9500))).toBe(true)
      expect(outputs.finalVolumeML).toBeCloseTo(9.5, 1)
    })

    it('T-C3: minimal valid (1 sample / 1 plate / 50 µL / setups=1) → 3.3 mL', () => {
      // validateSampleCount rejects 0 sampleCount; minimal valid is 1.
      const inputs = createCalculatorInputs(1, 'singles', 1, 50, 1)
      const outputs = calculateVolumes(inputs)

      // Wells: 1 + 24 = 25
      expect(outputs.totalWells).toBe(25)
      // Raw: 25 × 50 + 2000 = 1250 + 2000 = 3250 µL
      expect(outputs.rawVolume.equals(new Decimal(3250))).toBe(true)
      // Ceil 3.25 mL → 3.3 mL = 3300 µL
      expect(outputs.finalVolume.equals(new Decimal(3300))).toBe(true)
      expect(outputs.finalVolumeML).toBeCloseTo(3.3, 1)
    })
  })

  // --------------------------------------------------------------------------
  // GROUP D — CALC-05 max-5-singles cap (lib level) — R-05 retention
  // --------------------------------------------------------------------------
  describe('Group D: CALC-05 max-5-singles cap (lib-level helpers)', () => {
    it('T-D1: canAddSingle(premix_singles, 0) → true (empty start, can add)', () => {
      expect(canAddSingle('premix_singles', 0)).toBe(true)
    })

    it('T-D2: canAddSingle(premix_singles, 4) → true (1 slot remains, 5th allowed)', () => {
      expect(canAddSingle('premix_singles', 4)).toBe(true)
    })

    it('T-D3: canAddSingle(premix_singles, 5) → false (cap blocks 6th)', () => {
      expect(canAddSingle('premix_singles', 5)).toBe(false)
    })

    it('T-D4: canAddSingle(premix_singles, 6) → false (defensive — already over cap)', () => {
      expect(canAddSingle('premix_singles', 6)).toBe(false)
    })

    it('T-D5: canAddSingle(custom, 100) → true (no cap in custom mode)', () => {
      expect(canAddSingle('custom', 100)).toBe(true)
    })

    it('T-D6: canAddSingle(premix, 0) → false (premix-only disallows ANY singles)', () => {
      expect(canAddSingle('premix', 0)).toBe(false)
    })

    it('T-D7: getRemainingSingles(premix_singles, 3) → 2', () => {
      expect(getRemainingSingles('premix_singles', 3)).toBe(2)
    })

    it('T-D8: getRemainingSingles(premix_singles, 5) → 0', () => {
      expect(getRemainingSingles('premix_singles', 5)).toBe(0)
    })

    it('T-D9: getMaxSingles(premix_singles) === 5 (constant guard)', () => {
      expect(getMaxSingles('premix_singles')).toBe(5)
    })
  })

  // --------------------------------------------------------------------------
  // GROUP E — CALC-05 store-level regression (addSingle action enforces cap)
  // --------------------------------------------------------------------------
  describe('Group E: CALC-05 max-5-singles cap — store integration', () => {
    beforeEach(() => {
      // Reset to initialState so each test starts from a known baseline.
      // We then mutate requestType + singles directly via setState so the
      // beforeEach matches the production "user has selected premix_singles
      // and added 5 analytes" scenario without going through the IPC layer.
      useCalculatorStore.getState().reset()
      useCalculatorStore.setState({
        requestType: 'premix_singles',
        singles: Array.from({ length: 5 }, (_, i) => ({
          id: `seed-${i}`,
          name: `Analyte${i}`,
          stockConcentration: 20
        }))
      })
    })

    it('T-E1: addSingle blocks the 6th single under premix_singles (CALC-05 cap)', () => {
      // Sanity: 5 singles preloaded
      expect(useCalculatorStore.getState().singles).toHaveLength(5)

      // Attempt to add a 6th — addSingle silently fails (per existing
      // calculatorStore.ts implementation: "UI should prevent this").
      useCalculatorStore.getState().addSingle({
        name: 'Sixth',
        stockConcentration: 20
      })

      // Length must NOT change.
      expect(useCalculatorStore.getState().singles).toHaveLength(5)
      // No analyte named 'Sixth' was added.
      expect(
        useCalculatorStore.getState().singles.find((s) => s.name === 'Sixth')
      ).toBeUndefined()
    })

    it('T-E2: addSingle works when under cap (4 → 5 transition)', () => {
      // Trim back to 4 singles to verify the cap only blocks the 6th.
      useCalculatorStore.setState({
        singles: useCalculatorStore.getState().singles.slice(0, 4)
      })
      expect(useCalculatorStore.getState().singles).toHaveLength(4)

      useCalculatorStore.getState().addSingle({
        name: 'Fifth',
        stockConcentration: 20
      })

      expect(useCalculatorStore.getState().singles).toHaveLength(5)
      expect(
        useCalculatorStore.getState().singles.find((s) => s.name === 'Fifth')
      ).toBeDefined()
    })
  })

  // --------------------------------------------------------------------------
  // GROUP F — Snapshot-frozen historical-run preservation (SMK3-16 enabler)
  // --------------------------------------------------------------------------
  describe('Group F: numberOfSetups round-trips through the store', () => {
    beforeEach(() => {
      useCalculatorStore.getState().reset()
    })

    it('T-F1: setNumberOfSetups(3) → getOutputs() recomputes with 6000 µL dead', () => {
      // Simulate loading a Smoke 3 run that was saved with setups=3.
      // 100 samples in singles mode auto-fills 2 plates (72-per-plate cap),
      // so totalWells = 100 + 24×2 = 148. We override volumePerWell to 50
      // µL to land on the canonical PRD worked-example fixture (matches
      // Plan 12-01 calculator.test.ts Group C).
      useCalculatorStore.getState().setSampleCount(100)
      useCalculatorStore.setState({ volumePerWell: 50 })
      useCalculatorStore.getState().setNumberOfSetups(3)

      const outputs = useCalculatorStore.getState().getOutputs()
      expect(outputs).not.toBeNull()
      expect(outputs!.totalWells).toBe(148)
      // numberOfSetups=3 → deadVolume = 6000 µL; raw = 148 × 50 + 6000 = 13400 µL
      expect(outputs!.rawVolume.equals(new Decimal(13400))).toBe(true)
      expect(outputs!.finalVolume.equals(new Decimal(13400))).toBe(true)
      expect(outputs!.finalVolumeML).toBeCloseTo(13.4, 1)
    })

    it('T-F1b: setNumberOfSetups(1) (default) → getOutputs() recomputes with 2000 µL dead → PRD 9.4 mL', () => {
      // The setups=1 mirror of T-F1 — confirms the round-trip works for both
      // the default and the Smoke-3 multi-setup path.
      useCalculatorStore.getState().setSampleCount(100)
      useCalculatorStore.setState({ volumePerWell: 50 })
      useCalculatorStore.getState().setNumberOfSetups(1)

      const outputs = useCalculatorStore.getState().getOutputs()
      expect(outputs).not.toBeNull()
      expect(outputs!.totalWells).toBe(148)
      // numberOfSetups=1 → deadVolume = 2000 µL; raw = 148 × 50 + 2000 = 9400 µL = 9.4 mL
      expect(outputs!.rawVolume.equals(new Decimal(9400))).toBe(true)
      expect(outputs!.finalVolume.equals(new Decimal(9400))).toBe(true)
      expect(outputs!.finalVolumeML).toBeCloseTo(9.4, 1)
    })

    it('T-F2: setNumberOfSetups rejects invalid input (0, -1, 1.5)', () => {
      // Baseline
      expect(useCalculatorStore.getState().numberOfSetups).toBe(1)

      // Each invalid call leaves numberOfSetups unchanged and sets a
      // descriptive validationError.
      useCalculatorStore.getState().setNumberOfSetups(0)
      expect(useCalculatorStore.getState().numberOfSetups).toBe(1)
      expect(useCalculatorStore.getState().validationError).toMatch(/setups/i)

      useCalculatorStore.getState().setNumberOfSetups(-1)
      expect(useCalculatorStore.getState().numberOfSetups).toBe(1)
      expect(useCalculatorStore.getState().validationError).toMatch(/setups/i)

      useCalculatorStore.getState().setNumberOfSetups(1.5)
      expect(useCalculatorStore.getState().numberOfSetups).toBe(1)
      expect(useCalculatorStore.getState().validationError).toMatch(/setups/i)
    })

    it('T-F3: setNumberOfSetups accepts mid-range integer (e.g., 100) — within the [1, 1000] bound', () => {
      useCalculatorStore.getState().setNumberOfSetups(100)
      expect(useCalculatorStore.getState().numberOfSetups).toBe(100)
      expect(useCalculatorStore.getState().validationError).toBeNull()
    })

    // --- Bounds-rejection tests for setNumberOfSetups (WR-04 closure) ---
    it('T-F4: setNumberOfSetups(1000) accepted — upper boundary inclusive', () => {
      useCalculatorStore.getState().setNumberOfSetups(1000)
      expect(useCalculatorStore.getState().numberOfSetups).toBe(1000)
      expect(useCalculatorStore.getState().validationError).toBeNull()
    })

    it('T-F5: setNumberOfSetups(1001) rejected — one past upper boundary', () => {
      // Baseline: numberOfSetups starts at 1 from reset.
      expect(useCalculatorStore.getState().numberOfSetups).toBe(1)
      useCalculatorStore.getState().setNumberOfSetups(1001)
      // State unchanged on reject.
      expect(useCalculatorStore.getState().numberOfSetups).toBe(1)
      // Error message includes the new "between 1 and 1000" phrasing.
      expect(useCalculatorStore.getState().validationError).toMatch(/between 1 and 1000/i)
    })

    it('T-F6: setNumberOfSetups(1500) rejected — verbatim case from 12-VERIFICATION gap #2', () => {
      expect(useCalculatorStore.getState().numberOfSetups).toBe(1)
      useCalculatorStore.getState().setNumberOfSetups(1500)
      expect(useCalculatorStore.getState().numberOfSetups).toBe(1)
      expect(useCalculatorStore.getState().validationError).toMatch(/between 1 and 1000/i)
      // Per WR-04 acceptance: subsequent getOutputs() must not throw,
      // since the bound was caught at the store layer.
      expect(() => useCalculatorStore.getState().getOutputs()).not.toThrow()
    })

    // --- setVolumePerWell action tests (WR-01 closure — new action from Task 1) ---
    it('T-F7: setVolumePerWell(50) accepted — state mutates, validationError null', () => {
      useCalculatorStore.getState().setVolumePerWell(50)
      expect(useCalculatorStore.getState().volumePerWell).toBe(50)
      expect(useCalculatorStore.getState().validationError).toBeNull()
    })

    it('T-F8: setVolumePerWell(0) rejected — state unchanged, validationError set', () => {
      // Baseline: DEFAULT_VOLUME_PER_WELL = 25 from reset.
      const baseline = useCalculatorStore.getState().volumePerWell
      useCalculatorStore.getState().setVolumePerWell(0)
      expect(useCalculatorStore.getState().volumePerWell).toBe(baseline)
      expect(useCalculatorStore.getState().validationError).toMatch(/volume per well/i)
    })

    it('T-F9: setVolumePerWell(-5) rejected — negative volumes invalid', () => {
      const baseline = useCalculatorStore.getState().volumePerWell
      useCalculatorStore.getState().setVolumePerWell(-5)
      expect(useCalculatorStore.getState().volumePerWell).toBe(baseline)
      expect(useCalculatorStore.getState().validationError).toMatch(/volume per well/i)
    })

    it('T-F10: setVolumePerWell(NaN) rejected — non-finite invalid', () => {
      const baseline = useCalculatorStore.getState().volumePerWell
      useCalculatorStore.getState().setVolumePerWell(NaN)
      expect(useCalculatorStore.getState().volumePerWell).toBe(baseline)
      expect(useCalculatorStore.getState().validationError).toMatch(/volume per well/i)
    })

    it('T-F11: setVolumePerWell(Infinity) rejected — non-finite invalid', () => {
      const baseline = useCalculatorStore.getState().volumePerWell
      useCalculatorStore.getState().setVolumePerWell(Infinity)
      expect(useCalculatorStore.getState().volumePerWell).toBe(baseline)
      expect(useCalculatorStore.getState().validationError).toMatch(/volume per well/i)
    })

    it('T-F12: validationError cleared after a valid call following a rejection', () => {
      // Trip the error first.
      useCalculatorStore.getState().setVolumePerWell(-1)
      expect(useCalculatorStore.getState().validationError).toMatch(/volume per well/i)
      // Recover with a valid call — error must clear, state must mutate.
      useCalculatorStore.getState().setVolumePerWell(40)
      expect(useCalculatorStore.getState().volumePerWell).toBe(40)
      expect(useCalculatorStore.getState().validationError).toBeNull()
    })
  })

  // --------------------------------------------------------------------------
  // GROUP G — runStore.loadRun cascade end-to-end (SMK3-16 contract; WR-01 + WR-03)
  // --------------------------------------------------------------------------
  describe('Group G: runStore.loadRun preserves persisted volumePerWell + numberOfSetups (SMK3-16)', () => {
    /**
     * Why a separate group from Group F:
     *   Group F drives setNumberOfSetups DIRECTLY on the calculatorStore — it
     *   does NOT exercise the runStore.loadRun cascade. WR-03 from 12-REVIEW.md
     *   flagged this exact gap: "Group F is documented as the SMK3-16 enabler
     *   test but it calls setNumberOfSetups directly on the calculatorStore,
     *   never via the runStore.loadRun → calculator cascade."
     *
     * Test-env note: vitest.config.ts sets environment: 'node'. There is no
     * window global by default. We use vi.stubGlobal('window', ...) inside
     * beforeEach (Approach A per 12-04-PLAN.md — minimum blast radius) and
     * clean up with vi.unstubAllGlobals() in afterEach.
     *
     * Stub shape note: the endpoint names below are the REAL names from
     * src/preload/index.ts (verified during plan revision 2026-05-11):
     *   - species.getByPlatformId          (species is its OWN namespace)
     *   - panel.getByPlatformAndSpecies    (NOT getByPlatformSpecies)
     *   - analyte.getByPlatformAndSpecies  (NOT getByPlatformSpecies)
     *   - panel.getWithAnalytes            (NOT panel.getAnalytesByPanel)
     * If the loadRun cascade ever calls an endpoint not listed here, add
     * it; if anything below is unused, delete it (smaller stub = less coupling).
     */

    // Build a fully-shaped RunRecord mock. Required by TypeScript — every
    // non-optional field on RunRecord must be present. Helper centralizes
    // the boilerplate so each test only overrides the load-bearing fields.
    function makeMockRun(overrides: Partial<RunRecord> = {}): RunRecord {
      return {
        id: 'run-test-1',
        requestNumber: 99001,
        requestOverrideAdHoc: false,
        userName: 'Test Operator',
        operatorId: 'op-test',
        runDate: '2026-05-11',
        sampleType: 'Plasma',
        dilutionFactor: 1,
        sampleCount: 100,
        replicateMode: 'singles',
        requestType: 'premix',
        platformId: 'platform-test',
        speciesId: 'species-test',
        panelId: null,
        volumePerWell: 50,
        deadVolume: 6000,
        numberOfSetups: 3,
        hamilton: 1,
        runPlatePosition: 1,
        standardPosition: 1,
        troughPosition: 1,
        comments: null,
        plex: 0,
        plateCount: 2,
        plates: { 1: [], 2: [] },
        singleAnalyteIds: [],
        createdAt: '2026-05-11T00:00:00Z',
        updatedAt: '2026-05-11T00:00:00Z',
        machineName: null,
        isOfflineSave: false,
        ...overrides
      }
    }

    beforeEach(() => {
      // Reset calculator + run stores so each test starts clean.
      useCalculatorStore.getState().reset()

      // Stub window.electronAPI for the loadRun cascade. Approach A from
      // 12-04-PLAN.md — narrow stub, no DOM env switch. Endpoint names
      // mirror src/preload/index.ts exactly (see Step A above).
      vi.stubGlobal('window', {
        electronAPI: {
          run: {
            getAll: vi.fn().mockResolvedValue([]),
            getById: vi.fn(),
            create: vi.fn(),
            update: vi.fn(),
            delete: vi.fn()
          },
          platform: {
            getAll: vi.fn().mockResolvedValue([
              { id: 'platform-test', name: 'Test Platform', active: true }
            ]),
            getById: vi.fn().mockResolvedValue({
              id: 'platform-test', name: 'Test Platform', active: true
            }),
            create: vi.fn(),
            update: vi.fn()
          },
          species: {
            // species is its OWN top-level namespace (NOT nested under platform).
            getByPlatformId: vi.fn().mockResolvedValue([
              { id: 'species-test', platformId: 'platform-test', name: 'Test Species', active: true }
            ])
          },
          panel: {
            getByPlatformAndSpecies: vi.fn().mockResolvedValue([]),
            getWithAnalytes: vi.fn().mockResolvedValue(null),
            update: vi.fn(),
            delete: vi.fn(),
            addAnalyte: vi.fn(),
            removeAnalyte: vi.fn()
          },
          analyte: {
            getByPlatformAndSpecies: vi.fn().mockResolvedValue([]),
            getByPanelId: vi.fn().mockResolvedValue([]),
            update: vi.fn(),
            delete: vi.fn()
          }
        }
      })
    })

    afterEach(() => {
      vi.unstubAllGlobals()
    })

    it('T-G1: Smoke 3 run (volumePerWell=50, numberOfSetups=3) round-trips through loadRun → 13.4 mL', async () => {
      const mockRun = makeMockRun({
        volumePerWell: 50,
        numberOfSetups: 3,
        sampleCount: 100,
        deadVolume: 6000
      })
      // Cast: TS sees the stubbed window as unknown; the cast is local.
      ;(window.electronAPI.run.getById as ReturnType<typeof vi.fn>).mockResolvedValue(mockRun)

      await useRunStore.getState().loadRun(mockRun.id)

      // Assert no validation error surfaced anywhere in the loadRun
      // cascade (setReplicateMode → setSampleCount → setVolumePerWell →
      // setNumberOfSetups). Placed BEFORE the math assertions so any
      // regression in the validation cascade fails on this contract line.
      expect(useCalculatorStore.getState().validationError).toBeNull()

      // The load-bearing assertions: volumePerWell was restored (NOT the
      // 25 µL fall-back), numberOfSetups was restored, and getOutputs()
      // reproduces the persisted PRD worked-example total.
      expect(useCalculatorStore.getState().volumePerWell).toBe(50)
      expect(useCalculatorStore.getState().numberOfSetups).toBe(3)
      expect(useCalculatorStore.getState().sampleCount).toBe(100)

      const outputs = useCalculatorStore.getState().getOutputs()
      expect(outputs).not.toBeNull()
      // 148 wells × 50 µL + 6000 dead = 13400 µL = 13.4 mL
      expect(outputs!.totalWells).toBe(148)
      expect(outputs!.rawVolume.equals(new Decimal(13400))).toBe(true)
      expect(outputs!.finalVolume.equals(new Decimal(13400))).toBe(true)
      expect(outputs!.finalVolumeML).toBeCloseTo(13.4, 1)
    })

    it('T-G2: pre-Smoke-3 legacy run (numberOfSetups undefined) defaults to setups=1 → 9.4 mL', async () => {
      // Simulate a run saved BEFORE Plan 12-03 introduced numberOfSetups.
      // The TypeScript type marks the field optional; omit it on the mock
      // to assert the ?? 1 fall-back path in runStore.loadRun.
      const legacyRun = makeMockRun({
        volumePerWell: 50,
        numberOfSetups: undefined,
        sampleCount: 100,
        deadVolume: 2000
      })
      ;(window.electronAPI.run.getById as ReturnType<typeof vi.fn>).mockResolvedValue(legacyRun)

      await useRunStore.getState().loadRun(legacyRun.id)

      // Assert no validation error from the loadRun cascade. Placed
      // BEFORE the math assertions so any regression in the validation
      // cascade fails on this contract line.
      expect(useCalculatorStore.getState().validationError).toBeNull()

      // volumePerWell is REQUIRED on RunRecord, so it's still restored.
      expect(useCalculatorStore.getState().volumePerWell).toBe(50)
      // numberOfSetups falls back to 1 (the runStore.loadRun ?? 1).
      expect(useCalculatorStore.getState().numberOfSetups).toBe(1)

      const outputs = useCalculatorStore.getState().getOutputs()
      expect(outputs).not.toBeNull()
      // 148 wells × 50 µL + 2000 dead = 9400 µL = 9.4 mL (matches T-A1)
      expect(outputs!.rawVolume.equals(new Decimal(9400))).toBe(true)
      expect(outputs!.finalVolume.equals(new Decimal(9400))).toBe(true)
      expect(outputs!.finalVolumeML).toBeCloseTo(9.4, 1)
    })
  })
})
