import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, SkipForward } from 'lucide-react';
import { useDiagnosisStore } from '../../stores/diagnosisStore';
import { getNode } from '../../utils/diagnosisEngine';
import { DiagnosisNodeCard } from './DiagnosisNodeCard';
import { SkipDiagnosisModal } from './SkipDiagnosisModal';
import { Button } from '../ui/Button';
import type { TerminalData, DiagnosisStep } from '../../types/diagnosis';

interface DiagnosisStepperProps {
  categoryLabel: string;
  vehicleType: string;
  onComplete: (terminal: TerminalData, trail: DiagnosisStep[]) => void;
  onSkip: (reason: string) => void;
}

export function DiagnosisStepper({ categoryLabel, vehicleType, onComplete, onSkip }: DiagnosisStepperProps) {
  const { tree, currentNodeId, trail, advance, goBack, skip } = useDiagnosisStore();
  const [showSkipModal, setShowSkipModal] = useState(false);

  if (!tree || !currentNodeId) return null;

  const currentNode = getNode(tree, currentNodeId);
  if (!currentNode) return null;

  const isTerminal = currentNode.type === 'terminal' && currentNode.terminal;
  const stepCount = trail.length + 1;

  const handleSelectOption = (label: string) => {
    advance(label);
  };

  const handleActionDone = () => {
    advance();
  };

  const handleConfirmTerminal = () => {
    if (currentNode.terminal) {
      onComplete(currentNode.terminal, trail);
    }
  };

  const handleSkipConfirm = (reason: string) => {
    skip(reason);
    onSkip(reason);
    setShowSkipModal(false);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 h-12 border-b border-border flex-shrink-0">
        <div className="flex items-center gap-2">
          {trail.length > 0 && (
            <button
              onClick={goBack}
              className="min-w-[44px] min-h-[44px] flex items-center justify-center text-text-secondary"
            >
              <ArrowLeft size={20} />
            </button>
          )}
          <div>
            <span className="text-sm font-bold font-display text-text-primary">{categoryLabel}</span>
            {!isTerminal && (
              <span className="text-xs text-text-secondary ml-2">Step {stepCount}</span>
            )}
          </div>
        </div>
        {!isTerminal && (
          <button
            onClick={() => setShowSkipModal(true)}
            className="flex items-center gap-1 text-xs text-text-secondary min-h-[44px] px-2"
          >
            <SkipForward size={14} />
            Skip
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentNodeId}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.15 }}
          >
            <DiagnosisNodeCard
              node={currentNode}
              vehicleType={vehicleType}
              onSelectOption={handleSelectOption}
              onActionDone={handleActionDone}
            />
          </motion.div>
        </AnimatePresence>
      </div>

      {isTerminal && (
        <div className="p-4 border-t border-border flex-shrink-0 pb-[calc(16px+env(safe-area-inset-bottom))]">
          <Button size="lg" fullWidth onClick={handleConfirmTerminal}>
            Continue to Fault Details
          </Button>
        </div>
      )}

      <AnimatePresence>
        {showSkipModal && (
          <SkipDiagnosisModal
            onConfirm={handleSkipConfirm}
            onCancel={() => setShowSkipModal(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
