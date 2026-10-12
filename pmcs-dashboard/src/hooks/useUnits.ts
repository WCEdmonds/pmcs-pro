import { createContext, useContext } from 'react'
import type { Profile } from '../types/database'

export interface UnitsContextValue {
  profile: Profile | null
  /** The signed-in user's own unit: the only one whose faults they may change. */
  ownUnit: string | null
  /** Units the server lets this user see (own unit first, then watched). */
  units: string[]
  /** `units` joined into a stable string, for effect / loader keys. */
  unitsKey: string
  /** UIC -> unit name (from GET /uic/:uic), when known. */
  unitNames: Record<string, string>
  /** Selected unit filter, or '' for "All my units". */
  selectedUnit: string
  setSelectedUnit: (uic: string) => void
  /** True until GET /me has answered once. */
  loading: boolean
  error: string | null
  reload: () => void
}

export const UnitsContext = createContext<UnitsContextValue | null>(null)

export function useUnits(): UnitsContextValue {
  const ctx = useContext(UnitsContext)
  if (!ctx) throw new Error('useUnits must be used inside <UnitsProvider>')
  return ctx
}

/** `?unit=` query value for the current selection (undefined = all visible units). */
export function unitQuery(selectedUnit: string): string[] | undefined {
  return selectedUnit ? [selectedUnit] : undefined
}

export function unitLabel(uic: string | null | undefined, names: Record<string, string>): string {
  if (!uic) return '---'
  const name = names[uic]
  return name ? `${uic} (${name})` : uic
}

export const WATCHED_UICS_CHANGED = 'watched-uics-changed'
export const PROFILE_CHANGED = 'profile-changed'
