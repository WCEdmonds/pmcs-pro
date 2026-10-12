import { createElement } from 'react'
import { vi } from 'vitest'
import { UnitsContext, type UnitsContextValue } from '../hooks/useUnits'
import type { Profile } from '../types/database'

export const TOKEN_KEY = 'pmcs-api-token'

export function fakeToken(sub = 'u1') {
  const b64 = (o: unknown) => btoa(JSON.stringify(o)).replace(/=+$/, '')
  return `${b64({ alg: 'HS256' })}.${b64({ sub, exp: Math.floor(Date.now() / 1000) + 3600, iat: Math.floor(Date.now() / 1000) })}.sig`
}

export function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

export const baseProfile: Profile = {
  id: 'u1',
  dod_id: '0000000001',
  rank: 'CPT',
  last_name: 'Tester',
  first_name: 'Terry',
  mi: null,
  unit: 'WXYZA0',
  created_at: '2026-01-01T00:00:00Z',
  visible_units: ['WXYZA0'],
  role: 'member',
  must_change_pin: 0,
}

export function unitsValue(over: Partial<UnitsContextValue> = {}): UnitsContextValue {
  const profile = over.profile === undefined ? baseProfile : over.profile
  return {
    profile,
    ownUnit: profile?.unit ?? null,
    units: ['WXYZA0'],
    unitsKey: 'WXYZA0',
    unitNames: {},
    selectedUnit: '',
    setSelectedUnit: vi.fn(),
    loading: false,
    error: null,
    reload: vi.fn(),
    applyProfile: vi.fn(),
    isAdmin: profile?.role === 'admin',
    ...over,
  }
}

export function WithUnits({ value, children }: { value: UnitsContextValue; children: React.ReactNode }) {
  return createElement(UnitsContext.Provider, { value }, children)
}

type Handler = (url: URL, init: RequestInit) => Response | Promise<Response>

/** fetch mock routed by "METHOD /path"; unmatched requests answer 404. */
export function mockFetch(routes: Record<string, Handler>) {
  const calls: { method: string; path: string; url: URL; body: unknown }[] = []
  const fn = vi.fn(async (input: URL | string, init: RequestInit = {}) => {
    const url = new URL(String(input))
    const method = (init.method ?? 'GET').toUpperCase()
    const body = typeof init.body === 'string' ? JSON.parse(init.body) : undefined
    calls.push({ method, path: url.pathname, url, body })
    const h = routes[`${method} ${url.pathname}`]
    if (!h) return json({ error: 'Not found' }, 404)
    return h(url, init)
  })
  vi.stubGlobal('fetch', fn)
  return calls
}
