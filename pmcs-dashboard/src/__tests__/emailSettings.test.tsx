import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, fireEvent, cleanup, within, waitFor } from '@testing-library/react'
import { EmailSettings, CODE_CAP_MESSAGE } from '../components/EmailSettings'
import { signOut } from '../lib/api'
import { baseProfile, fakeToken, json, mockFetch, TOKEN_KEY, unitsValue, WithUnits } from './helpers'
import type { Profile } from '../types/database'

const unconfirmed: Profile = { ...baseProfile, email: 'terry@example.com', email_verified_at: null }

function renderEmail(profile: Profile) {
  const value = unitsValue({ profile })
  render(
    <WithUnits value={value}>
      <EmailSettings profile={profile} />
    </WithUnits>,
  )
  return value
}

describe('settings: email', () => {
  beforeEach(() => {
    localStorage.clear()
    localStorage.setItem(TOKEN_KEY, fakeToken())
  })
  afterEach(() => {
    cleanup()
    signOut()
    vi.unstubAllGlobals()
  })

  it('confirms an unconfirmed email with the emailed code and updates the profile', async () => {
    const calls = mockFetch({
      'POST /me/email/verify': () => json({ ...unconfirmed, email_verified_at: '2026-10-01T00:00:00Z' }),
    })
    const value = renderEmail(unconfirmed)
    const section = within(screen.getByTestId('email-settings'))
    expect(section.getByTestId('current-email').textContent).toBe('terry@example.com')
    expect(section.getByText('Not confirmed')).toBeTruthy()

    fireEvent.change(section.getByLabelText('Confirmation code'), { target: { value: '12 34 56' } })
    fireEvent.click(section.getByRole('button', { name: 'Confirm' }))
    await waitFor(() => expect(value.applyProfile).toHaveBeenCalled())
    expect(calls[0].body).toEqual({ code: '123456' })
    expect(value.applyProfile).toHaveBeenCalledWith(expect.objectContaining({ email: 'terry@example.com', email_verified_at: '2026-10-01T00:00:00Z' }))
    expect(section.getByRole('status').textContent).toContain('Email confirmed')
  })

  it('shows a wrong-code error and points to "Send a new code" when the code expired', async () => {
    const calls = mockFetch({
      'POST /me/email/verify': () => json({ error: 'That code has expired or was already used. Request a new one.', code: 'CODE_EXPIRED' }, 400),
      'POST /me/email/resend': () => json({ ok: true }),
    })
    const value = renderEmail(unconfirmed)
    fireEvent.change(screen.getByLabelText('Confirmation code'), { target: { value: '654321' } })
    fireEvent.click(screen.getByRole('button', { name: 'Confirm' }))
    expect((await screen.findByRole('alert')).textContent).toContain('Send a new code')
    expect(value.applyProfile).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: 'Send a new code' }))
    expect((await screen.findByRole('status')).textContent).toContain('We sent a new code to terry@example.com')
    expect(calls.map((c) => c.path)).toEqual(['/me/email/verify', '/me/email/resend'])
  })

  it('adds an email (lower-cased) and reports when the hourly code cap was hit', async () => {
    const calls = mockFetch({
      'PUT /me/email': () => json({ ...baseProfile, email: 'terry@example.com', email_verified_at: null, email_code_sent: false }),
    })
    const value = renderEmail({ ...baseProfile, email: null, email_verified_at: null })
    fireEvent.change(screen.getByLabelText('Email address'), { target: { value: 'not-an-email' } })
    fireEvent.click(screen.getByRole('button', { name: 'Add email' }))
    expect(screen.getByRole('alert').textContent).toBe('Enter a valid email address')
    expect(calls).toHaveLength(0)

    fireEvent.change(screen.getByLabelText('Email address'), { target: { value: ' Terry@Example.com ' } })
    fireEvent.click(screen.getByRole('button', { name: 'Add email' }))
    expect((await screen.findByRole('status')).textContent).toBe(CODE_CAP_MESSAGE)
    expect(calls[0].body).toEqual({ email: 'terry@example.com' })
    const applied = vi.mocked(value.applyProfile).mock.calls[0][0]
    expect(applied).toMatchObject({ email: 'terry@example.com', email_verified_at: null })
    expect(applied).not.toHaveProperty('email_code_sent')
  })

  it('shows a confirmed email and removes it after confirmation', async () => {
    mockFetch({ 'DELETE /me/email': () => json({ ...baseProfile, email: null, email_verified_at: null }) })
    const value = renderEmail({ ...unconfirmed, email_verified_at: '2026-10-01T00:00:00Z' })
    expect(screen.getByText('Confirmed')).toBeTruthy()
    expect(screen.queryByTestId('email-verify')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /Remove/ }))
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Remove email' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(value.applyProfile).toHaveBeenCalledWith(expect.objectContaining({ email: null, email_verified_at: null }))
  })
})
