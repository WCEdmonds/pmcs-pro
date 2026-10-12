import { useState } from 'react';
import { CloudOff, CloudUpload, Check, AlertTriangle } from 'lucide-react';
import { useUserStore } from '../../stores/userStore';
import { useSyncRunning, useUnsynced } from '../../hooks/useSync';
import { syncAll, describeRun } from '../../utils/syncEngine';
import type { SyncStateEntry } from '../../utils/db';
import { Button } from '../ui/Button';

/** Per-inspection badge. Only says "Synced" when the server confirmed it. */
export function SyncBadge({ state, inProgress }: { state?: SyncStateEntry; inProgress?: boolean }) {
  if (inProgress) {
    return <span className="text-xs font-semibold text-accent-blue">In progress</span>;
  }
  if (state?.status === 'synced') {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-semibold text-accent-green" data-testid="sync-badge" data-sync="synced">
        <Check size={12} aria-hidden="true" /> Synced
      </span>
    );
  }
  if (state?.status === 'failed') {
    return (
      <span className="inline-flex items-start gap-1 text-xs font-semibold text-accent-red" data-testid="sync-badge" data-sync="failed">
        <AlertTriangle size={12} className="mt-0.5 flex-shrink-0" aria-hidden="true" />
        <span>Failed: {state.lastError || 'unknown error'}</span>
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-xs font-semibold text-accent-amber" data-testid="sync-badge" data-sync="pending">
      <CloudOff size={12} aria-hidden="true" /> Not sent yet
    </span>
  );
}

/** "N inspections not sent to server" + Send now. Renders nothing when all are synced. */
export function SyncBanner({ compact = false }: { compact?: boolean }) {
  const user = useUserStore((s) => s.user);
  const data = useUnsynced(user?.dodId);
  const running = useSyncRunning();
  const [message, setMessage] = useState('');
  const count = data?.sessions.length ?? 0;
  if (!user || count === 0) {
    return message && !compact ? <p className="text-sm text-accent-green mb-3" role="status">{message}</p> : null;
  }

  const handleSend = async () => {
    setMessage('');
    const r = await syncAll({ force: true });
    setMessage(describeRun(r));
  };

  return (
    <div className="bg-accent-amber/10 border border-accent-amber/40 rounded-[var(--radius-lg)] p-3 mb-4" data-testid="sync-banner" role="status">
      <div className="flex items-center gap-3">
        <CloudUpload size={22} className="text-accent-amber flex-shrink-0" aria-hidden="true" />
        <p className="flex-1 text-sm font-semibold text-text-primary">
          {count} inspection{count === 1 ? '' : 's'} not sent to server
        </p>
        <Button size="default" onClick={handleSend} disabled={running} className="min-h-[40px] px-3 text-sm">
          {running ? 'Sending…' : 'Send now'}
        </Button>
      </div>
      {message && <p className="text-xs text-text-secondary mt-2">{message}</p>}
    </div>
  );
}
