import { useRef, useState } from 'react'
import { ScrollText, RefreshCw, Loader2, X } from 'lucide-react'
import { api, errorMessage, isAbortedError } from '../../lib/api'
import { useLoader } from '../../hooks/useLoader'
import { formatDateTime, localDayEndIso, localDayStartIso } from '../../lib/dates'
import { AUDIT_ACTION_PREFIXES, KNOWN_AUDIT_ACTIONS, describeAction, formatAuditDetails, rawDetails } from '../../lib/audit'
import { isValidUic, normalizeUic } from '../../lib/uic'
import { UicInput } from '../../components/UicInput'
import { ActionError, ErrorState } from '../../components/Feedback'
import type { AuditEntry, AuditPage } from '../../types/database'

const PAGE_SIZE = 50

const inputCls =
  'w-full px-3 py-2 bg-bg-tertiary border border-border rounded-lg text-sm text-text-primary placeholder:text-text-secondary/50 focus:outline-none focus:ring-1 focus:ring-accent-blue'

interface Filters {
  unit: string
  actorId: string
  action: string
  since: string
  until: string
}

function auditQuery(f: Filters, before?: string | number | null) {
  return {
    unit: f.unit || undefined,
    actor_id: f.actorId || undefined,
    action: f.action || undefined,
    since: f.since ? localDayStartIso(f.since) : undefined,
    until: f.until ? localDayEndIso(f.until) : undefined,
    limit: PAGE_SIZE,
    before: before ?? undefined,
  }
}

function actorLabel(e: AuditEntry): string {
  const last4 = e.actor_dod_last4 ? `…${e.actor_dod_last4}` : ''
  if (e.actor_name) return last4 ? `${e.actor_name} (${last4})` : e.actor_name
  return last4 || (e.actor_id ? 'Unknown user' : 'System')
}

function AuditDetails({ details }: { details: unknown }) {
  const lines = formatAuditDetails(details)
  const raw = rawDetails(details)
  if (lines.length === 0) return <span className="text-text-secondary">---</span>
  return (
    <div className="space-y-1">
      <dl className="text-xs grid grid-cols-[auto_1fr] gap-x-2 gap-y-0.5">
        {lines.map((l, i) => (
          <div key={i} className="contents">
            <dt className="text-text-secondary">{l.label}</dt>
            <dd className="text-text-primary break-words">{l.value}</dd>
          </div>
        ))}
      </dl>
      <details className="text-xs">
        <summary className="cursor-pointer text-text-secondary hover:text-text-primary">Raw JSON</summary>
        <pre className="mt-1 p-2 bg-bg-tertiary rounded text-[11px] text-text-secondary whitespace-pre-wrap break-all max-w-md">{raw}</pre>
      </details>
    </div>
  )
}

