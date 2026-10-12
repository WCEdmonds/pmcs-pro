import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, fireEvent, cleanup, within, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { AdminUsers } from '../pages/admin/AdminUsers'
import { signOut } from '../lib/api'
import { baseProfile, fakeToken, json, mockFetch, TOKEN_KEY, unitsValue, WithUnits } from './helpers'
import type { AdminUser } from '../types/database'

const soldier: AdminUser = {
  id: 'u2',
  dod_last4: '4321',
  rank: 'PVT',
  first_name: 'Pat',
  last_name: 'Private',
  mi: null,
  unit: 'WXYZA0',
  role: 'member',
  created_at: '2026-02-01T00:00:00Z',
  locked_until: new Date(Date.now() + 10 * 60_000).toISOString(),
  must_change_pin: 1,
}
const me: AdminUser = { ...soldier, id: 'u1', dod_last4: '0001', rank: 'CPT', first_name: 'Terry', last_name: 'Tester', role: 'admin', locked_until: null, must_change_pin: 0 }

function renderUsers() {
  return render(
    <WithUnits value={unitsValue({ profile: { ...baseProfile, role: 'admin' } })}>
      <MemoryRouter>
        <AdminUsers />
      </MemoryRouter>
    </WithUnits>,
  )
}

describe('admin users', () => {
  beforeEach(() => {
    localStorage.clear()
    localStorage.setItem(TOKEN_KEY, fakeToken())
  })
  afterEach(() => {
    cleanup()
    signOut()
    vi.unstubAllGlobals()
  })

  it('shows lock and must-change-PIN state; reset PIN is confirmed, then the temp PIN is shown once', async () => {
    const calls = mockFetch({
      'GET /admin/users': () => json([me, soldier]),
      'POST /admin/users/u2/reset-pin': () => json({ temp_pin: '824613' }),
    })
    renderUsers()
    const row = within(await screen.findByTestId('user-row-u2'))
    expect(row.getByText(/Locked until/)).toBeTruthy()
    expect(row.getByText('Must change PIN')).toBeTruthy()
    expect(calls[0].url.searchParams.get('limit')).toBe('200')

    // Accessible confirm dialog: role=dialog, focus on Cancel, Escape closes without acting.
    fireEvent.click(row.getByRole('button', { name: /Reset PIN/ }))
    const dialog = screen.getByRole('dialog')
    expect(dialog.getAttribute('aria-modal')).toBe('true')
    expect(document.activeElement?.textContent).toBe('Cancel')
    fireEvent.keyDown(dialog, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(calls.some((c) => c.method === 'POST')).toBe(false)

    fireEvent.click(row.getByRole('button', { name: /Reset PIN/ }))
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Reset PIN' }))
    const pinDialog = await screen.findByTestId('temp-pin-dialog')
    expect(within(pinDialog).getByTestId('temp-pin').textContent).toBe('824613')
    expect(pinDialog.textContent).toContain('Give this to the soldier in person. They must set a new PIN on next sign-in.')
    fireEvent.click(within(pinDialog).getByRole('button', { name: 'Done' }))
    expect(screen.queryByText('824613')).toBeNull()
  })

  it('keeps the dialog open and shows the server error when demoting the last admin', async () => {
    mockFetch({
      'GET /admin/users': () => json([me]),
      'POST /admin/users/u1/role': () => json({ error: 'Cannot remove the last admin' }, 409),
    })
    renderUsers()
    const row = within(await screen.findByTestId('user-row-u1'))
    fireEvent.click(row.getByRole('button', { name: /Remove admin/ }))
    const dialog = screen.getByRole('dialog')
    fireEvent.click(within(dialog).getByRole('button', { name: 'Remove admin' }))
    await waitFor(() => expect(within(dialog).getByRole('alert').textContent).toBe('Cannot remove the last admin'))
    expect(screen.getByRole('dialog')).toBeTruthy()
  })

  it('validates the new UIC before moving a user', async () => {
    const calls = mockFetch({
      'GET /admin/users': () => json([soldier]),
      'PATCH /admin/users/u2': () => json({ ok: true }),
    })
    renderUsers()
    const row = within(await screen.findByTestId('user-row-u2'))
    fireEvent.click(row.getByRole('button', { name: /Move unit/ }))
    const dialog = within(screen.getByRole('dialog'))
    const move = dialog.getByRole('button', { name: 'Move' }) as HTMLButtonElement
    fireEvent.change(dialog.getByLabelText('New UIC'), { target: { value: 'WXY' } })
    expect(move.disabled).toBe(true)
    fireEvent.change(dialog.getByLabelText('New UIC'), { target: { value: 'wxyzb1' } })
    expect(move.disabled).toBe(false)
    fireEvent.click(move)
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(calls.find((c) => c.method === 'PATCH')!.body).toEqual({ unit: 'WXYZB1' })
  })
})
