// Troubleshooting review (/review): the guided troubleshooting trees, numbered for review.
// Loaded only by the lazy review page, so none of this lands in the main bundle.

import { VEHICLE_REGISTRY } from '../data/vehicles';
import { FAULT_CATEGORIES } from '../data/faultCategories';
import { TM_PDF_URLS } from '../data/tmPageMap';
import type { TreeNode, TroubleshootingTree } from '../types/diagnosis';

export interface ReviewVehicle {
  type: string;
  /** e.g. "M1097 HMMWV (Heavy)" */
  label: string;
  tm: string;
  /** e.g. "15 Jul 2004" */
  date: string;
  pdf: string | undefined;
}

export interface ReviewTree {
  /** `${vehicleType}.${categoryId}`, e.g. "M1097.wont-start" */
  key: string;
  vehicleType: string;
  categoryId: string;
  /** Fault type, e.g. "Won't Start" */
  label: string;
  tmReference: string;
  rootNodeId: string;
  nodes: Record<string, TreeNode>;
  /** Reachable steps in depth-first order from the root, then unreachable ones. */
  order: string[];
  /** 1-based step number of every node, by `order`. */
  stepNo: Record<string, number>;
  /** Steps that can't be reached from the root. */
  unreachable: string[];
}

export interface ReviewData {
  vehicles: Record<string, ReviewVehicle>;
  trees: ReviewTree[];
}

/** Vehicle order and group labels in the review index (M1152 shares the M1151 trees). */
const GROUPS: { type: string; label: string }[] = [
  { type: 'M1151', label: 'M1151 / M1152 HMMWV' },
  { type: 'M1097', label: 'M1097 HMMWV (Heavy)' },
  { type: 'LMTV_M1078', label: 'M1078 LMTV' },
  { type: 'M1101_TRAILER', label: 'M1101 / M1102 Trailer' },
  { type: 'MEP802A', label: 'MEP-802A (5 kW)' },
  { type: 'MEP803A', label: 'MEP-803A (10 kW)' },
  { type: 'MEP831A', label: 'MEP-831A (3 kW)' },
  { type: 'MEP1030', label: 'MEP-1030 AMMPS (5 kW)' },
];

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "20040715" → "15 Jul 2004" */
export function formatTmDate(yyyymmdd: string): string {
  if (!/^\d{8}$/.test(yyyymmdd)) return yyyymmdd;
  return `${Number(yyyymmdd.slice(6))} ${MONTHS[Number(yyyymmdd.slice(4, 6)) - 1]} ${yyyymmdd.slice(0, 4)}`;
}

export function treeKey(t: Pick<TroubleshootingTree, 'vehicleType' | 'categoryId'>): string {
  return `${t.vehicleType}.${t.categoryId}`;
}

/** Numbers the steps in the order a soldier would reach them (depth-first from the root). */
export function buildReviewTree(t: TroubleshootingTree): ReviewTree {
  const order: string[] = [];
  const seen = new Set<string>();
  // Iterative DFS (pre-order, options in order) so very deep trees can't overflow the stack.
  const stack: string[] = [t.rootNodeId];
  while (stack.length) {
    const id = stack.pop()!;
    if (!id || seen.has(id) || !t.nodes[id]) continue;
    seen.add(id);
    order.push(id);
    const n = t.nodes[id];
    const next: string[] = [];
    if (n.type === 'question') for (const o of n.options ?? []) next.push(o.nextNodeId);
    if (n.type === 'action' && n.nextNodeId) next.push(n.nextNodeId);
    for (let i = next.length - 1; i >= 0; i--) stack.push(next[i]);
  }
  const unreachable = Object.keys(t.nodes).filter((k) => !seen.has(k));
  const all = [...order, ...unreachable];
  const label = FAULT_CATEGORIES.find((c) => c.id === t.categoryId)?.label ?? t.categoryId;
  return {
    key: treeKey(t),
    vehicleType: t.vehicleType,
    categoryId: t.categoryId,
    label,
    tmReference: t.tmReference,
    rootNodeId: t.rootNodeId,
    nodes: t.nodes,
    order: all,
    stepNo: Object.fromEntries(all.map((id, i) => [id, i + 1])),
    unreachable,
  };
}

export function buildVehicles(): Record<string, ReviewVehicle> {
  const out: Record<string, ReviewVehicle> = {};
  for (const g of GROUPS) {
    const reg = VEHICLE_REGISTRY.find((v) => v.type === g.type);
    out[g.type] = {
      type: g.type,
      label: g.label,
      tm: reg?.tmReference ?? '',
      date: formatTmDate(reg?.tmDate ?? ''),
      pdf: TM_PDF_URLS[g.type],
    };
  }
  return out;
}

/** Sorts trees by vehicle (index order), keeping each file's own tree order. */
export function sortTrees(trees: ReviewTree[]): ReviewTree[] {
  const rank = (v: string) => {
    const i = GROUPS.findIndex((g) => g.type === v);
    return i < 0 ? GROUPS.length : i;
  };
  return trees
    .map((t, i) => ({ t, i }))
    .sort((a, b) => rank(a.t.vehicleType) - rank(b.t.vehicleType) || a.i - b.i)
    .map(({ t }) => t);
}

/** Loads all 8 tree files (each its own chunk) and numbers them. */
export async function loadReviewData(): Promise<ReviewData> {
  const files = await Promise.all([
    import('../data/troubleshooting/m1151-troubleshooting.json'),
    import('../data/troubleshooting/m1097-troubleshooting.json'),
    import('../data/troubleshooting/m1078-troubleshooting.json'),
    import('../data/troubleshooting/m1101-troubleshooting.json'),
    import('../data/troubleshooting/mep802a-troubleshooting.json'),
    import('../data/troubleshooting/mep803a-troubleshooting.json'),
    import('../data/troubleshooting/mep831a-troubleshooting.json'),
    import('../data/troubleshooting/mep1030-troubleshooting.json'),
  ]);
  const trees = files.flatMap((f) => (f.default as unknown as TroubleshootingTree[]).map(buildReviewTree));
  return { vehicles: buildVehicles(), trees: sortTrees(trees) };
}
