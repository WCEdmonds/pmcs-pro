import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, fireEvent, cleanup, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { DashboardLayout } from '../components/DashboardLayout'
import { EMAIL_PROMPT_SNOOZE_MS } from '../components/EmailPromptBanner'
import { baseProfile, unitsValue, WithUnits } from './helpers'
import type { Profile } from '../types/database'

function renderLayout(profile: Profile, path = '/') {
  return render(
    <WithUnits value={unitsValue({ profile })}>
      <MemoryRouter initialEntries={[path]}>
        <DashboardLayout>
          <p>content</p>
        </DashboardLayout>
      </MemoryRouter>
    </WithUnits>,
  )
}

const noEmail: Profile = { ...baseProfile, email: null, email_verified_at: null }

describe('add-email prompt', () => {
  beforeEach(() => {
    localStorage.clear()
  })
  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it('asks a user without an email to add one, linking to Settings → Email', () => {
    renderLayout(noEmail)
    const banner = within(screen.getByTestId('email-prompt'))
    expect(banner.getByRole('link', { name: 'Add email in Settings' }).getAttribute('href')).toBe('/settings#email')
  })

  it('asks to confirm an unconfirmed email, and stays hidden once confirmed or on Settings', () => {
    renderLayout({ ...baseProfile, email: 'terry@example.com', email_verified_at: null })
    expect(screen.getByRole('link', { name: 'Confirm email in Settings' })).toBeTruthy()
    cleanup()
    renderLayout({ ...baseProfile, email: 'terry@example.com', email_verified_at: '2026-10-01T00:00:00Z' })
    expect(screen.queryByTestId('email-prompt')).toBeNull()
    cleanup()
    renderLayout(noEmail, '/settings')
    expect(screen.queryByTestId('email-prompt')).toBeNull()
    cleanup()
    // Older API without email fields: no prompt.
    renderLayout(baseProfile)
    expect(screen.queryByTestId('email-prompt')).toBeNull()
  })

  it('"Remind me later" hides it for 7 days', () => {
    const now = Date.now()
    vi.spyOn(Date, 'now').mockReturnValue(now)
    renderLayout(noEmail)
    fireEvent.click(screen.getByRole('button', { name: 'Remind me later' }))
    expect(screen.queryByTestId('email-prompt')).toBeNull()
    cleanup()

    renderLayout(noEmail)
    expect(screen.queryByTestId('email-prompt')).toBeNull()
    cleanup()

    vi.spyOn(Date, 'now').mockReturnValue(now + EMAIL_PROMPT_SNOOZE_MS + 1)
    renderLayout(noEmail)
    expect(screen.getByTestId('email-prompt')).toBeTruthy()
  })

  it('still dismisses when storage is unavailable', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    renderLayout(noEmail)
    fireEvent.click(screen.getByRole('button', { name: 'Remind me later' }))
    expect(screen.queryByTestId('email-prompt')).toBeNull()
  })
})
