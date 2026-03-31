import { useState, useCallback, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useSessionStore } from '../stores/sessionStore';
import { StepHeader } from '../components/pmcs/StepHeader';
import { StepCard } from '../components/pmcs/StepCard';
import { StatusButtons } from '../components/pmcs/StatusButtons';
import { StepNav } from '../components/pmcs/StepNav';
import { FaultDetailPanel } from '../components/pmcs/FaultDetailPanel';
import { Modal } from '../components/ui/Modal';
import { Button } from '../components/ui/Button';
import type { StepStatus } from '../types';

export default function PmcsWalkthroughPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const {
    currentSession, steps, stepResults, currentStepIndex,
    updateStepStatus, nextStep, prevStep, jumpToStep, faults,
  } = useSessionStore();

  const [direction, setDirection] = useState(0);
  const [showExitModal, setShowExitModal] = useState(false);
  const [showZoneMenu, setShowZoneMenu] = useState(false);
  const [showSkipModal, setShowSkipModal] = useState(false);
  const [showFaultPanel, setShowFaultPanel] = useState(false);

  const currentStep = steps[currentStepIndex];
  const currentResult = stepResults[currentStepIndex];

  // Zone info
  const zones = useMemo(() => {
    const zoneMap = new Map<string, { name: string; startIndex: number; count: number }>();
    steps.forEach((s, i) => {
      if (!zoneMap.has(s.zoneId)) {
        zoneMap.set(s.zoneId, { name: s.zone, startIndex: i, count: 0 });
      }
      zoneMap.get(s.zoneId)!.count++;
    });
    return Array.from(zoneMap.entries());
  }, [steps]);

  const currentZone = useMemo(() => {
    if (!currentStep) return null;
    const zone = zones.find(([id]) => id === currentStep.zoneId);
    if (!zone) return null;
    const [, info] = zone;
    const stepInZone = currentStepIndex - info.startIndex + 1;
    const checkedInZone = stepResults
      .slice(info.startIndex, info.startIndex + info.count)
      .filter((r) => r.status !== 'NOT_CHECKED').length;
    return { ...info, stepInZone, progress: checkedInZone / info.count };
  }, [currentStep, currentStepIndex, zones, stepResults]);

  const handleStatusChange = useCallback((status: StepStatus) => {
    if (!currentStep) return;
    if (status === 'FAULT') {
      setShowFaultPanel(true);
    } else {
      // If changing to GO, remove any existing fault for this step
      const existingFault = faults.find((f) => f.stepId === currentStep.id);
      if (existingFault) {
        useSessionStore.getState().removeFault(existingFault.id);
      }
      updateStepStatus(currentStep.id, status);
      // Auto-advance on GO
      const isLast = currentStepIndex === steps.length - 1;
      if (isLast) {
        navigate(`/session/${id}/summary`);
      } else {
        setDirection(1);
        nextStep();
      }
    }
  }, [currentStep, faults, updateStepStatus, currentStepIndex, steps.length, nextStep, navigate, id]);

  const handleNext = useCallback(() => {
    setDirection(1);
    nextStep();
  }, [nextStep]);

  const handlePrev = useCallback(() => {
    setDirection(-1);
    prevStep();
  }, [prevStep]);

  const handleFinish = useCallback(() => {
    const skipped = stepResults.filter((r) => r.status === 'NOT_CHECKED');
    if (skipped.length > 0) {
      setShowSkipModal(true);
    } else {
      navigate(`/session/${id}/summary`);
    }
  }, [stepResults, navigate, id]);

  const handleBack = useCallback(() => {
    setShowExitModal(true);
  }, []);

  if (!currentSession || !currentStep || !currentResult) {
    return (
      <div className="flex items-center justify-center h-full text-text-secondary">
        No active session. <button onClick={() => navigate('/')} className="ml-2 text-accent-blue underline">Go home</button>
      </div>
    );
  }

  const variants = {
    enter: (d: number) => ({ x: d > 0 ? '100%' : '-100%', opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit: (d: number) => ({ x: d > 0 ? '-100%' : '100%', opacity: 0 }),
  };

  return (
    <div className="flex flex-col h-[100dvh]" style={{ touchAction: 'pan-y' }}>
      <StepHeader
        zoneName={currentZone?.name || currentStep.zone}
        stepInZone={currentZone?.stepInZone || 1}
        totalInZone={currentZone?.count || 1}
        zoneProgress={currentZone?.progress || 0}
        onBack={handleBack}
        onZoneTap={() => setShowZoneMenu(true)}
      />

      <div className="flex-1 overflow-hidden relative">
        <AnimatePresence custom={direction} mode="wait">
          <motion.div
            key={currentStepIndex}
            custom={direction}
            variants={variants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.3, ease: 'easeInOut' }}
            className="absolute inset-0 flex flex-col pt-3 pb-3"
          >
            <StepCard step={currentStep} stepResult={currentResult} vehicleType={currentSession?.vehicleType} />
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="px-0 pb-2">
        <StatusButtons currentStatus={currentResult.status} onStatusChange={handleStatusChange} />
      </div>

      <StepNav
        currentStep={currentStepIndex}
        totalSteps={steps.length}
        onPrev={handlePrev}
        onNext={handleNext}
        onFinish={handleFinish}
      />

      {/* Fault detail panel */}
      {showFaultPanel && currentSession && (
        <FaultDetailPanel
          step={currentStep}
          sessionId={currentSession.id}
          vehicleId={currentSession.vehicleId}
          vehicleType={currentSession.vehicleType}
          existingFault={faults.find((f) => f.stepId === currentStep.id)}
          onDone={() => {
            setShowFaultPanel(false);
            // Auto-advance after recording fault
            const isLast = currentStepIndex === steps.length - 1;
            if (isLast) {
              navigate(`/session/${id}/summary`);
            } else {
              setDirection(1);
              nextStep();
            }
          }}
          onCancel={() => {
            setShowFaultPanel(false);
          }}
        />
      )}

      {/* Exit confirmation */}
      <Modal open={showExitModal} onClose={() => setShowExitModal(false)} title="Exit Inspection?">
        <p className="text-text-secondary text-sm mb-4">Your progress is saved. You can resume later from History.</p>
        <div className="flex gap-3">
          <Button variant="secondary" fullWidth onClick={() => setShowExitModal(false)}>Cancel</Button>
          <Button variant="danger" fullWidth onClick={() => { navigate('/'); }}>Exit</Button>
        </div>
      </Modal>

      {/* Skip review */}
      <Modal open={showSkipModal} onClose={() => setShowSkipModal(false)} title="Skipped Items">
        <p className="text-text-secondary text-sm mb-4">
          {stepResults.filter((r) => r.status === 'NOT_CHECKED').length} items were not checked. Review them or continue?
        </p>
        <div className="flex gap-3">
          <Button variant="secondary" fullWidth onClick={() => {
            const firstSkipped = stepResults.findIndex((r) => r.status === 'NOT_CHECKED');
            if (firstSkipped >= 0) jumpToStep(firstSkipped);
            setShowSkipModal(false);
          }}>Review Skipped</Button>
          <Button fullWidth onClick={() => { setShowSkipModal(false); navigate(`/session/${id}/summary`); }}>Continue</Button>
        </div>
      </Modal>

      {/* Zone jump menu */}
      <AnimatePresence>
        {showZoneMenu && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-bg-primary/95 flex flex-col"
          >
            <div className="flex items-center justify-between h-11 px-4 border-b border-border">
              <h2 className="text-lg font-bold font-display text-text-primary">Zones</h2>
              <button onClick={() => setShowZoneMenu(false)} className="text-accent-blue min-h-[44px] flex items-center">Close</button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-2">
              {zones.map(([zoneId, info]) => {
                const zoneResults = stepResults.slice(info.startIndex, info.startIndex + info.count);
                const checked = zoneResults.filter((r) => r.status !== 'NOT_CHECKED').length;
                const faultCount = faults.filter((f) => steps.slice(info.startIndex, info.startIndex + info.count).some((s) => s.id === f.stepId)).length;
                const allDone = checked === info.count;

                return (
                  <button
                    key={zoneId}
                    onClick={() => { jumpToStep(info.startIndex); setShowZoneMenu(false); }}
                    className="flex items-center justify-between bg-bg-secondary border border-border rounded-[var(--radius-md)] p-4 min-h-[56px] text-left"
                  >
                    <div>
                      <p className="text-base font-semibold text-text-primary">{info.name}</p>
                      <p className="text-xs text-text-secondary">{checked}/{info.count} checked</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {faultCount > 0 && (
                        <span className="bg-accent-red/20 text-accent-red text-xs font-bold px-2 py-0.5 rounded">{faultCount}</span>
                      )}
                      <span className={`text-lg ${allDone ? 'text-accent-green' : checked > 0 ? 'text-accent-amber' : 'text-text-secondary/30'}`}>
                        {allDone ? '●' : checked > 0 ? '◐' : '○'}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

