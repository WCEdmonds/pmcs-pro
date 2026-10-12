// Client for the PMCS Pro API (Cloudflare Worker in /pmcs-api).
// Semantics are kept in step with pmcs-app/src/utils/api.ts (timeout, non-JSON
// handling, 401 sign-out, multi-tab sign-out, sliding session refresh).

const API_URL = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '') ?? ''
const TOKEN_KEY = 'pmcs-api-token'
const REQUEST_TIMEOUT_MS = 20_000
const TOKEN_TTL_SECONDS = 60 * 60 * 24 * 30
const REFRESH_AFTER_MS = 24 * 60 * 60 * 1000

if (!API_URL) {
  console.error('FATAL: API URL not configured. Set VITE_API_URL.')
}

export interface ApiProfile {
  id: string
  dod_id: string
  rank: string | null
  last_name: string | null
  first_name: string | null
  mi: string | null
  unit: string | null
  created_at: string
  /** Units this user may view (own unit + approved watched units). Optional until the API ships it. */
  visible_units?: string[]
  role?: 'member' | 'admin'
  /** 1 while the user signs in with an admin-issued temporary PIN and must set their own. */
  must_change_pin?: number | boolean
  email?: string | null
  email_verified_at?: string | null
}

export class ApiError extends Error {
  /** HTTP status, or 0 for network failures and timeouts. */
  readonly status: number
  /** Machine-readable error code from the body (`{error, code}`), when the server sends one. */
  readonly code: string | undefined
  constructor(message: string, status: number, code?: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
  }
}

export const PIN_CHANGE_REQUIRED = 'PIN_CHANGE_REQUIRED'

// --- Forced PIN change -------------------------------------------------------
// Set when any request answers 403 {code:'PIN_CHANGE_REQUIRED'}; the app then
// shows the set-new-PIN screen until changePin() succeeds or the user signs out.
let pinChangeRequired = false
const pinListeners = new Set<() => void>()

function setPinChangeRequired(value: boolean) {
  if (pinChangeRequired === value) return
  pinChangeRequired = value
  pinListeners.forEach((l) => l())
}

export function isPinChangeRequired(): boolean {
  return pinChangeRequired
}

/** Subscribe to the forced-PIN-change flag (useSyncExternalStore-compatible). */
export function onPinChangeRequired(listener: () => void): () => void {
  pinListeners.add(listener)
  return () => {
    pinListeners.delete(listener)
  }
}

/**
 * Thrown when a request was cancelled on purpose: the caller aborted it (a newer
 * load superseded it, the page unmounted) or the user signed out while it was in
 * flight. Callers should ignore it rather than show an error.
 */
export class AbortedError extends Error {
  constructor() {
    super('Request cancelled')
    this.name = 'AbortedError'
  }
}

export function isAbortedError(err: unknown): err is AbortedError {
  return err instanceof AbortedError
}

/** User-facing message for any error thrown by api(). */
export function errorMessage(err: unknown): string {
  if (err instanceof Error && err.message) return err.message
  return 'Something went wrong'
}

type AuthListener = (signedIn: boolean) => void
const listeners = new Set<AuthListener>()

/** Aborted (and replaced) whenever the session ends, cancelling in-flight requests. */
let sessionController = new AbortController()

function readToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY)
  } catch {
    return null
  }
}

function notify(signedIn: boolean) {
  if (!signedIn) {
    setPinChangeRequired(false)
    sessionController.abort()
    sessionController = new AbortController()
  }
  listeners.forEach((l) => l(signedIn))
}

function writeToken(token: string | null) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token)
    else localStorage.removeItem(TOKEN_KEY)
  } catch {
    // Storage unavailable: the session lasts for this page load only
  }
  notify(!!token)
}

// Sign-in / sign-out in another tab.
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key !== TOKEN_KEY && e.key !== null) return
    notify(!!readToken())
  })
}

interface Claims {
  sub: string
  exp: number
  iat?: number
}

function decodeClaims(token: string): Claims | null {
  try {
    const payload = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')
    return JSON.parse(atob(payload))
  } catch {
    return null
  }
}

/** Returns the signed-in user's id if a non-expired session token is stored (works offline). */
export function getSessionUserId(): string | null {
  const token = readToken()
  const claims = token ? decodeClaims(token) : null
  if (!claims || claims.exp * 1000 < Date.now()) return null
  return claims.sub
}

