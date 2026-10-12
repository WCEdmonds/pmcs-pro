import { useEffect, useState } from 'react';
import { useSessionStore } from '../stores/sessionStore';
import { useUserStore } from '../stores/userStore';

export type SessionLoadStatus = 'loading' | 'ready' | 'notfound' | 'forbidden' | 'error';

/**
 * Makes sure the store holds session `id`. After a reload (or deep link) the
 * store is empty, so restore it from Dexie instead of showing "No active session".
 */
export function useSessionLoader(id: string | undefined): SessionLoadStatus {
  const currentId = useSessionStore((s) => s.currentSession?.id);
  const inspector = useSessionStore((s) => s.currentSession?.inspectorDodId);
  const restoreSession = useSessionStore((s) => s.restoreSession);
  const dodId = useUserStore((s) => s.user?.dodId);
  const [failed, setFailed] = useState<{ id: string; status: SessionLoadStatus } | null>(null);

  const loaded = !!id && currentId === id;

  useEffect(() => {
    if (!id || loaded) return;
    let cancelled = false;
    restoreSession(id)
      .then((ok) => {
        if (!cancelled && !ok) setFailed({ id, status: 'notfound' });
      })
      .catch((err) => {
        console.error('Restoring session failed:', err);
        if (!cancelled) setFailed({ id, status: 'error' });
      });
    return () => {
      cancelled = true;
    };
  }, [id, loaded, restoreSession]);

  if (!id) return 'notfound';
  if (loaded) {
    if (dodId && inspector && inspector !== dodId) return 'forbidden';
    return 'ready';
  }
  if (failed?.id === id) return failed.status;
  return 'loading';
}
