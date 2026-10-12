import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { AdminGuard } from '../components/AdminGuard'
import { DashboardLayout } from '../components/DashboardLayout'
import { baseProfile, unitsValue, WithUnits } from './helpers'

function renderAdmin(value: ReturnType<typeof unitsValue>) {
  return render(
    <WithUnits value={value}>
      <MemoryRouter initialEntries={['/admin/users']}>
        <Routes>
          <Route path="/admin" element={<AdminGuard />}>
            <Route path="users" element={<p>users page</p>} />
          </Route>
        </Routes>
      </MemoryRouter>
    </WithUnits>,
  )
}

describe('admin guard', () => {
  afterEach(cleanup)

  it('shows a 403 message to non-admins and never renders the admin page', () => {
    renderAdmin(unitsValue())
    expect(screen.getByTestId('admin-forbidden').textContent).toContain('403')
    expect(screen.queryByText('users page')).toBeNull()
  })

  it('renders the admin section for admins', () => {
    renderAdmin(unitsValue({ profile: { ...baseProfile, role: 'admin' } }))
    expect(screen.getByText('users page')).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Audit log' })).toBeTruthy()
    expect(screen.queryByTestId('admin-forbidden')).toBeNull()
  })

  it('waits for the profile instead of flashing a 403', () => {
    renderAdmin(unitsValue({ profile: null, loading: true }))
    expect(screen.queryByTestId('admin-forbidden')).toBeNull()
    expect(screen.queryByText('users page')).toBeNull()
  })

  it('shows the Admin nav item only to admins', () => {
    const nav = (value: ReturnType<typeof unitsValue>) =>
      render(
        <WithUnits value={value}>
          <MemoryRouter>
            <DashboardLayout>
              <p>content</p>
            </DashboardLayout>
          </MemoryRouter>
        </WithUnits>,
      )
    nav(unitsValue())
    expect(screen.queryByRole('link', { name: 'Admin' })).toBeNull()
    cleanup()
    nav(unitsValue({ profile: { ...baseProfile, role: 'admin' } }))
    expect(screen.getByRole('link', { name: 'Admin' }).getAttribute('href')).toBe('/admin')
  })
})
