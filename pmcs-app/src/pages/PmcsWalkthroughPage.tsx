import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { useNavigate, useParams, Navigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useSessionStore } from '../stores/sessionStore';
import { useSessionLoader } from '../hooks/useSessionLoader';
import { StepHeader } from '../components/pmcs/StepHeader';
import { StepCard } from '../components/pmcs/StepCard';
import { StatusButtons } from '../components/pmcs/StatusButtons';
import { StepNav } from '../components/pmcs/StepNav';
import { FaultDetailPanel } from '../components/pmcs/FaultDetailPanel';
import { Modal } from '../components/ui/Modal';
import { Button } from '../components/ui/Button';
import { SessionGate } from '../components/ui/NotFound';
import type { StepStatus, StepResult } from '../types';

const TAP_LOCK_MS = 450;

export default function PmcsWalkthroughPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const loadStatus = useSessionLoader(id);
  const {
    currentSession, steps, stepResults, currentStepIndex,
    updateStepStatus, nextStep, prevStep, jumpToStep, faults, clearSession,
  } = useSessionStore();

  const [direction, setDirection] = useState(0);
  const [showExitModal, setShowExitModal] = useState(false);
  const [showZoneMenu, setShowZoneMenu] = useState(false);
  const [showSkipModal, setShowSkipModal] = useState(false);
  const [showFaultPanel, setShowFaultPanel] = useState(false);

  // Double-tap guard: GO/FAULT taps are ignored until the next item is on screen.
  const tapLockRef = useRef(false);
  useEffect(() => {
    if (!tapLockRef.current) return;
    const t = setTimeout(() => { tapLockRef.current = false; }, TAP_LOCK_MS);
    return () => clearTimeout(t);
  }, [currentStepIndex]);
  const lockTaps = () => {
    tapLockRef.current = true;
    // Safety release in case the index doesn't change (e.g. last step)
    setTimeout(() => { tapLockRef.current = false; }, TAP_LOCK_MS * 2);
  };

  const resultsByStep = useMemo(() => {
    const m = new Map<string, StepResult>();
    for (const r of stepResults) m.set(r.stepId, r);
    return m;
  }, [stepResults]);

  const currentStep = steps[currentStepIndex];
  const currentResult = currentStep ? resultsByStep.get(currentStep.id) : undefined;

  // Zone info (computed by zoneId, not by contiguous ranges)
  const zones = useMemo(() => {
    const zoneMap = new Map<string, { name: string; startIndex: number; stepIds: string[] }>();
    steps.forEach((s, i) => {
      if (!zoneMap.has(s.zoneId)) zoneMap.set(s.zoneId, { name: s.zone, startIndex: i, stepIds: [] });
      zoneMap.get(s.zoneId)!.stepIds.push(s.id);
    });
    return Array.from(zoneMap.entries());
  }, [steps]);

  const currentZone = useMemo(() => {
    if (!currentStep) return null;
    const zone = zones.find(([zid]) => zid === currentStep.zoneId);
    if (!zone) return null;
    const [, info] = zone;
    const stepInZone = info.stepIds.indexOf(currentStep.id) + 1;
    const checkedInZone = info.stepIds.filter((sid) => {
      const r = resultsByStep.get(sid);
      return r && r.status !== 'NOT_CHECKED';
    }).length;
    return { name: info.name, count: info.stepIds.length, stepInZone, progress: checkedInZone / info.stepIds.length };
  }, [currentStep, zones, resultsByStep]);

  const advanceOrFinish = useCallback(() => {
    const isLast = currentStepIndex >= steps.length - 1;
    if (isLast) {
      navigate(`/session/${id}/summary`);
    } else {
      setDirection(1);
      nextStep();
    }
  }, [currentStepIndex, steps.length, nextStep, navigate, id]);

  const handleStatusChange = useCallback((status: StepStatus) => {
    if (!currentStep || tapLockRef.current || showFaultPanel) return;
    if (status === 'FAULT') {
      lockTaps();
      setShowFaultPanel(true);
      return;
    }
    lockTaps();
    const existingFault = faults.find((f) => f.stepId === currentStep.id);
    if (existingFault) {
      useSessionStore.getState().removeFault(existingFault.id);
    }
    updateStepStatus(currentStep.id, status);
    advanceOrFinish();
  }, [currentStep, faults, updateStepStatus, advanceOrFinish, showFaultPanel]);

  const handleNext = useCallback(() => {
    setDirection(1);
    nextStep();
  }, [nextStep]);

  const handlePrev = useCallback(() => {
    setDirection(-1);
    prevStep();
  }, [prevStep]);

  const uncheckedCount = stepResults.filter((r) => r.status === 'NOT_CHECKED').length;

  const handleFinish = useCallback(() => {
    if (uncheckedCount > 0) setShowSkipModal(true);
    else navigate(`/session/${id}/summary`);
  }, [uncheckedCount, navigate, id]);

  const handleExit = () => {
    setShowExitModal(false);
    clearSession();
    navigate('/');
  };

  if (loadStatus !== 'ready') return <SessionGate status={loadStatus} />;
  if (currentSession?.status === 'COMPLETED') return <Navigate to={`/session/${id}/5988`} replace />;
  if (!currentSession || !currentStep || !currentResult) return <SessionGate status="notfound" />;

  const variants = {
    enter: (d: number) => ({ x: d > 0 ? '100%' : '-100%', opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit: (d: number) => ({ x: d > 0 ? '-100%' : '100%', opacity: 0 }),
  };

  return (
    <main className="flex flex-col h-[100dvh]" style={{ touchAction: 'pan-y' }}>
      <h1 className="sr-only">
        PMCS {currentSession.bumperNumber}: item {currentStep.item}, step {currentStepIndex + 1} of {steps.length}
      </h1>
      <StepHeader
        zoneName={currentZone?.name || currentStep.zone}
        stepInZone={currentZone?.stepInZone || 1}
        totalInZone={currentZone?.count || 1}
        zoneProgress={currentZone?.progress || 0}
        onBack={() => setShowExitModal(true)}
        onZoneTap={() => setShowZoneMenu(true)}
      />

      <div className="flex-1 overflow-hidden relative">
        <AnimatePresence custom={direction} mode="wait">
          <motion.div
            key={currentStep.id}
            custom={direction}
            variants={variants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.3, ease: 'easeInOut' }}
            className="absolute inset-0 flex flex-col pt-3 pb-3"
          >
            <StepCard
              step={currentStep}
              stepResult={currentResult}
              vehicleType={currentSession.vehicleType}
              inspectionType={currentSession.inspectionType}
            />
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

      {showFaultPanel && (
        <FaultDetailPanel
          key={currentStep.id}
          step={currentStep}
          sessionId={currentSession.id}
          vehicleId={currentSession.vehicleId}
          vehicleType={currentSession.vehicleType}
          existingFault={faults.find((f) => f.stepId === currentStep.id)}
          onDone={() => {
            setShowFaultPanel(false);
            lockTaps();
            advanceOrFinish();
          }}
          onCancel={() => setShowFaultPanel(false)}
        />
      )}

      <Modal open={showExitModal} onClose={() => setShowExitModal(false)} title="Exit Inspection?">
        <p className="text-text-secondary text-sm mb-4">Your progress is saved. You can resume later from Home or History.</p>
        <div className="flex gap-3">
          <Button variant="secondary" fullWidth onClick={() => setShowExitModal(false)}>Cancel</Button>
          <Button variant="danger" fullWidth onClick={handleExit}>Exit</Button>
        </div>
      </Modal>

      <Modal open={showSkipModal} onClose={() => setShowSkipModal(false)} title="Skipped Items">
        <p className="text-text-secondary text-sm mb-4">
          {uncheckedCount} items were not checked. Review them or continue?
        </p>
        <div className="flex gap-3">
          <Button variant="secondary" fullWidth onClick={() => {
            const firstSkipped = steps.findIndex((s) => resultsByStep.get(s.id)?.status === 'NOT_CHECKED');
            if (firstSkipped >= 0) jumpToStep(firstSkipped);
            setShowSkipModal(false);
          }}>Review Skipped</Button>
          <Button fullWidth onClick={() => { setShowSkipModal(false); navigate(`/session/${id}/summary`); }}>Continue</Button>
        </div>
      </Modal>

      <AnimatePresence>
        {showZoneMenu && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-bg-primary/95 flex flex-col"
            role="dialog"
            aria-modal="true"
            aria-label="Zones"
          >
            <div className="flex items-center justify-between h-11 px-4 border-b border-border">
              <h2 className="text-lg font-bold font-display text-text-primary">Zones</h2>
              <button onClick={() => setShowZoneMenu(false)} className="text-accent-blue min-h-[44px] flex items-center">Close</button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-2">
              {zones.map(([zoneId, info]) => {
                const checked = info.stepIds.filter((sid) => {
                  const r = resultsByStep.get(sid);
                  return r && r.status !== 'NOT_CHECKED';
                }).length;
                const faultCount = faults.filter((f) => info.stepIds.includes(f.stepId)).length;
                const allDone = checked === info.stepIds.length;

                return (
                  <button
                    key={zoneId}
                    onClick={() => { jumpToStep(info.startIndex); setShowZoneMenu(false); }}
                    className="flex items-center justify-between bg-bg-secondary border border-border rounded-[var(--radius-md)] p-4 min-h-[56px] text-left"
                  >
                    <div>
                      <p className="text-base font-semibold text-text-primary">{info.name}</p>
                      <p className="text-xs text-text-secondary">{checked}/{info.stepIds.length} checked</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {faultCount > 0 && (
                        <span className="bg-accent-red/20 text-accent-red text-xs font-bold px-2 py-0.5 rounded">{faultCount}</span>
                      )}
                      <span aria-hidden="true" className={`text-lg ${allDone ? 'text-accent-green' : checked > 0 ? 'text-accent-amber' : 'text-text-secondary'}`}>
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
    </main>
  );
}
