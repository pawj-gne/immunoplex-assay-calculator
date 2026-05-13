import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { buildRunSnapshot, type MetadataFields } from '../useRunSnapshot'
import { useCalculatorStore } from '../../../../stores/calculatorStore'
import { usePlatformStore } from '../../../../stores/platformStore'
import { useSelectionStore } from '../../../../stores/selectionStore'
import { usePlateStore } from '../../../../stores/plateStore'

/**
 * Phase 15 Plan 03 Task 3 — proves the 10 new audit-trail snapshot fields
 * land on the RunCreate payload returned by the async buildRunSnapshot.
 *
 * Test coverage (validation map row 15-03-01):
 *   1. Happy path: master panel + 3 reagents present → all 10 fields populated
 *   2. Custom assay: no premix → no IPC call, 6 master-panel fields null
 *   3. IPC failure: getWithReagents throws → returns { error: 'Failed to snapshot…' }
 *   4. Override packing: calculatorStore.oldBeadsOverride=true → on RunCreate
 *
 * IPC mock pattern: vi.stubGlobal('window', { electronAPI: { masterPanel: { … } } })
 * mirrors the shape used in calculator.integration.test.ts Group J.
 */

// Minimal valid metadata fixture — all gates pass.
const validMetadata: MetadataFields = {
  requestNumber: 12345,
  requestOverrideAdHoc: false,
  userName: 'Test Operator',
  operatorId: 'op-001',
  runDate: '2026-05-12',
  sampleType: 'Plasma',
  dilutionFactor: 4,
  hamilton: 1,
  runPlatePosition: 1,
  standardPosition: 1,
  troughPosition: 1,
  comments: ''
}

// Master panel + 3 reagents fixture for happy path.
const masterPanelHappyPath = {
  masterPanel: {
    id: 'mp-1',
    platformId: 'plat-1',
    speciesId: 'spec-1',
    name: 'Panel I',
    sapeName: 'SAPE-A',
    description: null,
    vendorSinglesTerm: null,
    createdAt: '2026-05-12T00:00:00Z',
    updatedAt: '2026-05-12T00:00:00Z'
  },
  reagents: [
    {
      id: 'r-1',
      masterPanelId: 'mp-1',
      reagentKind: 'beads' as const,
      concentration: null,
      diluent: 'L-AB',
      volumePerWell: 0.05,
      createdAt: '2026-05-12T00:00:00Z',
      updatedAt: '2026-05-12T00:00:00Z'
    },
    {
      id: 'r-2',
      masterPanelId: 'mp-1',
      reagentKind: 'antibodies' as const,
      concentration: null,
      diluent: 'L-AB',
      volumePerWell: 0.025,
      createdAt: '2026-05-12T00:00:00Z',
      updatedAt: '2026-05-12T00:00:00Z'
    },
    {
      id: 'r-3',
      masterPanelId: 'mp-1',
      reagentKind: 'sape' as const,
      concentration: 1.0,
      diluent: null,
      volumePerWell: 0.025,
      createdAt: '2026-05-12T00:00:00Z',
      updatedAt: '2026-05-12T00:00:00Z'
    }
  ]
}

