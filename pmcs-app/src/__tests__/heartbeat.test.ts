import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { InspectionSession } from '../types';

const ME = '1111111111';
const OTHER = '2222222222';

const auth = vi.hoisted(() => ({ dodId: '1111111111' as string | null }));

vi.mock('../utils/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../utils/api')>();
  return { ...actual, api: vi.fn(), getSessionDodId: vi.fn(() => auth.dodId) };
});

const apiModule = await import('../utils/api');
const { NetworkError, ApiError } = apiModule;
const apiMock = vi.mocked(apiModule.api);
const { db } = await import('../utils/db');
const { sendHeartbeat, collectClientStatus, resetHeartbeatThrottle, HEARTBEAT_MIN_INTERVAL_MS, MAX_ERROR_LENGTH } = await import('../utils/heartbeat');
const { syncAll } = await import('../utils/syncEngine');
const { useUserStore } = await import('../stores/userStore');
const { APP_VERSION } = await import('../utils/version');

function session(id: string, dodId = ME, extra: Partial<InspectionSession> = {}): InspectionSession {
  return {
    id, date: '2026-04-02', vehicleId: 'v', vehicleType: 'M1151', bumperNumber: 'HQ-31', odometer: 1,
    inspectorDodId: dodId, inspectorRank: 'SGT', inspectorName: 'Jane Doe', unit: 'WXYZA0', inspectionType: 'BEFORE',
    status: 'COMPLETED', createdAt: '2026-04-02T12:00:00.000Z', completedAt: '2026-04-02T12:30:00.000Z', ...extra,
  };
}

const heartbeatCalls = () => apiMock.mock.calls.filter(([, path]) => path === '/client-status');
const lastBody = () => heartbeatCalls().at(-1)?.[2]?.body as Record<string, unknown>;

let clock = 1_000_000;
const now = () => clock;

beforeEach(async () => {
  auth.dodId = ME;
  clock = 1_000_000;
  apiMock.mockReset();
  apiMock.mockResolvedValue({ ok: true });
  resetHeartbeatThrottle();
  await db.delete();
  await db.open();
  useUserStore.setState({ user: { dodId: ME, rank: 'SGT', firstName: 'Jane', lastName: 'Doe', mi: '', unit: 'WXYZA0' } });
  Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });
});

describe('client-status content', () => {
  it('counts only my completed, unconfirmed sessions and reports the oldest and latest error', async () => {
    await db.sessions.bulkPut([
      session('a', ME, { completedAt: '2026-05-03T10:00:00Z' }),
      session('b', ME, { completedAt: '2026-05-01T10:00:00Z' }),
      session('c', ME, { completedAt: '2026-04-01T10:00:00Z' }), // synced: not counted, not oldest
      session('d', ME, { completedAt: '2026-05-02T10:00:00Z' }),
      session('e', ME, { status: 'IN_PROGRESS', completedAt: undefined, createdAt: '2026-01-01T00:00:00Z' }),
      session('x', OTHER, { completedAt: '2025-01-01T00:00:00Z' }), // someone else's
    ]);
    await db.syncState.bulkPut([
      { sessionId: 'a', status: 'failed', attempts: 2, lastError: 'old error', lastAttempt: '2026-05-03T11:00:00Z' },
      { sessionId: 'b', status: 'failed', attempts: 1, lastError: 'x'.repeat(500), lastAttempt: '2026-05-04T11:00:00Z' },
      { sessionId: 'c', status: 'synced', attempts: 0, lastError: 'stale', lastAttempt: '2026-06-01T00:00:00Z' },
      { sessionId: 'x', status: 'failed', attempts: 9, lastError: 'OTHER SOLDIER ERROR', lastAttempt: '2027-01-01T00:00:00Z' },
    ]);

    const status = await collectClientStatus(ME);
    expect(status).toEqual({
      unsent_count: 3, // a, b, d (d has no syncState yet)
      failed_count: 2,
      last_error: 'x'.repeat(MAX_ERROR_LENGTH),
      oldest_unsent_at: '2026-05-01T10:00:00.000Z',
      app_version: APP_VERSION,
    });

    expect(await sendHeartbeat({ now })).toBe('sent');
    expect(heartbeatCalls()).toHaveLength(1);
    const [method, , opts] = heartbeatCalls()[0];
    expect(method).toBe('POST');
    expect(opts?.body).toEqual(status);
    expect(JSON.stringify(opts?.body)).not.toContain('OTHER SOLDIER');
  });

  it('sends zero counts without error/oldest fields when everything is synced', async () => {
    await db.sessions.put(session('a'));
    await db.syncState.put({ sessionId: 'a', status: 'synced', attempts: 0 });
    await sendHeartbeat({ now });
    expect(lastBody()).toEqual({ unsent_count: 0, failed_count: 0, app_version: APP_VERSION });
  });

  it('ignores timestamps that do not parse', async () => {
    await db.sessions.bulkPut([session('a', ME, { completedAt: 'garbage' }), session('b', ME, { completedAt: '2026-05-01T10:00:00+02:00' })]);
    expect((await collectClientStatus(ME)).oldest_unsent_at).toBe('2026-05-01T08:00:00.000Z');
  });

  it('app version comes from package.json', () => {
    expect(APP_VERSION).toMatch(/^\d+\.\d+\.\d+/);
  });
});

