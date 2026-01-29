import { useState, useEffect, useCallback } from 'react'
import { PanelEditModal } from './PanelEditModal'

interface Analyte {
  id: string
  name: string
  beadRegion: number
  premixConc: number
  singleConc: number
  platformId: string
  speciesId: string
  createdAt: string
  updatedAt: string
}

interface PremixPanel {
  id: string
  name: string
  description: string | null
  platformId: string
  speciesId: string
  createdAt: string
  updatedAt: string
}

interface PanelWithAnalytes extends PremixPanel {
  analytes: Analyte[]
}

interface PanelListProps {
  platformId: string
  speciesId: string
}

export function PanelList({ platformId, speciesId }: PanelListProps): JSX.Element {
  const [panels, setPanels] = useState<PremixPanel[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [expandedPanel, setExpandedPanel] = useState<PanelWithAnalytes | null>(null)
  const [editingPanel, setEditingPanel] = useState<PanelWithAnalytes | null>(null)

  const fetchPanels = useCallback(async () => {
    setLoading(true)
    try {
      const result = await window.electronAPI.panel.getByPlatformAndSpecies(platformId, speciesId)
      setPanels(result)
    } catch {
      setPanels([])
    } finally {
      setLoading(false)
    }
  }, [platformId, speciesId])

  useEffect(() => {
    fetchPanels()
  }, [fetchPanels])

  async function handleExpand(panelId: string): Promise<void> {
    if (expandedId === panelId) {
      setExpandedId(null)
      setExpandedPanel(null)
      return
    }
    setExpandedId(panelId)
    try {
      const result = await window.electronAPI.panel.getWithAnalytes(panelId)
      setExpandedPanel(result)
    } catch {
      setExpandedPanel(null)
    }
  }

  async function handleEdit(panelId: string): Promise<void> {
    try {
      const result = await window.electronAPI.panel.getWithAnalytes(panelId)
      setEditingPanel(result)
    } catch {
      /* ignore */
    }
  }

  async function handleDelete(panelId: string): Promise<void> {
    try {
      await window.electronAPI.panel.delete(panelId)
      setPanels((prev) => prev.filter((p) => p.id !== panelId))
      if (expandedId === panelId) {
        setExpandedId(null)
        setExpandedPanel(null)
      }
    } catch {
      /* ignore */
    }
  }

  async function handleRemoveAnalyte(panelId: string, analyteId: string): Promise<void> {
    try {
      await window.electronAPI.panel.removeAnalyte(panelId, analyteId)
      if (expandedPanel && expandedPanel.id === panelId) {
        setExpandedPanel({
          ...expandedPanel,
          analytes: expandedPanel.analytes.filter((a) => a.id !== analyteId)
        })
      }
    } catch {
      /* ignore */
    }
  }

  if (loading) {
    return <p className="text-sm text-[var(--color-muted)]">Loading panels...</p>
  }

  if (panels.length === 0) {
    return <p className="text-sm text-[var(--color-muted)]">No panels found.</p>
  }

  return (
    <>
      <div className="space-y-3">
        {panels.map((panel) => (
          <div
            key={panel.id}
            className="border border-[var(--color-border)] rounded-lg p-4 shadow-sm bg-white"
          >
            <div className="flex items-center justify-between">
              <div className="flex-1 cursor-pointer" onClick={() => handleExpand(panel.id)}>
                <h4 className="text-sm font-semibold text-[var(--color-foreground)]">
                  {panel.name}
                </h4>
                {panel.description && (
                  <p className="text-xs text-[var(--color-muted)] mt-0.5">{panel.description}</p>
                )}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => handleEdit(panel.id)}
                  className="px-3 py-1 text-xs font-medium rounded border border-[var(--color-border)] text-[var(--color-foreground)] hover:bg-gray-50"
                >
                  Edit
                </button>
                <button
                  onClick={() => handleDelete(panel.id)}
                  className="px-3 py-1 text-xs font-medium rounded border border-red-200 text-red-600 hover:bg-red-50"
                >
                  Delete
                </button>
              </div>
            </div>

            {expandedId === panel.id && expandedPanel && (
              <div className="mt-3 pt-3 border-t border-[var(--color-border)]">
                {expandedPanel.analytes.length === 0 ? (
                  <p className="text-xs text-[var(--color-muted)]">No analytes in this panel.</p>
                ) : (
                  <ul className="space-y-1">
                    {expandedPanel.analytes.map((a) => (
                      <li
                        key={a.id}
                        className="flex items-center justify-between text-xs px-2 py-1.5 bg-gray-50 rounded"
                      >
                        <span>
                          {a.name}{' '}
                          <span className="text-[var(--color-muted)]">
                            (Region {a.beadRegion})
                          </span>
                        </span>
                        <button
                          onClick={() => handleRemoveAnalyte(panel.id, a.id)}
                          className="text-red-500 hover:text-red-700 font-medium"
                        >
                          Remove
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {editingPanel && (
        <PanelEditModal
          panel={editingPanel}
          platformId={platformId}
          speciesId={speciesId}
          onClose={() => setEditingPanel(null)}
          onSaved={() => {
            setEditingPanel(null)
            fetchPanels()
          }}
        />
      )}
    </>
  )
}
