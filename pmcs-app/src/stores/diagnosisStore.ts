import { create } from 'zustand';
import type { TroubleshootingTree, DiagnosisStep } from '../types/diagnosis';
import { advanceTrail, goBackTrail, getNode, getNextNodeId } from '../utils/diagnosisEngine';

interface DiagnosisState {
  active: boolean;
  faultId: string | null;
  sessionId: string | null;
  tree: TroubleshootingTree | null;
  currentNodeId: string | null;
  trail: DiagnosisStep[];
  skipReason: string | null;

  startDiagnosis: (faultId: string, sessionId: string, tree: TroubleshootingTree) => void;
  advance: (selectedOption?: string) => void;
  goBack: () => void;
  skip: (reason: string) => void;
  clear: () => void;
}

const initialState = {
  active: false,
  faultId: null,
  sessionId: null,
  tree: null,
  currentNodeId: null,
  trail: [] as DiagnosisStep[],
  skipReason: null,
};

export const useDiagnosisStore = create<DiagnosisState>((set, get) => ({
  ...initialState,

  startDiagnosis: (faultId, sessionId, tree) => {
    set({
      active: true,
      faultId,
      sessionId,
      tree,
      currentNodeId: tree.rootNodeId,
      trail: [],
      skipReason: null,
    });
  },

  advance: (selectedOption?: string) => {
    const { tree, currentNodeId, trail } = get();
    if (!tree || !currentNodeId) return;

    const currentNode = getNode(tree, currentNodeId);
    if (!currentNode) return;

    const newTrail = advanceTrail(trail, currentNodeId, currentNode.text, selectedOption);

    let nextId: string | undefined;
    if (currentNode.type === 'action') {
      nextId = currentNode.nextNodeId;
    } else if (selectedOption) {
      nextId = getNextNodeId(currentNode, selectedOption);
    }

    if (nextId) {
      set({ trail: newTrail, currentNodeId: nextId });
    }
  },

  goBack: () => {
    const { trail, tree } = get();
    if (!tree || trail.length === 0) return;

    const newTrail = goBackTrail(trail);
    const removedStep = trail[trail.length - 1];
    set({ trail: newTrail, currentNodeId: removedStep.nodeId });
  },

  skip: (reason) => {
    set({ active: false, skipReason: reason });
  },

  clear: () => {
    set({ ...initialState });
  },
}));