export function AdminAudit() {
  const [unitInput, setUnitInput] = useState('')
  const [actor, setActor] = useState<{ id: string; label: string } | null>(null)
  const [action, setAction] = useState('')
  const [since, setSince] = useState('')
  const [until, setUntil] = useState('')

  const unitNorm = normalizeUic(unitInput)
  const unit = isValidUic(unitNorm) ? unitNorm : ''
  const rangeError = since && until && since > until ? 'The start date is after the end date.' : null
  const filters: Filters = { unit, actorId: actor?.id ?? '', action, since: rangeError ? '' : since, until: rangeError ? '' : until }
  const key = `audit|${filters.unit}|${filters.actorId}|${filters.action}|${filters.since}|${filters.until}`

  // Not polled: new entries would shift the first page under "Load more". Use Refresh.
  const first = useLoader(key, (signal) => api<AuditPage>('GET', '/admin/audit', { query: auditQuery(filters), signal }), { enabled: false })

  const [more, setMore] = useState<{ key: string; items: AuditEntry[]; next: string | number | null }>({ key: '', items: [], next: null })
  const [loadingMore, setLoadingMore] = useState(false)
  const loadingMoreRef = useRef(false)
  const [moreError, setMoreError] = useState<string | null>(null)

  const extra = more.key === key ? more : null
  const items = first.data ? [...first.data.items, ...(extra?.items ?? [])] : []
  const next = extra ? extra.next : first.data?.next_before ?? null

  async function loadMore() {
    if (loadingMoreRef.current || next == null) return
    loadingMoreRef.current = true
    setLoadingMore(true)
    setMoreError(null)
    const forKey = key
    try {
      const page = await api<AuditPage>('GET', '/admin/audit', { query: auditQuery(filters, next) })
      setMore((prev) => ({
        key: forKey,
        items: [...(prev.key === forKey ? prev.items : []), ...page.items],
        next: page.next_before ?? null,
      }))
    } catch (err) {
      if (!isAbortedError(err)) setMoreError(errorMessage(err))
    } finally {
      loadingMoreRef.current = false
      setLoadingMore(false)
    }
  }

  function refresh() {
    setMore({ key: '', items: [], next: null })
    setMoreError(null)
    first.reload()
  }

  return (
    <div className="space-y-4">
      <div className="bg-bg-secondary border border-border rounded-xl p-4 grid grid-cols-2 lg:grid-cols-5 gap-3 items-start" role="search" aria-label="Audit log filters">
        <div>
          <label htmlFor="audit-unit" className="block text-xs text-text-secondary mb-1">Unit</label>
          <UicInput id="audit-unit" value={unitInput} onChange={setUnitInput} placeholder="Any unit" className={`${inputCls} font-display`} />
        </div>
        <div>
          <label htmlFor="audit-action" className="block text-xs text-text-secondary mb-1">Action</label>
          <select id="audit-action" value={action} onChange={(e) => setAction(e.target.value)} className={inputCls}>
            <option value="">All actions</option>
            {AUDIT_ACTION_PREFIXES.map((p) => (
              <optgroup key={p} label={p}>
                <option value={p}>All {p}* actions</option>
                {KNOWN_AUDIT_ACTIONS.filter((a) => a.startsWith(p)).map((a) => (
                  <option key={a} value={a}>{a}</option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="audit-since" className="block text-xs text-text-secondary mb-1">From (local date)</label>
          <input id="audit-since" type="date" value={since} max={until || undefined} onChange={(e) => setSince(e.target.value)} className={inputCls} />
        </div>
        <div>
          <label htmlFor="audit-until" className="block text-xs text-text-secondary mb-1">To (local date)</label>
          <input id="audit-until" type="date" value={until} min={since || undefined} onChange={(e) => setUntil(e.target.value)} className={inputCls} />
        </div>
        <div className="flex flex-col gap-2">
          {actor && (
            <span className="inline-flex items-center gap-1 self-start pl-3 pr-1 py-1 bg-bg-tertiary rounded-full text-xs text-text-primary">
              Actor: {actor.label}
              <button type="button" onClick={() => setActor(null)} aria-label="Clear actor filter" className="p-1 rounded-full hover:text-accent-red">
                <X className="w-3 h-3" />
              </button>
            </span>
          )}
          <button type="button" onClick={refresh} className="self-start flex items-center gap-2 px-3 py-2 bg-bg-tertiary rounded-lg text-sm text-text-primary hover:bg-bg-tertiary/70">
            <RefreshCw className="w-4 h-4" /> Refresh
          </button>
        </div>
      </div>
      {rangeError && <p role="alert" className="text-accent-amber text-sm">{rangeError} The date filter is ignored until it's fixed.</p>}

      {first.loading ? (
        <p className="text-text-secondary">Loading audit log...</p>
      ) : !first.data ? (
        <ErrorState title="Couldn't load the audit log" message={first.error ?? 'Unknown error'} onRetry={refresh} />
      ) : (
        <div className="bg-bg-secondary border border-border rounded-xl">
          <div className="flex items-center gap-3 p-6 border-b border-border">
            <ScrollText className="w-5 h-5 text-text-secondary" />
            <h2 className="font-display text-lg font-semibold text-text-primary">Audit log</h2>
            <span className="text-sm text-text-secondary">({items.length}{next != null ? '+' : ''}, newest first)</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full" data-testid="audit-table">
              <thead>
                <tr className="text-left text-xs text-text-secondary uppercase tracking-wider">
                  <th className="px-4 py-3">Time</th>
                  <th className="px-4 py-3">Actor</th>
                  <th className="px-4 py-3">Unit</th>
                  <th className="px-4 py-3">Action</th>
                  <th className="px-4 py-3">Target</th>
                  <th className="px-4 py-3">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border align-top">
                {items.map((e) => (
                  <tr key={e.id} data-testid="audit-row">
                    <td className="px-4 py-3 text-xs text-text-secondary whitespace-nowrap">{formatDateTime(e.at)}</td>
                    <td className="px-4 py-3 text-sm text-text-primary">
                      {e.actor_id ? (
                        <button
                          type="button"
                          onClick={() => setActor({ id: e.actor_id!, label: actorLabel(e) })}
                          title="Show only this actor"
                          className="text-left hover:underline"
                        >
                          {actorLabel(e)}
                        </button>
                      ) : (
                        actorLabel(e)
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs font-display text-text-secondary">{e.unit ?? '---'}</td>
                    <td className="px-4 py-3 text-sm">
                      <span className="text-text-primary">{describeAction(e.action)}</span>
                      <span className="block text-[11px] font-display text-text-secondary">{e.action}</span>
                    </td>
                    <td className="px-4 py-3 text-xs text-text-secondary">
                      {e.target_type ? (
                        <>
                          {e.target_type}
                          {e.target_id && <span className="block font-display break-all" title={e.target_id}>{e.target_id}</span>}
                        </>
                      ) : (
                        '---'
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <AuditDetails details={e.details} />
                    </td>
                  </tr>
                ))}
                {items.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-text-secondary">No audit entries match these filters</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="p-4 border-t border-border space-y-3">
            <ActionError message={moreError} onDismiss={() => setMoreError(null)} />
            {next != null ? (
              <button type="button" onClick={loadMore} disabled={loadingMore}
                className="flex items-center gap-2 px-4 py-2 bg-bg-tertiary rounded-lg text-sm text-text-primary hover:bg-bg-tertiary/70 disabled:opacity-50">
                {loadingMore && <Loader2 className="w-4 h-4 animate-spin" />}
                Load more
              </button>
            ) : (
              items.length > 0 && <p className="text-xs text-text-secondary">End of log for these filters.</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
