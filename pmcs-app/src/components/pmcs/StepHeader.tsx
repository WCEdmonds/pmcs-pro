import { ChevronLeft } from 'lucide-react';

interface StepHeaderProps {
  zoneName: string;
  stepInZone: number;
  totalInZone: number;
  zoneProgress: number; // 0-1
  onBack: () => void;
  onZoneTap: () => void;
}

export function StepHeader({ zoneName, stepInZone, totalInZone, zoneProgress, onBack, onZoneTap }: StepHeaderProps) {
  return (
    <div className="sticky top-0 z-30 bg-bg-primary border-b border-border">
      <div className="flex items-center h-11 px-2">
        <button onClick={onBack} className="min-w-[44px] min-h-[44px] flex items-center justify-center text-accent-blue">
          <ChevronLeft size={24} />
        </button>
        <button onClick={onZoneTap} className="flex-1 text-center min-h-[44px] flex flex-col items-center justify-center">
          <span className="text-sm font-semibold font-display text-text-primary truncate">{zoneName}</span>
          <span className="text-xs text-text-secondary">Step {stepInZone} of {totalInZone}</span>
        </button>
        <div className="w-11" />
      </div>
      <div className="h-1 bg-bg-tertiary">
        <div
          className="h-full bg-accent-blue transition-all duration-300"
          style={{ width: `${zoneProgress * 100}%` }}
        />
      </div>
    </div>
  );
}
