import type { ReviewTree } from '../../utils/reviewTrees';
import { FlagButton, NodeFlags, ResultRow, TmParaLink, TypeTag } from './FlagViews';
import { btnClass, useReview } from './reviewContext';

export interface WalkStep {
  id: string;
  /** The answer that led here (null for the first step). */
  via: string | null;
}

interface WalkThroughProps {
  tree: ReviewTree;
  path: WalkStep[];
  onPathChange: (path: WalkStep[]) => void;
}

/** Answer the questions one at a time, as a soldier would. */
export function WalkThrough({ tree, path: rawPath, onPathChange }: WalkThroughProps) {
  const { showInOutline } = useReview();
  const path = rawPath.length ? rawPath : [{ id: tree.rootNodeId, via: null }];
  const cur = path[path.length - 1];
  const n = tree.nodes[cur.id];
  const go = (id: string, via: string) => onPathChange([...path, { id, via }]);

  return (
    <div className="grid gap-3.5 rounded-[var(--radius-lg)] border border-border bg-bg-secondary p-4 min-[601px]:p-5" data-testid="walk">
      {!n ? (
        <p className="text-sm text-accent-red">Broken link to "{cur.id}"</p>
      ) : (
        <>
          <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1.5">
            <TypeTag tree={tree} nodeId={cur.id} />
            <TmParaLink tree={tree} node={n} />
            <FlagButton tree={tree} nodeId={cur.id} />
          </div>
          <p className="text-[17px] min-[601px]:text-lg font-semibold leading-snug text-text-primary max-w-[70ch] [overflow-wrap:anywhere]" data-testid="walk-text">
            {n.text}
          </p>
          {n.actionText && <p className="text-sm text-text-secondary max-w-[80ch] [overflow-wrap:anywhere]">{n.actionText}</p>}
          {n.type === 'question' && (
            <div className="grid gap-2 max-w-[70ch]">
              {(n.options ?? []).map((o, i) => (
                <button
                  key={`${i}-${o.label}`}
                  type="button"
                  className={`${btnClass()} justify-start! text-left text-base! py-2.5`}
                  onClick={() => go(o.nextNodeId, o.label)}
                >
                  {o.label}
                </button>
              ))}
            </div>
          )}
          {n.type === 'action' && n.nextNodeId && (
            <div className="grid gap-2 max-w-[70ch]">
              <button type="button" className={`${btnClass()} justify-start! text-left text-base! py-2.5`} onClick={() => go(n.nextNodeId!, 'Done')}>
                Done — continue
              </button>
            </div>
          )}
          <ResultRow node={n} />
          <NodeFlags tree={tree} nodeId={cur.id} />
        </>
      )}
      <div className="flex flex-wrap gap-2">
        <button type="button" className={`${btnClass()} max-[600px]:flex-1`} disabled={path.length < 2} onClick={() => onPathChange(path.slice(0, -1))}>
          ← Back
        </button>
        <button type="button" className={`${btnClass()} max-[600px]:flex-1`} disabled={path.length < 2} onClick={() => onPathChange([])}>
          Start over
        </button>
        <button type="button" className={`${btnClass()} max-[600px]:flex-1`} onClick={() => showInOutline(tree, cur.id)}>
          Show in outline
        </button>
      </div>
      {path.length > 1 && (
        <div className="grid gap-1 border-t border-border pt-2.5 text-sm text-text-secondary" data-testid="walk-trail">
          <b className="text-text-primary">Path so far</b>
          {path.slice(0, -1).map((p, i) => (
            <div key={`${i}-${p.id}`} className="grid grid-cols-[30px_minmax(0,1fr)] gap-1.5">
              <span className="font-display">{tree.stepNo[p.id]}.</span>
              <span className="[overflow-wrap:anywhere]">
                {tree.nodes[p.id]?.text ?? p.id} → {path[i + 1].via}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
