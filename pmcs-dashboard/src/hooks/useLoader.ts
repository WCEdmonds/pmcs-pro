import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { errorMessage, isAbortedError } from '../lib/api'
import { useRealtimeRefresh, type RefreshOptions } from './useRealtimeRefresh'

export interface LoaderState<T> {
  data: T | null
  /** Error from the latest load (initial or background), or null. */
  error: string | null
  /** True until the first load for the current key settles. */
  loading: boolean
  /** When `data` was last loaded successfully. */
  updatedAt: number | null
  reload: () => void
  /** Local (optimistic) update of the loaded data. */
  mutate: (fn: (prev: T) => T) => void
}

/**
 * Loads page data once per `key` (a string, so no effect ever depends on an
 * unstable array), then keeps it fresh with useRealtimeRefresh.
 *
 * Every load gets its own AbortController and sequence number: a newer load
 * aborts the older one and stale responses never overwrite newer state.
 */
export function useLoader<T>(
  key: string | null,
  load: (signal: AbortSignal) => Promise<T>,
  refresh: RefreshOptions & { enabled?: boolean } = {},
): LoaderState<T> {
  const [state, setState] = useState<{ key: string | null; data: T | null; error: string | null; loading: boolean; updatedAt: number | null }>(
    { key, data: null, error: null, loading: key !== null, updatedAt: null },
  )
  const loadRef = useRef(load)
  useLayoutEffect(() => {
    loadRef.current = load
  })
  const seq = useRef(0)
  const controller = useRef<AbortController | null>(null)
  const lastStart = useRef(0)
  const keyRef = useRef(key)

  const run = useCallback(() => {
    const k = keyRef.current
    if (k === null) return
    controller.current?.abort()
    const ctl = new AbortController()
    controller.current = ctl
    const id = ++seq.current
    lastStart.current = Date.now()

    loadRef.current(ctl.signal).then(
      (data) => {
        if (id !== seq.current) return
        setState({ key: k, data, error: null, loading: false, updatedAt: Date.now() })
      },
      (err: unknown) => {
        if (id !== seq.current || isAbortedError(err) || ctl.signal.aborted) return
        console.error('Load failed:', err)
        setState((prev) => ({ ...prev, key: k, error: errorMessage(err), loading: false }))
      },
    )
  }, [])

  useEffect(() => {
    keyRef.current = key
    if (key === null) return
    // State for a different key is hidden below until this key's load settles.
    run()
    const seqRef = seq
    const controllerRef = controller
    return () => {
      // Invalidate whatever is in flight for this key.
      controllerRef.current?.abort()
      seqRef.current++
    }
  }, [key, run])

  const enabled = refresh.enabled ?? true
  useRealtimeRefresh(
    () => {
      if (enabled) run()
    },
    () => (enabled ? lastStart.current : Date.now()),
    refresh,
  )

  const reload = useCallback(() => {
    setState((prev) => ({ ...prev, error: null, loading: prev.data === null }))
    run()
  }, [run])

  const mutate = useCallback((fn: (prev: T) => T) => {
    setState((prev) => (prev.data === null ? prev : { ...prev, data: fn(prev.data) }))
  }, [])

  const current = state.key === key
  return {
    data: current ? state.data : null,
    error: current ? state.error : null,
    loading: current ? state.loading : key !== null,
    updatedAt: current ? state.updatedAt : null,
    reload,
    mutate,
  }
}
