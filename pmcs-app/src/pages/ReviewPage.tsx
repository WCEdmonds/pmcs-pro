import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, BookOpen, WifiOff } from 'lucide-react';
import { useUserStore } from '../stores/userStore';
import { ApiError, getSessionUserId, isNetworkError } from '../utils/api';
import {
  OPEN_FLAGS,
  createFlag,
  deleteFlag,
  fetchReview,
  personName,
  saveVerdict,
  setFlagResolved,
  treeReviewState,
  withdrawVerdict,
  type FlagKind,
  type ReviewFlag,
  type ReviewPerson,
  type ReviewState,
  type TreeStatus,
  type VerdictStatus,
} from '../utils/reviewApi';
import { loadReviewData, type ReviewData, type ReviewTree } from '../utils/reviewTrees';
import { LoadingScreen } from '../components/ui/NotFound';
import { ReviewContext, btnClass, nodeAnchor, type FlagDraft, type ReviewContextValue } from '../components/review/reviewContext';
import { FlagCard } from '../components/review/FlagViews';
import { TreeOutline } from '../components/review/TreeOutline';
import { WalkThrough, type WalkStep } from '../components/review/WalkThrough';
import { VerdictPanel, type VerdictDraft } from '../components/review/VerdictPanel';

const POLL_MS = 30_000;
const LAST_TREE_KEY = 'pmcs-review-tree';
type SyncStatus = 'loading' | 'ready' | 'offline' | 'error';
type Tab = 'outline' | 'walk' | 'flags';

const STATUS_TITLE: Record<TreeStatus, string> = {
  approved: 'Approved',
  changes: 'Needs changes',
  partial: 'Approved, with open flags',
  none: 'Not reviewed',
};

const DOT_CLASS: Record<TreeStatus, string> = {
  approved: 'bg-accent-green border-accent-green',
  changes: 'bg-accent-amber border-accent-amber',
  partial: 'bg-[linear-gradient(90deg,var(--color-accent-green)_50%,transparent_50%)] border-accent-green',
  none: 'border-border',
};

function readLastTree(): string | null {
  try {
    return localStorage.getItem(LAST_TREE_KEY);
  } catch {
    return null;
  }
}

function writeLastTree(key: string) {
  try {
    localStorage.setItem(LAST_TREE_KEY, key);
  } catch {
    // storage blocked: the #hash still deep-links
  }
}

function writeErrorMessage(err: unknown): string {
  if (isNetworkError(err)) return "Not saved: can't reach the server. Check your connection and try again.";
  if (err instanceof ApiError) return err.message;
  return 'Not saved. Try again.';
}

