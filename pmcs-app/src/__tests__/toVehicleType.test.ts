import { describe, it, expect } from 'vitest';

// Extract the toVehicleType logic (same as SessionSetupPage.tsx)
function toVehicleType(model: string | null): string | null {
  if (!model) return null;
  const m = model.toUpperCase().replace(/[\s-]/g, '');
  if (/^M110[12]/.test(m)) return 'M1101_TRAILER';
  if (/^MEP(803|813)/.test(m)) return 'MEP803A';          // MEP-802A → null
  if (/^M1151/.test(m)) return 'M1151';
  if (/^(M1152|M1113|M1165)/.test(m)) return 'M1152';      // no weapon station
  if (/^M1078(?!A)/.test(m)) return 'LMTV_M1078';          // M1078A1/A1P2, M1083, M1085 → null
  return null;                                              // M1097 → null
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

  it.each(['M1097', 'MEP-802A', 'MEP802A', 'M1083A1', 'M1085A1P2WOW', 'M1078A1P2WOW', 'M984A4WO/W', 'PP-3102', '95A81', 'MJQ40B', 'PU-822A/T', ''])(
    'maps %s to null', (model) => {
      expect(toVehicleType(model)).toBeNull();
    }
  );
});
