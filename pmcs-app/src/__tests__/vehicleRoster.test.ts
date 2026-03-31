import { describe, it, expect } from 'vitest';
import { VEHICLE_ROSTER } from '../data/vehicleRoster';
import { VEHICLE_REGISTRY } from '../data/vehicles';

describe('VEHICLE_ROSTER', () => {
  it('has no duplicate bumper numbers', () => {
    const bumpers = VEHICLE_ROSTER.map((v) => v.bumperNumber);
    expect(new Set(bumpers).size).toBe(bumpers.length);
  });

  it('all vehicleType values map to a VEHICLE_REGISTRY entry', () => {
    const registeredTypes = new Set(VEHICLE_REGISTRY.map((v) => v.type));
    for (const rv of VEHICLE_ROSTER) {
      if (rv.vehicleType !== null) {
        expect(registeredTypes.has(rv.vehicleType), `${rv.bumperNumber} has vehicleType '${rv.vehicleType}' not in VEHICLE_REGISTRY`).toBe(true);
      }
    }
  });

  it('M1101 trailers map to M1101_TRAILER', () => {
    const m1101s = VEHICLE_ROSTER.filter((v) => v.model === 'M1101');
    expect(m1101s.length).toBeGreaterThan(0);
    for (const v of m1101s) {
      expect(v.vehicleType, `${v.bumperNumber} (M1101) should map to M1101_TRAILER`).toBe('M1101_TRAILER');
    }
  });

  it('M1102 trailers map to M1101_TRAILER', () => {
    const m1102s = VEHICLE_ROSTER.filter((v) => v.model === 'M1102');
    expect(m1102s.length).toBeGreaterThan(0);
    for (const v of m1102s) {
      expect(v.vehicleType, `${v.bumperNumber} (M1102) should map to M1101_TRAILER`).toBe('M1101_TRAILER');
    }
  });

  it('MEP803A generators map to MEP803A', () => {
    const gens = VEHICLE_ROSTER.filter((v) => v.model === 'MEP803A');
    expect(gens.length).toBeGreaterThan(0);
    for (const v of gens) {
      expect(v.vehicleType, `${v.bumperNumber} should map to MEP803A`).toBe('MEP803A');
    }
  });

  it('MEP802A generators map to MEP803A', () => {
    const gens = VEHICLE_ROSTER.filter((v) => v.model === 'MEP802A');
    expect(gens.length).toBeGreaterThan(0);
    for (const v of gens) {
      expect(v.vehicleType, `${v.bumperNumber} should map to MEP803A`).toBe('MEP803A');
    }
  });

  it('all entries have a bumperNumber and section', () => {
    for (const v of VEHICLE_ROSTER) {
      expect(v.bumperNumber).toBeTruthy();
      expect(v.section).toBeTruthy();
    }
  });
});
