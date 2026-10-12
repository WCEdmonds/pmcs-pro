import { describe, it, expect } from 'vitest';
import { toWinAnsi } from '../src/winansi';
import { parseUic, normalizeBumper, readCapped, sniffImage, isPdf, str, bool01, HttpError } from '../src/validate';

describe('toWinAnsi', () => {
  it('keeps WinAnsi text and transliterates or replaces the rest', () => {
    expect(toWinAnsi('Nguyễn ✓ 😀')).toBe('Nguyen ? ?');
    expect(toWinAnsi('José Müller — 5½ “ok” €')).toBe('José Müller — 5½ “ok” €');
    expect(toWinAnsi('Łódź Straße')).toBe('?ódz Straße');
    expect(toWinAnsi('line1\nline2\ttab')).toBe('line1 line2 tab');
    expect(toWinAnsi(null)).toBe('');
  });
});

describe('validation helpers', () => {
  it('normalizes UICs and bumpers', () => {
    expect(parseUic(' wxyza0 ')).toBe('WXYZA0');
    expect(() => parseUic('WXYZA01')).toThrow(HttpError);
    expect(() => parseUic(42)).toThrow(/required/);
    expect(normalizeBumper('hhc- 20')).toBe('HHC20');
  });

  it('type-checks fields', () => {
    expect(str({ a: ' x ' }, 'a')).toBe('x');
    expect(() => str({ a: {} }, 'a')).toThrow(/must be a string/);
    expect(bool01({ a: true }, 'a')).toBe(1);
    expect(() => bool01({ a: 'yes' }, 'a')).toThrow(/boolean/);
  });

  it('caps streamed bodies and sniffs file types', async () => {
    const small = new Request('http://x', { method: 'POST', body: new Uint8Array([0xff, 0xd8, 0xff, 1]) });
    expect(sniffImage(await readCapped(small, 10))).toBe('jpg');
    const big = new Request('http://x', { method: 'POST', body: new Uint8Array(11) });
    await expect(readCapped(big, 10)).rejects.toMatchObject({ status: 413 });
    expect(isPdf(new TextEncoder().encode('%PDF-1.7'))).toBe(true);
    expect(sniffImage(new TextEncoder().encode('<svg'))).toBeNull();
  });
});

describe('DA 2404 rows', () => {
  it('adds remarks and marks overflow instead of dropping rows', async () => {
    const { buildRows } = await import('../src/da2404');
    const fault = { item: '1', item_description: 'Tires', description: 'Flat', readiness: 'NMC', corrective_action: null,
      corrected_on_site: 0, needs_maintenance: 1, part_needed: 0, part_description: null, nsn: null };
    const withRemarks = buildRows([fault], 'Checked twice');
    expect(withRemarks.map((r) => r.deficiency)).toEqual(['Tires: Flat', 'REMARKS: Checked twice']);
    const many = buildRows(Array.from({ length: 50 }, () => fault), null);
    expect(many).toHaveLength(42);
    expect(many[41].deficiency).toBe('*** 9 MORE ENTRIES NOT SHOWN - FORM FULL ***');
    expect(buildRows([], null)[0].deficiency).toMatch(/NO DEFICIENCIES/);
  });
});

describe('DA 2404 TM number and date', () => {
  it.each([
    // app VehicleType ids (what the field app syncs as vehicle_type)
    ['M1151', 'TM 9-2320-387-10', '20090630'],
    ['M1152', 'TM 9-2320-387-10', '20090630'],
    ['LMTV_M1078', 'TM 9-2320-365-10', '20010531'],
    ['M1101_TRAILER', 'TM 9-2330-392-14&P', '20010427'],
    ['MEP803A', 'TM 9-6115-642-10', '19961030'],
    ['M1097', 'TM 9-2320-280-10', '20040715'],
    ['MEP802A', 'TM 9-6115-641-10', '20091015'],
    ['MEP1030', 'TM 9-6115-749-10', '20110201'],
    ['MEP831A', 'TM 9-6115-639-13&P', '20100430'],
    // roster model strings
    ['M1097A2', 'TM 9-2320-280-10', '20040715'],
    ['m1097a1', 'TM 9-2320-280-10', '20040715'],
    ['M1165A1', 'TM 9-2320-387-10', '20090630'],
    ['MEP-802A', 'TM 9-6115-641-10', '20091015'],
    ['MEP812A', 'TM 9-6115-641-10', '20091015'],
    ['MEP-1030', 'TM 9-6115-749-10', '20110201'],
    ['MEP-1031', 'TM 9-6115-749-10', '20110201'],
    ['MEP831', 'TM 9-6115-639-13&P', '20100430'],
    ['MEP-832A', 'TM 9-6115-639-13&P', '20100430'],
  ])('%s -> %s (%s)', async (type, tm, tmDate) => {
    const { tmFor } = await import('../src/da2404');
    expect(tmFor(type)).toEqual(expect.objectContaining({ tm, tmDate }));
  });

  it('leaves the TM blank for unknown models', async () => {
    const { tmFor } = await import('../src/da2404');
    for (const m of [null, '', 'M1083A1', 'MEP804A', 'PP-3102']) expect(tmFor(m)).toEqual(expect.objectContaining({ tm: '', tmDate: '' }));
  });
});
