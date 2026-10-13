import { useMemo, useState } from 'react'
import { AlertTriangle, CheckCircle, ClipboardList, Loader2, Lock } from 'lucide-react'
import { api, errorMessage, getByIds, isAbortedError } from '../lib/api'
import { useLoader } from '../hooks/useLoader'
import { unitLabel, unitQuery, useUnits } from '../hooks/useUnits'
import { formatDay } from '../lib/dates'
import { compareFaults, partsLabel } from '../lib/faults'
import { ActionError, ErrorState, ReadinessBadge, StaleBanner } from '../components/Feedback'
import { UnitSelector } from '../components/UnitSelector'
import type { Fault, Inspection, ProfileSummary, ResolutionStatus, Vehicle } from '../types/database'

type FilterTab = 'unacknowledged' | 'all_open' | 'by_vehicle'

interface FaultQueueData {
  vehicles: Vehicle[]
  faults: Fault[]
  inspections: Pick<Inspection, 'id' | 'inspector_id' | 'date' | 'completed_at'>[]
  profiles: ProfileSummary[]
}

async function loadFaultQueue(unit: string[] | undefined, signal: AbortSignal): Promise<FaultQueueData> {
  // Unit-wide queries: no id lists, so URLs never grow with the fleet.
  const [vehicles, faults] = await Promise.all([
    api<Vehicle[]>('GET', '/vehicles', { query: { unit }, signal }),
    api<Fault[]>('GET', '/faults', { query: { open: 1, unit }, signal }),
  ])
  // Inspection date + inspector, fetched by id in chunks of <= 90.
  const inspections = await getByIds<Inspection>('/inspections', 'id', faults.map((f) => f.inspection_id), { signal })
  const profiles = await getByIds<ProfileSummary>('/profiles', 'id', inspections.map((i) => i.inspector_id), { signal })
  return { vehicles, faults, inspections, profiles }
}