function prefersReducedMotion(): boolean {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

function StatusDot({ status }: { status: TreeStatus }) {
  return <span className={`inline-block w-2.5 h-2.5 rounded-full border-2 ${DOT_CLASS[status]}`} aria-hidden="true" />;
}

/** Who is reviewing, and where "home" is. Supplied by the host app (field app or dashboard). */
export interface ReviewViewer {
  id: string | null;
  isAdmin: boolean;
  rank?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  dodId?: string | null;
  homeLabel: string;
}

export default function ReviewPage() {
  const user = useUserStore((s) => s.user);
  return (
    <ReviewScreen
      viewer={{
        id: user?.id ?? getSessionUserId(), isAdmin: user?.role === 'admin',
        rank: user?.rank, firstName: user?.firstName, lastName: user?.lastName, dodId: user?.dodId, homeLabel: 'PMCS Pro home',
      }}
    />
  );
}

export function ReviewScreen({ viewer }: { viewer: ReviewViewer }) {
  const user = viewer;
  const me = viewer.id;
  const isAdmin = viewer.isAdmin;
  const location = useLocation();
  const navigate = useNavigate();
  const mainRef = useRef<HTMLElement>(null);

  const [data, setData] = useState<ReviewData | null>(null);
  const [dataError, setDataError] = useState(false);
  const [review, setReview] = useState<ReviewState>({ flags: [], verdicts: [], people: {} });
  const [sync, setSync] = useState<SyncStatus>('loading');
  const [syncError, setSyncError] = useState('');
  const [loadedAt, setLoadedAt] = useState<string | null>(null);
  const [view, setView] = useState<'tree' | 'flags'>('tree');
  const [tab, setTab] = useState<Tab>('outline');
  const [walk, setWalk] = useState<Record<string, WalkStep[]>>({});
  const [openForm, setOpenForm] = useState<string | null>(null);
  const [draft, setDraft] = useState<FlagDraft>({ kind: 'readiness', text: '' });
  const [verdictDrafts, setVerdictDrafts] = useState<Record<string, VerdictDraft | undefined>>({});
  const [highlight, setHighlight] = useState<string | null>(null);
  const [lastTree] = useState(readLastTree);

  // ---- data ----
  useEffect(() => {
    let alive = true;
    loadReviewData().then(
      (d) => alive && setData(d),
      (err) => {
        console.error('Loading troubleshooting trees failed:', err);
        if (alive) setDataError(true);
      },
    );
    return () => {
      alive = false;
    };
  }, []);

  // Only the newest GET may land, so a poll that started before a write can't undo it.
  const seq = useRef(0);
  const refresh = useCallback((): Promise<void> => {
    const n = ++seq.current;
    return fetchReview().then(
      (r) => {
        if (n !== seq.current) return;
        setReview(r);
        setSync('ready');
        setSyncError('');
        setLoadedAt(new Date().toISOString());
      },
      (err: unknown) => {
        if (n !== seq.current) return;
        if (isNetworkError(err)) {
          setSync('offline');
        } else {
          setSync('error');
          setSyncError(err instanceof Error ? err.message : String(err));
        }
      },
    );
  }, []);

  useEffect(() => {
    void refresh();
    const whenVisible = () => {
      if (document.visibilityState === 'visible') void refresh();
    };
    const timer = window.setInterval(whenVisible, POLL_MS);
    const goneOffline = () => setSync('offline');
    document.addEventListener('visibilitychange', whenVisible);
    window.addEventListener('online', whenVisible);
    window.addEventListener('offline', goneOffline);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', whenVisible);
      window.removeEventListener('online', whenVisible);
      window.removeEventListener('offline', goneOffline);
    };
  }, [refresh]);

  useEffect(() => {
    const before = document.title;
    document.title = 'Troubleshooting Review · PMCS Pro';
    return () => {
      document.title = before;
    };
  }, []);

  // ---- selected tree: the #hash is the deep link ----
  const trees = useMemo(() => data?.trees ?? [], [data]);
  const byKey = useMemo(() => new Map(trees.map((t) => [t.key, t])), [trees]);
  const hashKey = (() => {
    try {
      return decodeURIComponent(location.hash.replace(/^#/, ''));
    } catch {
      return '';
    }
  })();
  const key = byKey.has(hashKey)
    ? hashKey
    : lastTree && byKey.has(lastTree)
      ? lastTree
      : (trees.find((t) => t.vehicleType === 'M1151') ?? trees[0])?.key ?? '';
  const tree = byKey.get(key);

  // A new #tree from outside (a pasted link, Back) shows that tree.
  const [seenHash, setSeenHash] = useState(hashKey);
  if (seenHash !== hashKey) {
    setSeenHash(hashKey);
    if (byKey.has(hashKey)) {
      setView('tree');
      setOpenForm(null);
    }
  }

  // ---- people ----
  const myPerson: ReviewPerson | undefined = user.id
    ? { rank: user.rank || null, first_name: user.firstName || null, last_name: user.lastName || null }
    : undefined;
  const myName = personName(myPerson);
  const nameOf = (uid: string | null | undefined) => {
    if (!uid) return 'A reviewer';
    if (uid === me) return `${personName(review.people[uid]) || myName || 'You'} (you)`;
    return personName(review.people[uid]) || 'A reviewer';
  };

  const canWrite = sync === 'ready' && !!me;
  const readOnlyReason =
    sync === 'offline'
      ? "You're offline. Flags and verdicts can be saved once you're back online."
      : sync === 'error'
        ? "The review couldn't be loaded, so nothing can be saved right now."
        : sync === 'loading'
          ? 'Loading the review…'
          : !me
            ? 'Sign in again to record flags and verdicts.'
            : '';

  // ---- navigation ----
  const jump = useCallback((t: ReviewTree, nodeId: string) => {
    // After the click's re-render has reached the DOM.
    window.setTimeout(() => {
      const el = document.getElementById(nodeAnchor(t.key, nodeId));
      if (!el) return;
      el.scrollIntoView?.({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'start' });
      const hl = `${t.key}|${nodeId}`;
      setHighlight(hl);
      window.setTimeout(() => setHighlight((h) => (h === hl ? null : h)), 2000);
    }, 0);
  }, []);

  const openTree = (k: string, nodeId?: string) => {
    const t = byKey.get(k);
    if (!t) return;
    setView('tree');
    setOpenForm(null);
    if (nodeId) setTab('outline');
    writeLastTree(k);
    if (k !== hashKey) navigate({ hash: `#${k}` }, { replace: true });
    if (nodeId) jump(t, nodeId);
    else if (mainRef.current && mainRef.current.getBoundingClientRect().top < 0) mainRef.current.scrollIntoView?.({ block: 'start' });
  };

  const showInOutline = useCallback(
    (t: ReviewTree, nodeId: string) => {
      setView('tree');
      setTab('outline');
      jump(t, nodeId);
    },
    [jump],
  );

  // ---- writes (each refetches afterwards) ----
  const afterNetworkError = (err: unknown) => {
    if (isNetworkError(err)) setSync('offline');
  };

  const addFlag = async (treeKey: string, node: string, kind: FlagKind, text: string) => {
    try {
      const f = await createFlag(treeKey, node, kind, text);
      setReview((r) => ({
        ...r,
        flags: [...r.flags.filter((x) => x.id !== f.id), f],
        people: me && myPerson && !r.people[me] ? { ...r.people, [me]: myPerson } : r.people,
      }));
      void refresh();
      return null;
    } catch (err) {
      afterNetworkError(err);
      return writeErrorMessage(err);
    }
  };

  const resolveFlag = async (flag: ReviewFlag, resolved: boolean) => {
    try {
      const f = await setFlagResolved(flag.id, resolved);
      setReview((r) => ({ ...r, flags: r.flags.map((x) => (x.id === flag.id ? f : x)) }));
      void refresh();
      return null;
    } catch (err) {
      afterNetworkError(err);
      if (err instanceof ApiError && err.status === 404) void refresh();
      return writeErrorMessage(err);
    }
  };

  const removeFlag = async (flag: ReviewFlag) => {
    try {
      await deleteFlag(flag.id);
      setReview((r) => ({ ...r, flags: r.flags.filter((x) => x.id !== flag.id) }));
      void refresh();
      return null;
    } catch (err) {
      afterNetworkError(err);
      if (err instanceof ApiError && (err.status === 404 || err.status === 409)) void refresh();
      return writeErrorMessage(err);
    }
  };

  const onSaveVerdict = (t: ReviewTree) => async (status: VerdictStatus, note: string) => {
    try {
      const v = await saveVerdict(t.key, status, note);
      setReview((r) => ({
        ...r,
        verdicts: [...r.verdicts.filter((x) => !(x.tree === v.tree && x.user_id === v.user_id)), v],
        people: me && myPerson && !r.people[me] ? { ...r.people, [me]: myPerson } : r.people,
      }));
      setVerdictDrafts((d) => ({ ...d, [t.key]: undefined }));
      void refresh();
      return null;
    } catch (err) {
      afterNetworkError(err);
      if (err instanceof ApiError && err.code === OPEN_FLAGS) {
        void refresh();
        return err.message || 'This tree still has open flags. Resolve them, or choose Needs changes.';
      }
      return writeErrorMessage(err);
    }
  };

  const onWithdrawVerdict = (t: ReviewTree) => async () => {
    try {
      await withdrawVerdict(t.key);
      setReview((r) => ({ ...r, verdicts: r.verdicts.filter((x) => !(x.tree === t.key && x.user_id === me)) }));
      setVerdictDrafts((d) => ({ ...d, [t.key]: undefined }));
      void refresh();
      return null;
    } catch (err) {
      afterNetworkError(err);
      return writeErrorMessage(err);
    }
  };

  const ctx: ReviewContextValue = {
    review,
    vehicles: data?.vehicles ?? {},
    me,
    isAdmin,
    canWrite,
    readOnlyReason,
    openForm,
    setOpenForm,
    draft,
    setDraft,
    nameOf,
    addFlag,
    resolveFlag,
    removeFlag,
    showInOutline,
    highlight,
  };

  if (dataError) {
    return (
      <div className="min-h-full flex flex-col items-center justify-center gap-3 px-4 text-center">
        <p className="text-text-primary">The troubleshooting trees couldn't be loaded.</p>
        <p className="text-sm text-text-secondary">Check your connection and reload the page.</p>
        <Link to="/" className="text-accent-blue underline">{viewer.homeLabel}</Link>
      </div>
    );
  }
  if (!data || !tree) return <LoadingScreen label="Loading troubleshooting trees…" />;

  const vehicles = data.vehicles;
  const vehicleOf = (t: ReviewTree) =>
    vehicles[t.vehicleType] ?? { type: t.vehicleType, label: t.vehicleType, tm: '', date: '', pdf: undefined };

  // ---- header stats ----
  const states = new Map(trees.map((t) => [t.key, treeReviewState(t.key, review)]));
  const approved = trees.filter((t) => states.get(t.key)!.status === 'approved').length;
  const needChanges = trees.filter((t) => ['changes', 'partial'].includes(states.get(t.key)!.status)).length;
  const notReviewed = trees.length - approved - needChanges;
  const openFlags = review.flags.filter((f) => !f.resolved_at);
  const reviewers = new Set([...review.verdicts.map((v) => v.user_id), ...review.flags.map((f) => f.user_id)]).size;
  const pct = (n: number) => `${((100 * n) / Math.max(trees.length, 1)).toFixed(2)}%`;
  const totalSteps = trees.reduce((s, t) => s + t.order.length, 0);
  const groups = Object.keys(vehicles)
    .map((v) => ({ v, trees: trees.filter((t) => t.vehicleType === v) }))
    .filter((g) => g.trees.length);

  const stat = (n: number, label: string) => (
    <div className="flex items-baseline gap-1">
      <b className="font-display text-xl font-semibold text-text-primary">{n}</b>
      <span className="text-sm text-text-secondary">{label}</span>
    </div>
  );

  // ---- tree view ----
  const renderTree = (t: ReviewTree) => {
    const v = vehicleOf(t);
    const st = states.get(t.key)!;
    const terms = t.order.filter((id) => t.nodes[id].type === 'terminal');
    const nmc = terms.filter((id) => t.nodes[id].terminal?.readiness === 'NMC').length;
    const tflags = review.flags.filter((f) => f.tree === t.key);
    const tflagsOpen = tflags.filter((f) => !f.resolved_at).length;
    const tabBtn = (k: Tab, label: string) => (
      <button type="button" className={`${btnClass({ on: tab === k })} max-[600px]:flex-1`} aria-pressed={tab === k} onClick={() => setTab(k)}>
        {label}
      </button>
    );
    return (
      <div>
        <div className="grid gap-2 rounded-[var(--radius-lg)] border border-border bg-bg-secondary p-3.5 min-[601px]:p-4" data-testid="tree-head">
          <div className="font-display text-xs uppercase tracking-wider text-text-secondary [overflow-wrap:anywhere]">
            {v.label} · {v.tm}
            {v.date ? ` (${v.date})` : ''}
          </div>
          <h2 className="m-0 font-display text-[21px] min-[601px]:text-2xl font-bold leading-tight text-text-primary">{t.label}</h2>
          <div className="font-display text-xs leading-relaxed text-text-secondary [overflow-wrap:anywhere]">{t.tmReference}</div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-text-secondary">
            <span>
              {t.order.length} steps · {terms.length} end results ({nmc} NMC, {terms.length - nmc} PMC) · {st.open} open flag
              {st.open === 1 ? '' : 's'}
            </span>
            {v.pdf && (
              <a href={v.pdf} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-accent-blue underline underline-offset-2">
                <BookOpen size={14} aria-hidden="true" />
                Open the TM
              </a>
            )}
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5 my-3.5" aria-label="View">
          {tabBtn('outline', 'Outline')}
          {tabBtn('walk', 'Walk through')}
          {tabBtn('flags', `Flags (${tflagsOpen} open)`)}
        </div>
        {tab === 'outline' && <TreeOutline tree={t} />}
        {tab === 'walk' && (
          <WalkThrough tree={t} path={walk[t.key] ?? []} onPathChange={(p) => setWalk((w) => ({ ...w, [t.key]: p }))} />
        )}
        {tab === 'flags' &&
          (tflags.length ? (
            <div className="grid gap-3.5">
              {tflags.map((f) => (
                <div key={f.id} className="grid gap-1">
                  <StepRef tree={t} nodeId={f.node} onOpen={() => showInOutline(t, f.node)} />
                  <FlagCard flag={f} />
                </div>
              ))}
            </div>
          ) : (
            <Empty>No flags on this tree yet.</Empty>
          ))}
        <VerdictPanel
          key={t.key}
          tree={t}
          draft={verdictDrafts[t.key]}
          onDraftChange={(d) => setVerdictDrafts((all) => ({ ...all, [t.key]: d }))}
          onSave={onSaveVerdict(t)}
          onWithdraw={onWithdrawVerdict(t)}
        />
      </div>
    );
  };

  // ---- all open flags ----
  const renderAllFlags = () => {
    if (!openFlags.length) {
      return (
        <Empty>
          {sync === 'ready' ? 'No open flags. Flags you and other reviewers raise will collect here.' : 'Flags appear here once the review has loaded.'}
        </Empty>
      );
    }
    return (
      <div className="grid gap-4" data-testid="all-flags">
        <h2 className="m-0 font-display text-xl font-bold text-text-primary">Open flags ({openFlags.length})</h2>
        {trees
          .filter((t) => openFlags.some((f) => f.tree === t.key))
          .map((t) => (
            <section key={t.key} className="grid gap-2">
              <h3 className="m-0 font-display text-base font-semibold text-text-primary">
                {vehicleOf(t).label} — {t.label}
              </h3>
              {openFlags
                .filter((f) => f.tree === t.key)
                .map((f) => (
                  <div key={f.id} className="grid gap-1">
                    <StepRef tree={t} nodeId={f.node} onOpen={() => openTree(t.key, f.node)} />
                    <FlagCard flag={f} />
                  </div>
                ))}
            </section>
          ))}
      </div>
    );
  };

  const offlineNotice =
    sync === 'offline'
      ? `You're offline. The troubleshooting review needs a connection to load and save flags and verdicts. You can still read every tree${
          loadedAt ? `; flags and verdicts shown are from ${new Date(loadedAt).toLocaleTimeString(undefined, { timeStyle: 'short' })}` : ''
        }.`
      : sync === 'error'
        ? `The review couldn't be loaded (${syncError}). You can still read every tree. It retries every 30 seconds.`
        : null;

  return (
    <ReviewContext.Provider value={ctx}>
      <div className="min-h-full bg-bg-primary text-text-primary">
        <div className="mx-auto max-w-[1320px] px-4 pt-[calc(env(safe-area-inset-top,0px)+14px)] pb-10 min-[601px]:pt-5 min-[601px]:pb-12">
          <header className="grid gap-3.5 border-b-2 border-text-primary pb-4">
            <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
              <Link to="/" className="inline-flex items-center gap-1.5 min-h-[44px] text-sm text-accent-blue">
                <ArrowLeft size={16} aria-hidden="true" />
                {viewer.homeLabel}
              </Link>
              <span className="text-sm text-text-secondary" data-testid="signed-in">
                Signed in as <b className="text-text-primary font-semibold">{myName || user.dodId || 'you'}</b>
                {isAdmin ? ' · admin' : ''}
              </span>
            </div>
            <div className="font-display text-xs uppercase tracking-widest text-text-secondary">PMCS Pro · Warrant review</div>
            <h1 className="m-0 font-display text-[26px] min-[601px]:text-[34px] font-bold leading-tight tracking-tight">Troubleshooting Review</h1>
            <p className="m-0 max-w-[72ch] text-text-secondary">
              These are the guided troubleshooting steps soldiers see in PMCS Pro when they report a fault. Each tree ends in a call: PMC or NMC,
              and whether the operator fixed it or maintenance is needed. Check each tree against the TM, flag anything wrong, and record your
              verdict.
            </p>
            <div className="flex flex-wrap items-baseline gap-x-5 gap-y-2 tabular-nums" aria-live="polite" data-testid="stats">
              {stat(approved, `of ${trees.length} trees approved`)}
              {stat(needChanges, 'need changes')}
              {stat(notReviewed, 'not reviewed')}
              {stat(openFlags.length, openFlags.length === 1 ? 'open flag' : 'open flags')}
              {stat(reviewers, reviewers === 1 ? 'reviewer so far' : 'reviewers so far')}
            </div>
            <div className="flex h-1.5 max-w-[520px] overflow-hidden rounded-full bg-bg-tertiary" aria-hidden="true">
              <i className="block h-full bg-accent-green" style={{ width: pct(approved) }} />
              <i className="block h-full bg-accent-amber" style={{ width: pct(needChanges) }} />
            </div>
            {offlineNotice && (
              <p
                className="m-0 flex items-start gap-2 rounded-[var(--radius-md)] border border-accent-amber/60 bg-accent-amber/10 px-3.5 py-2.5 text-sm text-text-primary"
                role="alert"
                data-testid="offline-notice"
              >
                <WifiOff size={16} className="mt-0.5 shrink-0 text-accent-amber" aria-hidden="true" />
                <span>{offlineNotice}</span>
              </p>
            )}
            <details className="rounded-[var(--radius-md)] border border-border bg-bg-secondary px-3.5 py-2.5">
              <summary className="cursor-pointer font-semibold">How to review a tree</summary>
              <ol className="mt-2.5 mb-1 grid max-w-[80ch] list-decimal gap-1.5 pl-5 text-sm text-text-primary">
                <li>
                  Pick a vehicle and fault type on the left. The outline shows every question, action and end result. Step numbers follow the
                  order a soldier would reach them.
                </li>
                <li>Check each question and action against the TM paragraph shown next to it. The paragraph opens the TM PDF at that page.</li>
                <li>
                  Check every end result: is the PMC or NMC call right per the TM's PMCS "not fully mission capable if" column, and is "operator
                  fix" versus "needs maintenance" right for an operator (-10 level)?
                </li>
                <li>
                  Use <b>Flag</b> on any step that is wrong, unclear, unsafe or missing something. Say what it should be.
                </li>
                <li>
                  Optional: use <b>Walk through</b> to answer the questions as a soldier would.
                </li>
                <li>
                  At the bottom, mark the tree <b>Approved</b> or <b>Needs changes</b>. Approve only when you have no open flags on it.
                </li>
              </ol>
            </details>
            <div className="flex flex-wrap gap-2">
              <button type="button" className={`${btnClass({ on: view === 'tree' })} max-[600px]:flex-1`} aria-pressed={view === 'tree'} onClick={() => setView('tree')}>
                Trees
              </button>
              <button type="button" className={`${btnClass({ on: view === 'flags' })} max-[600px]:flex-1`} aria-pressed={view === 'flags'} onClick={() => setView('flags')}>
                All open flags ({openFlags.length})
              </button>
            </div>
          </header>

          <div className="mt-5 grid grid-cols-[minmax(0,1fr)] items-start gap-7 min-[900px]:grid-cols-[300px_minmax(0,1fr)]">
            <nav
              className="hidden min-[900px]:block sticky top-0 max-h-dvh overflow-y-auto pt-1 pr-1 pb-6"
              aria-label="Troubleshooting trees"
            >
              {groups.map((g) => (
                <div key={g.v} className="mb-4">
                  <h3 className="m-0 mb-1 font-display text-xs font-semibold uppercase tracking-wider text-text-secondary">
                    {vehicles[g.v].label}
                    <small className="mt-0.5 block font-normal normal-case tracking-normal">
                      {vehicles[g.v].tm} · {vehicles[g.v].date}
                    </small>
                  </h3>
                  {g.trees.map((t) => {
                    const s = states.get(t.key)!;
                    const sel = t.key === key && view === 'tree';
                    const meta = [s.approvals ? `✓${s.approvals}` : '', s.open ? `⚑${s.open}` : '', `${t.order.length} steps`].filter(Boolean).join('  ');
                    return (
                      <button
                        key={t.key}
                        type="button"
                        title={STATUS_TITLE[s.status]}
                        aria-current={t.key === key ? 'true' : undefined}
                        onClick={() => openTree(t.key)}
                        className={`grid w-full grid-cols-[14px_minmax(0,1fr)_auto] items-center gap-2 rounded-[var(--radius-md)] px-2 py-1.5 text-left text-sm text-text-primary hover:bg-bg-secondary ${
                          sel ? 'bg-bg-secondary font-semibold shadow-[inset_3px_0_0_var(--color-accent-blue)]' : ''
                        }`}
                      >
                        <StatusDot status={s.status} />
                        <span>{t.label}</span>
                        <span className="whitespace-nowrap font-display text-xs text-text-secondary">{meta}</span>
                      </button>
                    );
                  })}
                </div>
              ))}
            </nav>

            <main ref={mainRef} className="min-w-0 scroll-mt-2">
              <select
                aria-label="Choose a tree"
                value={key}
                onChange={(e) => openTree(e.target.value)}
                className="min-[900px]:hidden sticky top-[env(safe-area-inset-top,0px)] z-10 mb-3 block w-full min-h-[48px] rounded-[var(--radius-md)] border border-border bg-bg-secondary px-2.5 text-base text-text-primary shadow-[0_2px_0_var(--color-bg-primary)] focus:outline-none focus:ring-2 focus:ring-accent-blue"
              >
                {groups.map((g) => (
                  <optgroup key={g.v} label={vehicles[g.v].label}>
                    {g.trees.map((t) => {
                      const s = states.get(t.key)!.status;
                      return (
                        <option key={t.key} value={t.key}>
                          {vehicles[g.v].label} — {t.label}
                          {s === 'approved' ? ' ✓' : s === 'none' ? '' : ' ⚑'}
                        </option>
                      );
                    })}
                  </optgroup>
                ))}
              </select>
              {view === 'flags' ? renderAllFlags() : renderTree(tree)}
            </main>
          </div>
          <footer className="mt-9 font-display text-xs text-text-secondary">
            {trees.length} trees · {totalSteps} steps
          </footer>
        </div>
      </div>
    </ReviewContext.Provider>
  );
}

function StepRef({ tree, nodeId, onOpen }: { tree: ReviewTree; nodeId: string; onOpen: () => void }) {
  return (
    <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1 text-sm">
      <a
        href={`#${nodeAnchor(tree.key, nodeId)}`}
        className="font-display text-accent-blue underline underline-offset-2 whitespace-nowrap"
        onClick={(e) => {
          e.preventDefault();
          onOpen();
        }}
      >
        Step {tree.stepNo[nodeId] ?? '?'}
      </a>
      <span className="min-w-0 text-text-secondary [overflow-wrap:anywhere]">{tree.nodes[nodeId]?.text ?? ''}</span>
    </div>
  );
}

function Empty({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-[var(--radius-lg)] border border-dashed border-border bg-bg-secondary p-6 text-center text-text-secondary">{children}</div>
  );
}
