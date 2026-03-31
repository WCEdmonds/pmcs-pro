import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { Truck, AlertCircle, CheckCircle2, Filter } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useRealtimeRefresh } from '../hooks/useRealtimeRefresh'
import { useWatchedUics } from '../hooks/useWatchedUics'
import type { Vehicle } from '../types/database'

type FilterMode = 'all' | 'nmc' | 'overdue'

interface VehicleRow extends Vehicle {
  openFaultCount: number
  lastPmcsDate: string | null
}

interface ReadinessPoint {
  date: string
  FMC: number
  PMC: number
  NMC: number
}

interface FaultRecord {
  id: string
  vehicle_id: string
}

interface InspectionRecord {
  id: string
  vehicle_id: string
  completed_at: string | null
  status: string | null
}

export function FleetOverview() {
  const navigate = useNavigate()
  const { uics, loading: uicsLoading } = useWatchedUics()
  const [vehicles, setVehicles] = useState<VehicleRow[]>([])
  const [readinessData, setReadinessData] = useState<ReadinessPoint[]>([])
  const [filter, setFilter] = useState<FilterMode>('all')
  const [loading, setLoading] = useState(true)
  const isInitialLoad = useRef(true)

  useEffect(() => {
    loadData()
  }, [uics, uicsLoading])

  useRealtimeRefresh(['vehicles', 'faults', 'inspections'], loadData)

  async function loadData() {
    if (uicsLoading) return
    if (isInitialLoad.current) setLoading(true)

    let vehicleQuery = supabase.from('vehicles').select('*').order('bumper_number')
    if (uics.length > 0) {
      vehicleQuery = vehicleQuery.in('unit', uics)
    }

    const [vehiclesRes, inspectionsRes] = await Promise.all([
      vehicleQuery,
      supabase.from('inspections').select('id, vehicle_id, completed_at, status').eq('status', 'COMPLETED').order('completed_at', { ascending: false }),
    ])

    if (vehiclesRes.error) console.error('Vehicles query error:', vehiclesRes.error)
    if (inspectionsRes.error) console.error('Inspections query error:', inspectionsRes.error)

    const allVehicles = (vehiclesRes.data ?? []) as Vehicle[]
    const vehicleIds = allVehicles.map((v) => v.id)
    const faultsRes = vehicleIds.length > 0
      ? await supabase.from('faults').select('id, vehicle_id').neq('resolution_status', 'CORRECTED').in('vehicle_id', vehicleIds)
      : { data: [] as { id: string; vehicle_id: string }[] }

    if ('error' in faultsRes && faultsRes.error) console.error('Faults query error:', faultsRes.error)

    const openFaults = (faultsRes.data ?? []) as FaultRecord[]
    const inspections = (inspectionsRes.data ?? []) as InspectionRecord[]

    console.log('Fleet data loaded:', { vehicles: allVehicles.length, faults: openFaults.length, inspections: inspections.length })

    // Count open faults per vehicle
    const faultCounts = new Map<string, number>()
    for (const f of openFaults) {
      faultCounts.set(f.vehicle_id, (faultCounts.get(f.vehicle_id) ?? 0) + 1)
    }

    // Last inspection per vehicle
    const lastInspection = new Map<string, string>()
    for (const ins of inspections) {
      if (!lastInspection.has(ins.vehicle_id) && ins.completed_at) {
        lastInspection.set(ins.vehicle_id, ins.completed_at)
      }
    }

    const rows: VehicleRow[] = allVehicles.map((v) => ({
      ...v,
      openFaultCount: faultCounts.get(v.id) ?? 0,
      lastPmcsDate: lastInspection.get(v.id) ?? null,
    }))

    setVehicles(rows)

    // Build readiness chart from historical status snapshots
    await buildReadinessChart(allVehicles)
    isInitialLoad.current = false
    setLoading(false)
  }

  async function buildReadinessChart(allVehicles: Vehicle[]) {
    const total = allVehicles.length
    if (total === 0) {
      setReadinessData([])
      return
    }

    const now = new Date()
    const thirtyDaysAgo = new Date(now)
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    const { data: history } = await supabase
      .from('vehicle_status_history')
      .select('vehicle_id, status, recorded_at')
      .gte('recorded_at', thirtyDaysAgo.toISOString().slice(0, 10))
      .order('recorded_at')

    // Group snapshots by date
    const byDate = new Map<string, Map<string, string>>()
    for (const h of (history ?? []) as { vehicle_id: string; status: string; recorded_at: string }[]) {
      const date = h.recorded_at.slice(0, 10)
      if (!byDate.has(date)) byDate.set(date, new Map())
      byDate.get(date)!.set(h.vehicle_id, h.status)
    }

    // Build chart: for each day, use the snapshot if available, otherwise carry forward
    const points: ReadinessPoint[] = []
    const lastKnown = new Map<string, string>()
    // Initialize with current status as fallback
    for (const v of allVehicles) {
      lastKnown.set(v.id, v.status ?? 'FMC')
    }

    for (let i = 30; i >= 0; i--) {
      const day = new Date(now)
      day.setDate(day.getDate() - i)
      const dayStr = day.toISOString().slice(0, 10)

      // Apply any snapshots for this day
      const daySnapshots = byDate.get(dayStr)
      if (daySnapshots) {
        for (const [vid, status] of daySnapshots) {
          lastKnown.set(vid, status)
        }
      }

      const statuses = Array.from(lastKnown.values())
      points.push({
        date: dayStr,
        FMC: statuses.filter((s) => s === 'FMC').length,
        PMC: statuses.filter((s) => s === 'PMC').length,
        NMC: statuses.filter((s) => s === 'NMC' || s === 'DEADLINE').length,
      })
    }

    setReadinessData(points)
  }

  const fmcCount = vehicles.filter((v) => v.status === 'FMC').length
  const pmcCount = vehicles.filter((v) => v.status === 'PMC').length
  const nmcCount = vehicles.filter((v) => v.status === 'NMC' || v.status === 'DEADLINE').length
  const totalCount = vehicles.length
  const fmcPct = totalCount > 0 ? Math.round((fmcCount / totalCount) * 100) : 0

  const now = new Date()
  const sevenDaysAgo = new Date(now)
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

  const filtered = vehicles.filter((v) => {
    if (filter === 'nmc') return v.status !== 'FMC'
    if (filter === 'overdue') {
      if (!v.lastPmcsDate) return true
      return new Date(v.lastPmcsDate) < sevenDaysAgo
    }
    return true
  })

  function statusBadge(status: string | null) {
    if (status === 'FMC') return <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-accent-green/20 text-accent-green">FMC</span>
    if (status === 'PMC') return <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-accent-amber/20 text-accent-amber">PMC</span>
    if (status === 'DEADLINE') return <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-accent-red/20 text-accent-red">DEADLINE</span>
    return <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-accent-red/20 text-accent-red">NMC</span>
  }

  if (loading) {
    return <div className="text-text-secondary">Loading fleet data...</div>
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="font-display text-2xl font-bold text-text-primary">Fleet Overview</h1>
        <p className="text-text-secondary mt-1">Unit readiness at a glance</p>
      </div>

      {/* Readiness card */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-bg-secondary border border-border rounded-xl p-6 flex flex-col items-center justify-center">
          <p className="text-text-secondary text-sm mb-2">Fleet Readiness</p>
          <p className="font-display text-5xl font-bold text-accent-green">{fmcPct}%</p>
          <p className="text-text-secondary text-sm mt-2">
            <span className="text-text-primary font-semibold">{fmcCount}</span> / {totalCount} FMC
          </p>
        </div>

        <div className="bg-bg-secondary border border-border rounded-xl p-6 flex flex-col items-center justify-center">
          <CheckCircle2 className="w-8 h-8 text-accent-green mb-2" />
          <p className="font-display text-3xl font-bold text-accent-green">{fmcCount}</p>
          <p className="text-text-secondary text-sm mt-1">FMC</p>
        </div>

        <div className="bg-bg-secondary border border-border rounded-xl p-6 flex flex-col items-center justify-center">
          <AlertCircle className="w-8 h-8 text-accent-amber mb-2" />
          <p className="font-display text-3xl font-bold text-accent-amber">{pmcCount}</p>
          <p className="text-text-secondary text-sm mt-1">PMC</p>
        </div>

        <div className="bg-bg-secondary border border-border rounded-xl p-6 flex flex-col items-center justify-center">
          <AlertCircle className="w-8 h-8 text-accent-red mb-2" />
          <p className="font-display text-3xl font-bold text-accent-red">{nmcCount}</p>
          <p className="text-text-secondary text-sm mt-1">NMC</p>
        </div>
      </div>

      {/* Readiness chart */}
      {readinessData.length > 0 && (
        <div className="bg-bg-secondary border border-border rounded-xl p-6">
          <h2 className="font-display text-lg font-semibold text-text-primary mb-4">
            Vehicle Status Trend (30 Days)
          </h2>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={readinessData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis
                dataKey="date"
                stroke="#94A3B8"
                fontSize={12}
                tickFormatter={(val: string) => val.slice(5)}
              />
              <YAxis
                stroke="#94A3B8"
                fontSize={12}
                allowDecimals={false}
              />
              <Tooltip
                contentStyle={{ backgroundColor: '#1A1F25', border: '1px solid #334155', borderRadius: '8px' }}
                labelStyle={{ color: '#F1F5F9' }}
              />
              <Legend />
              <Line type="monotone" dataKey="FMC" stroke="#22C55E" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="PMC" stroke="#F59E0B" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="NMC" stroke="#EF4444" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Vehicle table */}
      <div className="bg-bg-secondary border border-border rounded-xl">
        <div className="flex items-center justify-between p-6 border-b border-border">
          <div className="flex items-center gap-3">
            <Truck className="w-5 h-5 text-text-secondary" />
            <h2 className="font-display text-lg font-semibold text-text-primary">Vehicles</h2>
            <span className="text-sm text-text-secondary">({filtered.length})</span>
          </div>
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-text-secondary" />
            {(['all', 'nmc', 'overdue'] as FilterMode[]).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  filter === f
                    ? 'bg-bg-tertiary text-text-primary'
                    : 'text-text-secondary hover:bg-bg-tertiary'
                }`}
              >
                {f === 'all' ? 'All' : f === 'nmc' ? 'NMC Only' : 'Overdue'}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-left text-xs text-text-secondary uppercase tracking-wider">
                <th className="px-6 py-3">Bumper #</th>
                <th className="px-6 py-3">Type</th>
                <th className="px-6 py-3">Status</th>
                <th className="px-6 py-3">Open Faults</th>
                <th className="px-6 py-3">Last PMCS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((v) => (
                <tr
                  key={v.id}
                  onClick={() => navigate(`/vehicle/${v.id}`)}
                  className="hover:bg-bg-tertiary cursor-pointer transition-colors"
                >
                  <td className="px-6 py-4 font-display font-semibold text-text-primary">
                    {v.bumper_number ?? '---'}
                  </td>
                  <td className="px-6 py-4 text-text-secondary text-sm">
                    {v.vehicle_type ?? '---'}
                  </td>
                  <td className="px-6 py-4">
                    {statusBadge(v.status)}
                  </td>
                  <td className="px-6 py-4">
                    {v.openFaultCount > 0 ? (
                      <span className="text-accent-red font-semibold">{v.openFaultCount}</span>
                    ) : (
                      <span className="text-text-secondary">0</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-sm text-text-secondary">
                    {v.lastPmcsDate ? new Date(v.lastPmcsDate).toLocaleDateString() : 'Never'}
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-text-secondary">
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
