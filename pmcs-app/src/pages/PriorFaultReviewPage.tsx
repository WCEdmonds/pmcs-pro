import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Check, HelpCircle, AlertTriangle } from 'lucide-react';
import { api } from '../utils/api';
import { useSessionStore } from '../stores/sessionStore';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';

interface OpenFault {
  id: string;
  item: string;
  item_description: string;
  description: string;
  readiness: string | null;
  zone: string;
  created_at: string;
}

type FaultDecision = 'still_open' | 'resolved' | 'idk';

export default function PriorFaultReviewPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const currentSession = useSessionStore((s) => s.currentSession);

  const [faults, setFaults] = useState<OpenFault[]>([]);
  const [decisions, setDecisions] = useState<Record<string, FaultDecision>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadOpenFaults();
  }, []);

  async function loadOpenFaults() {
    if (!currentSession) {
      setLoading(false);
      return;
    }

    // Find the vehicle by normalized bumper number
    const bumperNormalized = currentSession.bumperNumber.replace(/[-\s]/g, '').toUpperCase();
    const vehicle = await api<{ id: string }[]>('GET', '/vehicles', {
      query: { bumper_normalized: bumperNormalized, unit: currentSession.unit },
    }).then((rows) => rows[0] ?? null).catch(() => null);

    if (!vehicle) {
      setLoading(false);
      return;
    }

    const openFaults = await api<OpenFault[]>('GET', '/faults', {
      query: { vehicle_id: vehicle.id, open: 1, order: 'asc' },
    }).catch(() => [] as OpenFault[]);

    setFaults((openFaults || []) as OpenFault[]);

    // Default all to 'still_open'
    const defaults: Record<string, FaultDecision> = {};
    for (const f of (openFaults || [])) {
      defaults[f.id] = 'still_open';
    }
    setDecisions(defaults);
    setLoading(false);
  }

  const handleDecision = (faultId: string, decision: FaultDecision) => {
    setDecisions((prev) => ({ ...prev, [faultId]: decision }));
  };

  const handleContinue = async () => {
    setSaving(true);

    // Mark resolved faults on the server
    const resolvedIds = Object.entries(decisions)
      .filter(([, d]) => d === 'resolved')
      .map(([id]) => id);

    if (resolvedIds.length > 0) {
      await api('PATCH', '/faults', {
        body: { ids: resolvedIds, resolution_status: 'CORRECTED' },
      }).catch((err) => console.warn('Failed to resolve prior faults:', err));
    }

    setSaving(false);
    navigate(`/session/${id}/pmcs`);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-text-secondary font-display">
        Checking prior faults...
      </div>
    );
  }

  // No open faults — skip straight to walkthrough
  if (faults.length === 0) {
    navigate(`/session/${id}/pmcs`, { replace: true });
    return null;
  }

  const resolvedCount = Object.values(decisions).filter((d) => d === 'resolved').length;

  return (
    <div className="flex flex-col h-[100dvh]">
      {/* Header */}
      <div className="px-4 pt-6 pb-4 border-b border-border flex-shrink-0">
        <h1 className="text-xl font-bold font-display text-text-primary">
          Open Faults on {currentSession?.bumperNumber}
        </h1>
        <p className="text-sm text-text-secondary mt-1">
          These faults are still open from previous inspections. Have any been fixed?
        </p>
      </div>

      {/* Fault list */}
      <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-3">
        {faults.map((fault, i) => {
          const decision = decisions[fault.id] || 'still_open';
          return (
            <motion.div
              key={fault.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="bg-bg-secondary border border-border rounded-[var(--radius-lg)] p-4"
            >
              <div className="flex items-start justify-between gap-2 mb-2">
                <div>
                  <p className="text-sm font-semibold text-text-primary">
                    Item {fault.item}: {fault.item_description}
                  </p>
                  <p className="text-sm text-text-secondary mt-0.5">{fault.description}</p>
                </div>
                <Badge variant={fault.readiness === 'NMC' ? 'red' : 'amber'}>
                  {fault.readiness === 'NMC' ? 'NMC' : 'PMC'}
                </Badge>
              </div>
              <p className="text-xs text-text-secondary/60 mb-3">
                Reported {new Date(fault.created_at).toLocaleDateString()}
              </p>

              {/* Decision buttons */}
              <div className="flex gap-2">
                <button
                  onClick={() => handleDecision(fault.id, 'resolved')}
                  className={`flex-1 flex items-center justify-center gap-1.5 min-h-[48px] rounded-[var(--radius-md)] text-sm font-medium transition-colors ${
                    decision === 'resolved'
                      ? 'bg-accent-green text-white'
                      : 'border border-border text-text-secondary active:border-accent-green'
                  }`}
                >
                  <Check size={16} />
                  Fixed
                </button>
                <button
                  onClick={() => handleDecision(fault.id, 'still_open')}
                  className={`flex-1 flex items-center justify-center gap-1.5 min-h-[48px] rounded-[var(--radius-md)] text-sm font-medium transition-colors ${
                    decision === 'still_open'
                      ? 'bg-accent-red text-white'
                      : 'border border-border text-text-secondary active:border-accent-red'
                  }`}
                >
                  <AlertTriangle size={16} />
                  Still Open
                </button>
                <button
                  onClick={() => handleDecision(fault.id, 'idk')}
                  className={`flex-1 flex items-center justify-center gap-1.5 min-h-[48px] rounded-[var(--radius-md)] text-sm font-medium transition-colors ${
                    decision === 'idk'
                      ? 'bg-accent-blue text-white'
                      : 'border border-border text-text-secondary active:border-accent-blue'
                  }`}
                >
                  <HelpCircle size={16} />
                  Not Sure
                </button>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Bottom action */}
      <div className="px-4 pb-[calc(16px+env(safe-area-inset-bottom))] border-t border-border pt-3 flex-shrink-0">
        {resolvedCount > 0 && (
          <p className="text-xs text-accent-green text-center mb-2">
            {resolvedCount} fault{resolvedCount !== 1 ? 's' : ''} will be marked as resolved
          </p>
        )}
        <Button size="lg" fullWidth onClick={handleContinue} disabled={saving}>
          {saving ? 'Saving...' : 'Continue to PMCS'}
        </Button>
      </div>
    </div>
  );
}
