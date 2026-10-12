import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { AbortedError, api, ApiError, chunk, getSessionUserId, onAuthChange, signOut } from '../lib/api'

const TOKEN_KEY = 'pmcs-api-token'

function token(claims: Record<string, unknown>) {
  const b64 = (o: unknown) => btoa(JSON.stringify(o)).replace(/=+$/, '')
  return `${b64({ alg: 'HS256' })}.${b64(claims)}.sig`
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

describe('api()', () => {
  beforeEach(() => {
    localStorage.clear()
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.useRealTimers()
  })

  it('returns parsed JSON', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse([{ id: 1 }])))
    await expect(api('GET', '/vehicles')).resolves.toEqual([{ id: 1 }])
  })

  it('treats a non-JSON 2xx (e.g. index.html) as an error', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('<!doctype html>', { status: 200, headers: { 'Content-Type': 'text/html' } })))
    await expect(api('GET', '/vehicles')).rejects.toBeInstanceOf(ApiError)
  })

  it('surfaces the server error message', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({ error: 'Too many failed attempts. Try again in 15 minutes.' }, 429)))
    await expect(api('POST', '/auth/login', { body: {} })).rejects.toMatchObject({
      status: 429,
      message: 'Too many failed attempts. Try again in 15 minutes.',
    })
  })

  it('times out', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((_url: URL, init: RequestInit) => new Promise((_res, rej) => init.signal!.addEventListener('abort', () => rej(new DOMException('aborted', 'AbortError'))))),
    )
    await expect(api('GET', '/vehicles', { timeoutMs: 20 })).rejects.toMatchObject({ status: 0, message: expect.stringMatching(/too long/) })
  })

  it('signs out and notifies listeners on 401', async () => {
    localStorage.setItem(TOKEN_KEY, token({ sub: 'u1', exp: Date.now() / 1000 + 3600 }))
    expect(getSessionUserId()).toBe('u1')
    const listener = vi.fn()
    const off = onAuthChange(listener)
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({ error: 'Not signed in' }, 401)))
    await expect(api('GET', '/vehicles')).rejects.toBeInstanceOf(AbortedError)
    expect(listener).toHaveBeenCalledWith(false)
    expect(getSessionUserId()).toBeNull()
    off()
  })

  it('a wrong PIN (401 on /auth/login) is a normal error, not a sign-out', async () => {
    const listener = vi.fn()
    const off = onAuthChange(listener)
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({ error: 'Invalid DOD ID or PIN' }, 401)))
    await expect(api('POST', '/auth/login', { body: {} })).rejects.toMatchObject({ status: 401, message: 'Invalid DOD ID or PIN' })
    expect(listener).not.toHaveBeenCalled()
    off()
  })

  it('cancels in-flight requests quietly on sign-out', async () => {
    localStorage.setItem(TOKEN_KEY, token({ sub: 'u1', exp: Date.now() / 1000 + 3600 }))
    vi.stubGlobal(
      'fetch',
      vi.fn((_url: URL, init: RequestInit) => new Promise((_res, rej) => init.signal!.addEventListener('abort', () => rej(new DOMException('aborted', 'AbortError'))))),
    )
    const pending = api('GET', '/vehicles')
    signOut()
    await expect(pending).rejects.toBeInstanceOf(AbortedError)
  })

  it('notifies listeners when another tab signs out (storage event)', () => {
    const listener = vi.fn()
    const off = onAuthChange(listener)
    window.dispatchEvent(new StorageEvent('storage', { key: TOKEN_KEY, newValue: null }))
    expect(listener).toHaveBeenCalledWith(false)
    off()
  })

  it('chunks id lists to at most 90', () => {
    const ids = Array.from({ length: 200 }, (_, i) => String(i))
    expect(chunk(ids).map((c) => c.length)).toEqual([90, 90, 20])
  })
})
