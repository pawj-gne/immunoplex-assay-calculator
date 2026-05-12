import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { useSelectionStore } from '../selectionStore'
import type { PanelWithAnalytes } from '../../../../shared/types/panel'

describe('selectionStore.selectPanel (Smoke 3 SMK3-13 — D-18 preserve / D-20 prune)', () => {
  beforeEach(() => {
    useSelectionStore.getState().resetAllSelections()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  describe('D-18: selectPanel(null) preserves selectedSingleIds', () => {
    it('T-1: when singles = [a1, a2], selectPanel(null) keeps them', async () => {
      useSelectionStore.setState({
        selectedPanelId: 'panel-A',
        selectedSingleIds: ['a1', 'a2']
      })
      await useSelectionStore.getState().selectPanel(null)
      expect(useSelectionStore.getState().selectedPanelId).toBeNull()
      expect(useSelectionStore.getState().selectedSingleIds).toEqual(['a1', 'a2'])
    })

    it('T-2: when singles = [], selectPanel(null) keeps empty', async () => {
      useSelectionStore.setState({
        selectedPanelId: 'panel-A',
        selectedSingleIds: []
      })
      await useSelectionStore.getState().selectPanel(null)
      expect(useSelectionStore.getState().selectedSingleIds).toEqual([])
    })
  })

  describe('D-20: selectPanel(newPanel) prunes selectedSingleIds by panel membership', () => {
    it('T-3: panel B contains a2; singles=[a1,a2,a3] → prune to [a1,a3]', async () => {
      const panelB: PanelWithAnalytes = {
        id: 'panel-B',
        name: 'Panel B',
        description: null,
        platformId: 'p1',
        speciesId: 's1',
        masterPanelId: null,
        parentPanelId: null,
        subPanelConc: 1,
        createdAt: '2026-01-01',
        updatedAt: '2026-01-01',
        analytes: [
          // Only a2 and a4 are members
          {
            id: 'a2',
            name: 'IL-2',
            beadRegion: 12,
            premixConc: 10,
            singleConc: 20,
            platformId: 'p1',
            speciesId: 's1',
            masterPanelId: null,
            createdAt: '2026-01-01',
            updatedAt: '2026-01-01'
          },
          {
            id: 'a4',
            name: 'IL-4',
            beadRegion: 14,
            premixConc: 10,
            singleConc: 20,
            platformId: 'p1',
            speciesId: 's1',
            masterPanelId: null,
            createdAt: '2026-01-01',
            updatedAt: '2026-01-01'
          }
        ]
      }
      vi.stubGlobal('window', {
        electronAPI: {
          panel: { getWithAnalytes: vi.fn().mockResolvedValue(panelB) }
        }
      })

      useSelectionStore.setState({ selectedSingleIds: ['a1', 'a2', 'a3'] })
      await useSelectionStore.getState().selectPanel('panel-B')

      expect(useSelectionStore.getState().selectedPanelId).toBe('panel-B')
      expect([...useSelectionStore.getState().selectedSingleIds].sort()).toEqual(['a1', 'a3'])
    })

    it('T-4: no overlap → all singles survive', async () => {
      const panelB: PanelWithAnalytes = {
        id: 'panel-B',
        name: 'Panel B',
        description: null,
        platformId: 'p1',
        speciesId: 's1',
        masterPanelId: null,
        parentPanelId: null,
        subPanelConc: 1,
        createdAt: '2026-01-01',
        updatedAt: '2026-01-01',
        analytes: [
          {
            id: 'a5',
            name: 'IL-5',
            beadRegion: 15,
            premixConc: 10,
            singleConc: 20,
            platformId: 'p1',
            speciesId: 's1',
            masterPanelId: null,
            createdAt: '2026-01-01',
            updatedAt: '2026-01-01'
          }
        ]
      }
      vi.stubGlobal('window', {
        electronAPI: {
          panel: { getWithAnalytes: vi.fn().mockResolvedValue(panelB) }
        }
      })

      useSelectionStore.setState({ selectedSingleIds: ['a1', 'a2', 'a3'] })
      await useSelectionStore.getState().selectPanel('panel-B')

      expect([...useSelectionStore.getState().selectedSingleIds].sort()).toEqual([
        'a1',
        'a2',
        'a3'
      ])
    })

    it('T-5: IPC error preserves selectedSingleIds (NOT cleared)', async () => {
      vi.stubGlobal('window', {
        electronAPI: {
          panel: {
            getWithAnalytes: vi.fn().mockRejectedValue(new Error('IPC failed'))
          }
        }
      })

      useSelectionStore.setState({ selectedSingleIds: ['a1', 'a2'] })
      await useSelectionStore.getState().selectPanel('panel-B')

      expect(useSelectionStore.getState().selectedSingleIds).toEqual(['a1', 'a2'])
      expect(useSelectionStore.getState().panelError).toMatch(/IPC failed/)
      expect(useSelectionStore.getState().panelLoading).toBe(false)
    })
  })
})
