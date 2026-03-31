import type {
  TroubleshootingTree,
  TreeNode,
  DiagnosisStep,
  FaultCategory,
  Readiness,
} from '../types/diagnosis';

export function getNode(tree: TroubleshootingTree, nodeId: string): TreeNode | undefined {
  return tree.nodes[nodeId];
}

export function advanceTrail(
  trail: DiagnosisStep[],
  nodeId: string,
  nodeText: string,
  selectedOption?: string,
): DiagnosisStep[] {
  return [
    ...trail,
    {
      nodeId,
      nodeText,
      selectedOption,
      timestamp: new Date().toISOString(),
    },
  ];
}

export function goBackTrail(trail: DiagnosisStep[]): DiagnosisStep[] {
  if (trail.length === 0) return [];
  return trail.slice(0, -1);
}

/**
 * Short description for the DA 2404 form — just the terminal summary.
 * The full diagnosis trail lives in the diagnosisAttempts table for the dashboard.
 */
export function buildFaultDescription(_trail: DiagnosisStep[], terminalSummary: string): string {
  return terminalSummary;
}

export function getReadinessForCategory(category: FaultCategory): Readiness | undefined {
  if (category.affectsReadiness === 'determined-by-tree') return undefined;
  return category.affectsReadiness;
}

export function getNextNodeId(node: TreeNode, selectedOption: string): string | undefined {
  if (node.type === 'question' && node.options) {
    const option = node.options.find((o) => o.label === selectedOption);
    return option?.nextNodeId;
  }
  if (node.type === 'action') {
    return node.nextNodeId;
  }
  return undefined;
}
