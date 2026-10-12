import { describe, it, expect } from 'vitest';
import { readinessOf } from '../stores/historyStore';

describe('readinessOf', () => {
  const f = (readiness: 'PMC' | 'NMC', correctedOnSite = false) => ({ readiness, correctedOnSite });
  it('matches the server: NMC beats PMC beats FMC, and corrected faults are closed', () => {
    expect(readinessOf([])).toBe('FMC');
    expect(readinessOf([f('PMC')])).toBe('PMC');
    expect(readinessOf([f('PMC'), f('NMC')])).toBe('NMC');
    expect(readinessOf([f('NMC', true)])).toBe('FMC');
    expect(readinessOf([f('NMC', true), f('PMC')])).toBe('PMC');
  });
});
