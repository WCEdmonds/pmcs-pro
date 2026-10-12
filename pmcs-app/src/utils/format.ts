const pad = (n: number, w = 2) => String(n).padStart(w, '0');

/** YYYY-MM-DD in the device's local time zone (not UTC). */
export function localDateString(d: Date = new Date()): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** HHMM (24h) in the device's local time zone. */
export function localTimeHHMM(d: Date = new Date()): string {
  return `${pad(d.getHours())}${pad(d.getMinutes())}`;
}

export const MAX_ODOMETER_DIGITS = 7;

/**
 * Parses an odometer entry. Accepts digits with optional thousands separators
 * (commas, spaces, periods used as grouping) — "34,218" → 34218. Returns an
 * error message for anything else.
 */
export function parseOdometer(input: string): { value: number } | { error: string } {
  const trimmed = input.trim();
  if (!trimmed) return { error: 'Enter the odometer reading' };
  const stripped = trimmed.replace(/[,\s]/g, '');
  if (!/^\d+$/.test(stripped)) return { error: 'Odometer must be whole miles (digits only)' };
  if (stripped.length > MAX_ODOMETER_DIGITS) return { error: `Odometer can be at most ${MAX_ODOMETER_DIGITS} digits` };
  return { value: parseInt(stripped, 10) };
}
