import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { Truck, AlertCircle, CheckCircle2, Filter, Building2 } from 'lucide-react'
import { api, errorMessage, isAbortedError } from '../lib/api'
import { useLoader } from '../hooks/useLoader'
import { unitLabel, unitQuery, useUnits } from '../hooks/useUnits'
import { buildReadinessSeries, countStatuses, statusBucket } from '../lib/readiness'
import { pmcsCompliance } from '../lib/compliance'
import { addLocalDays, formatDay, localDateKey } from '../lib/dates'
import { ErrorState, StaleBanner, StatusBadge } from '../components/Feedback'
import { UnitSelector } from '../components/UnitSelector'
import type { Fault, LastInspection, Vehicle, VehicleStatusSnapshot } from '../types/database'

type FilterMode = 'all' | 'nmc' | 'pmc' | 'overdue'

const FILTER_LABELS: Record<FilterMode, string> = {
  all: 'All',
  nmc: 'NMC Only',
  pmc: 'PMC Only',
  overdue: 'PMCS Overdue',
}

const CHART_DAYS = 30

interface FleetData {
  vehicles: Vehicle[]
  openFaults: Pick<Fault, 'id' | 'vehicle_id'>[]
  lastInspections: LastInspection[]
  history: VehicleStatusSnapshot[] | null
  historyError: string | null
}

async function loadFleet(unit: string[] | undefined, signal: AbortSignal): Promise<FleetData> {
  const since = localDateKey(addLocalDays(new Date(), -(CHART_DAYS - 1)))
  const historyReq = api<VehicleStatusSnapshot[]>('GET', '/vehicle-status-history', { query: { since, unit }, signal })
    .then((h) => ({ history: h, historyError: null }))
    .catch((err: unknown) => {
      if (isAbortedError(err)) throw err
      return { history: null, historyError: errorMessage(err) }
    })
  const [vehicles, openFaults, lastInspections, hist] = await Promise.all([
    api<Vehicle[]>('GET', '/vehicles', { query: { unit }, signal }),
    api<Fault[]>('GET', '/faults', { query: { open: 1, unit }, signal }),
    api<LastInspection[]>('GET', '/vehicles/last-inspections', { query: { unit }, signal }),
    historyReq,
  ])
  return { vehicles, openFaults, lastInspections, ...hist }
}

