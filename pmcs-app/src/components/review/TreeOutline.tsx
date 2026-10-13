import type { ReactNode } from 'react';
import type { ReviewTree } from '../../utils/reviewTrees';
import { FlagButton, NodeFlags, ResultRow, TmParaLink, TypeTag } from './FlagViews';
import { NODE_TYPE_LABEL, nodeAnchor, useReview } from './reviewContext';

/** Past this depth, phones stop indenting so deep trees stay on screen; the step shows "level N". */
const PHONE_FLAT_DEPTH = 4;
/** Past this depth, wide screens stop indenting children too. */
const WIDE_FLAT_DEPTH = 9;

function OptionLabel({ word, children }: { word: string; children: ReactNode }) {
  return (
    <div className="flex items-baseline gap-1.5 text-sm text-text-primary">
      <b className="font-display text-xs font-semibold text-accent-blue whitespace-nowrap">{word}</b>
      <span className="min-w-0 [overflow-wrap:anywhere]">{children}</span>
    </div>
  );
}

/**
 * Every question, action and end result of one tree, numbered in the order a soldier reaches
 * them. A step reached from more than one place is shown once; later references say
 * "continues at Step N".
 */
export function TreeOutline({ tree }: { tree: ReviewTree }) {
  const { highlight, showInOutline } = useReview();
  const shown = new Set<string>();

  const renderNode = (id: string, depth: number): ReactNode => {
    const n = tree.nodes[id];
    if (!n) {
      return <div className="text-sm text-accent-red mt-1 ml-3.5">Broken link to "{id}"</div>;
    }
    if (shown.has(id)) {
      return (
        <div className="text-sm text-text-secondary mt-1 ml-3.5">
          → continues at{' '}
          <a
            href={`#${nodeAnchor(tree.key, id)}`}
            className="font-display text-accent-blue underline underline-offset-2"
            onClick={(e) => {
              e.preventDefault();
              showInOutline(tree, id);
            }}
          >
            Step {tree.stepNo[id]}
          </a>{' '}
          ({(NODE_TYPE_LABEL[n.type] ?? n.type).toLowerCase()} shown above)
        </div>
      );
    }
    shown.add(id);
    const deep = depth >= PHONE_FLAT_DEPTH;
    const childWrap = (kid: ReactNode) => (
      <div className={`mt-1.5 ${depth >= WIDE_FLAT_DEPTH ? 'ml-0' : 'ml-1.5'} ${deep ? 'max-[600px]:ml-0' : 'max-[600px]:ml-0.5'}`}>{kid}</div>
    );
    return (
      <div
        id={nodeAnchor(tree.key, id)}
        data-node={id}
        data-depth={depth}
        className={[
          'relative py-2.5 pl-3.5 border-l-2 border-border scroll-mt-20 min-[900px]:scroll-mt-4 transition-colors duration-700',
          depth > WIDE_FLAT_DEPTH ? 'border-dotted' : '',
          deep
            ? 'max-[600px]:pl-0 max-[600px]:border-l-0 max-[600px]:border-t max-[600px]:border-dashed max-[600px]:mt-1.5'
            : 'max-[600px]:pl-2',
          highlight === `${tree.key}|${id}` ? 'bg-accent-blue/15' : '',
        ].join(' ')}
      >
        <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1.5">
          <TypeTag tree={tree} nodeId={id} />
          {deep && <span className="hidden max-[600px]:inline font-display text-[11px] text-text-secondary">level {depth + 1}</span>}
          <span className="min-w-0 flex-[1_1_320px] max-[600px]:basis-full font-medium text-text-primary [overflow-wrap:anywhere]">{n.text}</span>
          <TmParaLink tree={tree} node={n} />
          <FlagButton tree={tree} nodeId={id} className="ml-auto max-[600px]:ml-0" />
        </div>
        {n.actionText && <p className="mt-1 text-sm text-text-secondary max-w-[80ch] [overflow-wrap:anywhere]">{n.actionText}</p>}
        <ResultRow node={n} />
        <NodeFlags tree={tree} nodeId={id} />
        {n.type === 'question' &&
          (n.options ?? []).map((o, i) => (
            <div key={`${i}-${o.label}`} className="mt-2">
              <OptionLabel word="IF">{o.label}</OptionLabel>
              {childWrap(renderNode(o.nextNodeId, depth + 1))}
            </div>
          ))}
        {n.type === 'action' && n.nextNodeId && (
          <div className="mt-2">
            <OptionLabel word="THEN">continue</OptionLabel>
            {childWrap(renderNode(n.nextNodeId, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  const root = renderNode(tree.rootNodeId, 0);
  const orphans = tree.order.filter((id) => !shown.has(id));
  return (
    <div className="grid" data-testid="outline">
      {root}
      {orphans.length > 0 && (
        <>
          <p className="mt-4 rounded-[var(--radius-md)] border border-accent-amber/60 bg-accent-amber/10 px-3.5 py-2.5 text-sm text-text-primary" role="note">
            {orphans.length} step{orphans.length === 1 ? '' : 's'} in this tree can't be reached from the start. They are listed below so
            you can say whether they should be connected or removed.
          </p>
          {orphans.map((id) => (shown.has(id) ? null : <div key={id}>{renderNode(id, 0)}</div>))}
        </>
      )}
    </div>
  );
}
