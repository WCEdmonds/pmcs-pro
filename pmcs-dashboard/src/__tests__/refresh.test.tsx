import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, act } from '@testing-library/react'
import { useRef } from 'react'
import { useRealtimeRefresh } from '../hooks/useRealtimeRefresh'

let visibility: DocumentVisibilityState = 'visible'
Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => visibility })

function Probe({ onRefresh }: { onRefresh: () => void }) {
  const last = useRef(0)
  useRealtimeRefresh(
    () => {
      last.current = Date.now()
      onRefresh()
    },
    () => last.current,
    { intervalMs: 15_000, minGapMs: 5_000 },
  )
  return null
}

describe('useRealtimeRefresh', () => {
  afterEach(() => {
    vi.useRealTimers()
    visibility = 'visible'
  })

  it('polls on the interval, dedupes focus + visibilitychange, and pauses while hidden', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 0, 1, 12))
    const spy = vi.fn()
    render(<Probe onRefresh={spy} />)

    act(() => {
      vi.advanceTimersByTime(30_000)
    })
    expect(spy).toHaveBeenCalledTimes(2)

    // Both events fire on return to the tab: only one refresh (and none if recent).
    act(() => {
      vi.advanceTimersByTime(6_000)
      document.dispatchEvent(new Event('visibilitychange'))
      window.dispatchEvent(new Event('focus'))
    })
    expect(spy).toHaveBeenCalledTimes(3)

    // Hidden: no polling at all.
    visibility = 'hidden'
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'))
      vi.advanceTimersByTime(120_000)
    })
    expect(spy).toHaveBeenCalledTimes(3)

    // Visible again: one immediate refresh, then polling resumes.
    visibility = 'visible'
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'))
      window.dispatchEvent(new Event('focus'))
    })
    expect(spy).toHaveBeenCalledTimes(4)
    act(() => {
      vi.advanceTimersByTime(15_000)
    })
    expect(spy).toHaveBeenCalledTimes(5)
  })
})
