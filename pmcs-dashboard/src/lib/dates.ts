// Calendar-day helpers in the viewer's LOCAL time zone.
//
// Never bucket by `toISOString().slice(0, 10)`: that is the UTC date, which is
// "tomorrow" during US evenings and skips/duplicates days across DST changes.

const pad = (n: number) => String(n).padStart(2, '0')

/** YYYY-MM-DD for the local calendar day containing `d`. */
export function localDateKey(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/**
 * Day key for a server value. A bare `YYYY-MM-DD` is already a calendar day and is
 * used as-is (parsing it with `new Date()` would read it as UTC midnight, i.e. the
 * previous day in the Americas). Full timestamps are converted to the local day.
 */
export function toDayKey(value: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? value.slice(0, 10) : localDateKey(d)
}

/** The local calendar day `days` days before/after `d` (DST-safe: uses calendar arithmetic). */
export function addLocalDays(d: Date, days: number): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + days, 12)
}

/** Keys for the `n` local days ending today (oldest first). */
export function lastNDayKeys(n: number, now: Date): string[] {
  const keys: string[] = []
  for (let i = n - 1; i >= 0; i--) keys.push(localDateKey(addLocalDays(now, -i)))
  return keys
}

function keyToUtcMs(key: string): number {
  const [y, m, d] = key.split('-').map(Number)
  return Date.UTC(y, m - 1, d)
}

/** Whole calendar days from day `fromKey` to day `toKey` (DST-independent). */
export function daysBetweenKeys(fromKey: string, toKey: string): number {
  return Math.round((keyToUtcMs(toKey) - keyToUtcMs(fromKey)) / 86_400_000)
}

/** Whole local calendar days between a timestamp and now. */
export function localDaysSince(value: string, now: Date): number {
  return daysBetweenKeys(toDayKey(value), localDateKey(now))
}

/** Formats a day key (or timestamp) as a short local date without UTC shifting. */
export function formatDay(value: string | null | undefined, opts: Intl.DateTimeFormatOptions = {}): string {
  if (!value) return '---'
  const key = toDayKey(value)
  const [y, m, d] = key.split('-').map(Number)
  if (!y || !m || !d) return value
  return new Date(y, m - 1, d, 12).toLocaleDateString(undefined, opts)
}

/** Current local time as HHMM (for the DA 2404 time block). */
export function localHHMM(now = new Date()): string {
  return `${pad(now.getHours())}${pad(now.getMinutes())}`
}

/** Parses a server timestamp (ISO, or SQLite "YYYY-MM-DD HH:MM:SS" which is UTC). */
export function parseServerTime(value: string | null | undefined): Date | null {
  if (!value) return null
  const iso = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}(:\d{2}(\.\d+)?)?$/.test(value) ? `${value.replace(' ', 'T')}Z` : value
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? null : d
}

/** Local date + time for a server timestamp, or '---'. */
export function formatDateTime(value: string | null | undefined): string {
  const d = parseServerTime(value)
  return d ? d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : value || '---'
}

/** Compact age ("just now", "12 min", "5 h", "3 d") from a timestamp to `now`. */
export function formatAge(value: string | null | undefined, now: Date): string {
  const d = parseServerTime(value)
  if (!d) return '---'
  const mins = Math.floor((now.getTime() - d.getTime()) / 60_000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins} min`
  const hours = Math.floor(mins / 60)
  if (hours < 48) return `${hours} h`
  return `${Math.floor(hours / 24)} d`
}

/** Local midnight at the start of a YYYY-MM-DD day, as an ISO instant. */
export function localDayStartIso(dayKey: string): string {
  const [y, m, d] = dayKey.split('-').map(Number)
  return new Date(y, m - 1, d).toISOString()
}

/** Local midnight at the end of a YYYY-MM-DD day (start of the next day), as an ISO instant. */
export function localDayEndIso(dayKey: string): string {
  const [y, m, d] = dayKey.split('-').map(Number)
  return new Date(y, m - 1, d + 1).toISOString()
}