// Helper: seed the 4 stores with a Smoke 3 premix panel selected. We use
// setState with merge semantics so each test only sets the fields it cares
// about; other state stays at the store's initial defaults.
//
// `as never` is a deliberate localized escape hatch because the seeded
// shapes are partial — zustand's setState typing requires the full state
// object otherwise. The test contracts are on the RESULT of buildRunSnapshot,
// not on the store typings.
function seedStoresWithPremixPanel(): void {
  usePlatformStore.setState({ selectedPlatformId: 'plat-1' })
  useSelectionStore.setState({
    selectedSpeciesId: 'spec-1',
    selectedPanelId: 'panel-1',
    selectedPanel: {
      id: 'panel-1',
      name: 'Panel I',
      description: null,
      platformId: 'plat-1',
      speciesId: 'spec-1',
      masterPanelId: 'mp-1',
      parentPanelId: null,
      subPanelConc: 1.0,
      createdAt: '2026-05-12T00:00:00Z',
      updatedAt: '2026-05-12T00:00:00Z',
      analytes: []
    },
    selectedSingleIds: [],
    getAllSelectedAnalytes: () =>
      [
        {
          id: 'a-1',
          name: 'IL-6',
          platformId: 'plat-1',
          speciesId: 'spec-1',
          stockConcentration: 20,
          beadRegion: null,
          createdAt: '2026-05-12T00:00:00Z',
          updatedAt: '2026-05-12T00:00:00Z'
        }
      ] as never
  } as never)
  useCalculatorStore.setState({
    sampleCount: 100,
    replicateMode: 'singles',
    requestType: 'premix',
    volumePerWell: 50,
    numberOfSetups: 1,
    oldBeads: 0,
    oldAntibodies: 0,
    oldBeadsOverride: false,
    oldAntibodiesOverride: false,
    validationError: null,
    capPaused: false
  })
  usePlateStore.setState({
    getPlateCount: () => 2,
    getPlatesSnapshot: () => ({})
  } as never)
}

// Helper: seed with no premix (custom assay) — same defaults as premix-panel
// path, but with selectedPanel = null and selectedPanelId = null.
function seedStoresCustomAssay(): void {
  seedStoresWithPremixPanel()
  useSelectionStore.setState({
    selectedPanelId: null,
    selectedPanel: null
  } as never)
}

