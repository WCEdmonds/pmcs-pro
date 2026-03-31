export interface FaultCategory {
  id: string;
  label: string;
  icon: string;
  hasDiagnosisTree: boolean;
  affectsReadiness: 'PMC' | 'NMC' | 'determined-by-tree';
}

export type Readiness = 'PMC' | 'NMC';

export interface TreeOption {
  label: string;
  nextNodeId: string;
}

export interface TerminalData {
  resolution: 'operator-fix' | 'needs-maintenance';
  readiness: Readiness;
  summary: string;
}

export interface TreeNode {
  id: string;
  type: 'question' | 'action' | 'terminal';
  text: string;
  illustration?: string;
  options?: TreeOption[];
  actionText?: string;
  nextNodeId?: string;
  terminal?: TerminalData;
  tmPage?: string;  // TM internal page reference, e.g., '3-11'
}

export interface TroubleshootingTree {
  categoryId: string;
  vehicleType: string;
  tmReference: string;
  rootNodeId: string;
  nodes: Record<string, TreeNode>;
}

export interface DiagnosisStep {
  nodeId: string;
  nodeText: string;
  selectedOption?: string;
  timestamp: string;
}

export interface DiagnosisAttempt {
  id: string;
  faultId: string;
  sessionId: string;
  categoryId: string;
  stepsCompleted: DiagnosisStep[];
  outcome: 'operator-fix' | 'needs-maintenance' | 'skipped';
  skipReason?: string;
  readinessResult: Readiness;
  completedAt: string;
}
