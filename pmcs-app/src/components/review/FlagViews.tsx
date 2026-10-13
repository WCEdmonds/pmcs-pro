import { useEffect, useRef, useState } from 'react';
import { Flag } from 'lucide-react';
import { getTmPageUrl } from '../../data/tmPageMap';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { FLAG_KINDS, FLAG_KIND_LABEL, FLAG_TEXT_MAX, type FlagKind, type ReviewFlag } from '../../utils/reviewApi';
import type { ReviewTree } from '../../utils/reviewTrees';
import type { TreeNode } from '../../types/diagnosis';
import { NODE_TYPE_LABEL, RESOLUTION_LABEL, btnClass, flagsFor, formatTime, useReview } from './reviewContext';

/** TM paragraph reference; opens the TM PDF at that page in a new tab. */
export function TmParaLink({ tree, node }: { tree: ReviewTree; node: TreeNode }) {
  if (!node.tmPage) return <span className="font-display text-xs text-text-secondary whitespace-nowrap">no TM ref</span>;
  const url = getTmPageUrl(tree.vehicleType, node.tmPage);
  if (!url) {
    return (
      <span className="font-display text-xs text-text-secondary whitespace-nowrap" title="No TM page mapped for this paragraph">
        TM {node.tmPage}
      </span>
    );
  }
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      title="Open the TM at this paragraph"
      className="font-display text-xs text-accent-blue underline underline-offset-2 whitespace-nowrap"
    >
      TM {node.tmPage}
    </a>
  );
}

const TAG_CLASS: Record<string, string> = {
  question: 'bg-accent-blue/15 text-accent-blue',
  action: 'bg-bg-tertiary text-text-primary border border-border',
  terminal: 'bg-text-primary text-bg-primary',
};

export function TypeTag({ tree, nodeId }: { tree: ReviewTree; nodeId: string }) {
  const n = tree.nodes[nodeId];
  return (
    <span className={`font-display text-[11px] font-semibold uppercase tracking-wide leading-none px-1.5 py-1 rounded-[var(--radius-sm)] whitespace-nowrap ${TAG_CLASS[n.type] ?? TAG_CLASS.action}`}>
      {tree.stepNo[nodeId]} · {NODE_TYPE_LABEL[n.type] ?? n.type}
    </span>
  );
}

export function ResultRow({ node }: { node: TreeNode }) {
  if (!node.terminal) return null;
  const { readiness, resolution, summary } = node.terminal;
  return (
    <div className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1.5" data-testid="end-result">
      <Badge variant={readiness === 'NMC' ? 'red' : 'amber'}>{readiness}</Badge>
      <span className="text-xs px-2 py-1 rounded-[var(--radius-sm)] bg-bg-tertiary border border-border text-text-primary">
        {RESOLUTION_LABEL[resolution] ?? resolution}
      </span>
      {summary && <span className="text-xs text-text-secondary min-w-0 [overflow-wrap:anywhere]">{summary}</span>}
    </div>
  );
}

export function FlagButton({ tree, nodeId, className = '' }: { tree: ReviewTree; nodeId: string; className?: string }) {
  const { review, canWrite, readOnlyReason, setOpenForm, setDraft, openForm } = useReview();
  const open = flagsFor(review.flags, tree.key, nodeId).filter((f) => !f.resolved_at).length;
  const formKey = `${tree.key}|${nodeId}`;
  return (
    <button
      type="button"
      className={`${btnClass({ small: true })} ${className}`}
      disabled={!canWrite}
      title={canWrite ? 'Flag a problem with this step' : readOnlyReason}
      aria-label={`Flag step ${tree.stepNo[nodeId]}${open ? ` (${open} open)` : ''}`}
      onClick={() => {
        if (openForm !== formKey) setDraft({ kind: 'readiness', text: '' });
        setOpenForm(formKey);
      }}
    >
      <Flag size={14} aria-hidden="true" />
      {open ? `Flag (${open})` : 'Flag'}
    </button>
  );
}

