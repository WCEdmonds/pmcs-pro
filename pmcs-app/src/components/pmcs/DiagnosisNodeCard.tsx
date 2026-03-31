import { Check, ArrowRight, BookOpen } from 'lucide-react';
import { Button } from '../ui/Button';
import type { TreeNode } from '../../types/diagnosis';
import { getTmPageUrl } from '../../data/tmPageMap';

interface DiagnosisNodeCardProps {
  node: TreeNode;
  vehicleType: string;
  onSelectOption: (label: string) => void;
  onActionDone: () => void;
}

function TmLink({ tmPage, vehicleType }: { tmPage?: string; vehicleType: string }) {
  if (!tmPage) return null;
  const url = getTmPageUrl(vehicleType, tmPage);
  if (!url) return null;
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1.5 text-xs text-accent-blue active:text-accent-blue/80 min-h-[44px]"
    >
      <BookOpen size={14} />
      See TM page {tmPage}
    </a>
  );
}

export function DiagnosisNodeCard({ node, vehicleType, onSelectOption, onActionDone }: DiagnosisNodeCardProps) {
  if (node.type === 'question') {
    return (
      <div className="flex flex-col gap-4">
        <p className="text-base font-semibold text-text-primary">{node.text}</p>
        <TmLink tmPage={node.tmPage} vehicleType={vehicleType} />
        {node.illustration && (
          <img
            src={node.illustration}
            alt=""
            className="w-full rounded-[var(--radius-md)] border border-border"
          />
        )}
        <div className="flex flex-col gap-2">
          {node.options?.map((option) => (
            <button
              key={option.label}
              type="button"
              onClick={() => onSelectOption(option.label)}
              className="flex items-center gap-3 p-3 rounded-[var(--radius-md)] border border-border text-left min-h-[48px] active:border-accent-blue active:bg-bg-tertiary transition-colors"
            >
              <ArrowRight size={16} className="text-text-secondary flex-shrink-0" />
              <span className="text-sm text-text-primary">{option.label}</span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (node.type === 'action') {
    return (
      <div className="flex flex-col gap-4">
        <p className="text-base font-semibold text-text-primary">{node.text}</p>
        {node.actionText && (
          <div className="p-3 bg-bg-tertiary rounded-[var(--radius-md)] border border-border">
            <p className="text-sm text-text-primary">{node.actionText}</p>
          </div>
        )}
        <TmLink tmPage={node.tmPage} vehicleType={vehicleType} />
        {node.illustration && (
          <img
            src={node.illustration}
            alt=""
            className="w-full rounded-[var(--radius-md)] border border-border"
          />
        )}
        <Button size="lg" fullWidth onClick={onActionDone}>
          <Check size={18} />
          Done
        </Button>
      </div>
    );
  }

  if (node.type === 'terminal' && node.terminal) {
    const isOperatorFix = node.terminal.resolution === 'operator-fix';
    return (
      <div className="flex flex-col gap-4">
        <div
          className={`p-4 rounded-[var(--radius-md)] border ${
            isOperatorFix
              ? 'border-accent-green bg-accent-green/10'
              : 'border-accent-amber bg-accent-amber/10'
          }`}
        >
          <p className="text-sm font-semibold mb-1 text-text-primary">
            {isOperatorFix ? 'Fixable at your level' : 'Needs maintenance support'}
          </p>
          <p className="text-sm text-text-secondary">{node.terminal.summary}</p>
        </div>
        <div
          className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold w-fit ${
            node.terminal.readiness === 'PMC'
              ? 'bg-accent-green/20 text-accent-green'
              : 'bg-accent-red/20 text-accent-red'
          }`}
        >
          {node.terminal.readiness}
        </div>
        <p className="text-sm text-text-secondary">{node.text}</p>
        <TmLink tmPage={node.tmPage} vehicleType={vehicleType} />
      </div>
    );
  }

  return null;
}
