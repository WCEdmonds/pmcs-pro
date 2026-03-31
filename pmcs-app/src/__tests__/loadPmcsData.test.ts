import { describe, it, expect } from 'vitest';
import { loadPmcsData } from '../utils/loadPmcsData';
import type { VehicleType } from '../types';

const VEHICLE_TYPES: VehicleType[] = ['M1151', 'M1152', 'LMTV_M1078', 'M1101_TRAILER', 'MEP803A'];

describe('loadPmcsData', () => {
  it.each(VEHICLE_TYPES)('loads PMCS data for %s', async (type) => {
    const data = await loadPmcsData(type);
    expect(data).toBeDefined();
    expect(data.vehicleType).toBeTruthy();
    expect(data.tmReference).toBeTruthy();
    expect(data.zones).toBeInstanceOf(Array);
    expect(data.zones.length).toBeGreaterThan(0);
  });

  it.each(VEHICLE_TYPES)('%s zones have valid steps', async (type) => {
    const data = await loadPmcsData(type);
    for (const zone of data.zones) {
      expect(zone.id).toBeTruthy();
      expect(zone.name).toBeTruthy();
      expect(zone.steps.length).toBeGreaterThan(0);
      for (const step of zone.steps) {
        expect(step.id).toBeTruthy();
        expect(step.sequence).toBeGreaterThanOrEqual(1);
        expect(step.itemDescription).toBeTruthy();
        expect(step.procedure).toBeTruthy();
        expect(typeof step.isNoGo).toBe('boolean');
      }
    }
  });

  it.each(VEHICLE_TYPES)('%s has unique step IDs', async (type) => {
    const data = await loadPmcsData(type);
    const allSteps = data.zones.flatMap((z) => z.steps);
    const ids = allSteps.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it.each(VEHICLE_TYPES)('%s has sequential step numbering', async (type) => {
    const data = await loadPmcsData(type);
    const allSteps = data.zones.flatMap((z) => z.steps);
    const sequences = allSteps.map((s) => s.sequence);
    for (let i = 1; i < sequences.length; i++) {
      expect(sequences[i]).toBeGreaterThanOrEqual(sequences[i - 1]);
    }
  });
});
