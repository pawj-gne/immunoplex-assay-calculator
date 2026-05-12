import { useState, useEffect, useCallback } from 'react'

// Phase 13: importer.ts shape changed (v0.7.0 created/skipped → Smoke 3
// summaries/ImportSheetError). UI surface adoption is deferred to Plan 13-06
// (the next wave). This file's banner-rendering keeps working against the
// preload-exposed ImportResult type without throwing in renderer; the full
// summary-rendering work lands in 13-06.
import type { ImportResult } from '../../../../main/import/importer'

interface BannerState {
  type: 'success' | 'error'
  message: string
  details?: string[]
}

export function ImportButton(): JSX.Element {
  const [loading, setLoading] = useState(false)
  const [banner, setBanner] = useState<BannerState | null>(null)

  // Auto-dismiss success banners after 10s
  useEffect(() => {
    if (banner?.type !== 'success') return undefined
    const timer = setTimeout(() => setBanner(null), 10000)
    return () => clearTimeout(timer)
  }, [banner])

  const handleImport = useCallback(async () => {
    setLoading(true)
    setBanner(null)
    try {
      const result: ImportResult = await window.electronAPI.import.panelData()

      if (result.canceled) {
        // User canceled file dialog - do nothing
        return
      }

      if (result.success) {
        const summaries = result.summaries
        const totalAnalytes = summaries.reduce((acc, s) => acc + s.analyteCount, 0)
        const totalPremixes = summaries.reduce((acc, s) => acc + s.premixCount, 0)
        const msg = `Imported ${summaries.length} panel${summaries.length !== 1 ? 's' : ''}: ${totalAnalytes} analyte${totalAnalytes !== 1 ? 's' : ''}, ${totalPremixes} premix${totalPremixes !== 1 ? 'es' : ''}. (Plan 13-06 will surface per-panel details.)`
        setBanner({ type: 'success', message: msg })
      } else {
        const details = result.errors.flatMap((e) =>
          e.issues.map((issue) => (e.sheetName ? `[${e.sheetName}] ${issue}` : issue))
        )
        setBanner({
          type: 'error',
          message: `Import failed with ${result.errors.length} error${result.errors.length !== 1 ? 's' : ''}:`,
          details
        })
      }
    } catch (err) {
      setBanner({
        type: 'error',
        message: err instanceof Error ? err.message : 'Unknown import error'
      })
    } finally {
      setLoading(false)
    }
  }, [])

  return (
    <div className="space-y-3">
      <button
        onClick={handleImport}
        disabled={loading}
        className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md border border-[var(--color-border)] bg-white text-[var(--color-foreground)] hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? (
          <>
            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Importing...
          </>
        ) : (
          <>
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
            Import Panel Data
          </>
        )}
      </button>

      {banner && (
        <div
          className={`rounded-md p-4 ${
            banner.type === 'success'
              ? 'bg-green-50 border border-green-200 text-green-800'
              : 'bg-red-50 border border-red-200 text-red-800'
          }`}
        >
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <p className="text-sm font-medium">{banner.message}</p>
              {banner.details && banner.details.length > 0 && (
                <ul className="mt-2 text-sm space-y-1 list-disc list-inside">
                  {banner.details.map((d, i) => (
                    <li key={i}>{d}</li>
                  ))}
                </ul>
              )}
            </div>
            <button
              onClick={() => setBanner(null)}
              className="ml-3 text-current opacity-50 hover:opacity-100"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
