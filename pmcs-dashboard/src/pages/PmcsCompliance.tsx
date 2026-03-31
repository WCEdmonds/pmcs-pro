import { useEffect, useRef, useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { ClipboardCheck, CheckCircle2, AlertCircle } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useRealtimeRefresh } from '../hooks/useRealtimeRefresh'
import { useWatchedUics } from '../hooks/useWatchedUics'
import type { Vehicle } from '../types/database'

interface ComplianceRow {
  id: string
  bumperNumber: string
  vehicleType: string
  lastInspectionDate: string | null
  daysSince: number | null
  complianceStatus: 'green' | 'amber' | 'red'
}

interface WeeklyPoint {
  week: string
  pct: number
}

interface InspectionRecord {
  id: string
  vehicle_id: string
  completed_at: string | null
  status: string | null
}

export function PmcsCompliance() {
  const { uics, loading: uicsLoading } = useWatchedUics()
  const [rows, setRows] = useState<ComplianceRow[]>([])
  const [weeklyData, setWeeklyData] = useState<WeeklyPoint[]>([])
  const [loading, setLoading] = useState(true)
  const isInitialLoad = useRef(true)

  useEffect(() => {
    loadData()
  }, [uics, uicsLoading])

  useRealtimeRefresh(['vehicles', 'inspections'], loadData)

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

    const vehicles = (vehiclesRes.data ?? []) as Vehicle[]
    const inspections = (inspectionsRes.data ?? []) as InspectionRecord[]

    // Last inspection per vehicle
    const lastInspection = new Map<string, string>()
    for (const ins of inspections) {
      if (!lastInspection.has(ins.vehicle_id) && ins.completed_at) {
        lastInspection.set(ins.vehicle_id, ins.completed_at)
      }
    }

    const now = new Date()
    const complianceRows: ComplianceRow[] = vehicles.map((v) => {
      const lastDate = lastInspection.get(v.id) ?? null
      let daysSince: number | null = null
      let complianceStatus: 'green' | 'amber' | 'red' = 'red'

      if (lastDate) {
        daysSince = Math.floor((now.getTime() - new Date(lastDate).getTime()) / (1000 * 60 * 60 * 24))
        if (daysSince <= 7) complianceStatus = 'green'
        else if (daysSince <= 14) complianceStatus = 'amber'
        else complianceStatus = 'red'
      }

      return {
        id: v.id,
        bumperNumber: v.bumper_number ?? '---',
        vehicleType: v.vehicle_type ?? '---',
        lastInspectionDate: lastDate,
        daysSince,
        complianceStatus,
      }
    })

    setRows(complianceRows)

    // Build weekly compliance chart (last 8 weeks)
    buildWeeklyChart(vehicles, inspections)
    isInitialLoad.current = false
    setLoading(false)
  }

  function buildWeeklyChart(
    vehicles: Vehicle[],
    inspections: InspectionRecord[]
  ) {
    const total = vehicles.length
    if (total === 0) {
      setWeeklyData([])
      return
    }

    const now = new Date()
    const points: WeeklyPoint[] = []

    for (let w = 7; w >= 0; w--) {
      const weekEnd = new Date(now)
      weekEnd.setDate(weekEnd.getDate() - w * 7)
      const cutoff = new Date(weekEnd)
      cutoff.setDate(cutoff.getDate() - 7)

      const inspected = new Set<string>()
      for (const ins of inspections) {
        if (ins.completed_at) {
          const d = new Date(ins.completed_at)
          if (d <= weekEnd && d >= cutoff) {
            inspected.add(ins.vehicle_id)
          }
        }
      }

      const pct = Math.round((inspected.size / total) * 100)
      const label = weekEnd.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
      points.push({ week: label, pct })
    }

    setWeeklyData(points)
  }

  const compliantCount = rows.filter((r) => r.complianceStatus === 'green').length
  const totalCount = rows.length

  function complianceBadge(status: 'green' | 'amber' | 'red') {
    if (status === 'green') return <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-accent-green/20 text-accent-green">Current</span>
    if (status === 'amber') return <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-accent-amber/20 text-accent-amber">Due Soon</span>
    return <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-accent-red/20 text-accent-red">Overdue</span>
  }

  if (loading) {
    return <div className="text-text-secondary">Loading compliance data...</div>
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="font-display text-2xl font-bold text-text-primary">PMCS Compliance</h1>
        <p className="text-text-secondary mt-1">7-day inspection window tracking</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-bg-secondary border border-border rounded-xl p-6 flex items-center gap-4">
          <ClipboardCheck className="w-10 h-10 text-accent-blue" />
          <div>
            <p className="font-display text-3xl font-bold text-text-primary">
              {compliantCount}/{totalCount}
            </p>
            <p className="text-sm text-text-secondary">Inspected in last 7 days</p>
          </div>
        </div>
        <div className="bg-bg-secondary border border-border rounded-xl p-6 flex items-center gap-4">
          <CheckCircle2 className="w-10 h-10 text-accent-green" />
          <div>
            <p className="font-display text-3xl font-bold text-accent-green">
              {totalCount > 0 ? Math.round((compliantCount / totalCount) * 100) : 0}%
            </p>
            <p className="text-sm text-text-secondary">Compliance Rate</p>
          </div>
        </div>
        <div className="bg-bg-secondary border border-border rounded-xl p-6 flex items-center gap-4">
          <AlertCircle className="w-10 h-10 text-accent-red" />
          <div>
            <p className="font-display text-3xl font-bold text-accent-red">
              {rows.filter((r) => r.complianceStatus === 'red').length}
            </p>
            <p className="text-sm text-text-secondary">Overdue Vehicles</p>
          </div>
        </div>
      </div>

      {/* Weekly compliance chart */}
      {weeklyData.length > 0 && (
        <div className="bg-bg-secondary border border-border rounded-xl p-6">
          <h2 className="font-display text-lg font-semibold text-text-primary mb-4">
            Weekly Compliance (8 Weeks)
          </h2>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={weeklyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="week" stroke="#94A3B8" fontSize={12} />
              <YAxis
                stroke="#94A3B8"
                fontSize={12}
                domain={[0, 100]}
                tickFormatter={(val: number) => `${val}%`}
              />
              <Tooltip
                contentStyle={{ backgroundColor: '#1A1F25', border: '1px solid #334155', borderRadius: '8px' }}
                labelStyle={{ color: '#F1F5F9' }}
                itemStyle={{ color: '#3B82F6' }}
                formatter={(value: unknown) => [`${value}%`, 'Compliance']}
              />
              <Bar dataKey="pct" fill="#3B82F6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Compliance table */}
      <div className="bg-bg-secondary border border-border rounded-xl overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="text-left text-xs text-text-secondary uppercase tracking-wider">
              <th className="px-6 py-3">Vehicle</th>
              <th className="px-6 py-3">Type</th>
              <th className="px-6 py-3">Last Inspection</th>
              <th className="px-6 py-3">Days Since</th>
              <th className="px-6 py-3">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((r) => (
              <tr key={r.id} className="hover:bg-bg-tertiary transition-colors">
                <td className="px-6 py-4 font-display text-sm font-semibold text-text-primary">
                  {r.bumperNumber}
                </td>
                <td className="px-6 py-4 text-sm text-text-secondary">{r.vehicleType}</td>
                <td className="px-6 py-4 text-sm text-text-secondary">
                  {r.lastInspectionDate ? new Date(r.lastInspectionDate).toLocaleDateString() : 'Never'}
                </td>
                <td className="px-6 py-4 text-sm">
                  <span className={
                    r.daysSince === null ? 'text-accent-red font-semibold' :
                    r.daysSince <= 7 ? 'text-accent-green' :
                    r.daysSince <= 14 ? 'text-accent-amber' :
                    'text-accent-red font-semibold'
                  }>
                    {r.daysSince !== null ? r.daysSince : 'N/A'}
                  </span>
                </td>
                <td className="px-6 py-4">{complianceBadge(r.complianceStatus)}</td>
              </tr>
            ))}
            {rows.length === 0 && (
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
  )
}
