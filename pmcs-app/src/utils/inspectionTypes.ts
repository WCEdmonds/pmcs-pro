import type { InspectionType, PmcsStepData, PmcsVehicleData } from '../types';

/** Display order of inspection types. 30_DAY includes every item. */
export const INSPECTION_TYPE_ORDER: InspectionType[] = ['BEFORE', 'DURING', 'AFTER', 'WEEKLY', 'MONTHLY', '30_DAY'];

export const INSPECTION_TYPE_LABELS: Record<InspectionType, string> = {
  BEFORE: 'Before',
  DURING: 'During',
  AFTER: 'After',
  WEEKLY: 'Weekly',
  MONTHLY: 'Monthly',
  '30_DAY': '30-Day',
};

export function inspectionTypeLabel(type: string): string {
  return INSPECTION_TYPE_LABELS[type as InspectionType] ?? type;
}

function normalizeConditionSet(cs: string | undefined): string {
  return (cs ?? '').trim().toUpperCase().replace(/[\s-]+/g, '_');
}

function stepMatchesType(step: PmcsStepData, type: InspectionType): boolean {
  if (type === '30_DAY') return true;
  return normalizeConditionSet(step.conditionSet) === type;
}

/**
 * The steps for an inspection, in walkthrough order. startSession and
 * restoreSession MUST both use this so step indexes stay consistent.
 */
export function stepsForInspection(vehicleData: PmcsVehicleData, type: InspectionType): PmcsStepData[] {
  const all = vehicleData.zones.flatMap((z) => z.steps);
  const order = new Map(all.map((s, i) => [s.id, i]));
  return all
    .filter((s) => stepMatchesType(s, type))
    .sort((a, b) => (a.sequence ?? 0) - (b.sequence ?? 0) || (order.get(a.id)! - order.get(b.id)!));
}

/** Inspection types that have at least one step for this vehicle, in display order. */
export function availableInspectionTypes(vehicleData: PmcsVehicleData): InspectionType[] {
  return INSPECTION_TYPE_ORDER.filter((t) => stepsForInspection(vehicleData, t).length > 0);
}
