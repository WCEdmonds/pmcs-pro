import { lastNDayKeys, localDateKey, toDayKey } from './dates'
import type { VehicleStatus } from '../types/database'

export interface ReadinessPoint {
  date: string
  FMC: number
  PMC: number
  NMC: number
}

export interface StatusSnapshot {
  vehicle_id: string
  status: string
  recorded_at: string
}

export interface FleetVehicle {
  id: string
  status: VehicleStatus | string | null
}

export type StatusBucket = 'FMC' | 'PMC' | 'NMC'

/** Groups a vehicle status into the three readiness buckets (DEADLINE counts as NMC). */
export function statusBucket(status: string | null | undefined): StatusBucket {
  if (status === 'PMC') return 'PMC'
  if (status === 'NMC' || status === 'DEADLINE') return 'NMC'
  return 'FMC'
}

export function countStatuses(statuses: Iterable<string | null | undefined>): Omit<ReadinessPoint, 'date'> {
  const counts = { FMC: 0, PMC: 0, NMC: 0 }
  for (const s of statuses) counts[statusBucket(s)]++
  return counts
}

/**
 * Builds the readiness trend for the last `days` local days.
 *
 * - Only vehicles in `vehicles` (the fleet currently shown) are counted.
 * - The chart starts at the first day with a snapshot; earlier days are left out
 *   rather than fabricated from today's status.
 * - A vehicle with no snapshot yet on a given day is not counted that day.
 * - Today's point is the live status of every vehicle, so it matches the KPI cards.
 */
export function buildReadinessSeries(
  vehicles: FleetVehicle[],
  history: StatusSnapshot[],
  now: Date,
  days = 30,
): ReadinessPoint[] {
  if (vehicles.length === 0) return []
  const fleet = new Set(vehicles.map((v) => v.id))
  const dayKeys = lastNDayKeys(days, now)
  const today = localDateKey(now)

  const byDay = new Map<string, StatusSnapshot[]>()
  for (const h of history) {
    if (!fleet.has(h.vehicle_id)) continue
    const key = toDayKey(h.recorded_at)
    if (!byDay.has(key)) byDay.set(key, [])
    byDay.get(key)!.push(h)
  }

  const known = new Map<string, string>()
  // Snapshots older than the window seed the carry-forward state.
  const windowStart = dayKeys[0]
  const older = [...byDay.keys()].filter((k) => k < windowStart).sort()
  for (const k of older) for (const h of byDay.get(k)!) known.set(h.vehicle_id, h.status)

  const points: ReadinessPoint[] = []
  for (const key of dayKeys) {
    if (key === today) break
    for (const h of byDay.get(key) ?? []) known.set(h.vehicle_id, h.status)
    if (known.size === 0) continue // before the first snapshot: leave a gap
    points.push({ date: key, ...countStatuses(known.values()) })
  }

  points.push({ date: today, ...countStatuses(vehicles.map((v) => v.status)) })
  return points
}
