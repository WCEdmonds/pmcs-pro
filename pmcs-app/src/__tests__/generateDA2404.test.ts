import { describe, it, expect } from 'vitest';
import { formatDate, formatInspectionType, tmDateFor } from '../utils/generateDA2404';

describe('DA 2404 formatters', () => {
  it('converts YYYY-MM-DD to YYYYMMDD', () => {
    expect(formatDate('2026-03-30')).toBe('20260330');
    expect(formatDate('2026-01-05')).toBe('20260105');
  });

  it.each([
    ['BEFORE', 'B'], ['DURING', 'D'], ['AFTER', 'A'], ['30_DAY', '30-Day'], ['MONTHLY', 'Monthly'], ['QUARTERLY', 'QUARTERLY'],
  ])('maps %s to %s', (input, out) => {
    expect(formatInspectionType(input)).toBe(out);
  });

  it('has TM dates for the HMMWV and LMTV', () => {
    expect(tmDateFor('M1151')).toMatch(/^\d{8}$/);
    expect(tmDateFor('LMTV_M1078')).toMatch(/^\d{8}$/);
  });
});
