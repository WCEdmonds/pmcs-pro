import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Wrench, ArrowUpCircle } from 'lucide-react';
import { useSessionStore } from '../../stores/sessionStore';
import { useDiagnosisStore } from '../../stores/diagnosisStore';
import { buildFaultDescription, getReadinessForCategory } from '../../utils/diagnosisEngine';
import { getCategoryById } from '../../data/faultCategories';
import { Button } from '../ui/Button';
import { TextArea } from '../ui/TextArea';
import { Input } from '../ui/Input';
import { CategoryPicker } from './CategoryPicker';
import { DiagnosisStepper } from './DiagnosisStepper';
import { FaultChips } from './FaultChips';
import { PhotoCapture } from './PhotoCapture';
import { db } from '../../utils/db';
import type { PmcsStepData, Fault } from '../../types';
import type { FaultCategory, TerminalData, DiagnosisStep, Readiness, TroubleshootingTree } from '../../types/diagnosis';

interface FaultDetailPanelProps {
  step: PmcsStepData;
  sessionId: string;
  vehicleId: string;
  vehicleType: string;
  existingFault?: Fault;
  onDone: () => void;
  onCancel: () => void;
}

type Phase = 'category' | 'diagnosis' | 'details';
type Resolution = 'none' | 'corrected' | 'needs_maintenance';

