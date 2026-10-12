import { addLocalDays, daysBetweenKeys, localDateKey, localDaysSince, toDayKey } from './dates'

/** A vehicle is "Current" when its last completed PMCS was at most this many days ago. */
export const CURRENT_MAX_DAYS = 7
/** "Due soon" up to this many days; anything older (or never) is "Overdue". */
export const DUE_SOON_MAX_DAYS = 14

export type ComplianceStatus = 'current' | 'due_soon' | 'overdue'

export interface ComplianceInfo {
  daysSince: number | null
  status: ComplianceStatus
}

/**
 * Shared PMCS compliance rule used by Fleet Overview and PMCS Compliance:
 * Current <= 7 days, Due soon 8-14 days, Overdue > 14 days or never inspected.
 * Days are local calendar days.
 */
export function pmcsCompliance(lastCompletedAt: string | null | undefined, now: Date): ComplianceInfo {
  if (!lastCompletedAt) return { daysSince: null, status: 'overdue' }
  const daysSince = Math.max(0, localDaysSince(lastCompletedAt, now))
  if (daysSince <= CURRENT_MAX_DAYS) return { daysSince, status: 'current' }
  if (daysSince <= DUE_SOON_MAX_DAYS) return { daysSince, status: 'due_soon' }
  return { daysSince, status: 'overdue' }
}

export function isOverdue(lastCompletedAt: string | null | undefined, now: Date): boolean {
  return pmcsCompliance(lastCompletedAt, now).status === 'overdue'
}

export interface WeeklyPoint {
  /** Local day key of the last day in the week window. */
  weekEnd: string
  inspected: number
  total: number
  pct: number
}

export interface CompletedInspection {
  vehicle_id: string
  completed_at: string | null
}

/**
 * Weekly PMCS coverage for the last `weeks` 7-day windows ending today: the share
 * of fleet vehicles with at least one completed inspection in each window. Counts
 * DISTINCT vehicles that are in `fleetIds`, so it can never exceed 100%.
 */
export function buildWeeklyCompliance(
  fleetIds: string[],
  inspections: CompletedInspection[],
  now: Date,
  weeks = 8,
): WeeklyPoint[] {
  const fleet = new Set(fleetIds)
  const total = fleet.size
  if (total === 0) return []
  const today = localDateKey(now)

  // vehicle -> local days with a completed inspection
  const daysByVehicle = new Map<string, Set<string>>()
  for (const ins of inspections) {
    if (!ins.completed_at || !fleet.has(ins.vehicle_id)) continue
    const key = toDayKey(ins.completed_at)
    if (!daysByVehicle.has(ins.vehicle_id)) daysByVehicle.set(ins.vehicle_id, new Set())
    daysByVehicle.get(ins.vehicle_id)!.add(key)
  }

  const points: WeeklyPoint[] = []
  for (let w = weeks - 1; w >= 0; w--) {
    const endKey = localDateKey(addLocalDays(now, -7 * w))
    let inspected = 0
    for (const days of daysByVehicle.values()) {
      for (const d of days) {
        const ago = daysBetweenKeys(d, endKey)
        if (ago >= 0 && ago < 7) {
          inspected++
          break
        }
      }
    }
    points.push({ weekEnd: endKey > today ? today : endKey, inspected, total, pct: Math.round((inspected / total) * 100) })
  }
  return points
}

/** Local day key of the first day covered by `buildWeeklyCompliance(..., weeks)`. */
export function weeklyWindowStart(now: Date, weeks = 8): string {
  return localDateKey(addLocalDays(now, -(7 * weeks - 1)))
}
