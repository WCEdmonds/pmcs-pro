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
