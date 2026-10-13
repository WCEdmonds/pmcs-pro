// Troubleshooting review API (pmcs-api: /review). All routes need the session token.
import { api } from './api';

export type FlagKind = 'readiness' | 'level' | 'tm' | 'wording' | 'missing' | 'safety' | 'other';

export const FLAG_KINDS: [FlagKind, string][] = [
  ['readiness', 'Wrong PMC / NMC call'],
  ['level', 'Wrong operator vs maintenance call'],
  ['tm', 'Wrong or missing TM reference'],
  ['wording', 'Wording unclear or inaccurate'],
  ['missing', 'Missing step or answer option'],
  ['safety', 'Unsafe or not an operator task'],
  ['other', 'Other'],
];

export const FLAG_KIND_LABEL: Record<string, string> = Object.fromEntries(FLAG_KINDS);

export const FLAG_TEXT_MAX = 4000;

export interface ReviewFlag {
  id: string;
  tree: string;
  node: string;
  kind: FlagKind;
  text: string;
  user_id: string;
  created_at: string;
  resolved_at: string | null;
  resolved_by: string | null;
}

export type VerdictStatus = 'approved' | 'changes';

export interface ReviewVerdict {
  tree: string;
  user_id: string;
  status: VerdictStatus;
  note: string | null;
  updated_at: string;
}

export interface ReviewPerson {
  rank: string | null;
  first_name: string | null;
  last_name: string | null;
}

export interface ReviewState {
  flags: ReviewFlag[];
  verdicts: ReviewVerdict[];
  people: Record<string, ReviewPerson>;
}

/** 409 code from PUT /review/verdicts/:tree when approving a tree that has open flags. */
export const OPEN_FLAGS = 'OPEN_FLAGS';

export async function fetchReview(): Promise<ReviewState> {
  const res = await api<Partial<ReviewState>>('GET', '/review');
  return {
    flags: Array.isArray(res?.flags) ? res.flags : [],
    verdicts: Array.isArray(res?.verdicts) ? res.verdicts : [],
    people: res?.people && typeof res.people === 'object' ? res.people : {},
  };
}

export function createFlag(tree: string, node: string, kind: FlagKind, text: string): Promise<ReviewFlag> {
  return api<ReviewFlag>('POST', '/review/flags', { body: { tree, node, kind, text } });
}

export function setFlagResolved(id: string, resolved: boolean): Promise<ReviewFlag> {
  return api<ReviewFlag>('PATCH', `/review/flags/${encodeURIComponent(id)}`, { body: { resolved } });
}

export function deleteFlag(id: string): Promise<{ ok: boolean }> {
  return api<{ ok: boolean }>('DELETE', `/review/flags/${encodeURIComponent(id)}`);
}

export function saveVerdict(tree: string, status: VerdictStatus, note: string): Promise<ReviewVerdict> {
  return api<ReviewVerdict>('PUT', `/review/verdicts/${encodeURIComponent(tree)}`, { body: note ? { status, note } : { status } });
}

export function withdrawVerdict(tree: string): Promise<{ ok: boolean }> {
  return api<{ ok: boolean }>('DELETE', `/review/verdicts/${encodeURIComponent(tree)}`);
}

export function personName(p: ReviewPerson | undefined): string {
  if (!p) return '';
  return [p.rank, p.first_name, p.last_name].filter((s) => s && s.trim()).join(' ');
}

export type TreeStatus = 'approved' | 'changes' | 'partial' | 'none';

export interface TreeReviewState {
  verdicts: ReviewVerdict[];
  open: number;
  approvals: number;
  changes: number;
  status: TreeStatus;
}

/** Any "needs changes" wins; approvals with open flags are "partial". */
export function treeReviewState(key: string, state: ReviewState): TreeReviewState {
  const verdicts = state.verdicts.filter((v) => v.tree === key);
  const open = state.flags.filter((f) => f.tree === key && !f.resolved_at).length;
  const approvals = verdicts.filter((v) => v.status === 'approved').length;
  const changes = verdicts.filter((v) => v.status === 'changes').length;
  const status: TreeStatus = changes ? 'changes' : approvals ? (open ? 'partial' : 'approved') : 'none';
  return { verdicts, open, approvals, changes, status };
}
