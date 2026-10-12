import { api, ApiError } from './api'

/** Uppercases and trims a typed UIC. */
export function normalizeUic(raw: string): string {
  return raw.trim().toUpperCase()
}

/** A UIC is exactly 6 letters/digits. */
export function isValidUic(uic: string): boolean {
  return /^[A-Z0-9]{6}$/.test(uic)
}

/** Validation message for a normalized UIC, or null when it is valid. */
export function uicError(uic: string): string | null {
  if (!uic) return 'Enter a UIC'
  if (/[^A-Z0-9]/.test(uic)) return 'A UIC has only letters and digits'
  if (uic.length !== 6) return `A UIC is exactly 6 characters (this has ${uic.length})`
  return null
}

/** Suggested correction when the letter O was probably meant as zero. */
export function zeroSuggestion(uic: string): string | null {
  return uic.includes('O') ? uic.replace(/O/g, '0') : null
}

export type UnitNameLookup =
  | { state: 'known'; name: string }
  | { state: 'unknown' }
  | { state: 'error' }

const cache = new Map<string, string | null>()

/** Unit name for a UIC from the public GET /uic/:uic (cached; 404 = not on file). */
export async function lookupUnitName(uic: string, signal?: AbortSignal): Promise<UnitNameLookup> {
  if (cache.has(uic)) {
    const name = cache.get(uic)
    return name ? { state: 'known', name } : { state: 'unknown' }
  }
  try {
    const row = await api<{ unit_name: string | null }>('GET', `/uic/${encodeURIComponent(uic)}`, { signal })
    cache.set(uic, row.unit_name || null)
    return row.unit_name ? { state: 'known', name: row.unit_name } : { state: 'unknown' }
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) {
      cache.set(uic, null)
      return { state: 'unknown' }
    }
    return { state: 'error' }
  }
}
