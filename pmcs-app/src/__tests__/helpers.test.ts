import { describe, it, expect } from 'vitest';
import { localDateString, localTimeHHMM, parseOdometer } from '../utils/format';
import { sanitizeWinAnsi, sanitizeLine } from '../utils/winAnsi';
import { validateUic, normalizeUic } from '../utils/uicLookup';
import { stepsForInspection, availableInspectionTypes } from '../utils/inspectionTypes';
import { buildRows, MAX_ROWS, formatInspectionType, formatDate } from '../utils/generateDA2404';
import { defaultReadiness } from '../utils/diagnosisEngine';
import { backoffDelay, BASE_BACKOFF_MS, MAX_BACKOFF_MS } from '../utils/syncEngine';
import type { Fault, PmcsVehicleData } from '../types';

describe('localDateString', () => {
  it('uses the local calendar date, not UTC', () => {
    // 9:30 PM local on Oct 12 — toISOString() would roll over to the 13th in US time zones
    const evening = new Date(2026, 9, 12, 21, 30);
    expect(localDateString(evening)).toBe('2026-10-12');
    const justBeforeMidnight = new Date(2026, 0, 31, 23, 59, 59);
    expect(localDateString(justBeforeMidnight)).toBe('2026-01-31');
  });
  it('pads month and day', () => {
    expect(localDateString(new Date(2026, 2, 5, 1, 0))).toBe('2026-03-05');
  });
  it('formats local HHMM', () => {
    expect(localTimeHHMM(new Date(2026, 0, 1, 7, 5))).toBe('0705');
    expect(localTimeHHMM(new Date(2026, 0, 1, 23, 59))).toBe('2359');
  });
});

describe('parseOdometer', () => {
  it('accepts plain digits', () => expect(parseOdometer('34218')).toEqual({ value: 34218 }));
  it('strips thousands separators', () => {
    expect(parseOdometer('34,218')).toEqual({ value: 34218 });
    expect(parseOdometer(' 1,234,567 ')).toEqual({ value: 1234567 });
    expect(parseOdometer('34 218')).toEqual({ value: 34218 });
  });
  it('rejects non-digits', () => {
    expect(parseOdometer('abc')).toHaveProperty('error');
    expect(parseOdometer('12.5')).toHaveProperty('error');
    expect(parseOdometer('-5')).toHaveProperty('error');
    expect(parseOdometer('')).toHaveProperty('error');
  });
  it('rejects more than 7 digits', () => {
    expect(parseOdometer('12345678')).toHaveProperty('error');
    expect(parseOdometer('9999999')).toEqual({ value: 9999999 });
  });
  it('keeps leading zeros harmless', () => expect(parseOdometer('00042')).toEqual({ value: 42 }));
});

describe('sanitizeWinAnsi', () => {
  it('strips diacritics', () => {
    expect(sanitizeWinAnsi('Nguyễn')).toBe('Nguyen');
    expect(sanitizeWinAnsi('José Peña Müller')).toBe('Jose Pena Muller');
  });
  it('maps smart quotes, dashes and ellipsis', () => {
    expect(sanitizeWinAnsi('“Leak” – it’s bad — really…')).toBe('"Leak" - it\'s bad - really...');
  });
  it('replaces check marks and emoji', () => {
    expect(sanitizeWinAnsi('done ✓')).toBe('done OK');
    expect(sanitizeWinAnsi('fire 🔥!')).toBe('fire ?!');
    expect(sanitizeWinAnsi('👍🏽')).toMatch(/^\?+$/);
  });
  it('keeps plain ASCII and newlines', () => {
    expect(sanitizeWinAnsi('ABC-123 (ok)\nline2')).toBe('ABC-123 (ok)\nline2');
  });
  it('output is always printable ASCII', () => {
    const out = sanitizeLine('Ω≈ç√∫˜µ≤≥÷ 中文 Ǆ ﬁ ½ ™');
    expect(out).toMatch(/^[\x20-\x7e]*$/);
  });
  it('handles null/undefined', () => {
    expect(sanitizeWinAnsi(undefined)).toBe('');
    expect(sanitizeWinAnsi(null)).toBe('');
  });
});

describe('UIC validation', () => {
  it('uppercases and trims', () => {
    expect(normalizeUic('  wabc12 ')).toBe('WABC12');
    expect(validateUic(' wabc12 ')).toMatchObject({ value: 'WABC12', valid: true });
  });
  it('requires exactly 6 alphanumerics', () => {
    expect(validateUic('WXYZA01').valid).toBe(false);
    expect(validateUic('WXYZ').valid).toBe(false);
    expect(validateUic('WB-FA0').valid).toBe(false);
  });
  it('suggests 0 for the letter O', () => {
    expect(validateUic('wxyzao')).toMatchObject({ value: 'WXYZAO', valid: true, suggestion: 'WXYZA0' });
    expect(validateUic('WXYZA0').suggestion).toBeUndefined();
  });
});