export function onAuthChange(listener: AuthListener): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

type Query = Record<string, string | number | boolean | string[] | null | undefined>

export interface ApiOptions {
  query?: Query
  body?: unknown
  raw?: Blob
  signal?: AbortSignal
  /** Overrides the default 20 s timeout. */
  timeoutMs?: number
}

// A 401 on these is a wrong DOD ID / PIN, not an expired session.
const AUTH_PATHS = new Set(['/auth/login', '/auth/signup', '/auth/change-pin', '/auth/pin-reset/request', '/auth/pin-reset/confirm'])

export async function api<T = unknown>(method: string, path: string, opts: ApiOptions = {}): Promise<T> {
  const url = new URL(API_URL + path, window.location.origin)
  for (const [k, v] of Object.entries(opts.query ?? {})) {
    if (v == null) continue
    for (const item of Array.isArray(v) ? v : [v]) url.searchParams.append(k, String(item))
  }

  const headers: Record<string, string> = { Accept: 'application/json' }
  const token = readToken()
  if (token) headers.Authorization = `Bearer ${token}`
  let body: BodyInit | undefined
  if (opts.raw) {
    body = opts.raw
    headers['Content-Type'] = opts.raw.type || 'application/octet-stream'
  } else if (opts.body !== undefined) {
    body = JSON.stringify(opts.body)
    headers['Content-Type'] = 'application/json'
  }

  // One controller fed by the timeout, the caller's signal and the session.
  const controller = new AbortController()
  let timedOut = false
  const timer = setTimeout(() => {
    timedOut = true
    controller.abort()
  }, opts.timeoutMs ?? REQUEST_TIMEOUT_MS)
  const session = sessionController.signal
  const forward = () => controller.abort()
  if (opts.signal?.aborted || (token && session.aborted)) controller.abort()
  opts.signal?.addEventListener('abort', forward)
  if (token) session.addEventListener('abort', forward)

  const cancelled = () => !timedOut && (opts.signal?.aborted || (!!token && session.aborted))

  try {
    let res: Response
    try {
      res = await fetch(url, { method, headers, body, signal: controller.signal })
    } catch {
      if (cancelled()) throw new AbortedError()
      if (timedOut) throw new ApiError('The server took too long to respond. Check your connection and retry.', 0)
      throw new ApiError('Could not reach the server. Check your connection and retry.', 0)
    }

    const isJson = (res.headers.get('content-type') ?? '').includes('application/json')
    let data: unknown = undefined
    if (isJson) {
      try {
        data = await res.json()
      } catch {
        if (cancelled()) throw new AbortedError()
        data = undefined
      }
    }

    if (!res.ok) {
      if (res.status === 401 && !AUTH_PATHS.has(path)) {
        // A 401 for a token that has since been replaced or cleared is stale: stay quiet.
        if (token && readToken() !== token) throw new AbortedError()
        if (token) writeToken(null)
        else notify(false)
        throw new AbortedError()
      }
      const { error: msg, code } = (data ?? {}) as { error?: string; code?: string }
      if (res.status === 403 && code === PIN_CHANGE_REQUIRED && token && readToken() === token) {
        setPinChangeRequired(true)
      }
      throw new ApiError(msg || `Request failed (${res.status})`, res.status, typeof code === 'string' ? code : undefined)
    }

    if (cancelled()) throw new AbortedError()
    if (res.status === 204) return undefined as T
    if (!isJson || data === undefined) {
      // e.g. a missing VITE_API_URL makes requests hit the SPA's index.html
      throw new ApiError('Unexpected response from the server (not JSON). Is the API URL configured?', res.status)
    }
    return data as T
  } finally {
    clearTimeout(timer)
    opts.signal?.removeEventListener('abort', forward)
    session.removeEventListener('abort', forward)
  }
}

/** Splits `ids` into chunks of at most `size` (the API binds at most ~90 ids per query). */
export function chunk<T>(ids: T[], size = 90): T[][] {
  const out: T[][] = []
  for (let i = 0; i < ids.length; i += size) out.push(ids.slice(i, i + size))
  return out
}

