// Runs in a US time zone with DST so the local-date logic is actually exercised.
;(globalThis as unknown as { process: { env: Record<string, string> } }).process.env.TZ = 'America/New_York'

import { describe, it, expect } from 'vitest'
import { addLocalDays, daysBetweenKeys, formatDay, lastNDayKeys, localDateKey, localDaysSince, toDayKey } from '../lib/dates'
import { buildReadinessSeries, countStatuses } from '../lib/readiness'
import { buildWeeklyCompliance, isOverdue, pmcsCompliance, weeklyWindowStart } from '../lib/compliance'
import { isValidUic, normalizeUic, uicError, zeroSuggestion } from '../lib/uic'

describe('local dates', () => {
  it('uses the local day, not the UTC day, in a US evening', () => {
    // 9 pm EDT on Oct 12 is already Oct 13 in UTC
    const evening = new Date('2026-10-13T01:00:00Z')
    expect(evening.toISOString().slice(0, 10)).toBe('2026-10-13')
    expect(localDateKey(evening)).toBe('2026-10-12')
  })

  it('does not skip or repeat a day across the spring-forward DST change', () => {
    const keys = lastNDayKeys(5, new Date(2026, 2, 10, 0, 30)) // Mar 10 00:30, DST began Mar 8
    expect(keys).toEqual(['2026-03-06', '2026-03-07', '2026-03-08', '2026-03-09', '2026-03-10'])
  })

  it('does not skip or repeat a day across the fall-back DST change', () => {
    const keys = lastNDayKeys(4, new Date(2026, 10, 3, 23, 30)) // Nov 3 23:30, DST ended Nov 1
    expect(keys).toEqual(['2026-10-31', '2026-11-01', '2026-11-02', '2026-11-03'])
    expect(new Set(keys).size).toBe(4)
  })

  it('treats bare YYYY-MM-DD values as calendar days (no UTC shift)', () => {
    expect(toDayKey('2026-10-12')).toBe('2026-10-12')
    expect(formatDay('2026-10-12', { month: 'numeric', day: 'numeric' })).toBe('10/12')
  })

  it('counts whole calendar days across DST', () => {
    expect(daysBetweenKeys('2026-03-07', '2026-03-09')).toBe(2)
    expect(daysBetweenKeys('2026-10-31', '2026-11-02')).toBe(2)
    expect(localDaysSince('2026-03-08T04:30:00Z', new Date(2026, 2, 9, 0, 10))).toBe(2) // Mar 7 23:30 EST
    expect(localDateKey(addLocalDays(new Date(2026, 2, 8, 1), 1))).toBe('2026-03-09')
  })
})

describe('readiness series', () => {
  const now = new Date(2026, 9, 12, 20, 0) // Oct 12, 8 pm local
  const vehicles = [
    { id: 'a', status: 'FMC' },
    { id: 'b', status: 'PMC' },
    { id: 'c', status: 'NMC' },
    { id: 'd', status: 'DEADLINE' },
  ]

  it('ends with live status that matches the KPI cards', () => {
    const history = [
      { vehicle_id: 'a', status: 'NMC', recorded_at: '2026-10-11' },
      { vehicle_id: 'b', status: 'FMC', recorded_at: '2026-10-11' },
      { vehicle_id: 'c', status: 'FMC', recorded_at: '2026-10-11' },
      { vehicle_id: 'd', status: 'FMC', recorded_at: '2026-10-11' },
    ]
    const series = buildReadinessSeries(vehicles, history, now)
    const last = series[series.length - 1]
    expect(last).toEqual({ date: '2026-10-12', ...countStatuses(vehicles.map((v) => v.status)) })
    expect(last).toEqual({ date: '2026-10-12', FMC: 1, PMC: 1, NMC: 2 })
    expect(series[0]).toEqual({ date: '2026-10-11', FMC: 3, PMC: 0, NMC: 1 })
  })

  it('starts at the first snapshot instead of fabricating earlier days', () => {
    const history = [{ vehicle_id: 'a', status: 'FMC', recorded_at: '2026-10-05' }]
    const series = buildReadinessSeries(vehicles, history, now)
    expect(series[0].date).toBe('2026-10-05')
    expect(series).toHaveLength(8) // Oct 5..12
    expect(series[0]).toEqual({ date: '2026-10-05', FMC: 1, PMC: 0, NMC: 0 })
  })

  it('with no history, shows only today', () => {
    expect(buildReadinessSeries(vehicles, [], now)).toEqual([{ date: '2026-10-12', FMC: 1, PMC: 1, NMC: 2 }])
  })

  it('ignores snapshots for vehicles outside the current fleet', () => {
    const history = [
      { vehicle_id: 'a', status: 'FMC', recorded_at: '2026-10-11' },
      { vehicle_id: 'other-unit', status: 'NMC', recorded_at: '2026-10-11' },
    ]
    const series = buildReadinessSeries(vehicles, history, now)
    expect(series[0]).toEqual({ date: '2026-10-11', FMC: 1, PMC: 0, NMC: 0 })
  })

  it('counts PMC as its own line', () => {
    const history = [{ vehicle_id: 'b', status: 'PMC', recorded_at: '2026-10-10' }]
    expect(buildReadinessSeries(vehicles, history, now)[0].PMC).toBe(1)
  })

  it('has one point per local day across DST', () => {
    const marchNow = new Date(2026, 2, 10, 22, 0)
    const history = ['2026-03-06', '2026-03-07', '2026-03-08', '2026-03-09'].map((d) => ({
      vehicle_id: 'a',
      status: 'FMC',
      recorded_at: d,
    }))
    const dates = buildReadinessSeries(vehicles, history, marchNow).map((p) => p.date)
    expect(dates).toEqual(['2026-03-06', '2026-03-07', '2026-03-08', '2026-03-09', '2026-03-10'])
  })
})

