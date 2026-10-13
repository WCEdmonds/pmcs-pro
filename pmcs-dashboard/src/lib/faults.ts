import type { Fault } from '../types/database'

type PartsFields = Pick<Fault, 'part_needed' | 'part_description' | 'nsn'>

/** "Part needed: Oil pan gasket (NSN 2940-...)", or null when no part was requested. Same wording as the DA 2404. */
export function partsLabel(f: PartsFields): string | null {
  if (!f.part_needed) return null
  const desc = f.part_description?.trim() || 'TBD'
  const nsn = f.nsn?.trim()
  return `Part needed: ${desc}${nsn ? ` (NSN ${nsn})` : ''}`
}

const READINESS_RANK: Record<string, number> = { NMC: 0, PMC: 1 }

/** NMC before PMC, then newest first, then by TM item number. */
export function compareFaults(
  a: Pick<Fault, 'readiness' | 'created_at' | 'item'>,
  b: Pick<Fault, 'readiness' | 'created_at' | 'item'>,
): number {
  const r = (READINESS_RANK[a.readiness ?? ''] ?? 2) - (READINESS_RANK[b.readiness ?? ''] ?? 2)
  if (r) return r
  const t = (b.created_at ?? '').localeCompare(a.created_at ?? '')
  if (t) return t
  return (a.item ?? '').localeCompare(b.item ?? '', undefined, { numeric: true })
}
