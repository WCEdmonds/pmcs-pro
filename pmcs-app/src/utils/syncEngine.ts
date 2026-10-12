// Reliable inspection sync.
//
// Source of truth is Dexie: every COMPLETED session is synced until the server
// confirms it (syncState.status === 'synced'). This covers sessions written by
// older app versions — ones that were never queued and ones the old queue gave
// up on after 3 attempts. The server is idempotent on client_session_id, so
// re-sending a session that did reach the server is safe.

import { db, type SyncStateEntry, type PendingFaultResolution } from './db';
import { api, ApiError, getSessionDodId, isNetworkError, isPinChangeRequired } from './api';
import { sendHeartbeat } from './heartbeat';
import { postInspection, dataUrlToBlob } from './sync';
import { localTimeHHMM } from './format';
import { useUserStore } from '../stores/userStore';
import type { InspectionSession } from '../types';

export const BASE_BACKOFF_MS = 30_000;
export const MAX_BACKOFF_MS = 30 * 60_000;
const PERIODIC_MS = 60_000;

export function backoffDelay(attempts: number): number {
  if (attempts <= 0) return 0;
  return Math.min(MAX_BACKOFF_MS, BASE_BACKOFF_MS * 2 ** (attempts - 1));
}

export interface SyncRunResult {
  skipped?: 'offline' | 'signed-out' | 'pin-change';
  synced: number;
  failed: number;
  /** Sessions still not confirmed after this run (any user). */
  remaining: number;
  authFailed?: boolean;
  networkFailed?: boolean;
  /** The server wants a new PIN before it accepts anything (admin reset). Nothing was lost. */
  pinChangeRequired?: boolean;
}

// ---------------------------------------------------------------------------
// Running-state listeners (for "Sending…" UI)
// ---------------------------------------------------------------------------

type RunListener = (running: boolean) => void;
const runListeners = new Set<RunListener>();
export function onSyncRunning(l: RunListener): () => void {
  runListeners.add(l);
  return () => runListeners.delete(l);
}
export function isSyncRunning(): boolean {
  return inFlight !== null;
}
function emitRunning(running: boolean) {
  runListeners.forEach((l) => l(running));
}

// ---------------------------------------------------------------------------
// Recovery of data written by older app versions
// ---------------------------------------------------------------------------

/**
 * Moves anything in the legacy syncQueue into sessions/faults (if missing) and
 * makes sure every completed session has a syncState row. Purely local.
 */
export async function recoverLocalData(): Promise<void> {
  const queue = await db.syncQueue.toArray();
  for (const entry of queue) {
    await db.transaction('rw', [db.sessions, db.faults, db.syncQueue, db.syncState], async () => {
      const existing = await db.sessions.get(entry.id);
      if (!existing && entry.session) {
        await db.sessions.put({
          ...entry.session,
          status: 'COMPLETED',
          completedAt: entry.session.completedAt ?? entry.lastAttempt ?? entry.createdAt,
        });
      } else if (existing && existing.status !== 'COMPLETED') {
        await db.sessions.put({ ...existing, status: 'COMPLETED', completedAt: existing.completedAt ?? entry.createdAt });
      }
      for (const f of entry.faults ?? []) {
        if (!(await db.faults.get(f.id))) await db.faults.put(f);
      }
      const state = await db.syncState.get(entry.id);
      if (!state) {
        await db.syncState.put({
          sessionId: entry.id,
          status: entry.attempts > 0 ? 'failed' : 'pending',
          attempts: 0, // fresh start: the old failures were a server bug
          lastError: entry.attempts > 0 ? 'Previous app version could not send this inspection' : undefined,
          lastAttempt: entry.lastAttempt ?? undefined,
        });
      }
      await db.syncQueue.delete(entry.id);
    });
  }

  const completed = await db.sessions.where('status').equals('COMPLETED').primaryKeys();
  const states = new Set(await db.syncState.toCollection().primaryKeys());
  const missing = completed.filter((id) => !states.has(id));
  if (missing.length) {
    await db.syncState.bulkPut(missing.map((sessionId) => ({ sessionId, status: 'pending' as const, attempts: 0 })));
  }
}

