import { useSyncExternalStore } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type SyncStateEntry } from '../utils/db';
import { isSyncRunning, onSyncRunning } from '../utils/syncEngine';
import type { InspectionSession } from '../types';

const subscribeRunning = (cb: () => void) => onSyncRunning(cb);

/** True while a sync run is in flight (tear-free, never misses the end of a run). */
export function useSyncRunning(): boolean {
  return useSyncExternalStore(subscribeRunning, isSyncRunning, () => false);
}

/** Sync state of every session, keyed by session id (live). */
export function useSyncStates(): Map<string, SyncStateEntry> | undefined {
  return useLiveQuery(async () => {
    const rows = await db.syncState.toArray();
    return new Map(rows.map((r) => [r.sessionId, r]));
  }, []);
}

/** Completed sessions of this user that the server hasn't confirmed (live). */
export function useUnsynced(dodId: string | undefined): { sessions: InspectionSession[]; states: Map<string, SyncStateEntry> } | undefined {
  return useLiveQuery(async () => {
    const states = new Map((await db.syncState.toArray()).map((r) => [r.sessionId, r]));
    if (!dodId) return { sessions: [], states };
    const sessions = (await db.sessions.where('inspectorDodId').equals(dodId).toArray())
      .filter((s) => s.status === 'COMPLETED' && states.get(s.id)?.status !== 'synced');
    return { sessions, states };
  }, [dodId]);
}
