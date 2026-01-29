import { useState } from 'react'
import type { Analyte } from '../../../../shared/types/analyte'

interface AnalyteEditModalProps {
  analyte: Analyte
  onClose: () => void
  onSaved: () => void
}

export function AnalyteEditModal({ analyte, onClose, onSaved }: AnalyteEditModalProps): JSX.Element {
  const [name, setName] = useState(analyte.name)
  const [beadRegion, setBeadRegion] = useState(String(analyte.beadRegion))
  const [premixConc, setPremixConc] = useState(String(analyte.premixConc))
  const [singleConc, setSingleConc] = useState(String(analyte.singleConc))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSave(): Promise<void> {
    setSaving(true)
    setError(null)
    try {
      await window.electronAPI.analyte.update({
        id: analyte.id,
        name: name.trim(),
        beadRegion: Number(beadRegion),
        premixConc: Number(premixConc),
        singleConc: Number(singleConc)
      })
      onSaved()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save analyte')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-lg border border-[var(--color-border)] shadow-lg w-full max-w-md mx-4">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--color-border)]">
          <h3 className="text-lg font-semibold text-[var(--color-foreground)]">Edit Analyte</h3>
          <button
            onClick={onClose}
            className="text-[var(--color-muted)] hover:text-[var(--color-foreground)]"
          >
            X
          </button>
        </div>

        <div className="px-6 py-4 space-y-4">
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
              Bead Region
            </label>
            <input
              type="number"
              value={beadRegion}
              onChange={(e) => setBeadRegion(e.target.value)}
              className="w-full px-3 py-2 border border-[var(--color-border)] rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-[var(--color-foreground)] mb-1">
                Premix Conc
              </label>
              <input
                type="number"
                step="any"
                value={premixConc}
                onChange={(e) => setPremixConc(e.target.value)}
                className="w-full px-3 py-2 border border-[var(--color-border)] rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--color-foreground)] mb-1">
                Single Conc
              </label>
              <input
                type="number"
                step="any"
                value={singleConc}
                onChange={(e) => setSingleConc(e.target.value)}
                className="w-full px-3 py-2 border border-[var(--color-border)] rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
              />
            </div>
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
