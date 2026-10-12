import { useEffect, useLayoutEffect, useRef } from 'react'

type TableName = 'vehicles' | 'faults' | 'inspections' | 'generated_forms' | 'diagnosis_attempts'

const POLL_INTERVAL_MS = 15_000

/**
 * Keeps dashboard data fresh by polling while the tab is visible and
 * refreshing immediately when the tab regains focus. (Replaces database
 * Realtime; `tables` is kept so call sites document what they depend on.)
 */
export function useRealtimeRefresh(
  _tables: TableName[],
  onRefresh: () => void
) {
  const callbackRef = useRef(onRefresh)
  useLayoutEffect(() => {
    callbackRef.current = onRefresh
  })

  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState === 'visible') callbackRef.current()
    }
    const timer = window.setInterval(refresh, POLL_INTERVAL_MS)
    document.addEventListener('visibilitychange', refresh)
    window.addEventListener('focus', refresh)

    return () => {
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', refresh)
      window.removeEventListener('focus', refresh)
    }
  }, [])
}
