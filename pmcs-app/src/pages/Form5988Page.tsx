import { useState, useEffect } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { Check, Download } from 'lucide-react';
import { useSessionStore } from '../stores/sessionStore';
import { useHistoryStore } from '../stores/historyStore';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { VEHICLE_REGISTRY } from '../data/vehicles';
import { generateDA2404 } from '../utils/generateDA2404';
import { syncInspectionToSupabase } from '../utils/sync';
import { enqueueSync } from '../utils/syncQueue';
import { supabase } from '../utils/supabase';
import type { InspectionSession, Fault, StepResult } from '../types';

export default function Form5988Page() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const locationState = location.state as { remarks?: string; supervisorName?: string; supervisorDodId?: string } | null;
  const remarks = locationState?.remarks;
  const supervisorName = locationState?.supervisorName;
  const supervisorDodId = locationState?.supervisorDodId;

  const { currentSession, stepResults, faults, completeSession, clearSession } = useSessionStore();
  const { getSession, getSessionFaults, getSessionStepResults } = useHistoryStore();

  // Support read-only mode from history
  const [session, setSession] = useState<InspectionSession | null>(currentSession);
  const [sessionFaults, setSessionFaults] = useState<Fault[]>(faults);
  const [sessionStepResults, setSessionStepResults] = useState<StepResult[]>(stepResults);
  const [isReadOnly, setIsReadOnly] = useState(false);
  const [saved, setSaved] = useState(false);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'synced' | 'failed'>('idle');
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    if (!currentSession && id) {
      // Loading from history
      setIsReadOnly(true);
      Promise.all([getSession(id), getSessionFaults(id), getSessionStepResults(id)]).then(
        ([s, f, sr]) => {
          if (s) setSession(s);
          if (f) setSessionFaults(f);
          if (sr) setSessionStepResults(sr);
        }
      );
    }
  }, [currentSession, id, getSession, getSessionFaults, getSessionStepResults]);

  if (!session) {
    return (
      <div className="flex items-center justify-center h-full text-text-secondary">
        Session not found.
      </div>
    );
  }

  const vehicle = VEHICLE_REGISTRY.find((v) => v.type === session.vehicleType);
  const goCount = sessionStepResults.filter((r) => r.status === 'GO').length;
  const faultCount = sessionStepResults.filter((r) => r.status === 'FAULT').length;
  const hasUncorrectedNMC = sessionFaults.some((f) => f.readiness === 'NMC' && !f.correctedOnSite);
  const missionCapable = !hasUncorrectedNMC;

  const handleSave = async () => {
    await completeSession(remarks);
    setSaved(true);

    // Sync to Supabase — wait for result before navigating
    if (session) {
      setSyncStatus('syncing');
      try {
        await syncInspectionToSupabase(session, sessionFaults);
        setSyncStatus('synced');
      } catch (err) {
        console.warn('Failed to sync to Supabase, queuing for retry:', err);
        await enqueueSync(session, sessionFaults);
        setSyncStatus('failed');
      }
    }

    setTimeout(() => {
      clearSession();
      navigate('/history');
    }, 2000);
  };

  const handleDownloadDA2404 = async () => {
    if (!session) return;
    setIsGenerating(true);
    try {
      // Try server-side generation first (includes prior faults)
      {
        const { data: { session: authSession } } = await supabase.auth.getSession();
        if (authSession) {
          const { data, error } = await supabase.functions.invoke('generate-da2404', {
            body: { inspection_id: session.id },
          });
          if (!error && data?.url) {
            window.open(data.url, '_blank');
            setIsGenerating(false);
            return;
          }
          console.warn('Server generation failed, falling back to client:', error || data?.error);
        }
      }

      // Fallback: client-side generation (no prior faults)
      try {
        const pdfBytes = await generateDA2404({
          session,
          stepResults: sessionStepResults,
          faults: sessionFaults,
          supervisorName,
          supervisorDodId,
        });
        const blob = new Blob([pdfBytes as BlobPart], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `DA2404_${session.bumperNumber}_${session.date}.pdf`;
        a.click();
        URL.revokeObjectURL(url);
      } catch (clientErr) {
        console.error('Client-side DA 2404 generation failed:', clientErr);
        alert('DA 2404 generation requires saving the inspection first. Tap "Save Inspection" then try downloading again.');
      }
    } catch (err) {
      console.error('Failed to generate DA 2404:', err);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 pt-6 pb-4 flex-shrink-0">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold font-display text-text-primary">Inspection Review</h1>
          <Badge variant={missionCapable ? 'green' : 'red'}>
            {missionCapable ? 'FMC' : 'NMC'}
          </Badge>
        </div>
        <Badge variant="amber" className="mt-2">
          Save to generate DA 2404 with prior faults
        </Badge>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-4 flex flex-col gap-3">
        {/* Vehicle Info */}
        <Card>
          <h3 className="text-xs font-semibold text-text-secondary mb-2 font-display">VEHICLE</h3>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div>
              <span className="text-text-secondary">Type:</span>
              <p className="text-text-primary font-medium">{vehicle?.name || session.vehicleType}</p>
            </div>
            <div>
              <span className="text-text-secondary">Bumper:</span>
              <p className="text-text-primary font-display font-bold">{session.bumperNumber}</p>
            </div>
            {session.serialNumber && (
              <div>
                <span className="text-text-secondary">Serial:</span>
                <p className="text-text-primary">{session.serialNumber}</p>
              </div>
            )}
            <div>
              <span className="text-text-secondary">Odometer:</span>
              <p className="text-text-primary font-display">{session.odometer.toLocaleString()} mi</p>
            </div>
          </div>
        </Card>

        {/* Inspection Info */}
        <Card>
          <h3 className="text-xs font-semibold text-text-secondary mb-2 font-display">INSPECTION</h3>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div>
              <span className="text-text-secondary">Date:</span>
              <p className="text-text-primary">{session.date}</p>
            </div>
            <div>
              <span className="text-text-secondary">Type:</span>
              <p className="text-text-primary">{session.inspectionType}</p>
            </div>
            <div>
              <span className="text-text-secondary">Inspector:</span>
              <p className="text-text-primary">{session.inspectorRank} {session.inspectorName}</p>
            </div>
            <div>
              <span className="text-text-secondary">UIC:</span>
              <p className="text-text-primary">{session.unit}</p>
            </div>
          </div>
        </Card>

        {/* Results */}
        <Card>
          <h3 className="text-xs font-semibold text-text-secondary mb-2 font-display">RESULTS</h3>
          <div className="flex gap-4 text-sm mb-3">
            <span className="text-accent-green font-display">GO: {goCount}</span>
            <span className="text-accent-red font-display">FAULTS: {faultCount}</span>
          </div>
        </Card>

        {/* Fault Table */}
        <Card>
          <h3 className="text-xs font-semibold text-text-secondary mb-2 font-display">FAULT TABLE</h3>
          {sessionFaults.length === 0 ? (
            <div className="flex items-center gap-2 py-2">
              <Check size={16} className="text-accent-green" />
              <span className="text-sm text-text-primary">PMCS COMPLETED — NO NEW FAULTS FOUND</span>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {/* Header */}
              <div className="grid grid-cols-[40px_24px_1fr_1fr] gap-2 text-xs text-text-secondary font-display pb-1 border-b border-border">
                <span>ITEM</span>
                <span>ST</span>
                <span>DEFICIENCY</span>
                <span>ACTION</span>
              </div>
              {sessionFaults.map((fault) => (
                <div key={fault.id} className="grid grid-cols-[40px_24px_1fr_1fr] gap-2 text-sm py-1.5 border-b border-border/50">
                  <span className="text-text-primary font-display">{fault.item}</span>
                  <span className={fault.readiness === 'NMC' ? 'text-accent-red font-bold' : 'text-accent-amber'}>
                    {fault.readiness === 'NMC' ? 'X' : '/'}
                  </span>
                  <span className="text-text-primary text-xs">{fault.description}</span>
                  <span className="text-text-secondary text-xs">
                    {fault.correctedOnSite ? fault.correctiveAction || 'Corrected' : fault.partNeeded ? `Parts — NSN ${fault.nsn || 'TBD'}` : '—'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Card>

        {session.remarks && (
          <Card>
            <h3 className="text-xs font-semibold text-text-secondary mb-2 font-display">REMARKS</h3>
            <p className="text-sm text-text-primary">{session.remarks}</p>
          </Card>
        )}
        {remarks && !session.remarks && (
          <Card>
            <h3 className="text-xs font-semibold text-text-secondary mb-2 font-display">REMARKS</h3>
            <p className="text-sm text-text-primary">{remarks}</p>
          </Card>
        )}
      </div>

      {/* Bottom actions */}
      <div className="px-4 pb-[calc(16px+env(safe-area-inset-bottom))] border-t border-border pt-3 flex-shrink-0 flex flex-col gap-2">
        <Button
          variant="secondary"
          size="lg"
          fullWidth
          onClick={handleDownloadDA2404}
          disabled={isGenerating}
        >
          <span className="flex items-center justify-center gap-2">
            <Download size={18} />
            {isGenerating ? 'Generating...' : 'Download DA 2404'}
          </span>
        </Button>
        {isReadOnly ? (
          <Button variant="ghost" size="default" fullWidth onClick={() => navigate('/history')}>
            Back to History
          </Button>
        ) : saved ? (
          <div className="flex flex-col items-center justify-center gap-1 min-h-[56px]">
            <div className="flex items-center gap-2 text-accent-green font-semibold">
              <Check size={20} />
              Saved!
            </div>
            <span className={`text-xs ${
              syncStatus === 'syncing' ? 'text-text-secondary' :
              syncStatus === 'synced' ? 'text-accent-green' :
              syncStatus === 'failed' ? 'text-accent-red' : 'text-text-secondary'
            }`}>
              {syncStatus === 'syncing' && 'Syncing to server...'}
              {syncStatus === 'synced' && 'Synced to dashboard ✓'}
              {syncStatus === 'failed' && 'Sync failed — will retry next time'}
            </span>
          </div>
        ) : (
          <Button size="lg" fullWidth onClick={handleSave}>
            Save Inspection
          </Button>
        )}
      </div>
    </div>
  );
}