export function FaultQueue() {
  const { units, unitsKey, unitNames, selectedUnit, ownUnit, loading: unitsLoading } = useUnits()
  const [filter, setFilter] = useState<FilterTab>('unacknowledged')
  const [selectedVehicle, setSelectedVehicle] = useState<string>('')
  const [actionId, setActionId] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [workOrderInputs, setWorkOrderInputs] = useState<Record<string, string>>({})

  const key = unitsLoading ? null : `faults|${unitsKey}|${selectedUnit}`
  const { data, error, loading, updatedAt, reload, mutate } = useLoader(key, (signal) =>
    loadFaultQueue(unitQuery(selectedUnit), signal),
  )

  const rows = useMemo(() => {
    if (!data) return null
    const vehicles = new Map(data.vehicles.map((v) => [v.id, v]))
    const inspections = new Map(data.inspections.map((i) => [i.id, i]))
    const names = new Map(data.profiles.map((p) => [p.id, `${p.rank ?? ''} ${p.last_name ?? ''}`.trim() || 'Unknown']))
    return data.faults.map((f) => {
      const v = vehicles.get(f.vehicle_id)
      const ins = inspections.get(f.inspection_id)
      return {
        ...f,
        bumperNumber: v?.bumper_number ?? '---',
        unit: v?.unit ?? null,
        inspectorName: (ins && names.get(ins.inspector_id)) || 'Unknown',
        inspectionDate: ins?.date ?? ins?.completed_at ?? null,
      }
    }).sort(compareFaults)
  }, [data])

  async function updateFault(faultId: string, status: Exclude<ResolutionStatus, 'OPEN'>) {
    if (actionId) return
    setActionId(faultId)
    setActionError(null)
    const wo = workOrderInputs[faultId]?.trim()
    try {
      await api('PATCH', '/faults', {
        body: { ids: [faultId], resolution_status: status, ...(wo ? { gcss_work_order: wo } : {}) },
      })
      mutate((prev) => ({
        ...prev,
        faults:
          status === 'CORRECTED'
            ? prev.faults.filter((f) => f.id !== faultId)
            : prev.faults.map((f) => (f.id === faultId ? { ...f, resolution_status: status, gcss_work_order: wo || f.gcss_work_order } : f)),
      }))
      reload()
    } catch (err) {
      if (!isAbortedError(err)) {
        setActionError(`${status === 'CORRECTED' ? 'Resolve' : 'Acknowledge'} failed: ${errorMessage(err)}`)
      }
    } finally {
      setActionId(null)
    }
  }

  if (loading) return <div className="text-text-secondary">Loading fault queue...</div>
  if (!rows || !data) return <ErrorState title="Couldn't load the fault queue" message={error ?? 'Unknown error'} onRetry={reload} />

  const multiUnit = units.length > 1
  const unacknowledgedCount = rows.filter((f) => f.resolution_status === 'OPEN').length
  const totalOpen = rows.length
  const filtered = rows.filter((f) => {
    if (filter === 'unacknowledged') return f.resolution_status === 'OPEN'
    if (filter === 'by_vehicle' && selectedVehicle) return f.vehicle_id === selectedVehicle
    return true
  })
  const colCount = multiUnit ? 9 : 8

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-text-primary">Fault Queue</h1>
          <p className="text-text-secondary mt-1">
            {selectedUnit ? unitLabel(selectedUnit, unitNames) : 'Track and manage open faults across the unit'}
          </p>
        </div>
        <UnitSelector />
      </div>

      {error && <StaleBanner message={error} updatedAt={updatedAt} onRetry={reload} />}
      <ActionError message={actionError} onDismiss={() => setActionError(null)} />

      <div className="flex gap-4">
        <div className="bg-bg-secondary border border-border rounded-xl px-6 py-4 flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-accent-red" />
          <div>
            <p className="font-display text-2xl font-bold text-accent-red" data-testid="unack-count">{unacknowledgedCount}</p>
            <p className="text-xs text-text-secondary">Unacknowledged</p>
          </div>
        </div>
        <div className="bg-bg-secondary border border-border rounded-xl px-6 py-4 flex items-center gap-3">
          <ClipboardList className="w-5 h-5 text-accent-amber" />
          <div>
            <p className="font-display text-2xl font-bold text-accent-amber" data-testid="open-count">{totalOpen}</p>
            <p className="text-xs text-text-secondary">Total Open</p>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {([
          ['unacknowledged', 'Unacknowledged'],
          ['all_open', 'All Open'],
          ['by_vehicle', 'By Vehicle'],
        ] as [FilterTab, string][]).map(([k, label]) => (
          <button
            key={k}
            onClick={() => setFilter(k)}
            aria-pressed={filter === k}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              filter === k ? 'bg-bg-tertiary text-text-primary' : 'text-text-secondary hover:bg-bg-tertiary'
            }`}
          >
            {label}
          </button>
        ))}
        {filter === 'by_vehicle' && (
          <select
            aria-label="Vehicle"
            value={selectedVehicle}
            onChange={(e) => setSelectedVehicle(e.target.value)}
            className="ml-2 px-3 py-2 bg-bg-tertiary border border-border rounded-lg text-sm text-text-primary focus:outline-none focus:ring-1 focus:ring-accent-blue"
          >
            <option value="">All Vehicles</option>
            {data.vehicles.map((v) => (
              <option key={v.id} value={v.id}>
                {v.bumper_number ?? v.id}
                {multiUnit && v.unit ? ` (${v.unit})` : ''}
              </option>
            ))}
          </select>
        )}
      </div>

      <div className="bg-bg-secondary border border-border rounded-xl overflow-x-auto">
        <table className="w-full" data-testid="fault-table">
          <thead>
            <tr className="text-left text-xs text-text-secondary uppercase tracking-wider">
              <th className="px-3 py-3">Vehicle</th>
              {multiUnit && <th className="px-3 py-3">Unit</th>}
              <th className="px-3 py-3">Item</th>
              <th className="px-3 py-3">Description</th>
              <th className="px-3 py-3">Readiness</th>
              <th className="px-3 py-3">Reported By</th>
              <th className="px-3 py-3" title="Date of the inspection that found the fault">Inspected</th>
              <th className="px-3 py-3">WO#</th>
              <th className="px-3 py-3">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filtered.map((f) => {
              const canEdit = !!ownUnit && f.unit === ownUnit
              const busy = actionId === f.id
              return (
                <tr key={f.id} className="hover:bg-bg-tertiary transition-colors">
                  <td className="px-3 py-4 font-display text-sm font-semibold text-text-primary">{f.bumperNumber}</td>
                  {multiUnit && <td className="px-3 py-4 text-sm text-text-secondary">{f.unit ?? '---'}</td>}
                  <td className="px-3 py-4 text-sm text-text-primary">{f.item ?? '---'}</td>
                  <td className="px-3 py-4 text-sm text-text-secondary min-w-[12rem] max-w-xs">
                    <div className="line-clamp-2" title={f.description ?? f.item_description ?? undefined}>{f.description ?? f.item_description ?? '---'}</div>
                    {partsLabel(f) && <div className="mt-1 text-xs text-accent-amber" data-testid="parts-needed">{partsLabel(f)}</div>}
                    {f.photo_urls && f.photo_urls.length > 0 && (
                      <div className="flex gap-1.5 mt-1.5">
                        {f.photo_urls.map((url, i) => (
                          <a key={i} href={url} target="_blank" rel="noopener noreferrer" className="flex-shrink-0">
                            <img
                              src={url}
                              alt={`Photo ${i + 1}`}
                              loading="lazy"
                              className="w-8 h-8 rounded border border-border object-cover hover:ring-1 hover:ring-accent-blue transition-all"
                            />
                          </a>
                        ))}
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-4"><ReadinessBadge readiness={f.readiness} /></td>
                  <td className="px-3 py-4 text-sm text-text-secondary">{f.inspectorName}</td>
                  <td className="px-3 py-4 text-sm text-text-secondary">{formatDay(f.inspectionDate)}</td>
                  <td className="px-3 py-4">
                    {canEdit ? (
                      <input
                        type="text"
                        placeholder="WO#"
                        aria-label="GCSS-A work order"
                        value={workOrderInputs[f.id] ?? f.gcss_work_order ?? ''}
                        onChange={(e) => setWorkOrderInputs((prev) => ({ ...prev, [f.id]: e.target.value }))}
                        className="w-28 px-2 py-1 bg-bg-tertiary border border-border rounded text-xs text-text-primary placeholder:text-text-secondary/50 focus:outline-none focus:ring-1 focus:ring-accent-blue"
                      />
                    ) : (
                      <span className="text-xs text-text-secondary">{f.gcss_work_order ?? '---'}</span>
                    )}
                  </td>
                  <td className="px-3 py-4">
                    {canEdit ? (
                      <div className="flex gap-2 whitespace-nowrap">
                        {f.resolution_status === 'OPEN' && (
                          <button
                            onClick={() => updateFault(f.id, 'ACKNOWLEDGED')}
                            disabled={!!actionId}
                            className="flex items-center gap-1 px-2.5 py-1.5 bg-accent-amber/20 text-accent-amber rounded-lg text-xs font-medium hover:bg-accent-amber/30 disabled:opacity-50 transition-colors"
                          >
                            {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : <ClipboardList className="w-3 h-3" />}
                            GCSS-A
                          </button>
                        )}
                        <button
                          onClick={() => updateFault(f.id, 'CORRECTED')}
                          disabled={!!actionId}
                          className="flex items-center gap-1 px-2.5 py-1.5 bg-accent-green/20 text-accent-green rounded-lg text-xs font-medium hover:bg-accent-green/30 disabled:opacity-50 transition-colors"
                        >
                          {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle className="w-3 h-3" />}
                          Resolve
                        </button>
                      </div>
                    ) : (
                      <span className="flex items-center gap-1 text-xs text-text-secondary" title="Watched unit: view only">
                        <Lock className="w-3 h-3" />
                        View only
                      </span>
                    )}
                  </td>
                </tr>
              )
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={colCount} className="px-3 py-12 text-center text-text-secondary">
                  No faults found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
