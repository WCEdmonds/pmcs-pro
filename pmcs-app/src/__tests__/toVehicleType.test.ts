import { describe, it, expect } from 'vitest';
import { VEHICLE_REGISTRY } from '../data/vehicles';

// Extract the toVehicleType logic (same as SessionSetupPage.tsx)
function toVehicleType(model: string | null): string | null {
  if (!model) return null;
  const m = model.toUpperCase().replace(/[\s-]/g, '');
  if (/^M110[12]/.test(m)) return 'M1101_TRAILER';
  if (/^MEP(803|813)/.test(m)) return 'MEP803A';          // TM 9-6115-642-10
  if (/^MEP(802|812)/.test(m)) return 'MEP802A';          // TM 9-6115-641-10
  if (/^MEP103[01]/.test(m)) return 'MEP1030';            // TM 9-6115-749-10 (AMMPS 5 kW)
  if (/^MEP83[12]/.test(m)) return 'MEP831A';             // MEP831, MEP831A, MEP832A (TM 9-6115-639-13&P)
  if (/^M1151/.test(m)) return 'M1151';
  if (/^(M1152|M1113|M1165)/.test(m)) return 'M1152';      // no weapon station
  if (/^M1097/.test(m)) return 'M1097';                    // M1097, M1097A1, M1097A2 (TM 9-2320-280-10)
  if (/^M1078(?!A)/.test(m)) return 'LMTV_M1078';          // M1078A1/A1P2, M1083, M1085 → null
  return null;                                              // unknown models → null
}

describe('toVehicleType (server model string mapping)', () => {
  it('maps null to null', () => {
    expect(toVehicleType(null)).toBeNull();
  });

  it.each(['M1151', 'M1151A1', 'm1151a1'])('maps %s to M1151', (model) => {
    expect(toVehicleType(model)).toBe('M1151');
  });

  it.each(['M1152', 'M1152A1', 'M1113', 'M1165A1', 'M-1165'])('maps %s to M1152', (model) => {
    expect(toVehicleType(model)).toBe('M1152');
  });

  it.each(['M1078', 'M1078 '])('maps %s to LMTV_M1078', (model) => {
    expect(toVehicleType(model)).toBe('LMTV_M1078');
  });

  it.each(['M1101', 'M1102'])('maps %s to M1101_TRAILER', (model) => {
    expect(toVehicleType(model)).toBe('M1101_TRAILER');
  });

  it.each(['MEP803A', 'MEP813A', 'MEP-803A', 'MEP-813A'])('maps %s to MEP803A', (model) => {
    expect(toVehicleType(model)).toBe('MEP803A');
  });

  it.each(['M1097', 'M1097A1', 'M1097A2', 'm1097a2', 'M-1097A2'])('maps %s to M1097', (model) => {
    expect(toVehicleType(model)).toBe('M1097');
  });

  it.each(['MEP802A', 'MEP-802A', 'MEP812A', 'MEP-812A'])('maps %s to MEP802A', (model) => {
    expect(toVehicleType(model)).toBe('MEP802A');
  });

  it.each(['MEP-1030', 'MEP1030', 'MEP-1031', 'mep 1030'])('maps %s to MEP1030', (model) => {
    expect(toVehicleType(model)).toBe('MEP1030');
  });

  it.each(['MEP831', 'MEP831A', 'MEP-831A', 'MEP832A', 'MEP-832A'])('maps %s to MEP831A', (model) => {
    expect(toVehicleType(model)).toBe('MEP831A');
  });

  it('never maps the M1097 to an up-armored HMMWV type', () => {
    expect(toVehicleType('M1097')).not.toBe('M1151');
    expect(toVehicleType('M1097')).not.toBe('M1152');
  });

  it.each(['M1083A1', 'M1085A1P2WOW', 'M1078A1P2WOW', 'M984A4WO/W', 'PP-3102', '95A81', 'MJQ40B', 'PU-822A/T', 'MEP804A', 'MEP-1040', 'M998', ''])(
    'maps %s to null', (model) => {
      expect(toVehicleType(model)).toBeNull();
    }
  );

  // SessionSetupPage accepts an exact app type id (the sync sends session.vehicleType as vehicle_type)
  // before falling back to toVehicleType.
  const resolve = (vt: string | null) =>
    VEHICLE_REGISTRY.some((r) => r.type === vt) ? vt : toVehicleType(vt);

  it.each(VEHICLE_REGISTRY.map((r) => r.type))('passes app type id %s through unchanged', (type) => {
    expect(resolve(type)).toBe(type);
  });
});
