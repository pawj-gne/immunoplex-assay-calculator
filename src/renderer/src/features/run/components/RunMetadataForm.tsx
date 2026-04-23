import { useEffect, useMemo, useState } from 'react'
import { useOperatorsStore } from '../../../stores/operatorsStore'
import type { MetadataFields } from '../hooks/useRunSnapshot'

// Sample type enum values — exactly the 5 options per CONTEXT.md §"Required
// Metadata Fields" §sampleType. Single source of truth for the dropdown
// options. Values match runs.sampleType enum in schema.ts / runCreateSchema.
const SAMPLE_TYPE_OPTIONS = [
  'Supernatant',
  'Lysate',
  'Lavage',
  'Plasma',
  'Serum'
] as const

/**
 * Today's date as an ISO 'YYYY-MM-DD' string. Computed once per render so
 * placeholders / defaults line up with the operator's wall clock per D-07.
 */
function todayISO(): string {
  return new Date().toISOString().slice(0, 10)
}

export const DEFAULT_METADATA: MetadataFields = {
  requestNumber: null,
  requestOverrideAdHoc: false,
  userName: '',
  operatorId: '',
  runDate: todayISO(),
  sampleType: '',
  dilutionFactor: 0,
  hamilton: 1,
  runPlatePosition: 1,
  standardPosition: 1,
  troughPosition: 1,
  comments: ''
}

interface RunMetadataFormProps {
  value: MetadataFields
  onChange: (next: MetadataFields) => void
  /**
   * When set, the form repopulates from these values. Used when a run is
   * loaded from RunList — the parent page maps the RunRecord into
   * MetadataFields and passes it here.
   */
  initialValues?: Partial<MetadataFields>
}

/**
 * The 11 CONTEXT.md metadata fields rendered in exact top-to-bottom order
 * per D-05. Fully controlled — every change bubbles up via onChange so
 * the parent drives Save-button gating and dirty tracking.
 *
 * Operator options come from useOperatorsStore — the store is owned by
 * Plan 04-05 and primed by App.tsx at mount with includeInactive:true.
 * We filter to active operators here for the dropdown (D-20 soft-delete
 * pattern: hidden operators should not appear in NEW run dropdowns but
 * historical runs still resolve to their display name).
 */
