import { ChevronLeft, ChevronRight } from 'lucide-react';

interface StepNavProps {
  currentStep: number;
  totalSteps: number;
  onPrev: () => void;
  onNext: () => void;
  onFinish: () => void;
}

export function StepNav({ currentStep, totalSteps, onPrev, onNext, onFinish }: StepNavProps) {
  const isFirst = currentStep === 0;
  const isLast = currentStep === totalSteps - 1;
  const progress = totalSteps > 0 ? (currentStep + 1) / totalSteps : 0;

  return (
    <div className="sticky bottom-0 bg-bg-primary border-t border-border pb-[env(safe-area-inset-bottom)]">
      <div className="h-1 bg-bg-tertiary">
        <div
          className="h-full bg-accent-blue transition-all duration-300"
          style={{ width: `${progress * 100}%` }}
        />
      </div>
      <div className="flex items-center justify-between h-14 px-2">
        <button
          onClick={onPrev}
          disabled={isFirst}
          className="min-w-[80px] min-h-[48px] flex items-center gap-1 text-accent-blue disabled:text-text-secondary/30 font-medium"
        >
          <ChevronLeft size={20} />
          Prev
        </button>

        <span className="text-sm text-text-secondary font-display">
          {currentStep + 1} / {totalSteps}
        </span>

        {isLast ? (
          <button
            onClick={onFinish}
            className="min-w-[80px] min-h-[48px] flex items-center justify-end gap-1 text-accent-green font-semibold"
          >
            Finish
          </button>
        ) : (
          <button
            onClick={onNext}
            className="min-w-[80px] min-h-[48px] flex items-center justify-end gap-1 text-accent-blue font-medium"
          >
            Next
            <ChevronRight size={20} />
          </button>
        )}
      </div>
    </div>
  );
}
