// Readable rendering of audit-log entries (GET /admin/audit).

/** Known action prefixes for the audit filter. */
export const AUDIT_ACTION_PREFIXES = [
  'user.',
  'auth.',
  'inspection.',
  'fault.',
  'photo.',
  'diagnosis.',
  'form.',
  'uic.',
  'unit_settings.',
  'watch.',
  'admin.',
] as const

/** Exact actions the API writes today (pmcs-api), grouped under the prefixes above in the filter. */
export const KNOWN_AUDIT_ACTIONS = [
  'admin.claim',
  'admin.claim_failed',
  'admin.pin_reset',
  'admin.role_change',
  'admin.sign_out_everywhere',
  'auth.locked',
  'diagnosis.upload',
  'fault.acknowledge',
  'fault.resolve',
  'inspection.synced',
  'photo.upload',
  'uic.name',
  'uic.rename',
  'unit_settings.update',
  'user.pin_change',
  'user.profile_update',
  'user.sign_out_everywhere',
  'user.signup',
  'user.unit_change',
  'watch.add',
  'watch.remove',
] as const

const ACRONYMS: Record<string, string> = {
  uic: 'UIC',
  uics: 'UICs',
  id: 'ID',
  ids: 'IDs',
  pin: 'PIN',
  nsn: 'NSN',
  pdf: 'PDF',
  dod: 'DOD',
  gcss: 'GCSS',
  da2404: 'DA 2404',
  nmc: 'NMC',
  pmc: 'PMC',
  fmc: 'FMC',
}

/** "notification_emails" -> "Notification emails", "uic" -> "UIC". */
export function humanizeKey(key: string): string {
  const words = key
    .replace(/([a-z])([A-Z])/g, '$1_$2')
    .split(/[_\s.-]+/)
    .filter(Boolean)
    .map((w) => ACRONYMS[w.toLowerCase()] ?? w.toLowerCase())
  if (words.length === 0) return key
  const [first, ...rest] = words
  return [first === first.toLowerCase() ? first[0].toUpperCase() + first.slice(1) : first, ...rest].join(' ')
}

/** "user.reset_pin" -> "User: reset PIN". */
export function describeAction(action: string): string {
  const dot = action.indexOf('.')
  if (dot < 0) return humanizeKey(action)
  const area = humanizeKey(action.slice(0, dot))
  const verb = humanizeKey(action.slice(dot + 1))
  // Lower-case the first word unless it is an acronym ("PIN reset", "UIC").
  const firstWord = verb.split(' ')[0]
  const keep = firstWord.length > 1 && firstWord === firstWord.toUpperCase()
  return `${area}: ${keep ? verb : verb.charAt(0).toLowerCase() + verb.slice(1)}`
}

/** Details may arrive as an object or as a JSON string; anything else is kept as-is. */
export function parseDetails(details: unknown): unknown {
  if (typeof details !== 'string') return details
  const t = details.trim()
  if (!t.startsWith('{') && !t.startsWith('[')) return details
  try {
    return JSON.parse(t)
  } catch {
    return details
  }
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

/** Keys that hold secrets must never be shown, even if the server logged them. */
const SECRET_KEY = /(^|_)(pin|token|secret|password|hash|code)($|_)/i
const SAFE_KEYS = new Set(['must_change_pin', 'pin_changed', 'pin_reset', 'status_code', 'error_code'])

export function formatValue(v: unknown): string {
  if (v === null || v === undefined || v === '') return '(none)'
  if (typeof v === 'boolean') return v ? 'yes' : 'no'
  if (Array.isArray(v)) return v.length === 0 ? '(none)' : v.map(formatValue).join(', ')
  if (isPlainObject(v)) {
    if ('from' in v || 'to' in v) return `${formatValue(v.from)} → ${formatValue(v.to)}`
    if ('old' in v || 'new' in v) return `${formatValue(v.old)} → ${formatValue(v.new)}`
    return Object.entries(v)
      .map(([k, x]) => `${humanizeKey(k)} ${formatValue(x)}`)
      .join('; ')
  }
  return String(v)
}

export interface DetailLine {
  label: string
  value: string
}

/**
 * Turns `details` into labelled lines, e.g.
 * {unit:{from:'WXYZA0',to:'WXYZB1'}} -> [{label:'Unit', value:'WXYZA0 → WXYZB1'}].
 * Paired `old_x`/`new_x` (or `from_x`/`to_x`) keys are merged into one "x" line.
 */
export function formatAuditDetails(details: unknown): DetailLine[] {
  const parsed = parseDetails(details)
  if (parsed === null || parsed === undefined || parsed === '') return []
  if (!isPlainObject(parsed)) return [{ label: 'Details', value: formatValue(parsed) }]

  const lines: DetailLine[] = []
  const used = new Set<string>()
  const entries = Object.entries(parsed)
  for (const [k, v] of entries) {
    if (used.has(k)) continue
    if (SECRET_KEY.test(k) && !SAFE_KEYS.has(k)) {
      used.add(k)
      lines.push({ label: humanizeKey(k), value: '(hidden)' })
      continue
    }
    const pair = /^(old|from|previous|prev)_(.+)$/.exec(k)
    if (pair) {
      const base = pair[2]
      const partner = ['new', 'to', 'next'].map((p) => `${p}_${base}`).find((p) => p in parsed)
      if (partner) {
        used.add(k)
        used.add(partner)
        lines.push({ label: humanizeKey(base), value: `${formatValue(v)} → ${formatValue(parsed[partner])}` })
        continue
      }
    }
    used.add(k)
    lines.push({ label: humanizeKey(k), value: formatValue(v) })
  }
  return lines
}

/** Pretty JSON for the "raw" expander. */
export function rawDetails(details: unknown): string {
  const parsed = parseDetails(details)
  if (typeof parsed === 'string') return parsed
  try {
    return JSON.stringify(parsed, null, 2) ?? ''
  } catch {
    return String(parsed)
  }
}