export function RunMetadataForm({
  value,
  onChange,
  initialValues
}: RunMetadataFormProps): JSX.Element {
  const operators = useOperatorsStore((s) => s.operators)
  const activeOperators = useMemo(
    () => operators.filter((o) => o.active).sort((a, b) => a.name.localeCompare(b.name)),
    [operators]
  )

  // When initialValues change (e.g., a run is loaded), merge them into the
  // controlled value exactly once per change. Keeps the controlled-component
  // contract intact without forcing the parent to re-derive the full object.
  const initialKey = useMemo(
    () => (initialValues ? JSON.stringify(initialValues) : null),
    [initialValues]
  )
  const [lastAppliedKey, setLastAppliedKey] = useState<string | null>(null)
  useEffect(() => {
    if (initialKey && initialKey !== lastAppliedKey && initialValues) {
      onChange({ ...value, ...initialValues })
      setLastAppliedKey(initialKey)
    }
    // Intentionally only re-run when initialKey changes. `value` and
    // `onChange` are parent-controlled and stable across renders here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialKey])

  function update<K extends keyof MetadataFields>(key: K, next: MetadataFields[K]): void {
    onChange({ ...value, [key]: next })
  }

  return (
    <div className="rounded-lg border border-[var(--color-border)] bg-white p-4 space-y-4">
      <h3 className="text-sm font-semibold text-[var(--color-foreground)]">Metadata</h3>

      {/* 1. Request Number + Ad-hoc override */}
      <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-3 items-end">
        <div>
          <label className="block text-sm font-medium text-[var(--color-foreground)] mb-1">
            Request Number
          </label>
          <input
            type="number"
            min={1}
            max={99999}
            value={value.requestNumber ?? ''}
            disabled={value.requestOverrideAdHoc}
            onChange={(e) => {
              const raw = e.target.value
              update('requestNumber', raw === '' ? null : Number(raw))
            }}
            className="w-full px-3 py-2 border border-[var(--color-border)] rounded-md text-sm disabled:bg-gray-100 disabled:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
          />
        </div>
        <label className="flex items-center gap-2 text-sm text-[var(--color-foreground)] pb-2">
          <input
            type="checkbox"
            checked={value.requestOverrideAdHoc}
            onChange={(e) => {
              const checked = e.target.checked
              onChange({
                ...value,
                requestOverrideAdHoc: checked,
                requestNumber: checked ? null : value.requestNumber
              })
            }}
          />
          Ad-hoc run (no request number)
        </label>
      </div>

      {/* 2. User */}
      <div>
        <label className="block text-sm font-medium text-[var(--color-foreground)] mb-1">
          User
        </label>
        <input
          type="text"
          value={value.userName}
          onChange={(e) => update('userName', e.target.value)}
          className="w-full px-3 py-2 border border-[var(--color-border)] rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
        />
      </div>

      {/* 3. Operator */}
      <div>
        <label className="block text-sm font-medium text-[var(--color-foreground)] mb-1">
          Operator
        </label>
        <select
          value={value.operatorId}
          onChange={(e) => update('operatorId', e.target.value)}
          className="w-full px-3 py-2 border border-[var(--color-border)] rounded-md text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
        >
          <option value="">-- Select operator --</option>
          {activeOperators.map((op) => (
            <option key={op.id} value={op.id}>
              {op.name}
            </option>
          ))}
        </select>
      </div>

      {/* 4. Date */}
      <div>
        <label className="block text-sm font-medium text-[var(--color-foreground)] mb-1">
          Date
        </label>
        <input
          type="date"
          value={value.runDate}
          onChange={(e) => update('runDate', e.target.value)}
          className="w-full px-3 py-2 border border-[var(--color-border)] rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
        />
      </div>

      {/* 5. Sample Type */}
      <div>
        <label className="block text-sm font-medium text-[var(--color-foreground)] mb-1">
          Sample Type
        </label>
        <select
          value={value.sampleType}
          onChange={(e) =>
            update('sampleType', e.target.value as MetadataFields['sampleType'])
          }
          className="w-full px-3 py-2 border border-[var(--color-border)] rounded-md text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
        >
          <option value="">-- Select sample type --</option>
          {SAMPLE_TYPE_OPTIONS.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      </div>

      {/* 6. Dilution Factor */}
      <div>
        <label className="block text-sm font-medium text-[var(--color-foreground)] mb-1">
          Dilution Factor
        </label>
        <input
          type="number"
          min={0}
          step="any"
          value={value.dilutionFactor || ''}
          onChange={(e) => {
            const raw = e.target.value
            update('dilutionFactor', raw === '' ? 0 : Number(raw))
          }}
          className="w-full px-3 py-2 border border-[var(--color-border)] rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
        />
      </div>

      {/* 7. Hamilton 1-5 */}
      <div>
        <label className="block text-sm font-medium text-[var(--color-foreground)] mb-1">
          Hamilton
        </label>
        <select
          value={value.hamilton}
          onChange={(e) => update('hamilton', Number(e.target.value))}
          className="w-full px-3 py-2 border border-[var(--color-border)] rounded-md text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
        >
          <option value={1}>1</option>
          <option value={2}>2</option>
          <option value={3}>3</option>
          <option value={4}>4</option>
          <option value={5}>5</option>
        </select>
      </div>

      {/* 8. Run Plate Position 1-4 */}
      <div>
        <label className="block text-sm font-medium text-[var(--color-foreground)] mb-1">
          Run Plate Position
        </label>
        <select
          value={value.runPlatePosition}
          onChange={(e) => update('runPlatePosition', Number(e.target.value))}
          className="w-full px-3 py-2 border border-[var(--color-border)] rounded-md text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
        >
          <option value={1}>1</option>
          <option value={2}>2</option>
          <option value={3}>3</option>
          <option value={4}>4</option>
        </select>
      </div>

      {/* 9. Standard Position 1-2 */}
      <div>
        <label className="block text-sm font-medium text-[var(--color-foreground)] mb-1">
          Standard Position
        </label>
        <select
          value={value.standardPosition}
          onChange={(e) => update('standardPosition', Number(e.target.value))}
          className="w-full px-3 py-2 border border-[var(--color-border)] rounded-md text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
        >
          <option value={1}>1</option>
          <option value={2}>2</option>
        </select>
      </div>

      {/* 10. Trough Position 1-2 */}
      <div>
        <label className="block text-sm font-medium text-[var(--color-foreground)] mb-1">
          Trough Position
        </label>
        <select
          value={value.troughPosition}
          onChange={(e) => update('troughPosition', Number(e.target.value))}
          className="w-full px-3 py-2 border border-[var(--color-border)] rounded-md text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
        >
          <option value={1}>1</option>
          <option value={2}>2</option>
        </select>
      </div>

      {/* 11. Comments */}
      <div>
        <label className="block text-sm font-medium text-[var(--color-foreground)] mb-1">
          Comments
        </label>
        <textarea
          rows={4}
          value={value.comments}
          onChange={(e) => update('comments', e.target.value)}
          placeholder="Notes about this run — anything useful for next time you see it in the log."
          className="w-full px-3 py-2 border border-[var(--color-border)] rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
        />
      </div>
    </div>
  )
}
