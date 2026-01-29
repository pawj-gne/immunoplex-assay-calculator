import { useState, useEffect, useCallback } from 'react'
import type { Analyte } from '../../../../shared/types/analyte'
import { AnalyteEditModal } from './AnalyteEditModal'

interface AnalyteTableProps {
  platformId: string
  speciesId: string
}

export function AnalyteTable({ platformId, speciesId }: AnalyteTableProps): JSX.Element {
  const [analytes, setAnalytes] = useState<Analyte[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<Analyte | null>(null)

  const fetchAnalytes = useCallback(async () => {
    setLoading(true)
    try {
      const result = await window.electronAPI.analyte.getByPlatformAndSpecies(platformId, speciesId)
      setAnalytes(result)
    } catch {
      setAnalytes([])
    } finally {
      setLoading(false)
    }
  }, [platformId, speciesId])

  useEffect(() => {
    fetchAnalytes()
  }, [fetchAnalytes])

  async function handleDelete(id: string): Promise<void> {
    if (!window.confirm('Delete this analyte? This cannot be undone.')) return
    try {
      await window.electronAPI.analyte.delete(id)
      setAnalytes((prev) => prev.filter((a) => a.id !== id))
    } catch {
      /* ignore */
    }
  }

  if (loading) {
    return <p className="text-sm text-[var(--color-muted)]">Loading analytes...</p>
  }

  if (analytes.length === 0) {
    return <p className="text-sm text-[var(--color-muted)]">No analytes found.</p>
  }

  return (
    <>
      <table className="table-auto w-full text-sm">
        <thead>
          <tr className="border-b border-[var(--color-border)] text-left text-[var(--color-muted)]">
            <th className="pb-2 font-medium">Name</th>
            <th className="pb-2 font-medium">Bead Region</th>
            <th className="pb-2 font-medium">Premix Conc</th>
            <th className="pb-2 font-medium">Single Conc</th>
            <th className="pb-2 font-medium text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          {analytes.map((a) => (
            <tr
              key={a.id}
              className="border-b border-[var(--color-border)] even:bg-gray-50 hover:bg-gray-100"
            >
              <td className="py-2 text-[var(--color-foreground)]">{a.name}</td>
              <td className="py-2">{a.beadRegion}</td>
              <td className="py-2">{a.premixConc}</td>
              <td className="py-2">{a.singleConc}</td>
              <td className="py-2 text-right">
                <button
                  onClick={() => setEditing(a)}
                  className="px-2 py-1 text-xs font-medium rounded border border-[var(--color-border)] text-[var(--color-foreground)] hover:bg-gray-50 mr-2"
                >
                  Edit
                </button>
                <button
                  onClick={() => handleDelete(a.id)}
                  className="px-2 py-1 text-xs font-medium rounded border border-red-200 text-red-600 hover:bg-red-50"
                >
                  Delete
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {editing && (
        <AnalyteEditModal
          analyte={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null)
            fetchAnalytes()
          }}
        />
      )}
    </>
  )
}
