import { describe, it, expect } from 'vitest';

// Extract the toVehicleType logic (same as SessionSetupPage.tsx)
function toVehicleType(model: string | null): string | null {
  if (!model) return null;
  if (['M1101', 'M1102'].some(m => model.includes(m))) return 'M1101_TRAILER';
  if (['MEP803', 'MEP813', 'MEP-803', 'MEP-813', 'MEP802', 'MEP-802'].some(m => model.includes(m))) return 'MEP803A';
  if (['M1151', 'M1151A1', 'M1113', 'M1097', 'M1165A1'].some(m => model.includes(m))) return 'M1151';
  if (['M1152', 'M1152A1'].some(m => model.includes(m))) return 'M1152';
  if (['M1078', 'M1083', 'M1085'].some(m => model.includes(m))) return 'LMTV_M1078';
  return null;
}

describe('toVehicleType (Supabase model string mapping)', () => {
  it('maps null to null', () => {
    expect(toVehicleType(null)).toBeNull();
  });

  // HMMWV family
  it.each(['M1151', 'M1151A1', 'M1113', 'M1097', 'M1165A1'])(
    'maps %s to M1151', (model) => {
      expect(toVehicleType(model)).toBe('M1151');
    }
  );

  it.each(['M1152', 'M1152A1'])(
    'maps %s to M1152', (model) => {
      expect(toVehicleType(model)).toBe('M1152');
    }
  );

  // FMTV family
  it.each(['M1078', 'M1078A1P2WOW', 'M1083A1', 'M1085A1P2WOW'])(
    'maps %s to LMTV_M1078', (model) => {
      expect(toVehicleType(model)).toBe('LMTV_M1078');
    }
  );

  // Trailer family
  it.each(['M1101', 'M1102'])(
    'maps %s to M1101_TRAILER', (model) => {
      expect(toVehicleType(model)).toBe('M1101_TRAILER');
    }
  );

  // Generator family
  it.each(['MEP803A', 'MEP813A', 'MEP-803A', 'MEP-813A', 'MEP802A', 'MEP-802A'])(
    'maps %s to MEP803A', (model) => {
      expect(toVehicleType(model)).toBe('MEP803A');
    }
  );

  // Unknown models
  it.each(['M984A4WO/W', 'PP-3102', '95A81', 'MJQ40B', 'PU-822A/T', ''])(
    'maps unknown model %s to null', (model) => {
      expect(toVehicleType(model)).toBeNull();
    }
  );
});
