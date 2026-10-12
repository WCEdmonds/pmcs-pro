interface NameParts {
  rank?: string | null
  last_name?: string | null
  first_name?: string | null
  mi?: string | null
}

/** "SGT Doe, John A." style display name, or '' when nothing is set. */
export function displayName(p: NameParts): string {
  const first = [p.first_name, p.mi ? `${p.mi}.` : null].filter(Boolean).join(' ')
  const name = [p.last_name, first].filter(Boolean).join(', ')
  return [p.rank, name].filter(Boolean).join(' ').trim()
}

export function truncate(text: string, max: number): string {
  return text.length <= max ? text : `${text.slice(0, max - 1)}…`
}

// Same rule as the API (pmcs-api/src/validate.ts).
const EMAIL_RE = /^[^\s@<>",;]+@[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?)+$/
export const MAX_UNIT_EMAILS = 10

export function isValidEmail(value: string): boolean {
  return value.length <= 254 && EMAIL_RE.test(value)
}

export const PIN_RE = /^\d{6,12}$/

/** Validation message for a new PIN, or null. */
export function newPinError(current: string, next: string, confirm: string): string | null {
  if (!PIN_RE.test(next)) return 'New PIN must be 6 to 12 digits'
  if (next !== confirm) return 'New PINs do not match'
  if (current && next === current) return 'New PIN must be different from the current PIN'
  return null
}

/** API flags arrive as 0/1 or booleans. */
export function flag(v: unknown): boolean {
  return v === true || v === 1 || v === '1'
}