/** GET with an id-list query, split into URL-safe chunks and concatenated. */
export async function getByIds<T>(path: string, key: string, ids: string[], opts: ApiOptions = {}): Promise<T[]> {
  const unique = [...new Set(ids)]
  if (unique.length === 0) return []
  const parts = await Promise.all(
    chunk(unique).map((c) => api<T[]>('GET', path, { ...opts, query: { ...opts.query, [key]: c } })),
  )
  return parts.flat()
}

export async function signIn(dodId: string, pin: string): Promise<ApiProfile> {
  const { token, profile } = await api<{ token: string; profile: ApiProfile }>('POST', '/auth/login', {
    body: { dod_id: dodId, pin },
  })
  writeToken(token)
  return profile
}

export async function signUp(
  dodId: string,
  pin: string,
  profile: { rank: string; last_name: string; first_name: string; mi: string; unit: string },
): Promise<ApiProfile> {
  const res = await api<{ token: string; profile: ApiProfile }>('POST', '/auth/signup', {
    body: { dod_id: dodId, pin, ...profile },
  })
  writeToken(res.token)
  return res.profile
}

export function signOut() {
  writeToken(null)
}

/**
 * Sets a new PIN (also clears a forced PIN change). The server issues a fresh
 * token, which replaces the stored one.
 */
export async function changePin(currentPin: string, newPin: string): Promise<ApiProfile> {
  const { token, profile } = await api<{ token: string; profile: ApiProfile }>('POST', '/auth/change-pin', {
    body: { current_pin: currentPin, new_pin: newPin },
  })
  if (token) writeToken(token)
  setPinChangeRequired(false)
  return profile
}

/**
 * "Forgot PIN" step 1: emails a reset code if the account has a confirmed email.
 * The server answers the same either way, so this never reveals whether it did.
 */
export async function requestPinReset(dodId: string): Promise<void> {
  await api('POST', '/auth/pin-reset/request', { body: { dod_id: dodId } })
}

/**
 * "Forgot PIN" step 2: the emailed code plus a new PIN. Signs in like signIn()
 * (the server ends every other session and clears any lockout).
 */
export async function confirmPinReset(dodId: string, code: string, newPin: string): Promise<ApiProfile> {
  const { token, profile } = await api<{ token: string; profile: ApiProfile }>('POST', '/auth/pin-reset/confirm', {
    body: { dod_id: dodId, code, new_pin: newPin },
  })
  writeToken(token)
  setPinChangeRequired(false)
  return profile
}

/** Error codes for emailed one-time codes (PIN reset, email confirmation). */
export const CODE_INVALID = 'CODE_INVALID'
export const CODE_EXPIRED = 'CODE_EXPIRED'
export const CODE_LOCKED = 'CODE_LOCKED'
export const CODE_LIMIT = 'CODE_LIMIT'

/** True when the code can no longer be used and the user should request a new one. */
export function needsNewCode(err: unknown): boolean {
  return err instanceof ApiError && (err.code === CODE_EXPIRED || err.code === CODE_LOCKED)
}

/** Ends every session for the signed-in user (all devices), then signs out here. */
export async function signOutEverywhere(): Promise<void> {
  await api('POST', '/auth/sign-out-everywhere')
  signOut()
}

let refreshing: Promise<void> | null = null

/**
 * Sliding session: when the stored token is more than about a day old, swap it
 * for a fresh one. Safe to call often; it only hits the network when needed.
 */
export function maybeRefreshSession(): Promise<void> {
  if (refreshing) return refreshing
  const token = readToken()
  const claims = token ? decodeClaims(token) : null
  if (!token || !claims || claims.exp * 1000 < Date.now()) return Promise.resolve()
  const issuedMs = (claims.iat ?? claims.exp - TOKEN_TTL_SECONDS) * 1000
  if (Date.now() - issuedMs < REFRESH_AFTER_MS) return Promise.resolve()

  refreshing = api<{ token: string }>('POST', '/auth/refresh')
    .then(({ token: next }) => {
      // Only replace the token we refreshed (the user may have signed out meanwhile).
      if (next && readToken() === token) writeToken(next)
    })
    .catch((err) => {
      if (!isAbortedError(err)) console.warn('Session refresh failed:', err)
    })
    .finally(() => {
      refreshing = null
    })
  return refreshing
}
