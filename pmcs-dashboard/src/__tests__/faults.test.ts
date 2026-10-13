import { describe, it, expect } from 'vitest'
import { compareFaults, partsLabel } from '../lib/faults'

describe('partsLabel', () => {
  it('describes the part, with the NSN when given', () => {
    expect(partsLabel({ part_needed: true, part_description: ' Oil pan gasket ', nsn: '2940-01-000-0000' }))
      .toBe('Part needed: Oil pan gasket (NSN 2940-01-000-0000)')
    expect(partsLabel({ part_needed: true, part_description: null, nsn: null })).toBe('Part needed: TBD')
    expect(partsLabel({ part_needed: false, part_description: 'x', nsn: null })).toBeNull()
    expect(partsLabel({ part_needed: null, part_description: null, nsn: null })).toBeNull()
  })
})

describe('compareFaults', () => {
  it('puts NMC first, then newest, then by item number', () => {
    const faults = [
      { id: 'pmc-new', readiness: 'PMC' as const, created_at: '2026-10-12T12:00:00Z', item: '8' },
      { id: 'nmc-old-10', readiness: 'NMC' as const, created_at: '2026-10-01T12:00:00Z', item: '10' },
      { id: 'nmc-old-9', readiness: 'NMC' as const, created_at: '2026-10-01T12:00:00Z', item: '9' },
      { id: 'nmc-new', readiness: 'NMC' as const, created_at: '2026-10-12T12:00:00Z', item: '5' },
      { id: 'none', readiness: null, created_at: '2026-10-13T12:00:00Z', item: '1' },
    ]
    expect([...faults].sort(compareFaults).map((f) => f.id)).toEqual(['nmc-new', 'nmc-old-9', 'nmc-old-10', 'pmc-new', 'none'])
  })
})
