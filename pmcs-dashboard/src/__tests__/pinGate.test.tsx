import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, fireEvent, cleanup, act, waitFor } from '@testing-library/react'
import { UnitsProvider } from '../components/UnitsProvider'
import { PinChangeGate } from '../components/PinChangeGate'
import { api, ApiError, isPinChangeRequired, signOut } from '../lib/api'
import { baseProfile, fakeToken, json, mockFetch, TOKEN_KEY } from './helpers'

function renderApp() {
  return render(
    <UnitsProvider>
      <PinChangeGate>
        <p>dashboard content</p>
      </PinChangeGate>
    </UnitsProvider>,
  )
}

function fillPins(current: string, next: string, confirm = next) {
  fireEvent.change(screen.getByLabelText('Temporary PIN'), { target: { value: current } })
  fireEvent.change(screen.getByLabelText('New PIN (6-12 digits)'), { target: { value: next } })
  fireEvent.change(screen.getByLabelText('Confirm new PIN'), { target: { value: confirm } })
}

describe('forced PIN change', () => {
  beforeEach(() => {
    localStorage.clear()
    localStorage.setItem(TOKEN_KEY, fakeToken())
  })
  afterEach(() => {
    cleanup()
    signOut()
    vi.unstubAllGlobals()
  })

  it('blocks the dashboard when /me says must_change_pin=1, then unblocks after a valid change and stores the new token', async () => {
    let mustChange = 1
    const newToken = fakeToken()
    const calls = mockFetch({
      'GET /me': () => json({ ...baseProfile, must_change_pin: mustChange }),
      'POST /auth/change-pin': () => {
        mustChange = 0
        return json({ token: newToken, profile: { ...baseProfile, must_change_pin: 0 } })
      },
    })
    renderApp()
    await screen.findByTestId('forced-pin-change')
    expect(screen.queryByText('dashboard content')).toBeNull()

    // Client-side validation: no request for a mismatched confirmation.
    fillPins('482913', '123456', '123457')
    fireEvent.click(screen.getByRole('button', { name: 'Set new PIN' }))
    expect((await screen.findByRole('alert')).textContent).toBe('New PINs do not match')
    expect(calls.some((c) => c.path === '/auth/change-pin')).toBe(false)

    fillPins('482913', '135790')
    fireEvent.click(screen.getByRole('button', { name: 'Set new PIN' }))
    await screen.findByText('dashboard content')
    const change = calls.find((c) => c.path === '/auth/change-pin')!
    expect(change.body).toEqual({ current_pin: '482913', new_pin: '135790' })
    expect(localStorage.getItem(TOKEN_KEY)).toBe(newToken)
  })

  it('shows the server error (e.g. wrong temporary PIN) without signing out', async () => {
    mockFetch({
      'GET /me': () => json({ ...baseProfile, must_change_pin: 1 }),
      'POST /auth/change-pin': () => json({ error: 'Current PIN is incorrect', code: 'INVALID_PIN' }, 403),
    })
    renderApp()
    await screen.findByTestId('forced-pin-change')
    fillPins('000000', '135790')
    fireEvent.click(screen.getByRole('button', { name: 'Set new PIN' }))
    expect((await screen.findByRole('alert')).textContent).toBe('Current PIN is incorrect')
    expect(localStorage.getItem(TOKEN_KEY)).not.toBeNull()
    expect(screen.getByTestId('forced-pin-change')).toBeTruthy()
  })

  it('switches to the PIN screen when any request answers 403 PIN_CHANGE_REQUIRED', async () => {
    mockFetch({
      'GET /me': () => json({ ...baseProfile, must_change_pin: 0 }),
      'GET /vehicles': () => json({ error: 'You must set a new PIN', code: 'PIN_CHANGE_REQUIRED' }, 403),
    })
    renderApp()
    await screen.findByText('dashboard content')
    let thrown: unknown
    await act(async () => {
      await api('GET', '/vehicles').catch((e) => {
        thrown = e
      })
    })
    expect(thrown).toBeInstanceOf(ApiError)
    expect((thrown as ApiError).code).toBe('PIN_CHANGE_REQUIRED')
    expect(isPinChangeRequired()).toBe(true)
    await waitFor(() => expect(screen.getByTestId('forced-pin-change')).toBeTruthy())
    expect(screen.queryByText('dashboard content')).toBeNull()

    // Signing out clears the lock.
    act(() => signOut())
    expect(isPinChangeRequired()).toBe(false)
  })

  it('a plain 403 does not trigger the PIN screen', async () => {
    mockFetch({ 'GET /admin/users': () => json({ error: 'Admins only' }, 403) })
    await expect(api('GET', '/admin/users')).rejects.toMatchObject({ status: 403, message: 'Admins only' })
    expect(isPinChangeRequired()).toBe(false)
  })
})
