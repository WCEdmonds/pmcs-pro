import { Check, OctagonAlert } from 'lucide-react';
import type { StepStatus } from '../../types';

interface StatusButtonsProps {
  currentStatus: StepStatus;
  onStatusChange: (status: StepStatus) => void;
}

const buttons = [
  { status: 'GO' as const, label: 'GO', icon: Check, color: 'accent-green' },
  { status: 'FAULT' as const, label: 'FAULT', icon: OctagonAlert, color: 'accent-red' },
] as const;

export function StatusButtons({ currentStatus, onStatusChange }: StatusButtonsProps) {
  return (
    <div className="flex gap-2 px-4">
      {buttons.map(({ status, label, icon: Icon, color }) => {
        const isSelected = currentStatus === status;
        return (
          <button
            key={status}
            onClick={() => onStatusChange(status)}
            className={`
              flex-1 min-h-[56px] rounded-[var(--radius-md)] flex flex-col items-center justify-center gap-1
              font-display font-semibold text-sm transition-all duration-150
              ${isSelected
                ? `bg-${color} text-white`
                : `border-2 border-border text-text-secondary active:border-${color}`
              }
            `}
          >
            <Icon size={20} />
            {label}
          </button>
        );
      })}
    </div>
  );
}