const data: PmcsVehicleData = {
  vehicleType: 'TEST',
  tmReference: 'TM',
  zones: [
    { id: 'z1', name: 'Zone 1', description: '', steps: [
      { id: 'a', sequence: 1, zone: 'Zone 1', zoneId: 'z1', item: '1', itemDescription: 'A', procedure: '', conditionSet: 'BEFORE', isNoGo: false },
      { id: 'b', sequence: 2, zone: 'Zone 1', zoneId: 'z1', item: '2', itemDescription: 'B', procedure: '', conditionSet: 'AFTER', isNoGo: true },
    ] },
    { id: 'z2', name: 'Zone 2', description: '', steps: [
      { id: 'c', sequence: 3, zone: 'Zone 2', zoneId: 'z2', item: '3', itemDescription: 'C', procedure: '', conditionSet: 'Weekly', isNoGo: false },
    ] },
  ],
};

describe('inspection types', () => {
  it('filters by conditionSet and 30_DAY includes all', () => {
    expect(stepsForInspection(data, 'BEFORE').map((s) => s.id)).toEqual(['a']);
    expect(stepsForInspection(data, 'WEEKLY').map((s) => s.id)).toEqual(['c']);
    expect(stepsForInspection(data, '30_DAY').map((s) => s.id)).toEqual(['a', 'b', 'c']);
    expect(stepsForInspection(data, 'DURING')).toEqual([]);
  });
  it('only offers types with steps', () => {
    expect(availableInspectionTypes(data)).toEqual(['BEFORE', 'AFTER', 'WEEKLY', '30_DAY']);
  });
});

function fault(i: number): Fault {
  return {
    id: `f${i}`, sessionId: 's', vehicleId: 'v', stepId: 'x', zone: 'Z', item: String(i), itemDescription: 'Item',
    categoryId: '', readiness: i % 2 ? 'NMC' : 'PMC', description: `desc ${i}`, partNeeded: false,
    correctedOnSite: false, needsMaintenance: true, createdAt: '',
  };
}

describe('DA 2404 rows', () => {
  it('no faults → completed line', () => {
    expect(buildRows([])).toHaveLength(1);
    expect(buildRows([])[0].deficiency).toMatch(/NO DEFICIENCIES/);
  });
  it('adds remarks rows', () => {
    const rows = buildRows([fault(1)], 'Smart “quote” remark');
    expect(rows).toHaveLength(2);
    expect(rows[1].deficiency).toBe('REMARKS: Smart "quote" remark');
  });
  it('never silently drops rows beyond 42', () => {
    const rows = buildRows(Array.from({ length: 50 }, (_, i) => fault(i)));
    expect(rows).toHaveLength(MAX_ROWS);
    expect(rows[MAX_ROWS - 1].deficiency).toMatch(/9 MORE ENTRIES NOT SHOWN/);
  });
  it('exactly 42 rows fit without a warning', () => {
    const rows = buildRows(Array.from({ length: 42 }, (_, i) => fault(i)));
    expect(rows).toHaveLength(42);
    expect(rows[41].deficiency).toBe('Item: desc 41');
  });
  it('formats header fields', () => {
    expect(formatDate('2026-03-30')).toBe('20260330');
    expect(formatInspectionType('BEFORE')).toBe('B');
    expect(formatInspectionType('WEEKLY')).toBe('Weekly');
  });
});

describe('default fault readiness', () => {
  const pmcCat = { id: 'c', label: 'c', icon: '', hasDiagnosisTree: false, affectsReadiness: 'PMC' as const };
  it('NMC when the step has an NMC criterion even if the category says PMC', () => {
    expect(defaultReadiness({ isNoGo: true, noGoCondition: 'Missing' }, pmcCat)).toBe('NMC');
  });
  it('category default otherwise', () => {
    expect(defaultReadiness({ isNoGo: false }, pmcCat)).toBe('PMC');
    expect(defaultReadiness({ isNoGo: false }, { ...pmcCat, affectsReadiness: 'NMC' })).toBe('NMC');
    expect(defaultReadiness({ isNoGo: false }, null)).toBe('PMC');
  });
});

describe('backoff', () => {
  it('grows exponentially and is capped (never infinite)', () => {
    expect(backoffDelay(0)).toBe(0);
    expect(backoffDelay(1)).toBe(BASE_BACKOFF_MS);
    expect(backoffDelay(2)).toBe(BASE_BACKOFF_MS * 2);
    expect(backoffDelay(50)).toBe(MAX_BACKOFF_MS);
  });
});
