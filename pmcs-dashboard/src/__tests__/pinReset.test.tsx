import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { LoginPage } from '../pages/LoginPage'
import { PIN_RESET_SENT_MESSAGE } from '../components/PinResetForm'
import { signOut } from '../lib/api'
import { baseProfile, fakeToken, json, mockFetch, TOKEN_KEY } from './helpers'

function renderLogin() {
  return render(
    <MemoryRouter initialEntries={['/login']}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/" element={<p>dashboard home</p>} />
      </Routes>
    </MemoryRouter>,
  )
}

async function requestCode(dodId = '1000000001') {
  fireEvent.click(screen.getByRole('button', { name: 'Forgot PIN?' }))
  fireEvent.change(screen.getByLabelText('DOD ID'), { target: { value: dodId } })
  fireEvent.click(screen.getByRole('button', { name: 'Send code' }))
  await screen.findByLabelText('6-digit code')
}

function fillReset(code: string, pin: string, confirm = pin) {
  fireEvent.change(screen.getByLabelText('6-digit code'), { target: { value: code } })
  fireEvent.change(screen.getByLabelText('New PIN'), { target: { value: pin } })
  fireEvent.change(screen.getByLabelText('Confirm PIN'), { target: { value: confirm } })
  fireEvent.click(screen.getByRole('button', { name: 'Set new PIN and sign in' }))
}

describe('forgot PIN (self-service reset)', () => {
  beforeEach(() => {
    localStorage.clear()
  })
  afterEach(() => {
    cleanup()
    signOut()
    vi.unstubAllGlobals()
  })

  it('requests a code, sets a new PIN, stores the session and enters the dashboard', async () => {
    const token = fakeToken()
    const calls = mockFetch({
      'POST /auth/pin-reset/request': () => json({ ok: true }),
      'POST /auth/pin-reset/confirm': () => json({ token, profile: { ...baseProfile, dod_id: '1000000001' } }),
    })
    renderLogin()
    await requestCode()
    expect(calls[0].body).toEqual({ dod_id: '1000000001' })
    expect(screen.getByRole('status').textContent).toContain(PIN_RESET_SENT_MESSAGE)

    // Client-side checks: no request for a mismatched PIN.
    fillReset('123456', '135790', '135791')
    expect(screen.getByRole('alert').textContent).toBe('New PINs do not match')
    expect(calls.some((c) => c.path === '/auth/pin-reset/confirm')).toBe(false)

    fillReset('123456', '135790')
    await screen.findByText('dashboard home')
    expect(calls.find((c) => c.path === '/auth/pin-reset/confirm')!.body).toEqual({
      dod_id: '1000000001',
      code: '123456',
      new_pin: '135790',
    })
    expect(localStorage.getItem(TOKEN_KEY)).toBe(token)
  })

  it('shows the server error and offers a new code when the code is locked', async () => {
    const calls = mockFetch({
      'POST /auth/pin-reset/request': () => json({ ok: true }),
      'POST /auth/pin-reset/confirm': () => json({ error: 'Too many wrong codes. Request a new one.', code: 'CODE_LOCKED' }, 429),
    })
    renderLogin()
    await requestCode()
    fillReset('999999', '135790')
    expect((await screen.findByRole('alert')).textContent).toBe('Too many wrong codes. Request a new one.')
    expect(localStorage.getItem(TOKEN_KEY)).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Send a new code' }))
    await waitFor(() => expect(calls.filter((c) => c.path === '/auth/pin-reset/request')).toHaveLength(2))
    expect((await screen.findByRole('status')).textContent).toContain('A new code was requested.')
    expect(screen.queryByRole('alert')).toBeNull()
    expect((screen.getByLabelText('6-digit code') as HTMLInputElement).value).toBe('')
  })

  it('validates the DOD ID before requesting a code', () => {
    const calls = mockFetch({})
    renderLogin()
    fireEvent.click(screen.getByRole('button', { name: 'Forgot PIN?' }))
    fireEvent.change(screen.getByLabelText('DOD ID'), { target: { value: '12345' } })
    fireEvent.click(screen.getByRole('button', { name: 'Send code' }))
    expect(screen.getByRole('alert').textContent).toBe('DOD ID must be exactly 10 digits')
    expect(calls).toHaveLength(0)
  })
})