export function FlagCard({ flag }: { flag: ReviewFlag }) {
  const { me, isAdmin, canWrite, nameOf, resolveFlag, removeFlag } = useReview();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const mine = !!me && flag.user_id === me;
  const canResolve = canWrite && (mine || isAdmin);
  const canDelete = canWrite && mine && !flag.resolved_at;
  const resolved = !!flag.resolved_at;

  const run = async (fn: () => Promise<string | null>) => {
    setBusy(true);
    setError('');
    const err = await fn();
    setBusy(false);
    if (err) setError(err);
  };

  return (
    <div
      className={`rounded-[var(--radius-md)] border px-3 py-2 text-sm max-w-[80ch] ${
        resolved ? 'border-dashed border-border bg-bg-secondary opacity-70' : 'border-accent-amber/60 bg-accent-amber/10'
      }`}
      data-testid="flag-card"
    >
      <div className="font-display text-xs font-semibold uppercase tracking-wide text-accent-amber">
        {FLAG_KIND_LABEL[flag.kind] ?? 'Flag'}
        {resolved ? ' · resolved' : ''}
      </div>
      <p className="text-text-primary whitespace-pre-wrap [overflow-wrap:anywhere] mt-0.5">{flag.text}</p>
      <div className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-text-secondary">
        <span>
          {nameOf(flag.user_id)} · {formatTime(flag.created_at)}
        </span>
        {resolved && flag.resolved_by && <span>Resolved by {nameOf(flag.resolved_by)}</span>}
        {canResolve && (
          <button type="button" className={btnClass({ small: true })} disabled={busy} onClick={() => run(() => resolveFlag(flag, !resolved))}>
            {resolved ? 'Reopen' : 'Mark resolved'}
          </button>
        )}
        {canDelete && (
          <button type="button" className={btnClass({ small: true })} disabled={busy} onClick={() => run(() => removeFlag(flag))}>
            Delete
          </button>
        )}
      </div>
      {error && <p className="text-xs text-accent-red mt-1" role="alert">{error}</p>}
    </div>
  );
}

function FlagForm({ tree, nodeId }: { tree: ReviewTree; nodeId: string }) {
  const { draft, setDraft, setOpenForm, addFlag } = useReview();
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const textRef = useRef<HTMLTextAreaElement>(null);
  const idBase = `flag-${tree.key}-${nodeId}`;

  useEffect(() => {
    textRef.current?.focus();
  }, []);

  const save = async () => {
    const text = draft.text.trim();
    if (!text) {
      setMsg('Describe the problem first.');
      textRef.current?.focus();
      return;
    }
    setSaving(true);
    setMsg('Saving…');
    const err = await addFlag(tree.key, nodeId, draft.kind, text.slice(0, FLAG_TEXT_MAX));
    if (err) {
      setSaving(false);
      setMsg(err);
      return;
    }
    setDraft({ kind: 'readiness', text: '' });
    setOpenForm(null);
  };

  return (
    <div className="grid gap-2 mt-2 p-2.5 rounded-[var(--radius-md)] border border-border bg-bg-secondary max-w-[80ch]">
      <label htmlFor={`${idBase}-kind`} className="text-xs font-medium text-text-secondary">
        What kind of problem
      </label>
      <select
        id={`${idBase}-kind`}
        value={draft.kind}
        onChange={(e) => setDraft({ ...draft, kind: e.target.value as FlagKind })}
        className="w-full min-h-[44px] px-2.5 text-sm bg-bg-tertiary text-text-primary border border-border rounded-[var(--radius-md)] focus:outline-none focus:ring-2 focus:ring-accent-blue"
      >
        {FLAG_KINDS.map(([k, label]) => (
          <option key={k} value={k}>
            {label}
          </option>
        ))}
      </select>
      <textarea
        id={`${idBase}-text`}
        ref={textRef}
        aria-label="Flag details"
        value={draft.text}
        maxLength={FLAG_TEXT_MAX}
        placeholder="What is wrong, and what should it say or do? Cite the TM if you can."
        onChange={(e) => setDraft({ ...draft, text: e.target.value })}
        className="w-full min-h-[80px] px-2.5 py-2 text-sm bg-bg-tertiary text-text-primary border border-border rounded-[var(--radius-md)] placeholder:text-text-secondary/70 resize-y focus:outline-none focus:ring-2 focus:ring-accent-blue"
      />
      <div className="flex flex-wrap items-center gap-2">
        <Button className="min-h-[40px]! text-sm" onClick={save} disabled={saving}>
          Save flag
        </Button>
        <button type="button" className={btnClass()} onClick={() => setOpenForm(null)}>
          Cancel
        </button>
        {msg && (
          <span className="text-xs text-text-secondary" role="status">
            {msg}
          </span>
        )}
      </div>
    </div>
  );
}

/** Flags raised on one step, plus the flag form when it is open on that step. */
export function NodeFlags({ tree, nodeId }: { tree: ReviewTree; nodeId: string }) {
  const { review, openForm } = useReview();
  const flags = flagsFor(review.flags, tree.key, nodeId);
  const formOpen = openForm === `${tree.key}|${nodeId}`;
  if (!flags.length && !formOpen) return null;
  return (
    <div className="grid gap-1.5 mt-2">
      {flags.map((f) => (
        <FlagCard key={f.id} flag={f} />
      ))}
      {formOpen && <FlagForm tree={tree} nodeId={nodeId} />}
    </div>
  );
}
