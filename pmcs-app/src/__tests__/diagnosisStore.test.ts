import { describe, it, expect, beforeEach } from 'vitest';
import { useDiagnosisStore } from '../stores/diagnosisStore';

const mockTree = {
  categoryId: 'fluid-leak',
  vehicleType: 'M1151',
  tmReference: 'TM test',
  rootNodeId: 'q1',
  nodes: {
    q1: {
      id: 'q1',
      type: 'question' as const,
      text: 'What color is the fluid?',
      options: [
        { label: 'Green', nextNodeId: 'a1' },
        { label: 'Red', nextNodeId: 't1' },
      ],
    },
    a1: {
      id: 'a1',
      type: 'action' as const,
      text: 'Tighten clamp',
      actionText: 'Use screwdriver to tighten.',
      nextNodeId: 't2',
    },
    t1: {
      id: 't1',
      type: 'terminal' as const,
      text: 'Needs maintenance.',
      terminal: { resolution: 'needs-maintenance' as const, readiness: 'NMC' as const, summary: 'Trans leak' },
    },
    t2: {
      id: 't2',
      type: 'terminal' as const,
      text: 'Fixed.',
      terminal: { resolution: 'operator-fix' as const, readiness: 'PMC' as const, summary: 'Clamp tightened' },
    },
  },
};

describe('diagnosisStore', () => {
  beforeEach(() => {
    useDiagnosisStore.getState().clear();
  });

  it('starts with no active diagnosis', () => {
    const state = useDiagnosisStore.getState();
    expect(state.active).toBe(false);
    expect(state.tree).toBeNull();
  });

  it('startDiagnosis sets tree and current node to root', () => {
    useDiagnosisStore.getState().startDiagnosis('fault-1', 'session-1', mockTree);
    const state = useDiagnosisStore.getState();
    expect(state.active).toBe(true);
    expect(state.currentNodeId).toBe('q1');
    expect(state.trail).toHaveLength(0);
    expect(state.faultId).toBe('fault-1');
  });

  it('advance moves to next node and records trail', () => {
    useDiagnosisStore.getState().startDiagnosis('fault-1', 'session-1', mockTree);
    useDiagnosisStore.getState().advance('Green');
    const state = useDiagnosisStore.getState();
    expect(state.currentNodeId).toBe('a1');
    expect(state.trail).toHaveLength(1);
    expect(state.trail[0].selectedOption).toBe('Green');
  });

  it('advance through action node to terminal', () => {
    useDiagnosisStore.getState().startDiagnosis('fault-1', 'session-1', mockTree);
    useDiagnosisStore.getState().advance('Green');  // q1 -> a1
    useDiagnosisStore.getState().advance();          // a1 -> t2
    const state = useDiagnosisStore.getState();
    expect(state.currentNodeId).toBe('t2');
  });

  it('goBack returns to previous node', () => {
    useDiagnosisStore.getState().startDiagnosis('fault-1', 'session-1', mockTree);
    useDiagnosisStore.getState().advance('Green');
    useDiagnosisStore.getState().goBack();
    const state = useDiagnosisStore.getState();
    expect(state.currentNodeId).toBe('q1');
    expect(state.trail).toHaveLength(0);
  });

  it('skip sets outcome and reason', () => {
    useDiagnosisStore.getState().startDiagnosis('fault-1', 'session-1', mockTree);
    useDiagnosisStore.getState().skip('Already know the issue');
    const state = useDiagnosisStore.getState();
    expect(state.active).toBe(false);
    expect(state.skipReason).toBe('Already know the issue');
  });

  it('clear resets all state', () => {
    useDiagnosisStore.getState().startDiagnosis('fault-1', 'session-1', mockTree);
    useDiagnosisStore.getState().advance('Green');
    useDiagnosisStore.getState().clear();
    const state = useDiagnosisStore.getState();
    expect(state.active).toBe(false);
    expect(state.tree).toBeNull();
    expect(state.trail).toHaveLength(0);
  });
});
