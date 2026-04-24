import { useNetworkStore } from '../../stores/networkStore'

/**
 * D-04: Persistent offline indicator. Appears below the app header when the
 * client machine cannot reach the server. Disappears automatically on reconnect.
 * Placed in App.tsx between <header> and <main> so it spans full width
 * (outside the max-w-4xl wizard container).
 *
 * Copy text "Working offline — saves stored locally" is verbatim from
 * 06-CONTEXT.md §Offline Indicator (D-04). Per D-04 the banner must be
 * impossible to overlook — yellow palette + role="status" aria-live="polite"
 * to announce the state change to assistive tech.
 */
export function OfflineBanner(): JSX.Element | null {
  const online = useNetworkStore((s) => s.online)
  if (online) return null
  return (
    <div
      role="status"
      aria-live="polite"
      className="w-full bg-yellow-50 border-b border-yellow-200 px-6 py-2 text-sm font-medium text-yellow-800"
    >
      Working offline — saves stored locally
    </div>
  )
}
