import { describe, it, expect } from 'vitest';
import { VEHICLE_REGISTRY } from '../data/vehicles';
import type { VehicleType } from '../types';

describe('VEHICLE_REGISTRY', () => {
  it('has entries for all supported vehicle types', () => {
    const expectedTypes: VehicleType[] = ['M1151', 'M1152', 'LMTV_M1078', 'M1101_TRAILER', 'MEP803A'];
    for (const type of expectedTypes) {
      const entry = VEHICLE_REGISTRY.find((v) => v.type === type);
      expect(entry, `Missing registry entry for ${type}`).toBeDefined();
    }
  });

  it('has unique vehicle types', () => {
    const types = VEHICLE_REGISTRY.map((v) => v.type);
    expect(new Set(types).size).toBe(types.length);
  });

  it('all entries have required fields', () => {
    for (const entry of VEHICLE_REGISTRY) {
      expect(entry.type).toBeTruthy();
      expect(entry.name).toBeTruthy();
      expect(entry.nickname).toBeTruthy();
      expect(entry.tmReference).toBeTruthy();
      expect(entry.itemCount).toBeGreaterThan(0);
    }
  });

  it('TM references follow expected pattern', () => {
    for (const entry of VEHICLE_REGISTRY) {
      expect(entry.tmReference).toMatch(/^TM \d+-\d+-\d+-\d+/);
    }
  });
});

describe('vehicle item counts', () => {
  it('match the number of PMCS steps in each data file', async () => {
    const { VEHICLE_REGISTRY } = await import('../data/vehicles');
    const files: Record<string, string> = {
      M1151: 'm1151-hmmwv', M1152: 'm1152-hmmwv', LMTV_M1078: 'm1078-lmtv',
      M1101_TRAILER: 'm1101-trailer', MEP803A: 'mep803a-generator',
    };
    for (const v of VEHICLE_REGISTRY) {
      const data = (await import(`../data/pmcs/${files[v.type]}.json`)).default as { zones: { steps: unknown[] }[] };
      const steps = data.zones.reduce((n, z) => n + z.steps.length, 0);
      expect(v.itemCount, v.type).toBe(steps);
    }
  });
});
