import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Clock, FileText, PlayCircle } from 'lucide-react';
import { useHistoryStore } from '../stores/historyStore';
import { useUserStore } from '../stores/userStore';
import { useSessionStore } from '../stores/sessionStore';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { SyncBadge, SyncBanner } from '../components/sync/SyncStatus';
import { useSyncStates } from '../hooks/useSync';
import { inspectionTypeLabel } from '../utils/inspectionTypes';
import { VEHICLE_REGISTRY } from '../data/vehicles';

export default function HistoryPage() {
  const navigate = useNavigate();
  const user = useUserStore((s) => s.user);
  const restoreSession = useSessionStore((s) => s.restoreSession);
  const { entries, isLoading, loadHistory } = useHistoryStore();
  const syncStates = useSyncStates();

  useEffect(() => {
    if (user?.dodId) loadHistory(user.dodId);
  }, [user?.dodId, loadHistory]);

  const handleResume = async (id: string) => {
    if (await restoreSession(id)) navigate(`/session/${id}/pmcs`);
  };

  return (
    <div className="flex flex-col h-full px-4 pt-6">
      <h1 className="text-2xl font-bold font-display text-text-primary mb-4">History</h1>

      <SyncBanner />

      {isLoading ? (
        <div className="flex-1 flex items-center justify-center text-text-secondary">Loading...</div>
      ) : entries.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center">
          <Clock size={48} className="text-text-secondary mb-3" aria-hidden="true" />
          <p className="text-lg font-semibold text-text-primary">No inspections yet</p>
          <p className="text-sm text-text-secondary mt-1 mb-4">Complete a PMCS to see it here</p>
          <Button onClick={() => navigate('/')}>Start PMCS</Button>
        </div>
      ) : (
        <ul className="flex-1 overflow-y-auto flex flex-col gap-2 pb-4" aria-label="Inspections">
          {entries.map((entry, i) => {
            const vehicle = VEHICLE_REGISTRY.find((v) => v.type === entry.session.vehicleType);
            const inProgress = entry.session.status === 'IN_PROGRESS';
            const hasNoGo = entry.nogoCount > 0;
            return (
              <motion.li
                key={entry.session.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(i, 10) * 0.05 }}
                className="bg-bg-secondary border border-border rounded-[var(--radius-md)] p-3 flex items-center gap-3"
                data-testid="history-entry"
                data-session-id={entry.session.id}
              >
                <button
                  type="button"
                  onClick={() => (inProgress ? handleResume(entry.session.id) : navigate(`/session/${entry.session.id}/5988`))}
                  className="flex-1 min-w-0 flex items-center gap-3 text-left"
                >
                  <div className="flex-shrink-0 w-10 h-10 bg-bg-tertiary rounded-[var(--radius-md)] flex items-center justify-center">
                    {inProgress
                      ? <PlayCircle size={20} className="text-accent-blue" aria-hidden="true" />
                      : <FileText size={20} className="text-text-secondary" aria-hidden="true" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-text-primary truncate">
                        {entry.session.bumperNumber}
                      </span>
                      <span className="text-xs text-text-secondary">
                        {vehicle?.nickname || entry.session.vehicleType}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      <span className="text-xs text-text-secondary">{entry.session.date}</span>
                      <span className="text-xs text-text-secondary">{inspectionTypeLabel(entry.session.inspectionType)}</span>
                      {entry.faultCount > 0 && (
                        <span className="text-xs text-text-secondary">{entry.faultCount} fault{entry.faultCount !== 1 ? 's' : ''}</span>
                      )}
                    </div>
                    <div className="mt-1">
                      <SyncBadge state={syncStates?.get(entry.session.id)} inProgress={inProgress} />
                    </div>
                  </div>
                </button>
                {inProgress ? (
                  <Button size="default" className="min-h-[40px] px-3 text-sm" onClick={() => handleResume(entry.session.id)}>
                    Resume
                  </Button>
                ) : (
                  <Badge variant={hasNoGo ? 'red' : 'green'}>
                    {hasNoGo ? 'NMC' : 'FMC'}
                  </Badge>
                )}
              </motion.li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
