import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { ClipboardCheck, CheckCircle2, AlertCircle } from 'lucide-react'
import { api, ApiError } from '../lib/api'
import { useLoader } from '../hooks/useLoader'
import { unitLabel, unitQuery, useUnits } from '../hooks/useUnits'
import {
  buildWeeklyCompliance,
  CURRENT_MAX_DAYS,
  DUE_SOON_MAX_DAYS,
  pmcsCompliance,
  weeklyWindowStart,
  type ComplianceStatus,
  type CompletedInspection,
} from '../lib/compliance'
import { formatDay, toDayKey } from '../lib/dates'
import { ErrorState, StaleBanner } from '../components/Feedback'
import { UnitSelector } from '../components/UnitSelector'
import type { Inspection, LastInspection, Vehicle } from '../types/database'

const WEEKS = 8
/** Requested row limit for the fallback 8-week inspection fetch. */
const INSPECTION_LIMIT = 5000

interface ComplianceData {
  vehicles: Vehicle[]
  lastInspections: LastInspection[]
  recent: CompletedInspection[]
  truncated: boolean
}

async function loadRecent(
  since: string,
  unit: string[] | undefined,
  signal: AbortSignal,
): Promise<{ recent: CompletedInspection[]; truncated: boolean }> {
  try {
    // Distinct (vehicle, day) pairs: small, and never truncated.
    const rows = await api<{ vehicle_id: string; day: string }[]>('GET', '/inspections/coverage', {
      query: { since, unit },
      signal,
    })
    return { recent: rows.map((r) => ({ vehicle_id: r.vehicle_id, completed_at: r.day })), truncated: false }
  } catch (err) {
    if (!(err instanceof ApiError && err.status === 404)) throw err
  }
  // Older API without /inspections/coverage: date-bounded, scoped inspection list.
  const recent = await api<Inspection[]>('GET', '/inspections', {
    query: { status: 'COMPLETED', since, unit, limit: INSPECTION_LIMIT },
    signal,
  })
  // The server may cap `limit` (1000) and older versions ignore `since`. A full
  // page that doesn't reach back to the window start means older weeks are incomplete.
  const oldest = recent.reduce<string | null>(
    (min, i) => (i.completed_at && (!min || toDayKey(i.completed_at) < min) ? toDayKey(i.completed_at) : min),
    null,
  )
  return { recent, truncated: recent.length >= 1000 && !!oldest && oldest >= since }
}

async function loadCompliance(unit: string[] | undefined, signal: AbortSignal): Promise<ComplianceData> {
  const since = weeklyWindowStart(new Date(), WEEKS)
  const [vehicles, lastInspections, coverage] = await Promise.all([
    api<Vehicle[]>('GET', '/vehicles', { query: { unit }, signal }),
    api<LastInspection[]>('GET', '/vehicles/last-inspections', { query: { unit }, signal }),
    loadRecent(since, unit, signal),
  ])
  return { vehicles, lastInspections, ...coverage }
}

const BADGE: Record<ComplianceStatus, { label: string; cls: string }> = {
  current: { label: 'Current', cls: 'bg-accent-green/20 text-accent-green' },
  due_soon: { label: 'Due Soon', cls: 'bg-accent-amber/20 text-accent-amber' },
  overdue: { label: 'Overdue', cls: 'bg-accent-red/20 text-accent-red' },
}

const DAYS_CLS: Record<ComplianceStatus, string> = {
  current: 'text-accent-green',
  due_soon: 'text-accent-amber',
  overdue: 'text-accent-red font-semibold',
}

