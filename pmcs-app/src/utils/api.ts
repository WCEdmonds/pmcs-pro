// Client for the PMCS Pro API (Cloudflare Worker in /pmcs-api).
// Keep in sync with pmcs-dashboard/src/lib/api.ts.

const API_URL = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '') ?? '';
export const TOKEN_KEY = 'pmcs-api-token';
const TOKEN_ISSUED_KEY = 'pmcs-api-token-issued';
const DEFAULT_TIMEOUT_MS = 20_000;
const REFRESH_AFTER_MS = 24 * 60 * 60 * 1000;

if (!API_URL && import.meta.env.MODE !== 'test') {
  console.error('FATAL: API URL not configured. Set VITE_API_URL.');
}

export interface ApiProfile {
  id: string;
  dod_id: string;
  rank: string | null;
  last_name: string | null;
  first_name: string | null;
  mi: string | null;
  unit: string | null;
  created_at: string;
  /** 'admin' can use the dashboard admin tools. Absent on older API versions. */
  role?: 'member' | 'admin';
  /** 1 while the soldier must replace a temporary PIN an admin set. */
  must_change_pin?: number | boolean;
}

/** Error code the API returns (403) on every non-auth route until a temporary PIN is replaced. */
export const PIN_CHANGE_REQUIRED = 'PIN_CHANGE_REQUIRED';

/** HTTP error returned by the API (status is the HTTP status code). */
export class ApiError extends Error {
  readonly status: number;
  /** Machine-readable `code` from the error body, when the API sends one. */
  readonly code?: string;
  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

/** The request never got an HTTP response (offline, DNS, CORS, timeout). */
export class NetworkError extends Error {
  constructor(message = "Can't reach the server") {
    super(message);
    this.name = 'NetworkError';
  }
}

export function isNetworkError(err: unknown): err is NetworkError {
  return err instanceof NetworkError;
}

export function isAuthError(err: unknown): boolean {
  return err instanceof ApiError && err.status === 401;
}

export function isPinChangeRequired(err: unknown): boolean {
  return err instanceof ApiError && err.status === 403 && err.code === PIN_CHANGE_REQUIRED;
}

// ---------------------------------------------------------------------------
// "Set a new PIN" gate: any API call answering PIN_CHANGE_REQUIRED tells the app.
// ---------------------------------------------------------------------------

type PinChangeListener = () => void;
const pinChangeListeners = new Set<PinChangeListener>();

export function onPinChangeRequired(listener: PinChangeListener): () => void {
  pinChangeListeners.add(listener);
  return () => pinChangeListeners.delete(listener);
}

function notifyPinChangeRequired() {
  pinChangeListeners.forEach((l) => {
    try {
      l();
    } catch (err) {
      console.error('PIN-change listener failed:', err);
    }
  });
}

// ---------------------------------------------------------------------------
// Why the soldier was signed out (shown once on the login screen)
// ---------------------------------------------------------------------------

const SIGN_OUT_NOTICE_KEY = 'pmcs-signout-notice';
export const REVOKED_NOTICE = 'You were signed out. Sign in again.';

function setSignOutNotice(text: string | null) {
  try {
    if (text) sessionStorage.setItem(SIGN_OUT_NOTICE_KEY, text);
    else sessionStorage.removeItem(SIGN_OUT_NOTICE_KEY);
  } catch {
    // ignore
  }
}

/** The pending "you were signed out" message, if any (kept until cleared). */
export function getSignOutNotice(): string | null {
  try {
    return sessionStorage.getItem(SIGN_OUT_NOTICE_KEY);
  } catch {
    return null;
  }
}

export function clearSignOutNotice() {
  setSignOutNotice(null);
}

type AuthListener = (signedIn: boolean) => void;
const listeners = new Set<AuthListener>();

function notify(signedIn: boolean) {
  listeners.forEach((l) => {
    try {
      l(signedIn);
    } catch (err) {
      console.error('Auth listener failed:', err);
    }
  });
}

export function readToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

function writeToken(token: string | null) {
  try {
    if (token) {
      localStorage.setItem(TOKEN_KEY, token);
      localStorage.setItem(TOKEN_ISSUED_KEY, String(Date.now()));
    } else {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(TOKEN_ISSUED_KEY);
    }
  } catch {
    // Storage unavailable — session lasts for this page load only
  }
  notify(!!token);
}

interface TokenClaims {
  sub: string;
  dod_id?: string;
  exp: number;
}

export function decodeClaims(token: string): TokenClaims | null {
  try {
    const part = token.split('.')[1];
    const b64 = part.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((part.length + 3) % 4);
    const claims = JSON.parse(atob(b64));
    if (!claims || typeof claims.exp !== 'number') return null;
    return claims;
  } catch {
    return null;
  }
}

function validClaims(): TokenClaims | null {
  const token = readToken();
  const claims = token ? decodeClaims(token) : null;
  if (!claims || claims.exp * 1000 < Date.now()) return null;
  return claims;
}

/** Returns the signed-in user's id if a non-expired session token is stored (works offline). */
export function getSessionUserId(): string | null {
  return validClaims()?.sub ?? null;
}

/** DOD ID claim of the stored, non-expired token (works offline). */
export function getSessionDodId(): string | null {
  return validClaims()?.dod_id ?? null;
}

export function onAuthChange(listener: AuthListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

// Multi-tab: another tab signing out (or in) changes the token key.
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key !== TOKEN_KEY && e.key !== null) return;
    const before = e.oldValue ? decodeClaims(e.oldValue)?.sub : undefined;
    const after = e.newValue ? decodeClaims(e.newValue)?.sub : undefined;
    // A different soldier signed in from another tab: start this tab fresh as them.
    if (before && after && before !== after) {
      window.location.reload();
      return;
    }
    notify(!!readToken());
  });
}

