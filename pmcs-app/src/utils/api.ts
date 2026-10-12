// Client for the PMCS Pro API (Cloudflare Worker in /pmcs-api).
// Keep in sync with pmcs-dashboard/src/lib/api.ts.

const API_URL = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '') ?? '';
const TOKEN_KEY = 'pmcs-api-token';

if (!API_URL) {
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
}

export class ApiError extends Error {
  readonly status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

type AuthListener = (signedIn: boolean) => void;
const listeners = new Set<AuthListener>();

function readToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

function writeToken(token: string | null) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    // Storage unavailable — session lasts for this page load only
  }
  listeners.forEach((l) => l(!!token));
}

function decodeClaims(token: string): { sub: string; exp: number } | null {
  try {
    const payload = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(atob(payload));
  } catch {
    return null;
  }
}

/** Returns the signed-in user's id if a non-expired session token is stored (works offline). */
export function getSessionUserId(): string | null {
  const token = readToken();
  const claims = token ? decodeClaims(token) : null;
  if (!claims || claims.exp * 1000 < Date.now()) return null;
  return claims.sub;
}

export function onAuthChange(listener: AuthListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

type Query = Record<string, string | number | boolean | string[] | null | undefined>;

export async function api<T = unknown>(
  method: string,
  path: string,
  opts: { query?: Query; body?: unknown; raw?: Blob } = {},
): Promise<T> {
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

  const res = await fetch(url, { method, headers, body });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401 && token) writeToken(null);
    throw new ApiError((data as { error?: string }).error || `Request failed (${res.status})`, res.status);
  }
  return data as T;
}

export async function signIn(dodId: string, pin: string): Promise<ApiProfile> {
  const { token, profile } = await api<{ token: string; profile: ApiProfile }>('POST', '/auth/login', {
    body: { dod_id: dodId, pin },
  });
  writeToken(token);
  return profile;
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
  writeToken(null);
}
