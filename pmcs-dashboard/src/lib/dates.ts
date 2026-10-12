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