type Query = Record<string, string | number | boolean | string[] | null | undefined>;

export interface ApiOptions {
  query?: Query;
  body?: unknown;
  raw?: Blob;
  timeoutMs?: number;
  /**
   * A 401 here means bad credentials in the body (e.g. a wrong current PIN), not a dead
   * session, so the stored token is kept.
   */
  credentialCheck?: boolean;
}

export function apiUrl(path: string): string {
  return API_URL + path;
}

export async function api<T = unknown>(method: string, path: string, opts: ApiOptions = {}): Promise<T> {
  const url = new URL(API_URL + path, window.location.origin);
  for (const [k, v] of Object.entries(opts.query ?? {})) {
    if (v == null) continue;
    for (const item of Array.isArray(v) ? v : [v]) url.searchParams.append(k, String(item));
  }

  const headers: Record<string, string> = {};
  const token = readToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  let body: BodyInit | undefined;
  if (opts.raw) {
    body = opts.raw;
    headers['Content-Type'] = opts.raw.type || 'application/octet-stream';
  } else if (opts.body !== undefined) {
    body = JSON.stringify(opts.body);
    headers['Content-Type'] = 'application/json';
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), opts.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  let res: Response;
  let text: string;
  try {
    res = await fetch(url, { method, headers, body, signal: controller.signal });
    text = await res.text();
  } catch (err) {
    const aborted = (err as Error)?.name === 'AbortError';
    throw new NetworkError(aborted ? 'The server took too long to respond' : "Can't reach the server");
  } finally {
    clearTimeout(timeout);
  }

  let data: unknown = undefined;
  let isJson = false;
  if (text) {
    try {
      data = JSON.parse(text);
      isJson = true;
    } catch {
      isJson = false;
    }
  }

  if (!res.ok) {
    const errBody = isJson && data && typeof data === 'object' ? (data as { error?: unknown; code?: unknown }) : {};
    const msg = (typeof errBody.error === 'string' && errBody.error) || `Request failed (${res.status})`;
    const code = typeof errBody.code === 'string' ? errBody.code : undefined;
    if (res.status === 401 && !opts.credentialCheck) {
      // Any other 401 means we are not (or no longer) signed in: expired, or revoked
      // from another device. Local data stays; it syncs after the next sign-in.
      if (token && readToken() === token) {
        setSignOutNotice(REVOKED_NOTICE);
        writeToken(null);
      } else if (!token) {
        notify(false);
      }
    }
    if (res.status === 403 && code === PIN_CHANGE_REQUIRED) notifyPinChangeRequired();
    throw new ApiError(msg, res.status, code);
  }
  if (!isJson) {
    // A 2xx that isn't JSON is a proxy/captive portal/SPA fallback, not our API.
    throw new ApiError('Unexpected response from the server', res.status);
  }
  return data as T;
}

export async function signIn(dodId: string, pin: string): Promise<ApiProfile> {
  const { token, profile } = await api<{ token: string; profile: ApiProfile }>('POST', '/auth/login', {
    body: { dod_id: dodId, pin },
    credentialCheck: true,
  });
  clearSignOutNotice();
  writeToken(token);
  return profile;
}

/**
 * POST /auth/change-pin. The server signs out every other session and returns a fresh
 * token for this one, which replaces the stored token. A 401 here usually means the
 * current PIN was wrong, so the session is kept (see `credentialCheck`).
 */
export async function changePin(currentPin: string, newPin: string): Promise<ApiProfile> {
  const res = await api<{ token: string; profile: ApiProfile }>('POST', '/auth/change-pin', {
    body: { current_pin: currentPin, new_pin: newPin },
    credentialCheck: true,
  });
  if (!res || typeof res.token !== 'string' || !res.token) {
    throw new ApiError('Unexpected response from the server', 200);
  }
  writeToken(res.token);
  return res.profile;
}

/** POST /auth/sign-out-everywhere, then signs this device out too (the server revoked it). */
export async function signOutEverywhere(): Promise<void> {
  await api<{ ok: boolean }>('POST', '/auth/sign-out-everywhere');
  clearSignOutNotice();
  writeToken(null);
}

export async function signUp(
  dodId: string,
  pin: string,
  profile: { rank: string; last_name: string; first_name: string; mi: string; unit: string },
): Promise<ApiProfile> {
  const res = await api<{ token: string; profile: ApiProfile }>('POST', '/auth/signup', {
    body: { dod_id: dodId, pin, ...profile },
  });
  writeToken(res.token);
  return res.profile;
}

export function signOut() {
  clearSignOutNotice();
  writeToken(null);
}

/** Sliding sessions: swap a token older than ~1 day for a fresh 30-day one. Never throws. */
export async function refreshTokenIfStale(): Promise<boolean> {
  const token = readToken();
  if (!token || !validClaims()) return false;
  let issued = 0;
  try {
    issued = Number(localStorage.getItem(TOKEN_ISSUED_KEY) || 0);
  } catch {
    issued = 0;
  }
  if (issued && Date.now() - issued < REFRESH_AFTER_MS) return false;
  try {
    const res = await api<{ token: string }>('POST', '/auth/refresh');
    if (res?.token) {
      try {
        localStorage.setItem(TOKEN_KEY, res.token);
        localStorage.setItem(TOKEN_ISSUED_KEY, String(Date.now()));
      } catch {
        // ignore
      }
      return true;
    }
  } catch {
    // Offline or refresh not supported — keep the current token.
  }
  return false;
}
