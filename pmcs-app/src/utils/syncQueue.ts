import { db } from './db';
import type { SyncQueueEntry } from './db';
import { syncInspectionToSupabase } from './sync';
import type { InspectionSession, Fault } from '../types';

const MAX_ATTEMPTS = 3;

export async function enqueueSync(session: InspectionSession, faults: Fault[]): Promise<void> {
  const entry: SyncQueueEntry = {
    id: session.id,
    session,
    faults,
    attempts: 0,
    lastAttempt: null,
    createdAt: new Date().toISOString(),
  };
  await db.syncQueue.put(entry);
}

export async function getPendingSyncCount(): Promise<number> {
  return db.syncQueue.count();
}

export async function flushSyncQueue(): Promise<{ synced: number; failed: number }> {
  const entries = await db.syncQueue.toArray();
  let synced = 0;
  let failed = 0;

  for (const entry of entries) {
    if (entry.attempts >= MAX_ATTEMPTS) {
      continue;
    }

    try {
      await syncInspectionToSupabase(entry.session, entry.faults);
      await db.syncQueue.delete(entry.id);
      synced++;
    } catch {
      failed++;
      await db.syncQueue.update(entry.id, {
        attempts: entry.attempts + 1,
        lastAttempt: new Date().toISOString(),
      });
    }
  }

  return { synced, failed };
}

export function startSyncListener(): () => void {
  const handler = () => {
    if (navigator.onLine) {
      flushSyncQueue().catch(() => {});
    }
  };

  window.addEventListener('online', handler);
  // Also try on startup
  if (navigator.onLine) {
    flushSyncQueue().catch(() => {});
  }

  return () => window.removeEventListener('online', handler);
}
