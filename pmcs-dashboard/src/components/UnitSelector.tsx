import { Building2 } from 'lucide-react'
import { unitLabel, useUnits } from '../hooks/useUnits'

/** "All my units" + each visible UIC. Hidden when the user can only see one unit. */
export function UnitSelector() {
  const { units, unitNames, selectedUnit, setSelectedUnit, ownUnit } = useUnits()
  if (units.length <= 1) return null
  return (
    <label className="flex items-center gap-2 text-sm text-text-secondary">
      <Building2 className="w-4 h-4" />
      <span className="sr-only">Unit</span>
      <select
        aria-label="Unit"
        value={selectedUnit}
        onChange={(e) => setSelectedUnit(e.target.value)}
        className="px-3 py-2 bg-bg-tertiary border border-border rounded-lg text-sm text-text-primary focus:outline-none focus:ring-1 focus:ring-accent-blue"
      >
        <option value="">All my units ({units.length})</option>
        {units.map((u) => (
          <option key={u} value={u}>
            {unitLabel(u, unitNames)}
            {u === ownUnit ? ' - own unit' : ' - watched'}
          </option>
        ))}
      </select>
    </label>
  )
}