// ---------------------------------------------------------------------------
// One session
// ---------------------------------------------------------------------------

class PartialSyncError extends Error {}

async function patchState(sessionId: string, patch: Partial<SyncStateEntry>): Promise<SyncStateEntry> {
  const prev = (await db.syncState.get(sessionId)) ?? { sessionId, status: 'pending' as const, attempts: 0 };
  const next = { ...prev, ...patch, sessionId };
  await db.syncState.put(next);
  return next;
}

async function syncSession(session: InspectionSession, unit: string): Promise<void> {
  const faults = (await db.faults.where('sessionId').equals(session.id).toArray())
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));

  const res = await postInspection(session, faults, unit);
  const remoteFaultIds: Record<string, string> = {};
  faults.forEach((f, i) => {
    if (res.fault_ids[i]) remoteFaultIds[f.id] = res.fault_ids[i];
  });
  let state = await patchState(session.id, { remoteInspectionId: res.inspection_id, remoteFaultIds });

  // Photos, per fault, using the server's fault ids
  const uploaded = new Set(state.uploadedPhotoIds ?? []);
  const photos = await db.photos.where('sessionId').equals(session.id).toArray();
  for (const photo of photos) {
    if (uploaded.has(photo.id)) continue;
    const remoteFaultId = remoteFaultIds[photo.faultId];
    if (!remoteFaultId) {
      if (!faults.some((f) => f.id === photo.faultId)) continue; // orphan photo of a deleted fault
      throw new PartialSyncError('Server did not return an id for a fault with photos');
    }
    const blob = dataUrlToBlob(photo.dataUrl);
    await api('POST', `/faults/${encodeURIComponent(remoteFaultId)}/photos`, {
      query: { session: session.id, photo: photo.id, ext: blob.type === 'image/png' ? 'png' : 'jpg' },
      raw: blob,
      timeoutMs: 60_000,
    });
    uploaded.add(photo.id);
    state = await patchState(session.id, { uploadedPhotoIds: [...uploaded] });
  }

  // Diagnosis attempts
  if (!state.diagnosisUploaded) {
    const attempts = await db.diagnosisAttempts.where('sessionId').equals(session.id).toArray();
    const payload = attempts
      .filter((a) => remoteFaultIds[a.faultId])
      .map((a) => ({
        id: a.id,
        fault_id: remoteFaultIds[a.faultId],
        session_id: session.id,
        category_id: a.categoryId,
        steps_completed: a.stepsCompleted,
        outcome: a.outcome,
        skip_reason: a.skipReason ?? null,
        readiness_result: a.readinessResult,
        completed_at: a.completedAt,
      }));
    if (payload.length) await api('POST', '/diagnosis-attempts', { body: payload });
    state = await patchState(session.id, { diagnosisUploaded: true });
  }

  // DA 2404 on the server, with the supervisor entered on the phone. Covers inspections saved
  // offline (whose form was made on the device); the server reuses an existing form, so this
  // never regenerates or re-emails one.
  if (!state.formCreated) {
    await api('POST', `/inspections/${encodeURIComponent(res.inspection_id)}/da2404`, {
      body: {
        supervisor_name: session.supervisorName || null,
        supervisor_dod_id: session.supervisorDodId || null,
        local_time: localTimeHHMM(session.completedAt ? new Date(session.completedAt) : new Date()),
      },
      timeoutMs: 30_000,
    });
    await patchState(session.id, { formCreated: true });
  }

  await patchState(session.id, {
    status: 'synced',
    lastError: undefined,
    attempts: 0,
    nextAttemptAt: undefined,
    syncedAt: new Date().toISOString(),
  });
}

// ---------------------------------------------------------------------------
// Prior-fault resolutions queued while offline
// ---------------------------------------------------------------------------

export async function queueFaultResolution(faultIds: string[], resolutionStatus: 'CORRECTED' | 'ACKNOWLEDGED', dodId: string) {
  const entry: PendingFaultResolution = {
    id: crypto.randomUUID(),
    faultIds,
    resolutionStatus,
    dodId,
    createdAt: new Date().toISOString(),
    attempts: 0,
  };
  await db.pendingFaultResolutions.put(entry);
  return entry;
}

