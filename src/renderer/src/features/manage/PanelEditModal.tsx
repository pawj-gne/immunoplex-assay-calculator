import { useState, useEffect } from 'react'

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

interface PanelWithAnalytes {
  id: string
  name: string
  description: string | null
  platformId: string
  speciesId: string
  createdAt: string
  updatedAt: string
  analytes: Analyte[]
}

interface PanelEditModalProps {
  panel: PanelWithAnalytes
  platformId: string
  speciesId: string
  onClose: () => void
  onSaved: () => void
}

export function PanelEditModal({
  panel,
  platformId,
  speciesId,
  onClose,
  onSaved
}: PanelEditModalProps): JSX.Element {
  const [name, setName] = useState(panel.name)
  const [description, setDescription] = useState(panel.description ?? '')
  const [panelAnalytes, setPanelAnalytes] = useState<Analyte[]>(panel.analytes)
  const [allAnalytes, setAllAnalytes] = useState<Analyte[]>([])
  const [addAnalyteId, setAddAnalyteId] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    window.electronAPI.analyte
      .getByPlatformAndSpecies(platformId, speciesId)
      .then(setAllAnalytes)
      .catch(() => setAllAnalytes([]))
  }, [platformId, speciesId])

  const availableAnalytes = allAnalytes.filter(
    (a) => !panelAnalytes.some((pa) => pa.id === a.id)
  )

  async function handleAddAnalyte(): Promise<void> {
    if (!addAnalyteId) return
    try {
      await window.electronAPI.panel.addAnalyte(panel.id, addAnalyteId)
      const added = allAnalytes.find((a) => a.id === addAnalyteId)
      if (added) setPanelAnalytes((prev) => [...prev, added])
      setAddAnalyteId('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add analyte')
    }
  }

  async function handleRemoveAnalyte(analyteId: string): Promise<void> {
    try {
      await window.electronAPI.panel.removeAnalyte(panel.id, analyteId)
      setPanelAnalytes((prev) => prev.filter((a) => a.id !== analyteId))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove analyte')
    }
  }

  async function handleSave(): Promise<void> {
    setSaving(true)
    setError(null)
    try {
      await window.electronAPI.panel.update({
        id: panel.id,
        name: name.trim(),
        description: description.trim() || null
      })
      onSaved()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save panel')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-lg border border-[var(--color-border)] shadow-lg w-full max-w-lg mx-4 max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--color-border)]">
          <h3 className="text-lg font-semibold text-[var(--color-foreground)]">Edit Panel</h3>
          <button
            onClick={onClose}
            className="text-[var(--color-muted)] hover:text-[var(--color-foreground)]"
          >
            X
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {error && (
            <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-[var(--color-foreground)] mb-1">
              Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 border border-[var(--color-border)] rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-[var(--color-foreground)] mb-1">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="w-full px-3 py-2 border border-[var(--color-border)] rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-[var(--color-foreground)] mb-2">
              Analytes ({panelAnalytes.length})
            </label>
            {panelAnalytes.length === 0 ? (
              <p className="text-sm text-[var(--color-muted)]">No analytes in this panel.</p>
            ) : (
              <ul className="space-y-1">
                {panelAnalytes.map((a) => (
                  <li
                    key={a.id}
                    className="flex items-center justify-between px-3 py-1.5 bg-gray-50 rounded text-sm"
                  >
                    <span>
                      {a.name}{' '}
                      <span className="text-[var(--color-muted)]">(Region {a.beadRegion})</span>
                    </span>
                    <button
                      onClick={() => handleRemoveAnalyte(a.id)}
                      className="text-red-500 hover:text-red-700 text-xs font-medium"
                    >
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {availableAnalytes.length > 0 && (
              <div className="flex gap-2 mt-2">
                <select
                  value={addAnalyteId}
                  onChange={(e) => setAddAnalyteId(e.target.value)}
                  className="flex-1 px-3 py-1.5 border border-[var(--color-border)] rounded-md text-sm"
                >
                  <option value="">Add analyte...</option>
                  {availableAnalytes.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name} (Region {a.beadRegion})
                    </option>
                  ))}
                </select>
                <button
                  onClick={handleAddAnalyte}
                  disabled={!addAnalyteId}
                  className="px-3 py-1.5 text-sm font-medium rounded-md bg-[var(--color-primary)] text-white hover:opacity-90 disabled:opacity-40"
                >
                  Add
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-2 px-6 py-4 border-t border-[var(--color-border)]">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium rounded-md border border-[var(--color-border)] bg-white text-[var(--color-foreground)] hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !name.trim()}
            className="px-4 py-2 text-sm font-medium rounded-md bg-[var(--color-primary)] text-white hover:opacity-90 disabled:opacity-40"
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}
