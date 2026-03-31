import { describe, it, expect } from 'vitest';
import {
  getNode,
  advanceTrail,
  goBackTrail,
  buildFaultDescription,
  getReadinessForCategory,
} from '../utils/diagnosisEngine';
import type { TroubleshootingTree, DiagnosisStep, FaultCategory } from '../types/diagnosis';

const mockTree: TroubleshootingTree = {
  categoryId: 'fluid-leak',
  vehicleType: 'M1151',
  tmReference: 'TM 9-2320-387-10, Ch. 3',
  rootNodeId: 'q1',
  nodes: {
    q1: {
      id: 'q1',
      type: 'question',
      text: 'Is the fluid green or orange?',
      options: [
        { label: 'Green', nextNodeId: 'q2' },
        { label: 'Orange', nextNodeId: 't1' },
      ],
    },
    q2: {
      id: 'q2',
      type: 'question',
      text: 'Is the leak at the radiator hose?',
      options: [
        { label: 'Yes', nextNodeId: 'a1' },
        { label: 'No', nextNodeId: 't2' },
      ],
    },
    a1: {
      id: 'a1',
      type: 'action',
      text: 'Tighten the hose clamp',
      actionText: 'Use a flathead screwdriver to tighten the clamp 1/4 turn.',
      nextNodeId: 't3',
    },
    t1: {
      id: 't1',
      type: 'terminal',
      text: 'Transmission fluid leak detected.',
      terminal: {
        resolution: 'needs-maintenance',
        readiness: 'NMC',
        summary: 'Trans leak',
      },
    },
    t2: {
      id: 't2',
      type: 'terminal',
      text: 'Coolant leak not at hose.',
      terminal: {
        resolution: 'needs-maintenance',
        readiness: 'NMC',
        summary: 'Coolant leak at unknown source — needs maintenance',
      },
    },
    t3: {
      id: 't3',
      type: 'terminal',
      text: 'Hose clamp tightened.',
      terminal: {
        resolution: 'operator-fix',
        readiness: 'PMC',
        summary: 'Coolant leak at radiator hose — tightened clamp',
      },
    },
  },
};

describe('getNode', () => {
  it('returns the node for a valid ID', () => {
    const node = getNode(mockTree, 'q1');
    expect(node).toBeDefined();
    expect(node!.text).toBe('Is the fluid green or orange?');
  });

  it('returns undefined for an invalid ID', () => {
    expect(getNode(mockTree, 'nonexistent')).toBeUndefined();
  });
});

describe('advanceTrail', () => {
  it('adds a step to an empty trail', () => {
    const trail = advanceTrail([], 'q1', 'Is the fluid green or orange?', 'Green');
    expect(trail).toHaveLength(1);
    expect(trail[0].nodeId).toBe('q1');
    expect(trail[0].selectedOption).toBe('Green');
  });

  it('appends to existing trail', () => {
    const existing: DiagnosisStep[] = [
      { nodeId: 'q1', nodeText: 'Q1', selectedOption: 'Green', timestamp: '2026-01-01T00:00:00Z' },
    ];
    const trail = advanceTrail(existing, 'q2', 'Q2', 'Yes');
    expect(trail).toHaveLength(2);
    expect(trail[1].nodeId).toBe('q2');
  });
});

describe('goBackTrail', () => {
  it('removes the last step', () => {
    const trail: DiagnosisStep[] = [
      { nodeId: 'q1', nodeText: 'Q1', selectedOption: 'Green', timestamp: '2026-01-01T00:00:00Z' },
      { nodeId: 'q2', nodeText: 'Q2', selectedOption: 'Yes', timestamp: '2026-01-01T00:00:01Z' },
    ];
    const result = goBackTrail(trail);
    expect(result).toHaveLength(1);
    expect(result[0].nodeId).toBe('q1');
  });

  it('returns empty array when trail has one step', () => {
    const trail: DiagnosisStep[] = [
      { nodeId: 'q1', nodeText: 'Q1', selectedOption: 'Green', timestamp: '2026-01-01T00:00:00Z' },
    ];
    expect(goBackTrail(trail)).toHaveLength(0);
  });

  it('returns empty array when trail is empty', () => {
    expect(goBackTrail([])).toHaveLength(0);
  });
});

describe('buildFaultDescription', () => {
  it('returns only the terminal summary (trail details stay in diagnosisAttempts)', () => {
    const trail: DiagnosisStep[] = [
      { nodeId: 'q1', nodeText: 'Is the fluid green or orange?', selectedOption: 'Green', timestamp: '2026-01-01T00:00:00Z' },
      { nodeId: 'q2', nodeText: 'Is the leak at the radiator hose?', selectedOption: 'Yes', timestamp: '2026-01-01T00:00:01Z' },
    ];
    const desc = buildFaultDescription(trail, 'Coolant leak at radiator hose — tightened clamp');
    expect(desc).toBe('Coolant leak at radiator hose — tightened clamp');
  });

  it('handles empty trail with just a summary', () => {
    const desc = buildFaultDescription([], 'Direct fault');
    expect(desc).toBe('Direct fault');
  });
});

describe('getReadinessForCategory', () => {
  it('returns the fixed readiness for non-tree categories', () => {
    const cat: FaultCategory = {
      id: 'body-damage',
      label: 'Body Damage',
      icon: 'shield-alert',
      hasDiagnosisTree: false,
      affectsReadiness: 'PMC',
    };
    expect(getReadinessForCategory(cat)).toBe('PMC');
  });

  it('returns undefined for tree-determined categories', () => {
    const cat: FaultCategory = {
      id: 'fluid-leak',
      label: 'Fluid Leak',
      icon: 'droplets',
      hasDiagnosisTree: true,
      affectsReadiness: 'determined-by-tree',
    };
    expect(getReadinessForCategory(cat)).toBeUndefined();
  });
});
