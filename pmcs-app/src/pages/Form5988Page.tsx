import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Check, ExternalLink } from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useSessionStore } from '../stores/sessionStore';
import { isNotMissionCapable } from '../stores/historyStore';
import { useSessionLoader } from '../hooks/useSessionLoader';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { SessionGate } from '../components/ui/NotFound';
import { SyncBadge } from '../components/sync/SyncStatus';
import { VEHICLE_REGISTRY } from '../data/vehicles';
import { generateDA2404 } from '../utils/generateDA2404';
import { syncAll } from '../utils/syncEngine';
import { api } from '../utils/api';
import { db } from '../utils/db';
import { localTimeHHMM } from '../utils/format';
import { inspectionTypeLabel } from '../utils/inspectionTypes';
import type { InspectionSession } from '../types';

/**
 * Opens a tab synchronously inside the tap handler (iOS blocks window.open after
 * an await), then points it at the PDF once it's ready.
 */
function openPendingWindow(): Window | null {
  try {
    const w = window.open('', '_blank');
    if (w) {
      try {
        w.document.title = 'DA 2404';
        w.document.body.innerHTML = '<p style="font-family:sans-serif;padding:24px">Preparing DA 2404…</p>';
      } catch {
        // cross-origin / restricted — fine
      }
    }
    return w;
  } catch {
    return null;
  }
}

function pointWindow(w: Window | null, url: string): boolean {
  if (!w || w.closed) return false;
  try {
    w.location.href = url;
    return true;
  } catch {
    return false;
  }
}

async function clientPdf(session: InspectionSession): Promise<Blob> {
  const [faults, stepResults] = await Promise.all([
    db.faults.where('sessionId').equals(session.id).toArray(),
    db.stepResults.where('sessionId').equals(session.id).toArray(),
  ]);
  faults.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const bytes = await generateDA2404({
    session,
    stepResults,
    faults,
    supervisorName: session.supervisorName,
    supervisorDodId: session.supervisorDodId,
  });
  return new Blob([bytes as BlobPart], { type: 'application/pdf' });
}

