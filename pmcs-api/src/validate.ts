// Request validation helpers. Every failure is an HttpError, which the app's
// onError turns into `{error}` with the given status.

export class HttpError extends Error {
  constructor(public status: 400 | 401 | 403 | 404 | 409 | 410 | 413 | 429, message: string) {
    super(message);
  }
}

export const bad = (message: string) => new HttpError(400, message);

export type Obj = Record<string, unknown>;

export const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);

export const UIC_RE = /^[A-Z0-9]{6}$/;

/** Upper-cases and trims a UIC and requires 6 letters/digits. */
export function parseUic(v: unknown, label = 'unit'): string {
  if (typeof v !== 'string' || !v.trim()) throw bad(`${label} (UIC) is required`);
  const uic = v.trim().toUpperCase();
  if (!UIC_RE.test(uic)) throw bad(`${label} must be a 6-character UIC (letters and digits), e.g. WAB1C0`);
  return uic;
}

/** Bumper numbers match across '-'/space/case differences: 'HHC-20' ≡ 'hhc 20' ≡ 'HHC20'. */
export const normalizeBumper = (s: string) => s.replace(/[-\s]/g, '').toUpperCase();

interface StrOpts { required?: boolean; max?: number; trim?: boolean }

/** Optional string field: undefined/null → null; non-strings → 400. */
export function str(o: Obj, key: string, opts: StrOpts = {}): string | null {
  const v = o[key];
  if (v === undefined || v === null) {
    if (opts.required) throw bad(`${key} is required`);
    return null;
  }
  if (typeof v !== 'string') throw bad(`${key} must be a string`);
  const s = opts.trim === false ? v : v.trim();
  if (opts.required && !s) throw bad(`${key} is required`);
  if (s.length > (opts.max ?? 500)) throw bad(`${key} is too long (max ${opts.max ?? 500} characters)`);
  return s;
}

/** Optional finite, non-negative number. */
export function num(o: Obj, key: string): number | null {
  const v = o[key];
  if (v === undefined || v === null) return null;
  if (typeof v !== 'number' || !Number.isFinite(v) || v < 0) throw bad(`${key} must be a non-negative number`);
  return v;
}

/** Optional boolean stored as 0/1; accepts true/false/0/1. */
export function bool01(o: Obj, key: string): 0 | 1 | null {
  const v = o[key];
  if (v === undefined || v === null) return null;
  if (v === true || v === 1) return 1;
  if (v === false || v === 0) return 0;
  throw bad(`${key} must be a boolean`);
}

/** Optional ISO-8601 timestamp, normalised to UTC `...Z`. */
export function timestamp(o: Obj, key: string): string | null {
  const s = str(o, key, { max: 64 });
  if (s === null || s === '') return null;
  const t = Date.parse(s);
  if (Number.isNaN(t)) throw bad(`${key} must be an ISO-8601 timestamp`);
  return new Date(t).toISOString();
}

/** Optional YYYY-MM-DD date. */
export function dateOnly(o: Obj, key: string): string | null {
  const s = str(o, key, { max: 10 });
  if (s === null || s === '') return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s) || Number.isNaN(Date.parse(s))) throw bad(`${key} must be a date (YYYY-MM-DD)`);
  return s;
}

/** Optional id (uuid-like). */
export function id(o: Obj, key: string, required = false): string | null {
  const s = str(o, key, { required, max: 64 });
  if (s !== null && !/^[A-Za-z0-9_-]{1,64}$/.test(s)) throw bad(`${key} is not a valid id`);
  return s;
}

/**
 * Reads at most `max` bytes of a request body. Rejects with 413 as soon as the
 * Content-Length header or the streamed size exceeds the cap.
 */
export async function readCapped(req: Request, max: number): Promise<Uint8Array> {
  const declared = Number(req.headers.get('content-length') ?? NaN);
  if (declared > max) throw new HttpError(413, `File is too large (max ${max / 1024 / 1024} MB)`);
  if (!req.body) return new Uint8Array();
  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > max) {
      await reader.cancel().catch(() => {});
      throw new HttpError(413, `File is too large (max ${max / 1024 / 1024} MB)`);
    }
    chunks.push(value);
  }
  const out = new Uint8Array(total);
  let off = 0;
  for (const c of chunks) { out.set(c, off); off += c.byteLength; }
  return out;
}

export function sniffImage(b: Uint8Array): 'jpg' | 'png' | null {
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'jpg';
  const png = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (b.length >= 8 && png.every((x, i) => b[i] === x)) return 'png';
  return null;
}

export const isPdf = (b: Uint8Array) => b.length >= 4 && b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46;

export function toBase64(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}
