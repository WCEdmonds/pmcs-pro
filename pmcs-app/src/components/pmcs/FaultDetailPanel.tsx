import { useState, useCallback, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Wrench, ArrowUpCircle } from 'lucide-react';
import { useSessionStore } from '../../stores/sessionStore';
import { useDiagnosisStore } from '../../stores/diagnosisStore';
import { buildFaultDescription, defaultReadiness } from '../../utils/diagnosisEngine';
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
import type { FaultCategory, TerminalData, DiagnosisStep, Readiness, TroubleshootingTree, DiagnosisAttempt } from '../../types/diagnosis';

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

/** Captured when the diagnosis tree finishes or is skipped, so saving doesn't depend on the (cleared) store. */
interface DiagnosisOutcome {
  trail: DiagnosisStep[];
  outcome: DiagnosisAttempt['outcome'];
  skipReason?: string;
}

function vehicleKeyFor(vehicleType: string): string {
  switch (vehicleType) {
    case 'LMTV_M1078': return 'm1078';
    case 'M1101_TRAILER': return 'm1101';
    case 'MEP803A': return 'mep803a';
    default: return 'm1151';
  }
}

export function FaultDetailPanel({
  step, sessionId, vehicleId, vehicleType, existingFault, onDone, onCancel,
}: FaultDetailPanelProps) {
  const { addFault, updateFault, updateStepStatus, addPhoto } = useSessionStore();
  const startDiagnosis = useDiagnosisStore((s) => s.startDiagnosis);
  const clearDiagnosis = useDiagnosisStore((s) => s.clear);

  const faultIdRef = useRef<string>(existingFault?.id ?? crypto.randomUUID());
  const savingRef = useRef(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  // Never inherit diagnosis/skip state from a previous fault, and never leak ours.
  useEffect(() => {
    clearDiagnosis();
    return () => clearDiagnosis();
  }, [clearDiagnosis]);

  const [phase, setPhase] = useState<Phase>(existingFault ? 'details' : 'category');
  const [selectedCategory, setSelectedCategory] = useState<FaultCategory | null>(null);

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
  const [readiness, setReadiness] = useState<Readiness>(existingFault?.readiness || defaultReadiness(step));
  /** Once the soldier picks PMC/NMC by hand, categories/chips no longer change it. */
  const [readinessTouched, setReadinessTouched] = useState(!!existingFault);
  const [categoryId, setCategoryId] = useState(existingFault?.categoryId || '');
  const [diagnosis, setDiagnosis] = useState<DiagnosisOutcome | null>(null);

  const applyCategoryReadiness = useCallback((cat: FaultCategory | null) => {
    if (!readinessTouched) setReadiness(defaultReadiness(step, cat));
  }, [readinessTouched, step]);

  const handleCategorySelect = useCallback(async (category: FaultCategory) => {
    setSelectedCategory(category);
    setCategoryId(category.id);
    setDiagnosis(null);

    if (category.hasDiagnosisTree) {
      try {
        const module = await import(`../../data/troubleshooting/${vehicleKeyFor(vehicleType)}-troubleshooting.json`);
        const trees = module.default as TroubleshootingTree[];
        const tree = trees.find((t: TroubleshootingTree) => t.categoryId === category.id);
        if (tree) {
          startDiagnosis(faultIdRef.current, sessionId, tree);
          setPhase('diagnosis');
          return;
        }
      } catch {
        // Tree file not found — fall through to details
      }
    }

    applyCategoryReadiness(category);
    if (!description) setDescription(category.label);
    setPhase('details');
  }, [vehicleType, sessionId, startDiagnosis, description, applyCategoryReadiness]);

  const handleOther = useCallback(() => {
    setCategoryId('other');
    setSelectedCategory(null);
    applyCategoryReadiness(null);
    setPhase('details');
  }, [applyCategoryReadiness]);

  const handleChipSelect = useCallback((text: string, chipCategoryId: string, chipReadiness?: Readiness) => {
    setDescription(text);
    const cat = getCategoryById(chipCategoryId);
    if (cat) setCategoryId(cat.id);
    if (readinessTouched) return;
    // A chip that states its readiness (matches / falls outside the TM criterion) decides the default.
    if (chipReadiness) setReadiness(chipReadiness);
    else if (cat) applyCategoryReadiness(cat);
  }, [applyCategoryReadiness, readinessTouched]);

  const handleDiagnosisComplete = useCallback((terminal: TerminalData, trail: DiagnosisStep[]) => {
    setDescription(buildFaultDescription(trail, terminal.summary));
    setResolution(terminal.resolution === 'operator-fix' ? 'corrected' : 'needs_maintenance');
    // The tree's result sets readiness, but the soldier can still override it.
    setReadiness(terminal.readiness);
    setDiagnosis({ trail, outcome: terminal.resolution });
    clearDiagnosis();
    setPhase('details');
  }, [clearDiagnosis]);

  const handleDiagnosisSkip = useCallback((reason: string) => {
    const trail = useDiagnosisStore.getState().trail;
    setDiagnosis({ trail, outcome: 'skipped', skipReason: reason });
    if (selectedCategory) applyCategoryReadiness(selectedCategory);
    else applyCategoryReadiness(null);
    if (!description && selectedCategory) setDescription(selectedCategory.label);
    clearDiagnosis();
    setPhase('details');
  }, [clearDiagnosis, applyCategoryReadiness, selectedCategory, description]);

  const handleReadiness = (r: Readiness) => {
    setReadiness(r);
    setReadinessTouched(true);
  };

  const handleDone = async () => {
    if (!description.trim() || savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    setSaveError('');

    try {
      const faultData = {
        description: description.trim(),
        categoryId,
        readiness,
        correctedOnSite: resolution === 'corrected',
        correctiveAction: resolution === 'corrected' ? correctiveAction.trim() || undefined : undefined,
        needsMaintenance: resolution === 'needs_maintenance',
        partNeeded: resolution === 'needs_maintenance' && partNeeded,
        partDescription: resolution === 'needs_maintenance' && partNeeded ? partDescription.trim() || undefined : undefined,
        nsn: resolution === 'needs_maintenance' && partNeeded ? nsn.trim() || undefined : undefined,
      };

      const faultId = faultIdRef.current;
      const alreadySaved = existingFault ?? useSessionStore.getState().faults.find((f) => f.id === faultId);
      if (alreadySaved) {
        await updateFault(faultId, faultData);
      } else {
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

      if (diagnosis) {
        const attempt: DiagnosisAttempt = {
          id: crypto.randomUUID(),
          faultId,
          sessionId,
          categoryId,
          stepsCompleted: diagnosis.trail,
          outcome: diagnosis.outcome,
          skipReason: diagnosis.skipReason,
          readinessResult: readiness,
          completedAt: new Date().toISOString(),
        };
        await db.diagnosisAttempts.put(attempt);
      }

      for (const dataUrl of photos) {
        await addPhoto({
          id: crypto.randomUUID(),
          faultId,
          sessionId,
          dataUrl,
          createdAt: new Date().toISOString(),
        });
      }

      clearDiagnosis();
      await updateStepStatus(step.id, 'FAULT');
      onDone();
    } catch (err) {
      console.error('Saving fault failed:', err);
      setSaveError(err instanceof Error && /quota/i.test(err.message)
        ? 'Phone storage is full — remove a photo and try again.'
        : 'Could not save this fault. Try again.');
      savingRef.current = false;
      setSaving(false);
    }
  };

  const nmcCriterion = step.noGoCondition?.trim();

  return (
    <motion.div
      initial={{ y: '100%' }}
      animate={{ y: 0 }}
      exit={{ y: '100%' }}
      transition={{ type: 'spring', damping: 25, stiffness: 300 }}
      className="fixed inset-0 z-50 bg-bg-primary flex flex-col"
      role="dialog"
      aria-modal="true"
      aria-label={`Fault, item ${step.item}`}
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
              <h2 className="text-base font-bold font-display text-text-primary">
                Fault — Item {step.item}
              </h2>
              <button onClick={onCancel} aria-label="Close" className="min-w-[44px] min-h-[44px] flex items-center justify-center text-text-secondary">
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
                <h2 className="text-base font-bold font-display text-text-primary">
                  Fault Details — Item {step.item}
                </h2>
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                  readiness === 'PMC' ? 'bg-accent-green/20 text-accent-green' : 'bg-accent-red/20 text-accent-red'
                }`}>
                  {readiness}
                </span>
              </div>
              <button onClick={onCancel} aria-label="Close" className="min-w-[44px] min-h-[44px] flex items-center justify-center text-text-secondary">
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

              {/* Readiness: defaults from the TM criterion, soldier can override */}
              <fieldset className="flex flex-col gap-2">
                <legend className="text-sm font-medium text-text-secondary mb-2">Vehicle status with this fault</legend>
                <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Readiness">
                  <button
                    type="button"
                    role="radio"
                    aria-checked={readiness === 'PMC'}
                    onClick={() => handleReadiness('PMC')}
                    className={`min-h-[48px] rounded-[var(--radius-md)] border-2 text-sm font-semibold font-display ${
                      readiness === 'PMC' ? 'border-accent-green bg-accent-green/15 text-accent-green' : 'border-border text-text-secondary'
                    }`}
                  >
                    PMC <span className="block text-[11px] font-normal font-body">Can still do the mission</span>
                  </button>
                  <button
                    type="button"
                    role="radio"
                    aria-checked={readiness === 'NMC'}
                    onClick={() => handleReadiness('NMC')}
                    className={`min-h-[48px] rounded-[var(--radius-md)] border-2 text-sm font-semibold font-display ${
                      readiness === 'NMC' ? 'border-accent-red bg-accent-red/15 text-accent-red' : 'border-border text-text-secondary'
                    }`}
                  >
                    NMC <span className="block text-[11px] font-normal font-body">Not mission capable</span>
                  </button>
                </div>
                <p className="text-xs text-text-secondary" data-testid="nmc-criterion">
                  {nmcCriterion
                    ? <>TM: not mission capable if <span className="text-text-primary">{nmcCriterion}</span></>
                    : step.isNoGo
                      ? 'TM lists this as a not-mission-capable item.'
                      : 'TM gives no not-mission-capable criterion for this item.'}
                </p>
              </fieldset>

              <div className="flex flex-col gap-2">
                <span className="text-sm font-medium text-text-secondary">What's the status?</span>
                <div className="flex flex-col gap-2">
                  <button
                    type="button"
                    onClick={() => setResolution('corrected')}
                    aria-pressed={resolution === 'corrected'}
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
                    aria-pressed={resolution === 'needs_maintenance'}
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
                  <label htmlFor="partNeeded" className="flex items-center gap-3 min-h-[48px] cursor-pointer">
                    <input
                      type="checkbox"
                      id="partNeeded"
                      checked={partNeeded}
                      onChange={(e) => setPartNeeded(e.target.checked)}
                      className="w-7 h-7 rounded border-border bg-bg-tertiary accent-accent-amber flex-shrink-0"
                    />
                    <span className="text-base text-text-primary">Part needed</span>
                  </label>
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
                onCapture={(dataUrl) => setPhotos((prev) => [...prev, dataUrl])}
                onRemove={(i) => setPhotos((prev) => prev.filter((_, idx) => idx !== i))}
              />
            </div>

            <div className="p-4 border-t border-border flex-shrink-0 pb-[calc(16px+env(safe-area-inset-bottom))]">
              {saveError && <p className="text-sm text-accent-red mb-2" role="alert">{saveError}</p>}
              <Button size="lg" fullWidth onClick={handleDone} disabled={!description.trim() || saving}>
                {saving ? 'Saving…' : 'Done'}
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