describe('Phase 15 — buildRunSnapshot async + 10 new audit-trail fields', () => {
  beforeEach(() => {
    // Restore mocks AND reset the calculator store between tests so
    // override flags don't leak across cases (Threat T-15-10 mitigation).
    vi.restoreAllMocks()
    useCalculatorStore.getState().reset()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('happy path: packs all 10 audit-trail fields when master panel + 3 reagents are present (SMK3-12/15/16/17)', async () => {
    const getWithReagentsMock = vi.fn().mockResolvedValue(masterPanelHappyPath)
    vi.stubGlobal('window', {
      electronAPI: { masterPanel: { getWithReagents: getWithReagentsMock } }
    })
    seedStoresWithPremixPanel()

    const result = await buildRunSnapshot(validMetadata)
    expect('error' in result).toBe(false)
    if ('error' in result) return // type narrow for TS

    expect(getWithReagentsMock).toHaveBeenCalledTimes(1)
    expect(getWithReagentsMock).toHaveBeenCalledWith('mp-1')

    // 6 master-panel-derived fields populated from the IPC result.
    expect(result.sapeName).toBe('SAPE-A')
    expect(result.sapeConcentration).toBe(1.0)
    expect(result.beadsDiluent).toBe('L-AB')
    expect(result.antibodiesDiluent).toBe('L-AB')
    expect(result.beadsVolumePerWell).toBe(0.05)
    expect(result.antibodiesVolumePerWell).toBe(0.025)
    // premixConcentration from selectionStore.selectedPanel.subPanelConc (no IPC).
    expect(result.premixConcentration).toBe(1.0)
    // 2 override booleans default false (operator did not confirm cap modal).
    expect(result.oldBeadsOverride).toBe(false)
    expect(result.oldAntibodiesOverride).toBe(false)
    // Marker for Phase-15-format saves.
    expect(result.calculationRulesVersion).toBe('smoke3')
  })

  it('custom assay: skips the IPC call and writes 6 nulls when no premix is selected', async () => {
    const getWithReagentsMock = vi.fn().mockResolvedValue(null)
    vi.stubGlobal('window', {
      electronAPI: { masterPanel: { getWithReagents: getWithReagentsMock } }
    })
    seedStoresCustomAssay()

    const result = await buildRunSnapshot(validMetadata)
    expect('error' in result).toBe(false)
    if ('error' in result) return

    // No premix → no IPC call.
    expect(getWithReagentsMock).not.toHaveBeenCalled()

    // 6 master-panel fields all null; premixConcentration null too.
    expect(result.sapeName).toBeNull()
    expect(result.sapeConcentration).toBeNull()
    expect(result.beadsDiluent).toBeNull()
    expect(result.antibodiesDiluent).toBeNull()
    expect(result.beadsVolumePerWell).toBeNull()
    expect(result.antibodiesVolumePerWell).toBeNull()
    expect(result.premixConcentration).toBeNull()
    // Marker still stamped on custom-assay saves (drives historical-run UI).
    expect(result.calculationRulesVersion).toBe('smoke3')
  })

  it('WR-02 IPC throw: silent-skip the smoke3 marker + 10 audit fields (no error returned)', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const getWithReagentsMock = vi.fn().mockRejectedValue(new Error('IPC blew up'))
    vi.stubGlobal('window', {
      electronAPI: { masterPanel: { getWithReagents: getWithReagentsMock } }
    })
    seedStoresWithPremixPanel()

    const result = await buildRunSnapshot(validMetadata)
    // NO error result — the save proceeds.
    expect('error' in result).toBe(false)
    if ('error' in result) return // type narrow

    // Marker absent — run will render as legacy (historical banner shows).
    expect(result.calculationRulesVersion).toBeUndefined()
    // 6 master-panel fields absent (conditional-spread omitted them).
    expect(result.sapeName).toBeUndefined()
    expect(result.sapeConcentration).toBeUndefined()
    expect(result.beadsDiluent).toBeUndefined()
    expect(result.antibodiesDiluent).toBeUndefined()
    expect(result.beadsVolumePerWell).toBeUndefined()
    expect(result.antibodiesVolumePerWell).toBeUndefined()
    // premixConcentration + 2 override flags also absent (whole 10-field block omitted).
    expect(result.premixConcentration).toBeUndefined()
    expect(result.oldBeadsOverride).toBeUndefined()
    expect(result.oldAntibodiesOverride).toBeUndefined()

    // Always-emitted fields still present.
    expect(result.sampleCount).toBeDefined()

    // Diagnostic console.warn fired exactly once with the IPC error message.
    expect(warnSpy).toHaveBeenCalledTimes(1)
    expect(warnSpy.mock.calls[0][0]).toContain('IPC blew up')

    warnSpy.mockRestore()
  })

  it('WR-02 IPC null result: silent-skip the smoke3 marker + 10 audit fields', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const getWithReagentsMock = vi.fn().mockResolvedValue(null) // resolves null, does not throw
    vi.stubGlobal('window', {
      electronAPI: { masterPanel: { getWithReagents: getWithReagentsMock } }
    })
    seedStoresWithPremixPanel() // premix IS selected — masterPanelId is non-null, so IPC IS called

    const result = await buildRunSnapshot(validMetadata)
    expect('error' in result).toBe(false)
    if ('error' in result) return

    expect(getWithReagentsMock).toHaveBeenCalledTimes(1) // distinguishes from custom-assay path
    expect(result.calculationRulesVersion).toBeUndefined()
    expect(result.sapeName).toBeUndefined()

    expect(warnSpy).toHaveBeenCalledTimes(1)

    warnSpy.mockRestore()
  })

  it('override packing: oldBeadsOverride=true / oldAntibodiesOverride=true flow from calculatorStore onto RunCreate (D-15-08)', async () => {
    vi.stubGlobal('window', {
      electronAPI: { masterPanel: { getWithReagents: vi.fn().mockResolvedValue(null) } }
    })
    seedStoresCustomAssay()
    useCalculatorStore.setState({
      oldBeadsOverride: true,
      oldAntibodiesOverride: true
    })

    const result = await buildRunSnapshot(validMetadata)
    expect('error' in result).toBe(false)
    if ('error' in result) return
    expect(result.oldBeadsOverride).toBe(true)
    expect(result.oldAntibodiesOverride).toBe(true)
  })
})
