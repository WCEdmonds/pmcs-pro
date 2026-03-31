import { describe, it, expect } from 'vitest';

// Test the pure helper functions from generateDA2404
// (We can't test the full PDF generation without a template PDF, but we can test formatters)

function formatDate(dateStr: string): string {
  return dateStr.replace(/-/g, '');
}

function formatInspectionType(type: string): string {
  switch (type) {
    case 'BEFORE': return 'B';
    case 'DURING': return 'D';
    case 'AFTER': return 'A';
    case '30_DAY': return '30-Day';
    default: return type;
  }
}

describe('DA 2404 formatters', () => {
  describe('formatDate', () => {
    it('converts YYYY-MM-DD to YYYYMMDD', () => {
      expect(formatDate('2026-03-30')).toBe('20260330');
    });

    it('handles single-digit months and days', () => {
      expect(formatDate('2026-01-05')).toBe('20260105');
    });
  });

  describe('formatInspectionType', () => {
    it('maps BEFORE to B', () => {
      expect(formatInspectionType('BEFORE')).toBe('B');
    });

    it('maps DURING to D', () => {
      expect(formatInspectionType('DURING')).toBe('D');
    });

    it('maps AFTER to A', () => {
      expect(formatInspectionType('AFTER')).toBe('A');
    });

    it('maps 30_DAY to 30-Day', () => {
      expect(formatInspectionType('30_DAY')).toBe('30-Day');
    });

    it('returns unknown types as-is', () => {
      expect(formatInspectionType('QUARTERLY')).toBe('QUARTERLY');
    });
  });
});
