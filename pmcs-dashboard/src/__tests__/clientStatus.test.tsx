import { describe, it, expect } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import { ClientStatusPanel } from '../components/ClientStatusPanel'
import type { ClientStatus } from '../types/database'

const now = new Date('2026-10-12T15:00:00Z')

function row(over: Partial<ClientStatus>): ClientStatus {
  return {
    user_id: 'u1',
    rank: 'SPC',
    last_name: 'Doe',
    first_name: 'Jane',
    unit: 'WXYZA0',
    unsent_count: 2,
    failed_count: 0,
    last_error: null,
    oldest_unsent_at: '2026-10-12T12:00:00Z',
    reported_at: '2026-10-12T14:30:00Z',
    app_version: '1.4.0',
    stale: 0,
    ...over,
  }
}

describe('ClientStatusPanel', () => {
  it('renders nothing when no soldier has unsent inspections', () => {
    const { container } = render(<ClientStatusPanel rows={[]} unitNames={{}} now={now} />)
    expect(container.innerHTML).toBe('')
  })

  it('shows a singular heading and the help line', () => {
    render(<ClientStatusPanel rows={[row({})]} unitNames={{}} now={now} />)
    expect(screen.getByRole('heading', { name: "1 soldier has inspections that haven't reached the server" })).toBeTruthy()
    expect(screen.getByText('Ask them to open PMCS Pro on that phone while connected.')).toBeTruthy()
  })

  it('lists each soldier with counts, age, truncated error, report time and a stale badge', () => {
    const longError = 'Network request failed: '.repeat(10).trim()
    render(
      <ClientStatusPanel
        rows={[
          row({}),
          row({ user_id: 'u2', rank: 'SGT', last_name: 'Roe', first_name: 'Rick', unsent_count: 5, failed_count: 3, last_error: longError, oldest_unsent_at: '2026-10-09T15:00:00Z', stale: 1 }),
        ]}
        unitNames={{ WXYZA0: 'Test Company' }}
        now={now}
      />,
    )
    expect(screen.getByRole('heading', { name: "2 soldiers have inspections that haven't reached the server" })).toBeTruthy()
    const rows = screen.getAllByTestId('client-status-row')
    // Oldest unsent first
    const roe = within(rows[0])
    expect(roe.getByText('SGT Roe, Rick')).toBeTruthy()
    expect(roe.getByText('5')).toBeTruthy()
    expect(roe.getByText('3')).toBeTruthy()
    expect(roe.getByText('3 d')).toBeTruthy()
    expect(roe.getByTestId('stale-badge').textContent).toBe('stale')
    const err = roe.getByTitle(longError)
    expect(err.textContent!.length).toBeLessThanOrEqual(60)
    expect(err.textContent!.endsWith('…')).toBe(true)
    expect(roe.getByText('WXYZA0 (Test Company)')).toBeTruthy()

    const doe = within(rows[1])
    expect(doe.getByText('SPC Doe, Jane')).toBeTruthy()
    expect(doe.getByText('3 h')).toBeTruthy()
    expect(doe.queryByTestId('stale-badge')).toBeNull()
    expect(doe.getByText(new Date('2026-10-12T14:30:00Z').toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }))).toBeTruthy()
  })
})