async function flushFaultResolutions(dodId: string, force: boolean): Promise<void> {
  const entries = await db.pendingFaultResolutions.where('dodId').equals(dodId).toArray();
  for (const e of entries) {
    if (!force && e.nextAttemptAt && e.nextAttemptAt > new Date().toISOString()) continue;
    try {
      await api('PATCH', '/faults', { body: { ids: e.faultIds, resolution_status: e.resolutionStatus } });
      await db.pendingFaultResolutions.delete(e.id);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) throw err;
      // Must come before the 403 drop below: a PIN-change lock is not a refusal of this change.
      if (isPinChangeRequired(err)) throw err;
      if (isNetworkError(err)) throw err;
      if (err instanceof ApiError && [400, 403, 404].includes(err.status)) {
        // Fault gone or no longer ours to change: retrying can never succeed.
        console.warn('Dropping queued fault resolution the server refused:', err.message);
        await db.pendingFaultResolutions.delete(e.id);
        continue;
      }
      const attempts = e.attempts + 1;
      await db.pendingFaultResolutions.update(e.id, {
        attempts,
        lastError: (err as Error).message,
        nextAttemptAt: new Date(Date.now() + backoffDelay(attempts)).toISOString(),
      });
    }
  }
}

// ---------------------------------------------------------------------------
// Run
// ---------------------------------------------------------------------------

async function resolveUnit(dodId: string): Promise<string> {
  const user = useUserStore.getState().user;
  if (user?.dodId === dodId && user.unit) return user.unit;
  const cached = await db.users.get(dodId).catch(() => undefined);
  return cached?.unit ?? '';
}

async function countRemaining(): Promise<number> {
  return db.syncState.where('status').anyOf('pending', 'failed').count();
}

async function runSync(force: boolean): Promise<SyncRunResult> {
  await recoverLocalData();
  const result: SyncRunResult = { synced: 0, failed: 0, remaining: 0 };

  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return { ...result, skipped: 'offline', remaining: await countRemaining() };
  }
  const dodId = getSessionDodId();
  if (!dodId) return { ...result, skipped: 'signed-out', remaining: await countRemaining() };
  const current = useUserStore.getState().user;
  if (current?.dodId === dodId && current.mustChangePin) {
    return { ...result, skipped: 'pin-change', remaining: await countRemaining() };
  }
  const unit = await resolveUnit(dodId);

  try {
    await flushFaultResolutions(dodId, force);
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) return { ...result, authFailed: true, remaining: await countRemaining() };
    if (isPinChangeRequired(err)) return { ...result, pinChangeRequired: true, remaining: await countRemaining() };
    // network trouble: carry on, inspections will hit the same error and stop
  }

  const sessions = (await db.sessions.where('status').equals('COMPLETED').toArray())
    .filter((s) => s.inspectorDodId === dodId)
    .sort((a, b) => (a.completedAt ?? a.createdAt).localeCompare(b.completedAt ?? b.createdAt));

  for (const session of sessions) {
    const state = await db.syncState.get(session.id);
    if (state?.status === 'synced') continue;
    if (!force && state?.nextAttemptAt && state.nextAttemptAt > new Date().toISOString()) continue;

    const startedAt = new Date().toISOString();
    try {
      await syncSession(session, unit);
      result.synced++;
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        // Not an attempt: we just need the user to sign in again.
        await patchState(session.id, { lastError: 'Sign in to send' });
        result.authFailed = true;
        break;
      }
      if (isPinChangeRequired(err)) {
        // Not an attempt either: the soldier has to set a new PIN first.
        await patchState(session.id, { lastError: 'Set a new PIN to send' });
        result.pinChangeRequired = true;
        break;
      }
      if (isNetworkError(err)) {
        // Not the inspection's fault — don't count it; stop this run.
        await patchState(session.id, { lastError: (err as Error).message, lastAttempt: startedAt });
        result.networkFailed = true;
        break;
      }
      const attempts = (state?.attempts ?? 0) + 1;
      await patchState(session.id, {
        status: 'failed',
        attempts,
        lastAttempt: startedAt,
        lastError: (err as Error).message || 'Unknown error',
        nextAttemptAt: new Date(Date.now() + backoffDelay(attempts)).toISOString(),
      });
      result.failed++;
    }
  }

  result.remaining = await countRemaining();
  return result;
}

