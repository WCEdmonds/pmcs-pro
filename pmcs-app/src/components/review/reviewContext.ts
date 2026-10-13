import { createContext, useContext } from 'react';
import type { FlagKind, ReviewFlag, ReviewState } from '../../utils/reviewApi';
import type { ReviewTree, ReviewVehicle } from '../../utils/reviewTrees';

export interface FlagDraft {
  kind: FlagKind;
  text: string;
}

export interface ReviewContextValue {
  review: ReviewState;
  vehicles: Record<string, ReviewVehicle>;
  /** Server id of the signed-in user. */
  me: string | null;
  isAdmin: boolean;
  /** Online and the review loaded: flags and verdicts can be saved. */
  canWrite: boolean;
  /** Why saving is off, shown on disabled controls. */
  readOnlyReason: string;
  /** `${tree}|${node}` of the open flag form. */
  openForm: string | null;
  setOpenForm: (key: string | null) => void;
  draft: FlagDraft;
  setDraft: (d: FlagDraft) => void;
  nameOf: (userId: string | null | undefined) => string;
  /** Each returns an error message, or null when it worked. */
  addFlag: (tree: string, node: string, kind: FlagKind, text: string) => Promise<string | null>;
  resolveFlag: (flag: ReviewFlag, resolved: boolean) => Promise<string | null>;
  removeFlag: (flag: ReviewFlag) => Promise<string | null>;
  /** Shows a step in the outline (scrolls to it and highlights it). */
  showInOutline: (tree: ReviewTree, nodeId: string) => void;
  highlight: string | null;
}

export const ReviewContext = createContext<ReviewContextValue | null>(null);

export function useReview(): ReviewContextValue {
  const ctx = useContext(ReviewContext);
  if (!ctx) throw new Error('useReview outside ReviewContext');
  return ctx;
}

export const nodeAnchor = (treeKey: string, nodeId: string) => `n-${treeKey}-${nodeId}`;

export const NODE_TYPE_LABEL: Record<string, string> = { question: 'Question', action: 'Action', terminal: 'End result' };

export const RESOLUTION_LABEL: Record<string, string> = { 'operator-fix': 'Operator fix', 'needs-maintenance': 'Needs maintenance' };

export function formatTime(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

/** Small outline/toolbar button (the app's 48px Button is kept for primary actions). */
export function btnClass(opts: { on?: boolean; small?: boolean } = {}): string {
  return [
    'inline-flex items-center justify-center gap-1.5 rounded-[var(--radius-md)] border font-body transition-colors',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-blue',
    'disabled:opacity-50 disabled:cursor-not-allowed',
    opts.small ? 'min-h-[36px] px-2.5 text-sm' : 'min-h-[44px] px-3.5 text-sm',
    opts.on
      ? 'border-accent-blue bg-accent-blue/15 text-accent-blue font-semibold'
      : 'border-border bg-bg-secondary text-text-primary hover:border-accent-blue/70 active:bg-bg-tertiary',
  ].join(' ');
}

export function flagsFor(flags: ReviewFlag[], treeKey: string, nodeId: string): ReviewFlag[] {
  return flags
    .filter((f) => f.tree === treeKey && f.node === nodeId)
    .sort((a, b) => (a.created_at || '').localeCompare(b.created_at || ''));
}