export function FaultDetailPanel({
  step, sessionId, vehicleId, vehicleType, existingFault, onDone, onCancel,
}: FaultDetailPanelProps) {
  const { addFault, updateFault, updateStepStatus, addPhoto } = useSessionStore();
  const diagnosisStore = useDiagnosisStore();

  // Phase management
  const [phase, setPhase] = useState<Phase>(existingFault ? 'details' : 'category');
  const [selectedCategory, setSelectedCategory] = useState<FaultCategory | null>(null);

  // Fault detail fields
  const [description, setDescription] = useState(existingFault?.description || '');
  const [resolution, setResolution] = useState<Resolution>(
    existingFault?.correctedOnSite ? 'corrected' :
    existingFault?.needsMaintenance ? 'needs_maintenance' : 'none'
  );
  const [correctiveAction, setCorrectiveAction] = useState(existingFault?.correctiveAction || '');
  const [partNeeded, setPartNeeded] = useState(existingFault?.partNeeded || false);
  const [partDescription, setPartDescription] = useState(existingFault?.partDescription || '');
  const [nsn, setNsn] = useState(existingFault?.nsn || '');
  const [photos, setPhotos] = useState<string[]>([]);
  const [readiness, setReadiness] = useState<Readiness>(existingFault?.readiness || 'NMC');
  const [categoryId, setCategoryId] = useState(existingFault?.categoryId || '');

  const handleCategorySelect = useCallback(async (category: FaultCategory) => {
    setSelectedCategory(category);
    setCategoryId(category.id);

    if (category.hasDiagnosisTree) {
      try {
        const vehicleKey = vehicleType === 'LMTV_M1078' ? 'm1078' : vehicleType === 'M1101_TRAILER' ? 'm1101' : vehicleType === 'MEP803A' ? 'mep803a' : 'm1151';
        const module = await import(`../../data/troubleshooting/${vehicleKey}-troubleshooting.json`);
        const trees = module.default as TroubleshootingTree[];
        const tree = trees.find((t: TroubleshootingTree) => t.categoryId === category.id);
        if (tree) {
          const faultId = existingFault?.id || crypto.randomUUID();
          diagnosisStore.startDiagnosis(faultId, sessionId, tree);
          setPhase('diagnosis');
          return;
        }
      } catch {
        // Tree file not found — fall through to details
      }
    }

    // No tree — pre-populate description with category label and go to details
    const fixedReadiness = getReadinessForCategory(category);
    if (fixedReadiness) setReadiness(fixedReadiness);
    if (!description) setDescription(category.label);
    setPhase('details');
  }, [vehicleType, sessionId, existingFault, diagnosisStore, description]);

  const handleOther = useCallback(() => {
    setCategoryId('other');
    setReadiness('NMC');
    setPhase('details');
  }, []);

  const handleChipSelect = useCallback((text: string, chipCategoryId: string) => {
    setDescription(text);
    const cat = getCategoryById(chipCategoryId);
    if (cat) {
      setCategoryId(cat.id);
      const fixedReadiness = getReadinessForCategory(cat);
      if (fixedReadiness) setReadiness(fixedReadiness);
    }
  }, []);

  const handleDiagnosisComplete = useCallback((terminal: TerminalData, trail: DiagnosisStep[]) => {
    setDescription(buildFaultDescription(trail, terminal.summary));
    setResolution(terminal.resolution === 'operator-fix' ? 'corrected' : 'needs_maintenance');
    setReadiness(terminal.readiness);
    diagnosisStore.clear();
    setPhase('details');
  }, [diagnosisStore]);

  const handleDiagnosisSkip = useCallback((_reason: string) => {
    setReadiness('NMC');
    setPhase('details');
  }, []);

  const handleDone = async () => {
    if (!description.trim()) return;

    const faultData = {
      description: description.trim(),
      categoryId,
      readiness,
      correctedOnSite: resolution === 'corrected',
      correctiveAction: resolution === 'corrected' ? correctiveAction.trim() || undefined : undefined,
      needsMaintenance: resolution === 'needs_maintenance',
      partNeeded,
      partDescription: partNeeded ? partDescription.trim() || undefined : undefined,
      nsn: partNeeded ? nsn.trim() || undefined : undefined,
    };

    let faultId: string;
    if (existingFault) {
      await updateFault(existingFault.id, faultData);
      faultId = existingFault.id;
    } else {
      faultId = crypto.randomUUID();
      const fault: Fault = {
        id: faultId,
        sessionId,
        vehicleId,
        stepId: step.id,
        zone: step.zone,
        item: step.item,
        itemDescription: step.itemDescription,
        tmReference: `${step.conditionSet}, Item ${step.item}`,
        createdAt: new Date().toISOString(),
        ...faultData,
      };
      await addFault(fault);
    }

    // Save diagnosis attempt if one was completed or skipped
    const diagState = useDiagnosisStore.getState();
    if (diagState.skipReason || diagState.trail.length > 0) {
      const attempt = {
        id: crypto.randomUUID(),
        faultId,
        sessionId,
        categoryId,
        stepsCompleted: diagState.trail,
        outcome: diagState.skipReason ? 'skipped' as const : resolution === 'corrected' ? 'operator-fix' as const : 'needs-maintenance' as const,
        skipReason: diagState.skipReason || undefined,
        readinessResult: readiness,
        completedAt: new Date().toISOString(),
      };
      await db.diagnosisAttempts.put(attempt);
    }

    // Save photos to Dexie
    for (const dataUrl of photos) {
      await addPhoto({
        id: crypto.randomUUID(),
        faultId,
        sessionId,
        dataUrl,
        createdAt: new Date().toISOString(),
      });
    }

    diagnosisStore.clear();
    await updateStepStatus(step.id, 'FAULT');
    onDone();
  };

  return (
    <motion.div
      initial={{ y: '100%' }}
      animate={{ y: 0 }}
      exit={{ y: '100%' }}
      transition={{ type: 'spring', damping: 25, stiffness: 300 }}
      className="fixed inset-0 z-50 bg-bg-primary flex flex-col"
    >
      <AnimatePresence mode="wait">
        {phase === 'category' && (
          <motion.div
            key="category"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col h-full"
          >
            <div className="flex items-center justify-between px-4 h-12 border-b border-border flex-shrink-0">
              <h3 className="text-base font-bold font-display text-text-primary">
                Fault — Item {step.item}
              </h3>
              <button onClick={onCancel} className="min-w-[44px] min-h-[44px] flex items-center justify-center text-text-secondary">
                <X size={22} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              <p className="text-sm text-text-secondary mb-4">{step.itemDescription}</p>
              <CategoryPicker stepId={step.id} onSelect={handleCategorySelect} onOther={handleOther} />
            </div>
          </motion.div>
        )}

        {phase === 'diagnosis' && selectedCategory && (
          <motion.div
            key="diagnosis"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="h-full"
          >
            <DiagnosisStepper
              categoryLabel={selectedCategory.label}
              vehicleType={vehicleType}
              onComplete={handleDiagnosisComplete}
              onSkip={handleDiagnosisSkip}
            />
          </motion.div>
        )}

        {phase === 'details' && (
          <motion.div
            key="details"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col h-full"
          >
            <div className="flex items-center justify-between px-4 h-12 border-b border-border flex-shrink-0">
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold font-display text-text-primary">
                  Fault Details — Item {step.item}
                </h3>
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                  readiness === 'PMC' ? 'bg-accent-green/20 text-accent-green' : 'bg-accent-red/20 text-accent-red'
                }`}>
                  {readiness}
                </span>
              </div>
              <button onClick={onCancel} className="min-w-[44px] min-h-[44px] flex items-center justify-center text-text-secondary">
                <X size={22} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
              <p className="text-sm text-text-secondary">{step.itemDescription}</p>

              <div>
                <TextArea
                  label="What's wrong?"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe the fault..."
                />
                <div className="mt-2">
                  <FaultChips stepId={step.id} onSelect={handleChipSelect} />
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <span className="text-sm font-medium text-text-secondary">What's the status?</span>
                <div className="flex flex-col gap-2">
                  <button
                    type="button"
                    onClick={() => setResolution('corrected')}
                    className={`flex items-center gap-3 p-3 rounded-[var(--radius-md)] border text-left min-h-[48px] transition-colors ${
                      resolution === 'corrected'
                        ? 'border-accent-green bg-accent-green/10'
                        : 'border-border active:border-accent-green'
                    }`}
                  >
                    <Wrench size={20} className={resolution === 'corrected' ? 'text-accent-green' : 'text-text-secondary'} />
                    <div>
                      <p className="text-sm font-medium text-text-primary">I fixed it</p>
                      <p className="text-xs text-text-secondary">Corrected on site — operator level</p>
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setResolution('needs_maintenance')}
                    className={`flex items-center gap-3 p-3 rounded-[var(--radius-md)] border text-left min-h-[48px] transition-colors ${
                      resolution === 'needs_maintenance'
                        ? 'border-accent-amber bg-accent-amber/10'
                        : 'border-border active:border-accent-amber'
                    }`}
                  >
                    <ArrowUpCircle size={20} className={resolution === 'needs_maintenance' ? 'text-accent-amber' : 'text-text-secondary'} />
                    <div>
                      <p className="text-sm font-medium text-text-primary">Needs maintenance support</p>
                      <p className="text-xs text-text-secondary">Beyond operator level — needs a mechanic</p>
                    </div>
                  </button>
                </div>
              </div>

              {resolution === 'corrected' && (
                <div className="pl-4 border-l-2 border-accent-green">
                  <TextArea
                    label="What did you do to fix it?"
                    value={correctiveAction}
                    onChange={(e) => setCorrectiveAction(e.target.value)}
                    placeholder="e.g., Topped off oil to FULL mark"
                  />
                </div>
              )}

              {resolution === 'needs_maintenance' && (
                <div className="pl-4 border-l-2 border-accent-amber flex flex-col gap-3">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="partNeeded"
                      checked={partNeeded}
                      onChange={(e) => setPartNeeded(e.target.checked)}
                      className="w-5 h-5 rounded border-border bg-bg-tertiary accent-accent-amber"
                    />
                    <label htmlFor="partNeeded" className="text-sm text-text-primary">Part needed</label>
                  </div>
                  {partNeeded && (
                    <div className="flex flex-col gap-2">
                      <Input label="Part Description" value={partDescription} onChange={(e) => setPartDescription(e.target.value)} placeholder="e.g., Serpentine belt" />
                      <Input label="NSN (optional)" value={nsn} onChange={(e) => setNsn(e.target.value)} inputMode="numeric" placeholder="e.g., 2320-01-346-9317" />
                    </div>
                  )}
                </div>
              )}

              <PhotoCapture
                photos={photos}
                onCapture={(dataUrl) => setPhotos([...photos, dataUrl])}
                onRemove={(i) => setPhotos(photos.filter((_, idx) => idx !== i))}
              />
            </div>

            <div className="p-4 border-t border-border flex-shrink-0 pb-[calc(16px+env(safe-area-inset-bottom))]">
              <Button size="lg" fullWidth onClick={handleDone} disabled={!description.trim()}>
                Done
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
