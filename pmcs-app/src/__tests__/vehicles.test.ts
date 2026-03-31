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
