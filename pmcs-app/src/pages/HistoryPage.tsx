import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Clock, FileText } from 'lucide-react';
import { useHistoryStore } from '../stores/historyStore';
import { useUserStore } from '../stores/userStore';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { VEHICLE_REGISTRY } from '../data/vehicles';

export default function HistoryPage() {
  const navigate = useNavigate();
  const user = useUserStore((s) => s.user);
  const { entries, isLoading, loadHistory } = useHistoryStore();

  useEffect(() => {
    loadHistory(user?.dodId);
  }, [user?.dodId, loadHistory]);

  return (
    <div className="flex flex-col h-full px-4 pt-6">
      <h1 className="text-2xl font-bold font-display text-text-primary mb-4">History</h1>

      {isLoading ? (
        <div className="flex-1 flex items-center justify-center text-text-secondary">Loading...</div>
      ) : entries.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center">
          <Clock size={48} className="text-text-secondary/30 mb-3" />
          <p className="text-lg font-semibold text-text-primary">No inspections yet</p>
          <p className="text-sm text-text-secondary mt-1 mb-4">Complete a PMCS to see it here</p>
          <Button onClick={() => navigate('/')}>Start PMCS</Button>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto flex flex-col gap-2 pb-4">
          {entries.map((entry, i) => {
            const vehicle = VEHICLE_REGISTRY.find((v) => v.type === entry.session.vehicleType);
            const hasNoGo = entry.nogoCount > 0;
            return (
              <motion.button
                key={entry.session.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                onClick={() => navigate(`/session/${entry.session.id}/5988`)}
                className="bg-bg-secondary border border-border rounded-[var(--radius-md)] p-3 text-left active:border-accent-blue flex items-center gap-3"
              >
                <div className="flex-shrink-0 w-10 h-10 bg-bg-tertiary rounded-[var(--radius-md)] flex items-center justify-center">
                  <FileText size={20} className="text-text-secondary" />
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
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs text-text-secondary">{entry.session.date}</span>
                    <span className="text-xs text-text-secondary">{entry.session.inspectionType}</span>
                    {entry.faultCount > 0 && (
                      <span className="text-xs text-text-secondary">{entry.faultCount} fault{entry.faultCount !== 1 ? 's' : ''}</span>
                    )}
                  </div>
                </div>
                <Badge variant={hasNoGo ? 'red' : 'green'}>
                  {hasNoGo ? 'NMC' : 'FMC'}
                </Badge>
              </motion.button>
            );
          })}
        </div>
      )}
    </div>
  );
}