describe('PMCS compliance thresholds', () => {
  const now = new Date(2026, 9, 12, 9, 0)
  const daysAgo = (n: number) => new Date(2026, 9, 12 - n, 15, 0).toISOString()

  it('Current up to 7 days, Due soon 8-14, Overdue after 14 or never', () => {
    expect(pmcsCompliance(daysAgo(0), now)).toEqual({ daysSince: 0, status: 'current' })
    expect(pmcsCompliance(daysAgo(7), now).status).toBe('current')
    expect(pmcsCompliance(daysAgo(8), now).status).toBe('due_soon')
    expect(pmcsCompliance(daysAgo(14), now).status).toBe('due_soon')
    expect(pmcsCompliance(daysAgo(15), now).status).toBe('overdue')
    expect(pmcsCompliance(null, now)).toEqual({ daysSince: null, status: 'overdue' })
    expect(isOverdue(daysAgo(14), now)).toBe(false)
    expect(isOverdue(daysAgo(15), now)).toBe(true)
    expect(isOverdue(null, now)).toBe(true)
  })

  it('uses local calendar days (a late-evening inspection is still "yesterday")', () => {
    const lateLast = new Date(2026, 9, 11, 23, 30).toISOString() // UTC date is Oct 12
    expect(pmcsCompliance(lateLast, now).daysSince).toBe(1)
  })
})

describe('weekly compliance', () => {
  const now = new Date(2026, 9, 12, 12, 0)
  const at = (y: number, m: number, d: number) => new Date(y, m, d, 10).toISOString()

  it('counts distinct in-fleet vehicles only, never above 100%', () => {
    const inspections = [
      { vehicle_id: 'a', completed_at: at(2026, 9, 12) },
      { vehicle_id: 'a', completed_at: at(2026, 9, 11) }, // same vehicle twice
      { vehicle_id: 'b', completed_at: at(2026, 9, 10) },
      { vehicle_id: 'x', completed_at: at(2026, 9, 10) }, // other unit
      { vehicle_id: 'y', completed_at: at(2026, 9, 9) },
      { vehicle_id: 'z', completed_at: at(2026, 9, 9) },
    ]
    const weeks = buildWeeklyCompliance(['a', 'b'], inspections, now)
    const last = weeks[weeks.length - 1]
    expect(last).toMatchObject({ weekEnd: '2026-10-12', inspected: 2, total: 2, pct: 100 })
    for (const w of weeks) expect(w.pct).toBeLessThanOrEqual(100)
  })

  it('uses 7-day windows ending on each week end', () => {
    const inspections = [
      { vehicle_id: 'a', completed_at: at(2026, 9, 6) }, // first day of the last window
      { vehicle_id: 'b', completed_at: at(2026, 9, 5) }, // previous window
    ]
    const weeks = buildWeeklyCompliance(['a', 'b'], inspections, now, 2)
    expect(weeks.map((w) => [w.weekEnd, w.inspected])).toEqual([
      ['2026-10-05', 1],
      ['2026-10-12', 1],
    ])
    expect(weeklyWindowStart(now, 2)).toBe('2026-09-29')
  })

  it('returns nothing for an empty fleet', () => {
    expect(buildWeeklyCompliance([], [], now)).toEqual([])
  })
})

describe('UIC input rules', () => {
  it('normalizes and validates', () => {
    expect(normalizeUic('  wabc12 ')).toBe('WABC12')
    expect(isValidUic('WABC12')).toBe(true)
    expect(uicError('WCCC')).toMatch(/exactly 6/)
    expect(uicError('WABC123')).toMatch(/exactly 6/)
    expect(uicError('WAB-12')).toMatch(/letters and digits/)
  })

  it('suggests zero for the letter O', () => {
    expect(zeroSuggestion('WAOO12')).toBe('WA0012')
    expect(zeroSuggestion('WABC12')).toBeNull()
  })
})
