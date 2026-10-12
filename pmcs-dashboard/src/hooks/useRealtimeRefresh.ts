import { useEffect, useLayoutEffect, useRef } from 'react'

export const POLL_INTERVAL_MS = 15_000
/** Focus/visibility events closer together than this to the last refresh are ignored. */
export const MIN_REFRESH_GAP_MS = 5_000

export interface RefreshOptions {
  intervalMs?: number
  minGapMs?: number
}

/**
 * Keeps dashboard data fresh (replaces database Realtime):
 * - polls every `intervalMs` while the tab is visible, and pauses while hidden;
 * - refreshes when the tab becomes visible / regains focus, deduplicated and
 *   throttled so `visibilitychange` + `focus` firing together cause one refresh;
 * - `getLastRefresh` reports when data was last (re)loaded, so a load triggered
 *   elsewhere (initial load, Retry) also resets the poll timer.
 */
export function useRealtimeRefresh(
  onRefresh: () => void,
  getLastRefresh: () => number,
  { intervalMs = POLL_INTERVAL_MS, minGapMs = MIN_REFRESH_GAP_MS }: RefreshOptions = {},
) {
  const callbackRef = useRef(onRefresh)
  const lastRef = useRef(getLastRefresh)
  useLayoutEffect(() => {
    callbackRef.current = onRefresh
    lastRef.current = getLastRefresh
  })

  useEffect(() => {
    let timer: number | undefined
    const visible = () => document.visibilityState === 'visible'

    const schedule = (ms: number) => {
      window.clearTimeout(timer)
      timer = window.setTimeout(tick, Math.max(ms, 0))
    }

    function tick() {
      timer = undefined
      if (!visible()) return // paused until the tab is visible again
      const since = Date.now() - lastRef.current()
      if (since >= intervalMs) {
        callbackRef.current()
        schedule(intervalMs)
      } else {
        schedule(intervalMs - since)
      }
    }

    const onWake = () => {
      if (!visible()) {
        window.clearTimeout(timer)
        timer = undefined
        return
      }
      const since = Date.now() - lastRef.current()
      if (since >= minGapMs) {
        callbackRef.current()
        schedule(intervalMs)
      } else if (timer === undefined) {
        schedule(intervalMs - since)
      }
    }

    schedule(intervalMs)
    document.addEventListener('visibilitychange', onWake)
    window.addEventListener('focus', onWake)
    return () => {
      window.clearTimeout(timer)
      document.removeEventListener('visibilitychange', onWake)
      window.removeEventListener('focus', onWake)
    }
  }, [intervalMs, minGapMs])
}
