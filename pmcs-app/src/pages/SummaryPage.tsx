import { useMemo, useState } from 'react';
import { useNavigate, useParams, Navigate } from 'react-router-dom';
import { useSessionLoader } from '../hooks/useSessionLoader';
import { SessionGate } from '../components/ui/NotFound';
import { readinessOf, READINESS_BADGE } from '../stores/historyStore';
import { motion } from 'framer-motion';
import { Check, OctagonAlert } from 'lucide-react';
import { useSessionStore } from '../stores/sessionStore';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { TextArea } from '../components/ui/TextArea';
import { Input } from '../components/ui/Input';

export default function SummaryPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const loadStatus = useSessionLoader(id);
  const { stepResults, faults, currentSession, steps, jumpToStep, updateSession } = useSessionStore();
  // Draft fields live on the session in Dexie, so a reload keeps them.
  const [draft, setDraft] = useState<{ id: string; remarks: string; supervisorName: string; supervisorDodId: string } | null>(null);
  const fields = draft?.id === currentSession?.id && draft ? draft : {
    id: currentSession?.id ?? '',
    remarks: currentSession?.remarks ?? '',
    supervisorName: currentSession?.supervisorName ?? '',
    supervisorDodId: currentSession?.supervisorDodId ?? '',
  };
  const setField = (k: 'remarks' | 'supervisorName' | 'supervisorDodId', v: string) => setDraft({ ...fields, [k]: v });
  const { remarks, supervisorName, supervisorDodId } = fields;
  const [continuing, setContinuing] = useState(false);

  const stats = useMemo(() => {
    const total = stepResults.length;
    const checked = stepResults.filter((r) => r.status !== 'NOT_CHECKED').length;
    const go = stepResults.filter((r) => r.status === 'GO').length;
    const fault = stepResults.filter((r) => r.status === 'FAULT').length;
    return { total, checked, go, fault, readiness: readinessOf(faults) };
  }, [stepResults, faults]);

  const faultsByZone = useMemo(() => {
    const grouped = new Map<string, typeof faults>();
    faults.forEach((f) => {
      if (!grouped.has(f.zone)) grouped.set(f.zone, []);
      grouped.get(f.zone)!.push(f);
    });
    return Array.from(grouped.entries());
  }, [faults]);

  const handleFaultTap = (stepId: string) => {
    const idx = steps.findIndex((s) => s.id === stepId);
    if (idx >= 0) {
      jumpToStep(idx);
      navigate(`/session/${id}/pmcs`);
    }
  };

  const handleContinue = async () => {
    if (continuing) return;
    setContinuing(true);
    await updateSession({
      remarks: remarks.trim() || undefined,
      supervisorName: supervisorName.trim() || undefined,
      supervisorDodId: supervisorDodId.trim() || undefined,
    });
    navigate(`/session/${id}/5988`);
  };

  if (loadStatus !== 'ready') return <SessionGate status={loadStatus} />;
  if (!currentSession) return <SessionGate status="notfound" />;
  if (currentSession.status === 'COMPLETED') return <Navigate to={`/session/${id}/5988`} replace />;

  return (
    <div className="flex flex-col h-full">
      {/* Stats bar */}
      <div className="px-4 pt-6 pb-4 border-b border-border flex-shrink-0">
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-2xl font-bold font-display text-text-primary">Summary</h1>
          <Badge variant={READINESS_BADGE[stats.readiness]}>
            {stats.readiness}
          </Badge>
        </div>
        <p className="text-sm text-text-secondary mb-3">{stats.checked}/{stats.total} items checked</p>
        <div className="flex gap-3">
          <div className="flex items-center gap-1.5">
            <Check size={16} className="text-accent-green" />
            <span className="text-sm font-display text-text-primary">{stats.go} GO</span>
          </div>
          <div className="flex items-center gap-1.5">
            <OctagonAlert size={16} className="text-accent-red" />
            <span className="text-sm font-display text-text-primary">{stats.fault} FAULT</span>
          </div>
        </div>
      </div>

      {/* Fault list */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        {faults.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Check size={48} className="text-accent-green mb-3" />
            <p className="text-lg font-semibold text-text-primary">No faults found</p>
            <p className="text-sm text-text-secondary mt-1">All items serviceable</p>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {faultsByZone.map(([zone, zoneFaults]) => (
              <div key={zone}>
                <h3 className="text-sm font-semibold text-text-secondary mb-2 font-display">{zone}</h3>
                <div className="flex flex-col gap-2">
                  {zoneFaults.map((fault, i) => (
                    <motion.button
                      key={fault.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.05 }}
                      onClick={() => handleFaultTap(fault.stepId)}
                      className="bg-bg-secondary border border-border rounded-[var(--radius-md)] p-3 text-left active:border-accent-blue"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1">
                          <p className="text-sm font-semibold text-text-primary">
                            Item {fault.item}: {fault.itemDescription}
                          </p>
                          <p className="text-sm text-text-secondary mt-1">{fault.description}</p>
                          {fault.correctedOnSite && (
                            <p className="text-xs text-accent-green mt-1">Corrected on site</p>
                          )}
                        </div>
                        <Badge variant={fault.readiness === 'NMC' ? 'red' : 'green'}>
                          {fault.readiness}
                        </Badge>
                      </div>
                    </motion.button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="mt-6 flex flex-col gap-4">
          <TextArea
            label="Additional Remarks"
            value={remarks}
            onChange={(e) => setField('remarks', e.target.value)}
            onBlur={() => updateSession({ remarks: remarks.trim() || undefined })}
            placeholder="Overall vehicle comments..."
          />

          <div className="border-t border-border pt-4">
            <h3 className="text-sm font-semibold text-text-secondary font-display mb-3">Supervisor Acknowledgment</h3>
            <div className="flex flex-col gap-3">
              <Input
                label="Supervisor Name"
                value={supervisorName}
                onChange={(e) => setField('supervisorName', e.target.value)}
                placeholder="e.g., SSG Smith"
              />
              <Input
                label="Supervisor DOD ID"
                value={supervisorDodId}
                onChange={(e) => setField('supervisorDodId', e.target.value.replace(/\D/g, '').slice(0, 10))}
                inputMode="numeric"
                placeholder="10-digit DOD ID"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Bottom action */}
      <div className="px-4 pb-[calc(16px+env(safe-area-inset-bottom))] border-t border-border pt-3 flex-shrink-0">
        <Button
          size="lg"
          fullWidth
          onClick={handleContinue}
          disabled={continuing}
        >
          Review & Generate DA 2404
        </Button>
      </div>
    </div>
  );
}