let inFlight: Promise<SyncRunResult> | null = null;
let queuedForced: Promise<SyncRunResult> | null = null;
let networkRetry: ReturnType<typeof setTimeout> | null = null;
export const NETWORK_RETRY_MS = 10_000;

/**
 * The `online` event often fires before requests actually go through. After a
 * network failure while the device claims to be online, try again shortly.
 */
function scheduleNetworkRetry(result: SyncRunResult) {
  if (!result.networkFailed || networkRetry) return;
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return;
  networkRetry = setTimeout(() => {
    networkRetry = null;
    syncAll();
  }, NETWORK_RETRY_MS);
}

/**
 * Syncs every completed local session not yet confirmed by the server.
 * Single-flight: concurrent callers share one run. `force` ignores backoff
 * (used for app start, sign-in, the `online` event and "Send now").
 */
export function syncAll(opts: { force?: boolean } = {}): Promise<SyncRunResult> {
  const force = !!opts.force;
  if (inFlight) {
    if (!force) return inFlight;
    if (!queuedForced) {
      queuedForced = inFlight.catch(() => undefined).then(() => {
        queuedForced = null;
        return syncAll({ force: true });
      });
    }
    return queuedForced;
  }
  inFlight = runSync(force)
    .catch((err) => {
      console.error('Sync run failed:', err);
      return { synced: 0, failed: 0, remaining: -1 } as SyncRunResult;
    })
    .then((result) => {
      scheduleNetworkRetry(result);
      // Tell leaders what hasn't reached the server (throttled; never throws or blocks the run).
      if (!result.skipped && !result.authFailed && !result.pinChangeRequired) {
        sendHeartbeat().catch(() => undefined);
      }
      return result;
    })
    .finally(() => {
      inFlight = null;
      emitRunning(false);
    });
  emitRunning(true);
  return inFlight;
}

/** Wires automatic sync: `online` event (forced) and a periodic retry that honors backoff. */
export function startSyncListener(): () => void {
  const onOnline = () => {
    syncAll({ force: true });
  };
  const onVisible = () => {
    if (document.visibilityState === 'visible') syncAll();
  };
  window.addEventListener('online', onOnline);
  document.addEventListener('visibilitychange', onVisible);
  const interval = setInterval(() => syncAll(), PERIODIC_MS);
  return () => {
    window.removeEventListener('online', onOnline);
    document.removeEventListener('visibilitychange', onVisible);
    clearInterval(interval);
  };
}

/** Sync state for one session (undefined = never seen by the engine yet). */
export function getSyncState(sessionId: string) {
  return db.syncState.get(sessionId);
}

/** Completed sessions of this user that the server hasn't confirmed. */
export async function getUnsyncedSessions(dodId?: string): Promise<InspectionSession[]> {
  const completed = await db.sessions.where('status').equals('COMPLETED').toArray();
  const out: InspectionSession[] = [];
  for (const s of completed) {
    if (dodId && s.inspectorDodId !== dodId) continue;
    const st = await db.syncState.get(s.id);
    if (st?.status !== 'synced') out.push(s);
  }
  return out;
}

/** One-line, soldier-facing summary of a sync run. */
export function describeRun(r: SyncRunResult): string {
  if (r.skipped === 'offline') return "You're offline. They'll send automatically when you're back online.";
  if (r.skipped === 'signed-out' || r.authFailed) return 'Sign in again to send them.';
  if (r.skipped === 'pin-change' || r.pinChangeRequired) return 'Set a new PIN to send them.';
  if (r.networkFailed) return "Can't reach the server right now. Will keep trying.";
  if (r.failed > 0) return `${r.failed} could not be sent. See the reasons below; will keep retrying.`;
  if (r.synced > 0) return `Sent ${r.synced} inspection${r.synced === 1 ? '' : 's'}.`;
  return 'Nothing to send.';
}

