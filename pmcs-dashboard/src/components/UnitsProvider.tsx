import { useCallback, useEffect, useMemo, useState } from 'react'
import { api } from '../lib/api'
import { lookupUnitName } from '../lib/uic'
import type { Profile } from '../types/database'
import { useLoader } from '../hooks/useLoader'
import { PROFILE_CHANGED, UnitsContext, WATCHED_UICS_CHANGED, type UnitsContextValue } from '../hooks/useUnits'

const SELECTED_KEY = 'pmcs-dashboard-unit'
function readSelected(): string {
  try {
    return localStorage.getItem(SELECTED_KEY) ?? ''
  } catch {
    return ''
  }
}

export function UnitsProvider({ children }: { children: React.ReactNode }) {
  // The profile changes rarely: no polling, refetched on watch-list/profile events.
  const me = useLoader('me', (signal) => api<Profile>('GET', '/me', { signal }), { enabled: false })
  const { reload } = me
  const profile = me.data

  useEffect(() => {
    window.addEventListener(WATCHED_UICS_CHANGED, reload)
    window.addEventListener(PROFILE_CHANGED, reload)
    return () => {
      window.removeEventListener(WATCHED_UICS_CHANGED, reload)
      window.removeEventListener(PROFILE_CHANGED, reload)
    }
  }, [reload])

  const ownUnit = profile?.unit ?? null
  const visible = profile?.visible_units
  const unitsKey = (visible && visible.length > 0 ? visible : ownUnit ? [ownUnit] : []).join(',')
  const units = useMemo(() => (unitsKey ? unitsKey.split(',') : []), [unitsKey])

  const [unitNames, setUnitNames] = useState<Record<string, string>>({})
  useEffect(() => {
    let cancelled = false
    const list = unitsKey ? unitsKey.split(',') : []
    Promise.all(list.map(async (u) => [u, await lookupUnitName(u)] as const)).then((pairs) => {
      if (cancelled) return
      const next: Record<string, string> = {}
      for (const [u, r] of pairs) if (r.state === 'known') next[u] = r.name
      setUnitNames(next)
    })
    return () => {
      cancelled = true
    }
  }, [unitsKey])

  const [selected, setSelected] = useState(readSelected)
  // A selection that is no longer visible (unwatched) falls back to "All my units".
  const selectedUnit = selected && units.includes(selected) ? selected : ''
  const setSelectedUnit = useCallback((uic: string) => {
    setSelected(uic)
    try {
      if (uic) localStorage.setItem(SELECTED_KEY, uic)
      else localStorage.removeItem(SELECTED_KEY)
    } catch {
      // per-viewer convenience only
    }
  }, [])

  const value = useMemo<UnitsContextValue>(
    () => ({
      profile,
      ownUnit,
      units,
      unitsKey,
      unitNames,
      selectedUnit: profile ? selectedUnit : '',
      setSelectedUnit,
      loading: me.loading,
      error: me.error,
      reload,
    }),
    [profile, ownUnit, units, unitsKey, unitNames, selectedUnit, setSelectedUnit, me.loading, me.error, reload],
  )

  return <UnitsContext.Provider value={value}>{children}</UnitsContext.Provider>
}
