// Client-status heartbeat: tells leaders on the dashboard whose phone holds inspections
// that haven't reached the server. Best effort — offline is normal, so failures are
// swallowed and simply retried on the next sync run.
//
// Only the signed-in soldier's own sessions are counted (shared phones hold other
// soldiers' inspections too), and only while the token and the in-app user agree.

import { db } from './db';
import { api, getSessionDodId } from './api';
import { APP_VERSION } from './version';
import { useUserStore } from '../stores/userStore';

export const HEARTBEAT_MIN_INTERVAL_MS = 5 * 60_000;
export const MAX_ERROR_LENGTH = 300;
const STORAGE_PREFIX = 'pmcs-heartbeat:';

export interface ClientStatus {
  unsent_count: number;
  failed_count: number;
  last_error?: string;
  oldest_unsent_at?: string;
  app_version?: string;
}

export type HeartbeatResult = 'sent' | 'throttled' | 'skipped' | 'failed';

interface LastSent {
  at: number;
  sig: string;
}

/** Counts for one soldier: unsent = COMPLETED and not confirmed synced; failed = syncState failed. */
export async function collectClientStatus(dodId: string): Promise<ClientStatus> {
  const completed = (await db.sessions.where('inspectorDodId').equals(dodId).toArray())
    .filter((s) => s.status === 'COMPLETED' && s.inspectorDodId === dodId);
  const states = await db.syncState.bulkGet(completed.map((s) => s.id));

  let unsent = 0;
  let failed = 0;
  let oldest: number | undefined;
  let lastError: { text: string; at: string } | undefined;

  completed.forEach((session, i) => {
    const state = states[i];
    if (state?.status === 'synced') return;
    unsent++;
    if (state?.status === 'failed') failed++;
    // The API rejects non-ISO timestamps; skip anything a legacy row may hold that doesn't parse.
    const when = Date.parse(session.completedAt ?? session.createdAt ?? '');
    if (!Number.isNaN(when) && (oldest === undefined || when < oldest)) oldest = when;
    if (state?.lastError) {
      const at = state.lastAttempt ?? '';
      if (!lastError || at > lastError.at) lastError = { text: state.lastError, at };
    }
  });

  const status: ClientStatus = { unsent_count: unsent, failed_count: failed, app_version: APP_VERSION };
  if (lastError) status.last_error = lastError.text.slice(0, MAX_ERROR_LENGTH);
  if (oldest !== undefined) status.oldest_unsent_at = new Date(oldest).toISOString();
  return status;
}

const memory = new Map<string, LastSent>();

function readLast(dodId: string): LastSent | undefined {
  const mem = memory.get(dodId);
  if (mem) return mem;
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + dodId);
    const parsed = raw ? (JSON.parse(raw) as LastSent) : undefined;
    if (parsed && typeof parsed.at === 'number' && typeof parsed.sig === 'string') return parsed;
  } catch {
    // ignore
  }
  return undefined;
}

function writeLast(dodId: string, last: LastSent) {
  memory.set(dodId, last);
  try {
    localStorage.setItem(STORAGE_PREFIX + dodId, JSON.stringify(last));
  } catch {
    // ignore: the in-memory copy still throttles this page load
  }
}

/** Test hook: forget when heartbeats were last sent. */
export function resetHeartbeatThrottle() {
  memory.clear();
  try {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i);
      if (k?.startsWith(STORAGE_PREFIX)) localStorage.removeItem(k);
    }
  } catch {
    // ignore
  }
}

function signature(s: ClientStatus): string {
  return `${s.unsent_count}|${s.failed_count}`;
}

let inFlight: Promise<HeartbeatResult> | null = null;

/**
 * Posts /client-status for the signed-in soldier. At most once per 5 minutes unless the
 * unsent/failed counts changed. Never throws.
 */
export function sendHeartbeat(opts: { now?: () => number } = {}): Promise<HeartbeatResult> {
  if (inFlight) return inFlight;
  inFlight = run(opts.now ?? Date.now)
    .catch(() => 'failed' as const)
    .finally(() => {
      inFlight = null;
    });
  return inFlight;
}

async function run(now: () => number): Promise<HeartbeatResult> {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return 'skipped';
  const dodId = getSessionDodId();
  if (!dodId) return 'skipped';
  const user = useUserStore.getState().user;
  // The token decides whose data this is; never report while the app shows someone else.
  if (user && user.dodId !== dodId) return 'skipped';
  // Every non-auth route answers PIN_CHANGE_REQUIRED until the PIN is changed.
  if (user?.mustChangePin) return 'skipped';

  const status = await collectClientStatus(dodId);
  const sig = signature(status);
  const last = readLast(dodId);
  if (last && last.sig === sig && now() - last.at < HEARTBEAT_MIN_INTERVAL_MS) return 'throttled';

  // A different soldier may have signed in while we were counting.
  if (getSessionDodId() !== dodId) return 'skipped';
  try {
    await api('POST', '/client-status', { body: status, timeoutMs: 15_000 });
  } catch {
    return 'failed';
  }
  writeLast(dodId, { at: now(), sig });
  return 'sent';
}
