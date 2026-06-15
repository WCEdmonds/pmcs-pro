import { useState, useEffect } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { Check, ExternalLink } from 'lucide-react';
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

  const handleViewDA2404 = async () => {
    if (!session) return;
    setIsGenerating(true);
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
      window.open(url, '_blank');
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (err) {
      console.error('DA 2404 generation failed:', err);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSaveAndOpenDA2404 = async () => {
    if (!session) return;
    setIsGenerating(true);

    // 1. Save locally
    await completeSession(remarks);
    setSaved(true);

    // 2. Sync to Supabase — capture the Supabase inspection ID for PDF storage
    let supabaseInspectionId: string | null = null;
    setSyncStatus('syncing');
    try {
      supabaseInspectionId = await syncInspectionToSupabase(session, sessionFaults);
      setSyncStatus('synced');
    } catch (err) {
      console.warn('Sync failed, queuing for retry:', err);
      await enqueueSync(session, sessionFaults);
      setSyncStatus('failed');
    }

    // 3. Try server-side generation (includes prior faults, stores to generated_forms)
    if (supabaseInspectionId) {
      const { data: { session: authSession } } = await supabase.auth.getSession();
      if (authSession) {
        const { data, error } = await supabase.functions.invoke('generate-da2404', {
          body: { inspection_id: supabaseInspectionId },
        });
        if (!error && data?.url) {
          window.open(data.url, '_blank');
          setIsGenerating(false);
          setTimeout(() => { clearSession(); navigate('/history'); }, 2000);
          return;
        }
        console.warn('Server-side generation failed, falling back to client:', error || data?.error);
      }
    }

    // 4. Client-side generation fallback
    try {
      const pdfBytes = await generateDA2404({
        session,
        stepResults: sessionStepResults,
        faults: sessionFaults,
        supervisorName,
        supervisorDodId,
      });
      const blob = new Blob([pdfBytes as BlobPart], { type: 'application/pdf' });

      // If synced, upload PDF to storage so the dashboard can find it
      if (supabaseInspectionId) {
        const storagePath = `da2404/${supabaseInspectionId}.pdf`;
        const { error: uploadError } = await supabase.storage
          .from('generated')
          .upload(storagePath, blob, { contentType: 'application/pdf' });
        if (!uploadError) {
          await supabase.from('generated_forms').insert({
            inspection_id: supabaseInspectionId,
            pdf_storage_path: storagePath,
          } as never);
          const { data: signedData } = await supabase.storage
            .from('generated')
            .createSignedUrl(storagePath, 3600);
          if (signedData?.signedUrl) {
            window.open(signedData.signedUrl, '_blank');
            setIsGenerating(false);
            setTimeout(() => { clearSession(); navigate('/history'); }, 2000);
            return;
          }
        } else {
          console.warn('Storage upload failed:', uploadError.message);
        }
      }

      // Last resort: open as local blob URL
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (clientErr) {
      console.error('Client-side DA 2404 generation failed:', clientErr);
    }

    setIsGenerating(false);
    setTimeout(() => { clearSession(); navigate('/history'); }, 2000);
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
        {isReadOnly ? (
          <>
            <Button
              variant="secondary"
              size="lg"
              fullWidth
              onClick={handleViewDA2404}
              disabled={isGenerating}
            >
              <span className="flex items-center justify-center gap-2">
                <ExternalLink size={18} />
                {isGenerating ? 'Generating...' : 'View DA 2404'}
              </span>
            </Button>
            <Button variant="ghost" size="default" fullWidth onClick={() => navigate('/history')}>
              Back to History
            </Button>
          </>
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
          <Button size="lg" fullWidth onClick={handleSaveAndOpenDA2404} disabled={isGenerating}>
            <span className="flex items-center justify-center gap-2">
              <ExternalLink size={18} />
              {isGenerating ? 'Saving...' : 'Save & Open DA 2404'}
            </span>
          </Button>
        )}
      </div>
    </div>
  );
}
