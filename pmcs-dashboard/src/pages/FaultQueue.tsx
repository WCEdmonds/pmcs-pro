import { useEffect, useRef, useState } from 'react'
import { AlertTriangle, CheckCircle, ClipboardList, Loader2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useRealtimeRefresh } from '../hooks/useRealtimeRefresh'
import { useWatchedUics } from '../hooks/useWatchedUics'
import type { Fault, Vehicle } from '../types/database'

type FilterTab = 'unacknowledged' | 'all_open' | 'by_vehicle'

interface FaultRow extends Fault {
  bumperNumber: string
  inspectorName: string
}

interface InspectionIdRecord {
  id: string
  inspector_id: string
}

interface ProfileRecord {
  id: string
  rank: string | null
  last_name: string | null
}

export function FaultQueue() {
  const { uics, loading: uicsLoading } = useWatchedUics()
  const [faults, setFaults] = useState<FaultRow[]>([])
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [filter, setFilter] = useState<FilterTab>('unacknowledged')
  const [selectedVehicle, setSelectedVehicle] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [actionId, setActionId] = useState<string | null>(null)
  const [workOrderInputs, setWorkOrderInputs] = useState<Record<string, string>>({})
  const isInitialLoad = useRef(true)

  useEffect(() => {
    loadData()
  }, [uics, uicsLoading])

  useRealtimeRefresh(['faults', 'vehicles'], loadData)

  async function loadData() {
    if (uicsLoading) return
    if (isInitialLoad.current) setLoading(true)

    let vehicleQuery = supabase.from('vehicles').select('*').order('bumper_number')
    if (uics.length > 0) {
      vehicleQuery = vehicleQuery.in('unit', uics)
    }

    const vehiclesRes = await vehicleQuery
    const allVehicles = (vehiclesRes.data ?? []) as Vehicle[]
    setVehicles(allVehicles)

    const vehicleIds = allVehicles.map((v) => v.id)
    let faultsQuery = supabase.from('faults').select('*').neq('resolution_status', 'CORRECTED').order('created_at', { ascending: false })
    if (vehicleIds.length > 0) {
      faultsQuery = faultsQuery.in('vehicle_id', vehicleIds)
    } else if (uics.length > 0) {
      // UICs are set but no vehicles matched — no faults to show
      setFaults([])
      isInitialLoad.current = false
      setLoading(false)
      return
    }

    const faultsRes = await faultsQuery
    const allFaults = (faultsRes.data ?? []) as Fault[]

    // Build vehicle map
    const vehicleMap = new Map<string, string>()
    for (const v of allVehicles) {
      vehicleMap.set(v.id, v.bumper_number ?? '---')
    }

    // Get inspector profiles
    const inspectionIds = [...new Set(allFaults.map((f) => f.inspection_id))]
    let inspectorNameByInspection = new Map<string, string>()

    if (inspectionIds.length > 0) {
      const { data: inspections } = await supabase
        .from('inspections')
        .select('id, inspector_id')
        .in('id', inspectionIds)

      const insRecords = (inspections ?? []) as InspectionIdRecord[]
      const inspectorIds = [...new Set(insRecords.map((i) => i.inspector_id))]
      if (inspectorIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, rank, last_name')
          .in('id', inspectorIds)

        const profileMap = new Map<string, string>()
        for (const p of (profiles ?? []) as ProfileRecord[]) {
          profileMap.set(p.id, `${p.rank ?? ''} ${p.last_name ?? ''}`.trim())
        }

        for (const ins of insRecords) {
          inspectorNameByInspection.set(ins.id, profileMap.get(ins.inspector_id) ?? 'Unknown')
        }
      }
    }

    setFaults(
      allFaults.map((f) => ({
        ...f,
        bumperNumber: vehicleMap.get(f.vehicle_id) ?? '---',
        inspectorName: inspectorNameByInspection.get(f.inspection_id) ?? 'Unknown',
      }))
    )
    isInitialLoad.current = false
    setLoading(false)
  }

  async function handleAcknowledge(faultId: string) {
    setActionId(faultId)
    const updates: { resolution_status: string; gcss_work_order?: string } = {
      resolution_status: 'ACKNOWLEDGED',
    }
    const wo = workOrderInputs[faultId]
    if (wo) updates.gcss_work_order = wo

    await supabase.from('faults').update(updates as never).eq('id', faultId)
    setFaults((prev) =>
      prev.map((f) => f.id === faultId ? { ...f, resolution_status: 'ACKNOWLEDGED' as const, gcss_work_order: wo || f.gcss_work_order } : f)
    )
    setActionId(null)
  }

  async function handleResolve(faultId: string) {
    setActionId(faultId)
    const { data: { user } } = await supabase.auth.getUser()
    const wo = workOrderInputs[faultId]
    const updates: { resolution_status: string; resolved_at: string; resolved_by: string | null; gcss_work_order?: string } = {
      resolution_status: 'CORRECTED',
      resolved_at: new Date().toISOString(),
      resolved_by: user?.id ?? null,
    }
    if (wo) updates.gcss_work_order = wo

    await supabase.from('faults').update(updates as never).eq('id', faultId)
    setFaults((prev) => prev.filter((f) => f.id !== faultId))
    setActionId(null)
  }

  const unacknowledgedCount = faults.filter((f) => f.resolution_status === 'OPEN').length
  const totalOpen = faults.length

  const filtered = faults.filter((f) => {
    if (filter === 'unacknowledged') return f.resolution_status === 'OPEN'
    if (filter === 'by_vehicle' && selectedVehicle) return f.vehicle_id === selectedVehicle
    return true
  })

  function readinessBadge(readiness: string | null) {
    if (readiness === 'NMC') return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-accent-red/20 text-accent-red">NMC</span>
    return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-accent-amber/20 text-accent-amber">PMC</span>
  }

  if (loading) {
    return <div className="text-text-secondary">Loading fault queue...</div>
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="font-display text-2xl font-bold text-text-primary">Fault Queue</h1>
        <p className="text-text-secondary mt-1">Track and manage open faults across the unit</p>
      </div>

      {/* Count badges */}
      <div className="flex gap-4">
        <div className="bg-bg-secondary border border-border rounded-xl px-6 py-4 flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-accent-red" />
          <div>
            <p className="font-display text-2xl font-bold text-accent-red">{unacknowledgedCount}</p>
            <p className="text-xs text-text-secondary">Unacknowledged</p>
          </div>
        </div>
        <div className="bg-bg-secondary border border-border rounded-xl px-6 py-4 flex items-center gap-3">
          <ClipboardList className="w-5 h-5 text-accent-amber" />
          <div>
            <p className="font-display text-2xl font-bold text-accent-amber">{totalOpen}</p>
            <p className="text-xs text-text-secondary">Total Open</p>
          </div>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex items-center gap-2">
        {([
          ['unacknowledged', 'Unacknowledged'],
          ['all_open', 'All Open'],
          ['by_vehicle', 'By Vehicle'],
        ] as [FilterTab, string][]).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              filter === key
                ? 'bg-bg-tertiary text-text-primary'
                : 'text-text-secondary hover:bg-bg-tertiary'
            }`}
          >
            {label}
          </button>
        ))}
        {filter === 'by_vehicle' && (
          <select
            value={selectedVehicle}
            onChange={(e) => setSelectedVehicle(e.target.value)}
            className="ml-2 px-3 py-2 bg-bg-tertiary border border-border rounded-lg text-sm text-text-primary focus:outline-none focus:ring-1 focus:ring-accent-blue"
          >
            <option value="">All Vehicles</option>
            {vehicles.map((v) => (
              <option key={v.id} value={v.id}>
                {v.bumper_number ?? v.id}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Faults table */}
      <div className="bg-bg-secondary border border-border rounded-xl overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="text-left text-xs text-text-secondary uppercase tracking-wider">
              <th className="px-6 py-3">Vehicle</th>
              <th className="px-6 py-3">Item</th>
              <th className="px-6 py-3">Description</th>
              <th className="px-6 py-3">Readiness</th>
              <th className="px-6 py-3">Reported By</th>
              <th className="px-6 py-3">Date</th>
              <th className="px-6 py-3">WO#</th>
              <th className="px-6 py-3">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filtered.map((f) => (
              <tr key={f.id} className="hover:bg-bg-tertiary transition-colors">
                <td className="px-6 py-4 font-display text-sm font-semibold text-text-primary">
                  {f.bumperNumber}
                </td>
                <td className="px-6 py-4 text-sm text-text-primary">{f.item ?? '---'}</td>
                <td className="px-6 py-4 text-sm text-text-secondary max-w-xs">
                  <div className="truncate">{f.description ?? f.item_description ?? '---'}</div>
                  {f.photo_urls && f.photo_urls.length > 0 && (
                    <div className="flex gap-1.5 mt-1.5">
                      {f.photo_urls.map((url, i) => (
                        <a key={i} href={url} target="_blank" rel="noopener noreferrer" className="flex-shrink-0">
                          <img
                            src={url}
                            alt={`Photo ${i + 1}`}
                            className="w-8 h-8 rounded border border-border object-cover hover:ring-1 hover:ring-accent-blue transition-all"
                          />
                        </a>
                      ))}
                    </div>
                  )}
                </td>
                <td className="px-6 py-4">{readinessBadge(f.readiness)}</td>
                <td className="px-6 py-4 text-sm text-text-secondary">{f.inspectorName}</td>
                <td className="px-6 py-4 text-sm text-text-secondary">
                  {new Date(f.created_at).toLocaleDateString()}
                </td>
                <td className="px-6 py-4">
                  <input
                    type="text"
                    placeholder="WO#"
                    value={workOrderInputs[f.id] ?? f.gcss_work_order ?? ''}
                    onChange={(e) => setWorkOrderInputs((prev) => ({ ...prev, [f.id]: e.target.value }))}
                    className="w-28 px-2 py-1 bg-bg-tertiary border border-border rounded text-xs text-text-primary placeholder:text-text-secondary/50 focus:outline-none focus:ring-1 focus:ring-accent-blue"
                  />
                </td>
                <td className="px-6 py-4">
                  <div className="flex gap-2">
                    {f.resolution_status === 'OPEN' && (
                      <button
                        onClick={() => handleAcknowledge(f.id)}
                        disabled={actionId === f.id}
                        className="flex items-center gap-1 px-2.5 py-1.5 bg-accent-amber/20 text-accent-amber rounded-lg text-xs font-medium hover:bg-accent-amber/30 disabled:opacity-50 transition-colors"
                      >
                        {actionId === f.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <ClipboardList className="w-3 h-3" />}
                        GCSS-A
                      </button>
                    )}
                    <button
                      onClick={() => handleResolve(f.id)}
                      disabled={actionId === f.id}
                      className="flex items-center gap-1 px-2.5 py-1.5 bg-accent-green/20 text-accent-green rounded-lg text-xs font-medium hover:bg-accent-green/30 disabled:opacity-50 transition-colors"
                    >
                      {actionId === f.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle className="w-3 h-3" />}
                      Resolve
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={8} className="px-6 py-12 text-center text-text-secondary">
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
