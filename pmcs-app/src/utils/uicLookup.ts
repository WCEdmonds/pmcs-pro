import { db } from './db';
import { api, ApiError } from './api';

/** Uppercase + trim. Use for every UIC that is stored or sent. */
export function normalizeUic(uic: string | null | undefined): string {
  return (uic ?? '').trim().toUpperCase();
}

export interface UicValidation {
  value: string;
  valid: boolean;
  error?: string;
  /** Suggested correction (letter O → digit 0) */
  suggestion?: string;
}

/** A UIC is exactly 6 letters/digits. Flags the letter O, which is almost always a mistyped zero. */
export function validateUic(raw: string): UicValidation {
  const value = normalizeUic(raw);
  const suggestion = value.includes('O') ? value.replace(/O/g, '0') : undefined;
  if (!value) return { value, valid: false, error: 'Enter your UIC' };
  if (!/^[A-Z0-9]+$/.test(value)) {
    return { value, valid: false, error: 'UIC is letters and numbers only', suggestion };
  }
  if (value.length !== 6) {
    return { value, valid: false, error: `UIC must be exactly 6 characters (you entered ${value.length})`, suggestion };
  }
  return { value, valid: true, suggestion };
}

export type UicLookup =
  | { status: 'known'; unitName: string }
  | { status: 'new' }
  | { status: 'unavailable' };

/** Looks up a UIC's unit name: local cache first, then public GET /uic/:uic. */
export async function lookupUic(uic: string): Promise<UicLookup> {
  const upper = normalizeUic(uic);
  if (!upper) return { status: 'new' };
  const local = await db.uicLookup.get(upper).catch(() => undefined);
  if (local?.unitName) return { status: 'known', unitName: local.unitName };
  try {
    const data = await api<{ unit_name: string | null }>('GET', `/uic/${encodeURIComponent(upper)}`, { timeoutMs: 8000 });
    if (!data?.unit_name) return { status: 'new' };
    await db.uicLookup.put({ uic: upper, unitName: data.unit_name }).catch(() => undefined);
    return { status: 'known', unitName: data.unit_name };
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) return { status: 'new' };
    return { status: 'unavailable' };
  }
}

export async function getUnitName(uic: string): Promise<string | null> {
  const res = await lookupUic(uic);
  return res.status === 'known' ? res.unitName : null;
}

/** Saves locally, then to the server (needs a token; own unit only). Never throws. */
export async function saveUicMapping(uic: string, unitName: string): Promise<boolean> {
  const upper = normalizeUic(uic);
  if (!upper || !unitName.trim()) return false;
  await db.uicLookup.put({ uic: upper, unitName: unitName.trim() }).catch(() => undefined);
  try {
    await api('PUT', `/uic/${encodeURIComponent(upper)}`, { body: { unit_name: unitName.trim() } });
    return true;
  } catch {
    return false;
  }
}