export function FleetOverview() {
  const navigate = useNavigate()
  const { units, unitsKey, unitNames, selectedUnit, setSelectedUnit, loading: unitsLoading } = useUnits()
  const [filter, setFilter] = useState<FilterMode>('all')

  const key = unitsLoading ? null : `fleet|${unitsKey}|${selectedUnit}`
  const { data, error, loading, updatedAt, reload } = useLoader(key, (signal) => loadFleet(unitQuery(selectedUnit), signal))

  const view = useMemo(() => {
    if (!data) return null
    const now = new Date()
    const faultCounts = new Map<string, number>()
    for (const f of data.openFaults) faultCounts.set(f.vehicle_id, (faultCounts.get(f.vehicle_id) ?? 0) + 1)
    const last = new Map(data.lastInspections.map((l) => [l.vehicle_id, l.last_completed_at]))

    const rows = data.vehicles.map((v) => {
      const lastPmcs = last.get(v.id) ?? null
      return { ...v, openFaultCount: faultCounts.get(v.id) ?? 0, lastPmcs, compliance: pmcsCompliance(lastPmcs, now) }
    })

    const byUnit = new Map<string, typeof rows>()
    for (const r of rows) {
      const u = r.unit ?? '---'
      if (!byUnit.has(u)) byUnit.set(u, [])
      byUnit.get(u)!.push(r)
    }
    const unitBreakdown = [...byUnit.entries()]
      .map(([unit, list]) => {
        const c = countStatuses(list.map((r) => r.status))
        return {
          unit,
          total: list.length,
          ...c,
          pct: list.length ? Math.round((c.FMC / list.length) * 100) : 0,
          overdue: list.filter((r) => r.compliance.status === 'overdue').length,
        }
      })
      .sort((a, b) => a.unit.localeCompare(b.unit))

    return {
      rows,
      counts: countStatuses(rows.map((r) => r.status)),
      unitBreakdown,
      chart: data.history ? buildReadinessSeries(data.vehicles, data.history, now, CHART_DAYS) : [],
    }
  }, [data])

  if (loading) return <div className="text-text-secondary">Loading fleet data...</div>
  if (!view) {
    return <ErrorState title="Couldn't load fleet data" message={error ?? 'Unknown error'} onRetry={reload} />
  }

  const { rows, counts, unitBreakdown, chart } = view
  const totalCount = rows.length
  const fmcPct = totalCount > 0 ? Math.round((counts.FMC / totalCount) * 100) : 0
  const multiUnit = units.length > 1

  const filtered = rows.filter((v) => {
    if (filter === 'nmc') return statusBucket(v.status) === 'NMC'
    if (filter === 'pmc') return statusBucket(v.status) === 'PMC'
    if (filter === 'overdue') return v.compliance.status === 'overdue'
    return true
  })

  const chartStartsLate = chart.length > 0 && chart.length < CHART_DAYS

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-text-primary">Fleet Overview</h1>
          <p className="text-text-secondary mt-1">
            {selectedUnit ? unitLabel(selectedUnit, unitNames) : multiUnit ? `All my units (${units.length})` : 'Unit readiness at a glance'}
          </p>
        </div>
        <UnitSelector />
      </div>

      {error && <StaleBanner message={error} updatedAt={updatedAt} onRetry={reload} />}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4" data-testid="kpis">
        <div className="bg-bg-secondary border border-border rounded-xl p-6 flex flex-col items-center justify-center">
          <p className="text-text-secondary text-sm mb-2">Fleet Readiness</p>
          <p className="font-display text-5xl font-bold text-accent-green" data-testid="kpi-pct">{fmcPct}%</p>
          <p className="text-text-secondary text-sm mt-2">
            <span className="text-text-primary font-semibold">{counts.FMC}</span> / {totalCount} FMC
          </p>
        </div>
        <div className="bg-bg-secondary border border-border rounded-xl p-6 flex flex-col items-center justify-center">
          <CheckCircle2 className="w-8 h-8 text-accent-green mb-2" />
          <p className="font-display text-3xl font-bold text-accent-green" data-testid="kpi-fmc">{counts.FMC}</p>
          <p className="text-text-secondary text-sm mt-1">FMC</p>
        </div>
        <div className="bg-bg-secondary border border-border rounded-xl p-6 flex flex-col items-center justify-center">
          <AlertCircle className="w-8 h-8 text-accent-amber mb-2" />
          <p className="font-display text-3xl font-bold text-accent-amber" data-testid="kpi-pmc">{counts.PMC}</p>
          <p className="text-text-secondary text-sm mt-1">PMC</p>
        </div>
        <div className="bg-bg-secondary border border-border rounded-xl p-6 flex flex-col items-center justify-center">
          <AlertCircle className="w-8 h-8 text-accent-red mb-2" />
          <p className="font-display text-3xl font-bold text-accent-red" data-testid="kpi-nmc">{counts.NMC}</p>
          <p className="text-text-secondary text-sm mt-1">NMC</p>
        </div>
      </div>

      {multiUnit && !selectedUnit && unitBreakdown.length > 0 && (
        <div className="bg-bg-secondary border border-border rounded-xl" data-testid="unit-breakdown">
          <div className="flex items-center gap-3 p-6 border-b border-border">
            <Building2 className="w-5 h-5 text-text-secondary" />
            <h2 className="font-display text-lg font-semibold text-text-primary">Readiness by Unit</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-left text-xs text-text-secondary uppercase tracking-wider">
                  <th className="px-6 py-3">Unit</th>
                  <th className="px-6 py-3">Readiness</th>
                  <th className="px-6 py-3">FMC</th>
                  <th className="px-6 py-3">PMC</th>
                  <th className="px-6 py-3">NMC</th>
                  <th className="px-6 py-3">Vehicles</th>
                  <th className="px-6 py-3">PMCS Overdue</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {unitBreakdown.map((u) => (
                  <tr
                    key={u.unit}
                    onClick={() => setSelectedUnit(u.unit)}
                    className="hover:bg-bg-tertiary cursor-pointer transition-colors"
                  >
                    <td className="px-6 py-3 font-display text-sm font-semibold text-text-primary">{unitLabel(u.unit, unitNames)}</td>
                    <td className="px-6 py-3 font-display text-sm font-semibold text-accent-green">{u.pct}%</td>
                    <td className="px-6 py-3 text-sm text-text-secondary">{u.FMC}</td>
                    <td className="px-6 py-3 text-sm text-text-secondary">{u.PMC}</td>
                    <td className="px-6 py-3 text-sm text-text-secondary">{u.NMC}</td>
                    <td className="px-6 py-3 text-sm text-text-secondary">{u.total}</td>
                    <td className="px-6 py-3 text-sm text-text-secondary">{u.overdue}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {totalCount > 0 && (
        <div
          className="bg-bg-secondary border border-border rounded-xl p-6"
          data-testid="readiness-chart"
          data-first={chart.length ? JSON.stringify(chart[0]) : undefined}
          data-last={chart.length ? JSON.stringify(chart[chart.length - 1]) : undefined}
          data-points={chart.length}
        >
          <h2 className="font-display text-lg font-semibold text-text-primary mb-1">Vehicle Status Trend (30 Days)</h2>
          {data?.historyError ? (
            <p className="text-sm text-accent-red">Couldn't load status history: {data.historyError}</p>
          ) : (
            <>
              <p className="text-xs text-text-secondary mb-4">
                {chartStartsLate
                  ? chart.length === 1
                    ? 'No daily snapshots yet: showing today only. History builds up from the first daily snapshot.'
                    : `History starts ${formatDay(chart[0].date)}. Today shows live status.`
                  : 'Daily snapshots; today shows live status.'}
              </p>
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={chart}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis dataKey="date" stroke="#94A3B8" fontSize={12} tickFormatter={(val: string) => val.slice(5)} />
                  <YAxis stroke="#94A3B8" fontSize={12} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#1A1F25', border: '1px solid #334155', borderRadius: '8px' }}
                    labelStyle={{ color: '#F1F5F9' }}
                    labelFormatter={(val) => formatDay(String(val))}
                  />
                  <Legend />
                  <Line type="monotone" dataKey="FMC" stroke="#22C55E" strokeWidth={2} dot={chart.length < 3} isAnimationActive={false} />
                  <Line type="monotone" dataKey="PMC" stroke="#F59E0B" strokeWidth={2} dot={chart.length < 3} isAnimationActive={false} />
                  <Line type="monotone" dataKey="NMC" stroke="#EF4444" strokeWidth={2} dot={chart.length < 3} isAnimationActive={false} />
                </LineChart>
              </ResponsiveContainer>
            </>
          )}
        </div>
      )}

      <div className="bg-bg-secondary border border-border rounded-xl">
        <div className="flex flex-wrap items-center justify-between gap-3 p-6 border-b border-border">
          <div className="flex items-center gap-3">
            <Truck className="w-5 h-5 text-text-secondary" />
            <h2 className="font-display text-lg font-semibold text-text-primary">Vehicles</h2>
            <span className="text-sm text-text-secondary">({filtered.length})</span>
          </div>
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-text-secondary" />
            {(Object.keys(FILTER_LABELS) as FilterMode[]).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                aria-pressed={filter === f}
                title={f === 'overdue' ? 'No completed PMCS in more than 14 days (or never)' : undefined}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  filter === f ? 'bg-bg-tertiary text-text-primary' : 'text-text-secondary hover:bg-bg-tertiary'
                }`}
              >
                {FILTER_LABELS[f]}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full" data-testid="vehicle-table">
            <thead>
              <tr className="text-left text-xs text-text-secondary uppercase tracking-wider">
                <th className="px-6 py-3">Bumper #</th>
                {multiUnit && <th className="px-6 py-3">Unit</th>}
                <th className="px-6 py-3">Type</th>
                <th className="px-6 py-3">Status</th>
                <th className="px-6 py-3">Open Faults</th>
                <th className="px-6 py-3">Last PMCS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((v) => (
                <tr key={v.id} onClick={() => navigate(`/vehicle/${v.id}`)} className="hover:bg-bg-tertiary cursor-pointer transition-colors">
                  <td className="px-6 py-4 font-display font-semibold text-text-primary">{v.bumper_number ?? '---'}</td>
                  {multiUnit && <td className="px-6 py-4 text-sm text-text-secondary">{v.unit ?? '---'}</td>}
                  <td className="px-6 py-4 text-text-secondary text-sm">{v.vehicle_type ?? '---'}</td>
                  <td className="px-6 py-4"><StatusBadge status={v.status} /></td>
                  <td className="px-6 py-4">
                    {v.openFaultCount > 0 ? (
                      <span className="text-accent-red font-semibold">{v.openFaultCount}</span>
                    ) : (
                      <span className="text-text-secondary">0</span>
                    )}
                  </td>
                  <td className={`px-6 py-4 text-sm ${v.compliance.status === 'overdue' ? 'text-accent-red' : 'text-text-secondary'}`}>
                    {v.lastPmcs ? formatDay(v.lastPmcs) : 'Never'}
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
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
    </div>
  )
}