export default function Form5988Page() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const loadStatus = useSessionLoader(id);
  const { currentSession: session, stepResults, faults, completeSession, clearSession } = useSessionStore();
  const syncState = useLiveQuery(() => (id ? db.syncState.get(id) : undefined), [id]);

  const [busy, setBusy] = useState(false);
  const [phase, setPhase] = useState<'idle' | 'saved'>('idle');
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [error, setError] = useState('');
  const busyRef = useRef(false);
  const blobUrlRef = useRef<string | null>(null);

  useEffect(() => () => {
    if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current);
  }, []);

  if (loadStatus !== 'ready') return <SessionGate status={loadStatus} />;
  if (!session) return <SessionGate status="notfound" />;

  const isCompleted = session.status === 'COMPLETED';
  const vehicle = VEHICLE_REGISTRY.find((v) => v.type === session.vehicleType);
  const goCount = stepResults.filter((r) => r.status === 'GO').length;
  const faultCount = stepResults.filter((r) => r.status === 'FAULT').length;
  const missionCapable = !isNotMissionCapable(faults);

  const showPdf = (w: Window | null, url: string) => {
    setPdfUrl(url);
    pointWindow(w, url);
  };

  const showBlob = (w: Window | null, blob: Blob) => {
    if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current);
    const url = URL.createObjectURL(blob);
    blobUrlRef.current = url;
    showPdf(w, url);
  };

  /** Server PDF when the inspection is on the server, else client PDF (uploaded if possible). */
  const produceDa2404 = async (s: InspectionSession, w: Window | null) => {
    const state = await db.syncState.get(s.id);
    const remoteId = state?.status === 'synced' ? state.remoteInspectionId : undefined;
    if (remoteId) {
      try {
        const data = await api<{ url: string }>('POST', `/inspections/${encodeURIComponent(remoteId)}/da2404`, {
          body: {
            supervisor_name: s.supervisorName || null,
            supervisor_dod_id: s.supervisorDodId || null,
            local_time: localTimeHHMM(s.completedAt ? new Date(s.completedAt) : new Date()),
          },
          timeoutMs: 30_000,
        });
        if (data?.url) {
          showPdf(w, data.url);
          return;
        }
      } catch (err) {
        console.warn('Server DA 2404 failed, generating on device:', err);
      }
    }

    const blob = await clientPdf(s);
    showBlob(w, blob);
    if (remoteId) {
      // Keep the dashboard copy: upload the device-generated form.
      api<{ url: string }>('PUT', `/inspections/${encodeURIComponent(remoteId)}/da2404`, { raw: blob, timeoutMs: 60_000 })
        .catch((err) => console.warn('Uploading device DA 2404 failed:', err));
    }
  };

  const handleSave = async () => {
    if (busyRef.current) return;
    busyRef.current = true;
    const w = openPendingWindow();
    setBusy(true);
    setError('');
    try {
      // completeSession returns the completed session (remarks, completedAt) — use it, not the stale one.
      const completed = await completeSession(session.remarks);
      if (!completed) throw new Error('Could not save the inspection');
      if (!(await db.syncState.get(completed.id))) {
        await db.syncState.put({ sessionId: completed.id, status: 'pending', attempts: 0 });
      }
      setPhase('saved');
      await syncAll({ force: true });
      await produceDa2404(completed, w);
    } catch (err) {
      console.error('Save / DA 2404 failed:', err);
      setError(`The inspection is saved, but the DA 2404 could not be created: ${(err as Error).message || 'unknown error'}`);
      if (w && !w.closed) w.close();
    } finally {
      setBusy(false);
      busyRef.current = false;
    }
  };

  const handleView = async () => {
    if (busyRef.current) return;
    busyRef.current = true;
    const w = openPendingWindow();
    setBusy(true);
    setError('');
    try {
      await produceDa2404(session, w);
    } catch (err) {
      console.error('DA 2404 generation failed:', err);
      setError(`Could not create the DA 2404: ${(err as Error).message || 'unknown error'}`);
      if (w && !w.closed) w.close();
    } finally {
      setBusy(false);
      busyRef.current = false;
    }
  };

  const handleDone = () => {
    clearSession();
    navigate('/history');
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
        {isCompleted && (
          <div className="mt-2" aria-live="polite">
            <SyncBadge state={syncState} />
          </div>
        )}
      </div>

      <main className="flex-1 overflow-y-auto px-4 pb-4 flex flex-col gap-3">
        <Card>
          <h2 className="text-xs font-semibold text-text-secondary mb-2 font-display">VEHICLE</h2>
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
              <p className="text-text-primary font-display">
                {Number.isFinite(session.odometer) ? `${session.odometer.toLocaleString()} mi` : '—'}
              </p>
            </div>
          </div>
        </Card>

        <Card>
          <h2 className="text-xs font-semibold text-text-secondary mb-2 font-display">INSPECTION</h2>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div>
              <span className="text-text-secondary">Date:</span>
              <p className="text-text-primary">{session.date}</p>
            </div>
            <div>
              <span className="text-text-secondary">Type:</span>
              <p className="text-text-primary">{inspectionTypeLabel(session.inspectionType)}</p>
            </div>
            <div>
              <span className="text-text-secondary">Inspector:</span>
              <p className="text-text-primary">{session.inspectorRank} {session.inspectorName}</p>
            </div>
            <div>
              <span className="text-text-secondary">UIC:</span>
              <p className="text-text-primary">{session.unit}</p>
            </div>
            {session.supervisorName && (
              <div className="col-span-2">
                <span className="text-text-secondary">Supervisor:</span>
                <p className="text-text-primary">{session.supervisorName}</p>
              </div>
            )}
          </div>
        </Card>

        <Card>
          <h2 className="text-xs font-semibold text-text-secondary mb-2 font-display">RESULTS</h2>
          <div className="flex gap-4 text-sm mb-3">
            <span className="text-accent-green font-display">GO: {goCount}</span>
            <span className="text-accent-red font-display">FAULTS: {faultCount}</span>
          </div>
        </Card>

        <Card>
          <h2 className="text-xs font-semibold text-text-secondary mb-2 font-display">FAULT TABLE</h2>
          {faults.length === 0 ? (
            <div className="flex items-center gap-2 py-2">
              <Check size={16} className="text-accent-green" aria-hidden="true" />
              <span className="text-sm text-text-primary">PMCS COMPLETED — NO NEW FAULTS FOUND</span>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <div className="grid grid-cols-[40px_24px_1fr_1fr] gap-2 text-xs text-text-secondary font-display pb-1 border-b border-border">
                <span>ITEM</span>
                <span>ST</span>
                <span>DEFICIENCY</span>
                <span>ACTION</span>
              </div>
              {faults.map((fault) => (
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
            <h2 className="text-xs font-semibold text-text-secondary mb-2 font-display">REMARKS</h2>
            <p className="text-sm text-text-primary whitespace-pre-wrap" data-testid="remarks">{session.remarks}</p>
          </Card>
        )}
      </main>

      <div className="px-4 pb-[calc(16px+env(safe-area-inset-bottom))] border-t border-border pt-3 flex-shrink-0 flex flex-col gap-2">
        {error && <p className="text-sm text-accent-red" role="alert">{error}</p>}
        {pdfUrl && (
          <a
            href={pdfUrl}
            target="_blank"
            rel="noopener"
            className="flex items-center justify-center gap-2 min-h-[48px] rounded-[var(--radius-md)] border border-accent-blue text-accent-blue font-medium"
            data-testid="open-da2404"
          >
            <ExternalLink size={18} aria-hidden="true" /> Open DA 2404
          </a>
        )}

        {!isCompleted ? (
          <Button size="lg" fullWidth onClick={handleSave} disabled={busy}>
            <span className="flex items-center justify-center gap-2">
              <ExternalLink size={18} aria-hidden="true" />
              {busy ? 'Saving...' : 'Save & Open DA 2404'}
            </span>
          </Button>
        ) : phase === 'saved' ? (
          <>
            <div className="flex items-center justify-center gap-2 text-accent-green font-semibold min-h-[32px]" role="status">
              <Check size={20} aria-hidden="true" /> Saved on this device
              {busy && <span className="text-xs text-text-secondary font-normal">— sending…</span>}
            </div>
            <Button size="lg" fullWidth onClick={handleDone} disabled={busy}>Done</Button>
          </>
        ) : (
          <>
            <Button variant="secondary" size="lg" fullWidth onClick={handleView} disabled={busy}>
              <span className="flex items-center justify-center gap-2">
                <ExternalLink size={18} aria-hidden="true" />
                {busy ? 'Generating...' : 'View DA 2404'}
              </span>
            </Button>
            <Button variant="ghost" size="default" fullWidth onClick={handleDone}>
              Back to History
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
