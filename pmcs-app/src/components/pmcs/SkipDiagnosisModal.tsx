import { useState } from 'react';
import { motion } from 'framer-motion';
import { X } from 'lucide-react';
import { Button } from '../ui/Button';
import { TextArea } from '../ui/TextArea';

interface SkipDiagnosisModalProps {
  onConfirm: (reason: string) => void;
  onCancel: () => void;
}

export function SkipDiagnosisModal({ onConfirm, onCancel }: SkipDiagnosisModalProps) {
  const [reason, setReason] = useState('');

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[60] bg-black/60 flex items-end justify-center"
    >
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        className="w-full max-w-lg bg-bg-primary rounded-t-2xl p-4 flex flex-col gap-4 pb-[calc(16px+env(safe-area-inset-bottom))]"
      >
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold font-display text-text-primary">Skip Diagnosis</h3>
          <button
            onClick={onCancel}
            className="min-w-[44px] min-h-[44px] flex items-center justify-center text-text-secondary"
          >
            <X size={22} />
          </button>
        </div>
        <p className="text-sm text-text-secondary">
          Why are you skipping the diagnosis? This helps track maintenance quality.
        </p>
        <TextArea
          label="Reason"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="e.g., Already know it's a flat tire"
        />
        <Button size="lg" fullWidth onClick={() => onConfirm(reason)} disabled={!reason.trim()}>
          Skip Diagnosis
        </Button>
      </motion.div>
    </motion.div>
  );
}
