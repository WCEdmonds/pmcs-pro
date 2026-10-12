import { CloudOff } from 'lucide-react'
import { formatAge, formatDateTime } from '../lib/dates'
import { displayName, flag, truncate } from '../lib/people'
import { unitLabel } from '../hooks/useUnits'
import type { ClientStatus } from '../types/database'

interface ClientStatusPanelProps {
  rows: ClientStatus[]
  unitNames: Record<string, string>
  now?: Date
}

/**
 * Soldiers whose phones report inspections that haven't reached the server
 * (GET /client-status). Renders nothing when there are none.
 */
export function ClientStatusPanel({ rows, unitNames, now = new Date() }: ClientStatusPanelProps) {
  if (rows.length === 0) return null
  const n = rows.length
  const sorted = [...rows].sort((a, b) => (a.oldest_unsent_at ?? '￿').localeCompare(b.oldest_unsent_at ?? '￿'))

  return (
    <section className="bg-bg-secondary border border-accent-amber/40 rounded-xl" data-testid="client-status-panel" aria-labelledby="client-status-title">
      <div className="p-6 border-b border-border">
        <div className="flex items-center gap-3">
          <CloudOff className="w-5 h-5 text-accent-amber" />
          <h2 id="client-status-title" className="font-display text-lg font-semibold text-text-primary">
            {n} {n === 1 ? 'soldier has' : 'soldiers have'} inspections that haven't reached the server
          </h2>
        </div>
        <p className="text-sm text-text-secondary mt-1">Ask them to open PMCS Pro on that phone while connected.</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full" data-testid="client-status-table">
          <thead>
            <tr className="text-left text-xs text-text-secondary uppercase tracking-wider">
              <th className="px-6 py-3">Soldier</th>
              <th className="px-6 py-3">Unit</th>
              <th className="px-6 py-3">Unsent</th>
              <th className="px-6 py-3">Failed</th>
              <th className="px-6 py-3">Oldest</th>
              <th className="px-6 py-3">Last error</th>
              <th className="px-6 py-3">Last report</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {sorted.map((r) => (
              <tr key={r.user_id} data-testid="client-status-row">
                <td className="px-6 py-3 text-sm text-text-primary">
                  {displayName(r) || 'Unknown soldier'}
                  {flag(r.stale) && (
                    <span
                      className="ml-2 px-2 py-0.5 rounded text-[11px] font-semibold bg-text-secondary/20 text-text-secondary"
                      title="This phone hasn't reported in a while, so these counts may be out of date"
                      data-testid="stale-badge"
                    >
                      stale
                    </span>
                  )}
                </td>
                <td className="px-6 py-3 text-sm text-text-secondary">{unitLabel(r.unit, unitNames)}</td>
                <td className="px-6 py-3 text-sm font-semibold text-accent-amber">{r.unsent_count}</td>
                <td className={`px-6 py-3 text-sm font-semibold ${r.failed_count > 0 ? 'text-accent-red' : 'text-text-secondary'}`}>{r.failed_count}</td>
                <td className="px-6 py-3 text-sm text-text-secondary" title={r.oldest_unsent_at ? formatDateTime(r.oldest_unsent_at) : undefined}>
                  {r.oldest_unsent_at ? formatAge(r.oldest_unsent_at, now) : '---'}
                </td>
                <td className="px-6 py-3 text-xs text-text-secondary max-w-xs" title={r.last_error ?? undefined}>
                  {r.last_error ? truncate(r.last_error, 60) : '---'}
                </td>
                <td className="px-6 py-3 text-xs text-text-secondary whitespace-nowrap">
                  {formatDateTime(r.reported_at)}
                  {r.app_version && <span className="block">v{r.app_version}</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