describe('throttling', () => {
  it('sends at most once per 5 minutes while the counts are unchanged', async () => {
    await db.sessions.put(session('a'));
    expect(await sendHeartbeat({ now })).toBe('sent');
    clock += 60_000;
    expect(await sendHeartbeat({ now })).toBe('throttled');
    clock += HEARTBEAT_MIN_INTERVAL_MS - 60_000 - 1;
    expect(await sendHeartbeat({ now })).toBe('throttled');
    clock += 1;
    expect(await sendHeartbeat({ now })).toBe('sent');
    expect(heartbeatCalls()).toHaveLength(2);
  });

  it('sends immediately when the counts change', async () => {
    await db.sessions.put(session('a'));
    await sendHeartbeat({ now });
    clock += 1000;
    await db.sessions.put(session('b'));
    expect(await sendHeartbeat({ now })).toBe('sent');
    expect(lastBody().unsent_count).toBe(2);
    clock += 1000;
    await db.syncState.put({ sessionId: 'a', status: 'failed', attempts: 1, lastError: 'boom' });
    expect(await sendHeartbeat({ now })).toBe('sent');
    expect(lastBody()).toMatchObject({ unsent_count: 2, failed_count: 1, last_error: 'boom' });
    clock += 1000;
    await db.syncState.bulkPut([
      { sessionId: 'a', status: 'synced', attempts: 0 },
      { sessionId: 'b', status: 'synced', attempts: 0 },
    ]);
    expect(await sendHeartbeat({ now })).toBe('sent');
    expect(lastBody()).toMatchObject({ unsent_count: 0, failed_count: 0 });
  });

  it('swallows failures and retries on the next call (a failure does not start the throttle)', async () => {
    await db.sessions.put(session('a'));
    apiMock.mockRejectedValueOnce(new NetworkError());
    expect(await sendHeartbeat({ now })).toBe('failed');
    apiMock.mockRejectedValueOnce(new ApiError('Server error', 500));
    expect(await sendHeartbeat({ now })).toBe('failed');
    expect(await sendHeartbeat({ now })).toBe('sent');
  });

  it('throttles per soldier', async () => {
    await db.sessions.bulkPut([session('a'), session('x', OTHER)]);
    await sendHeartbeat({ now });
    auth.dodId = OTHER;
    useUserStore.setState({ user: { dodId: OTHER, rank: 'SPC', firstName: 'O', lastName: 'T', mi: '', unit: 'WXYZA0' } });
    expect(await sendHeartbeat({ now })).toBe('sent');
    expect(lastBody().unsent_count).toBe(1);
  });
});

describe('when not to send', () => {
  it('skips offline, signed out, a mismatched user, and during a PIN-change lock', async () => {
    await db.sessions.put(session('a'));
    Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });
    expect(await sendHeartbeat({ now })).toBe('skipped');
    Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });

    auth.dodId = null;
    expect(await sendHeartbeat({ now })).toBe('skipped');

    auth.dodId = OTHER; // token is someone else's than the app user
    expect(await sendHeartbeat({ now })).toBe('skipped');

    auth.dodId = ME;
    useUserStore.setState({ user: { ...useUserStore.getState().user!, mustChangePin: true } });
    expect(await sendHeartbeat({ now })).toBe('skipped');

    expect(heartbeatCalls()).toHaveLength(0);
  });
});

describe('sync integration', () => {
  it('posts a heartbeat after every completed sync run, success or failure', async () => {
    apiMock.mockImplementation(async (_m: string, path: string, opts: { body?: unknown } = {}) => {
      if (path === '/inspections/sync') {
        const body = opts.body as { inspection: { client_session_id: string } };
        if (body.inspection.client_session_id === 'bad') throw new ApiError('Vehicle invalid', 400);
        return { inspection_id: 'r', vehicle_id: 'v', fault_ids: [] };
      }
      return { ok: true };
    });
    await db.sessions.bulkPut([session('good'), session('bad')]);
    await syncAll({ force: true });
    // heartbeat is fired after the run resolves; let it settle
    await vi.waitFor(() => expect(heartbeatCalls()).toHaveLength(1));
    expect(lastBody()).toMatchObject({ unsent_count: 1, failed_count: 1, last_error: 'Vehicle invalid' });
  });

  it('does not post while the PIN-change lock is on', async () => {
    useUserStore.setState({ user: { ...useUserStore.getState().user!, mustChangePin: true } });
    await db.sessions.put(session('a'));
    const r = await syncAll({ force: true });
    expect(r.skipped).toBe('pin-change');
    await new Promise((r) => setTimeout(r, 20));
    expect(apiMock).not.toHaveBeenCalled();
  });
});
