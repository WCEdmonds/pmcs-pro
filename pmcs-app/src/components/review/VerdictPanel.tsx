import { useState } from 'react';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { FLAG_TEXT_MAX, treeReviewState, type VerdictStatus } from '../../utils/reviewApi';
import type { ReviewTree } from '../../utils/reviewTrees';
import { btnClass, formatTime, useReview } from './reviewContext';

export interface VerdictDraft {
  status: VerdictStatus | null;
  note: string;
}

interface VerdictPanelProps {
  tree: ReviewTree;
  /** Unsaved edits; undefined shows the saved verdict. */
  draft: VerdictDraft | undefined;
  onDraftChange: (draft: VerdictDraft | undefined) => void;
  /** Return an error message, or null when saved. */
  onSave: (status: VerdictStatus, note: string) => Promise<string | null>;
  onWithdraw: () => Promise<string | null>;
}

export function VerdictPanel({ tree, draft, onDraftChange, onSave, onWithdraw }: VerdictPanelProps) {
  const { review, me, canWrite, readOnlyReason, nameOf } = useReview();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ text: string; error: boolean } | null>(null);
  const st = treeReviewState(tree.key, review);
  const mine = me ? st.verdicts.find((v) => v.user_id === me) : undefined;
  const d: VerdictDraft = draft ?? { status: mine?.status ?? null, note: mine?.note ?? '' };
  const blocked = d.status === 'approved' && st.open > 0;
  const noteId = `verdict-note-${tree.key}`;

  const edit = (patch: Partial<VerdictDraft>) => {
    setMsg(null);
    onDraftChange({ ...d, ...patch });
  };

  const save = async () => {
    if (!d.status || busy) return;
    if (blocked) return;
    setBusy(true);
    setMsg({ text: 'Saving…', error: false });
    const err = await onSave(d.status, d.note.trim().slice(0, FLAG_TEXT_MAX));
    setBusy(false);
    setMsg(err ? { text: err, error: true } : { text: 'Saved.', error: false });
  };

  const withdraw = async () => {
    if (busy) return;
    setBusy(true);
    setMsg(null);
    const err = await onWithdraw();
    setBusy(false);
    setMsg(err ? { text: err, error: true } : { text: 'Your verdict was withdrawn.', error: false });
  };

  const others = st.verdicts.slice().sort((a, b) => (b.updated_at || '').localeCompare(a.updated_at || ''));
  const pick = (status: VerdictStatus, label: string) => (
    <button
      type="button"
      className={`${btnClass({ on: d.status === status })} max-[600px]:flex-1`}
      aria-pressed={d.status === status}
      disabled={!canWrite}
      onClick={() => edit({ status })}
    >
      {label}
    </button>
  );

  return (
    <section
      className="mt-6 grid gap-3 rounded-[var(--radius-lg)] border border-border border-t-4 border-t-text-primary bg-bg-secondary p-4 min-[601px]:p-5"
      aria-labelledby={`vh-${tree.key}`}
      data-testid="verdict"
    >
      <h3 id={`vh-${tree.key}`} className="m-0 font-display text-lg font-bold text-text-primary">
        Your verdict on this tree
      </h3>
      {!canWrite && <p className="text-sm text-text-secondary">{readOnlyReason}</p>}
      <div className="flex flex-wrap gap-2">
        {pick('approved', 'Approved')}
        {pick('changes', 'Needs changes')}
      </div>
      <textarea
        id={noteId}
        aria-label="Verdict note"
        value={d.note}
        maxLength={FLAG_TEXT_MAX}
        disabled={!canWrite}
        placeholder="Optional note: what you checked, or what has to change"
        onChange={(e) => edit({ note: e.target.value })}
        className="w-full min-h-[80px] px-2.5 py-2 text-sm bg-bg-tertiary text-text-primary border border-border rounded-[var(--radius-md)] placeholder:text-text-secondary/70 resize-y focus:outline-none focus:ring-2 focus:ring-accent-blue disabled:opacity-60"
      />
      {blocked && (
        <p className="text-sm text-accent-amber" role="alert">
          This tree still has {st.open} open flag{st.open === 1 ? '' : 's'}. Resolve them, or choose Needs changes.
        </p>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <Button className="min-h-[44px]! text-sm max-[600px]:flex-1" onClick={save} disabled={!canWrite || !d.status || blocked || busy}>
          {mine ? 'Update verdict' : 'Save verdict'}
        </Button>
        {mine && (
          <button type="button" className={`${btnClass()} max-[600px]:flex-1`} disabled={!canWrite || busy} onClick={withdraw}>
            Withdraw my verdict
          </button>
        )}
        {msg && (
          <span className={`text-sm ${msg.error ? 'text-accent-red' : 'text-text-secondary'}`} role="status">
            {msg.text}
          </span>
        )}
      </div>
      <div className="grid gap-1.5 text-sm" data-testid="verdict-list">
        <b className="text-text-primary">All verdicts</b>
        {others.length ? (
          others.map((v) => (
            <div key={v.user_id} className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
              <Badge variant={v.status === 'approved' ? 'green' : 'amber'}>{v.status === 'approved' ? 'APPROVED' : 'NEEDS CHANGES'}</Badge>
              <span className="text-text-primary">{nameOf(v.user_id)}</span>
              <span className="text-text-secondary">{formatTime(v.updated_at)}</span>
              {v.note && <span className="text-text-primary min-w-0 [overflow-wrap:anywhere]">“{v.note}”</span>}
            </div>
          ))
        ) : (
          <span className="text-text-secondary">No verdicts yet.</span>
        )}
      </div>
    </section>
  );
}