export function PmcsCompliance() {
  const navigate = useNavigate()
  const { units, unitsKey, unitNames, selectedUnit, loading: unitsLoading } = useUnits()
  const key = unitsLoading ? null : `compliance|${unitsKey}|${selectedUnit}`
  const { data, error, loading, updatedAt, reload } = useLoader(key, (signal) =>
    loadCompliance(unitQuery(selectedUnit), signal),
  )

  const view = useMemo(() => {
    if (!data) return null
    const now = new Date()
    const last = new Map(data.lastInspections.map((l) => [l.vehicle_id, l.last_completed_at]))
    const rows = data.vehicles.map((v) => {
      const lastDate = last.get(v.id) ?? null
      return { id: v.id, bumper: v.bumper_number ?? '---', type: v.vehicle_type ?? '---', unit: v.unit, lastDate, ...pmcsCompliance(lastDate, now) }
    })
    const weekly = buildWeeklyCompliance(
      data.vehicles.map((v) => v.id),
      data.recent,
      now,
      WEEKS,
    ).map((p) => ({ ...p, week: formatDay(p.weekEnd, { month: 'short', day: 'numeric' }) }))
    return { rows, weekly }
  }, [data])

  if (loading) return <div className="text-text-secondary">Loading compliance data...</div>
  if (!view) return <ErrorState title="Couldn't load compliance data" message={error ?? 'Unknown error'} onRetry={reload} />

  const { rows, weekly } = view
  const totalCount = rows.length
  const currentCount = rows.filter((r) => r.status === 'current').length
  const overdueCount = rows.filter((r) => r.status === 'overdue').length
  const multiUnit = units.length > 1

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-text-primary">PMCS Compliance</h1>
          <p className="text-text-secondary mt-1">
            {selectedUnit ? `${unitLabel(selectedUnit, unitNames)} · ` : ''}
            Current ≤{CURRENT_MAX_DAYS} days · Due soon {CURRENT_MAX_DAYS + 1}–{DUE_SOON_MAX_DAYS} days · Overdue &gt;{DUE_SOON_MAX_DAYS} days or never
          </p>
        </div>
        <UnitSelector />
      </div>

      {error && <StaleBanner message={error} updatedAt={updatedAt} onRetry={reload} />}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-bg-secondary border border-border rounded-xl p-6 flex items-center gap-4">
          <ClipboardCheck className="w-10 h-10 text-accent-blue" />
          <div>
            <p className="font-display text-3xl font-bold text-text-primary" data-testid="compliance-current">
              {currentCount}/{totalCount}
            </p>
            <p className="text-sm text-text-secondary">Inspected in last {CURRENT_MAX_DAYS} days</p>
          </div>
        </div>
        <div className="bg-bg-secondary border border-border rounded-xl p-6 flex items-center gap-4">
          <CheckCircle2 className="w-10 h-10 text-accent-green" />
          <div>
            <p className="font-display text-3xl font-bold text-accent-green" data-testid="compliance-rate">
              {totalCount > 0 ? Math.round((currentCount / totalCount) * 100) : 0}%
            </p>
            <p className="text-sm text-text-secondary">Compliance Rate</p>
          </div>
        </div>
        <div className="bg-bg-secondary border border-border rounded-xl p-6 flex items-center gap-4">
          <AlertCircle className="w-10 h-10 text-accent-red" />
          <div>
            <p className="font-display text-3xl font-bold text-accent-red" data-testid="compliance-overdue">{overdueCount}</p>
            <p className="text-sm text-text-secondary">Overdue Vehicles</p>
          </div>
        </div>
      </div>

      {weekly.length > 0 && (
        <div className="bg-bg-secondary border border-border rounded-xl p-6" data-testid="weekly-chart">
          <h2 className="font-display text-lg font-semibold text-text-primary mb-1">Weekly Compliance (8 Weeks)</h2>
          <p className="text-xs text-text-secondary mb-4">
            Share of vehicles with at least one completed PMCS in each 7-day window.
            {data?.truncated && ' Too many inspections to load in full: older weeks may be under-counted.'}
          </p>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={weekly}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="week" stroke="#94A3B8" fontSize={12} />
              <YAxis stroke="#94A3B8" fontSize={12} domain={[0, 100]} tickFormatter={(val: number) => `${val}%`} />
              <Tooltip
                contentStyle={{ backgroundColor: '#1A1F25', border: '1px solid #334155', borderRadius: '8px' }}
                labelStyle={{ color: '#F1F5F9' }}
                itemStyle={{ color: '#3B82F6' }}
                formatter={(value: unknown, _name: unknown, item: { payload?: { inspected: number; total: number } }) => [
                  `${value}% (${item.payload?.inspected ?? 0}/${item.payload?.total ?? 0})`,
                  'Compliance',
                ]}
              />
              <Bar dataKey="pct" fill="#3B82F6" radius={[4, 4, 0, 0]} isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="bg-bg-secondary border border-border rounded-xl overflow-x-auto">
        <table className="w-full" data-testid="compliance-table">
          <thead>
            <tr className="text-left text-xs text-text-secondary uppercase tracking-wider">
              <th className="px-6 py-3">Vehicle</th>
              {multiUnit && <th className="px-6 py-3">Unit</th>}
              <th className="px-6 py-3">Type</th>
              <th className="px-6 py-3">Last Inspection</th>
              <th className="px-6 py-3">Days Since</th>
              <th className="px-6 py-3">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((r) => (
              <tr key={r.id} onClick={() => navigate(`/vehicle/${r.id}`)} className="hover:bg-bg-tertiary cursor-pointer transition-colors">
                <td className="px-6 py-4 font-display text-sm font-semibold text-text-primary">{r.bumper}</td>
                {multiUnit && <td className="px-6 py-4 text-sm text-text-secondary">{r.unit ?? '---'}</td>}
                <td className="px-6 py-4 text-sm text-text-secondary">{r.type}</td>
                <td className="px-6 py-4 text-sm text-text-secondary">{r.lastDate ? formatDay(r.lastDate) : 'Never'}</td>
                <td className="px-6 py-4 text-sm">
                  <span className={DAYS_CLS[r.status]}>{r.daysSince !== null ? r.daysSince : 'N/A'}</span>
                </td>
                <td className="px-6 py-4">
                  <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${BADGE[r.status].cls}`}>{BADGE[r.status].label}</span>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={multiUnit ? 6 : 5} className="px-6 py-12 text-center text-text-secondary">
                  No vehicles found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
