import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { InspectionSession, Fault, FaultPhoto } from '../types';

const ME = '1111111111';
const OTHER = '2222222222';

const auth = vi.hoisted(() => ({ dodId: '1111111111' as string | null }));

vi.mock('../utils/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../utils/api')>();
  return { ...actual, api: vi.fn(), getSessionDodId: vi.fn(() => auth.dodId) };
});

const apiModule = await import('../utils/api');
const { ApiError, NetworkError } = apiModule;
const apiMock = vi.mocked(apiModule.api);
const { db } = await import('../utils/db');
const { syncAll, recoverLocalData, queueFaultResolution } = await import('../utils/syncEngine');
const { useUserStore } = await import('../stores/userStore');

type Call = { method: string; path: string; body?: unknown; query?: unknown };
let calls: Call[] = [];
let serverFault: ((c: Call) => unknown) | null = null;
let syncDelay = 0;

function installServer() {
  apiMock.mockImplementation(async (method: string, path: string, opts: { body?: unknown; query?: unknown } = {}) => {
    const call = { method, path, body: opts.body, query: opts.query };
    calls.push(call);
    if (serverFault) {
      const r = serverFault(call);
      if (r instanceof Error) throw r;
    }
    if (method === 'POST' && path === '/inspections/sync') {
      if (syncDelay) await new Promise((r) => setTimeout(r, syncDelay));
      const body = opts.body as { inspection: { client_session_id: string }; faults: { client_fault_id: string }[] };
      return {
        inspection_id: `remote-${body.inspection.client_session_id}`,
        vehicle_id: 'veh-1',
        fault_ids: body.faults.map((f) => `remote-${f.client_fault_id}`),
      };
    }
    return { ok: true, url: 'https://x/y' };
  });
}

function oldSession(id: string, dodId = ME, extra: Partial<InspectionSession> = {}): InspectionSession {
  return {
    id, date: '2026-04-02', vehicleId: 'M1151-HQ31', vehicleType: 'M1151', bumperNumber: 'HQ-31', odometer: 34218,
    inspectorDodId: dodId, inspectorRank: 'SGT', inspectorName: 'Jane Doe', unit: 'wabc12', inspectionType: 'BEFORE',
    status: 'COMPLETED', createdAt: '2026-04-02T12:00:00.000Z', completedAt: '2026-04-02T12:30:00.000Z',
    remarks: 'Real remarks', ...extra,
  };
}

function oldFault(id: string, sessionId: string, createdAt: string): Fault {
  return {
    id, sessionId, vehicleId: 'M1151-HQ31', stepId: 'm1151-b-01', zone: 'Front', item: '1', itemDescription: 'Tires',
    categoryId: 'tire', readiness: 'NMC', description: 'Flat', partNeeded: false, correctedOnSite: false,
    needsMaintenance: true, createdAt,
  };
}

const PNG = 'data:image/jpeg;base64,' + btoa('fakejpeg');

/** Exactly what the old app left on the owner's phone. */
async function seedOldAppData() {
  // 1) completed + old queue entry that gave up (attempts=3); queue snapshot has stale remarks
  const s1 = oldSession('sess-stuck');
  await db.sessions.put(s1);
  await db.syncQueue.put({ id: s1.id, session: { ...s1, remarks: undefined }, faults: [], attempts: 3, lastAttempt: '2026-04-02T13:00:00Z', createdAt: '2026-04-02T12:31:00Z' });
  const f1 = oldFault('fault-a', s1.id, '2026-04-02T12:10:00Z');
  const f2 = oldFault('fault-b', s1.id, '2026-04-02T12:20:00Z');
  await db.faults.bulkPut([f2, f1]);
  const photo: FaultPhoto = { id: 'photo-1', faultId: 'fault-b', sessionId: s1.id, dataUrl: PNG, createdAt: 'x' };
  await db.photos.put(photo);
  await db.diagnosisAttempts.put({ id: 'diag-1', faultId: 'fault-a', sessionId: s1.id, categoryId: 'tire', stepsCompleted: [], outcome: 'needs-maintenance', readinessResult: 'NMC', completedAt: 'x' });
  await db.stepResults.bulkPut([
    { id: 'sr-m1151-b-01', sessionId: s1.id, stepId: 'm1151-b-01', sequence: 1, zone: 'Front', itemDescription: 'Tires', status: 'FAULT' },
  ]);
  // 2) completed, never queued
  await db.sessions.put(oldSession('sess-never-queued', ME, { completedAt: '2026-05-01T10:00:00Z' }));
  // 3) a queue entry whose session row is missing entirely
  const s3 = oldSession('sess-queue-only', ME, { completedAt: '2026-06-01T10:00:00Z' });
  await db.syncQueue.put({ id: s3.id, session: s3, faults: [oldFault('fault-q', s3.id, 'x')], attempts: 5, lastAttempt: null, createdAt: 'z' });
  // 4) someone else's on a shared phone
  await db.sessions.put(oldSession('sess-other-user', OTHER));
  // 5) in progress — must not be sent
  await db.sessions.put(oldSession('sess-in-progress', ME, { status: 'IN_PROGRESS', completedAt: undefined }));
}

beforeEach(async () => {
  calls = [];
  serverFault = null;
  syncDelay = 0;
  auth.dodId = ME;
  apiMock.mockReset();
  installServer();
  await db.delete();
  await db.open();
  useUserStore.setState({ user: { dodId: ME, rank: 'SGT', firstName: 'Jane', lastName: 'Doe', mi: '', unit: 'WABC12' } });
  Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });
});

const syncCalls = () => calls.filter((c) => c.path === '/inspections/sync');

describe('recovery of old-app data', () => {
  it('sends every completed session of the user, including stuck and never-queued ones', async () => {
    await seedOldAppData();
    const r = await syncAll({ force: true });
    expect(r.synced).toBe(3);

    const sent = syncCalls().map((c) => (c.body as { inspection: { client_session_id: string } }).inspection.client_session_id).sort();
    expect(sent).toEqual(['sess-never-queued', 'sess-queue-only', 'sess-stuck']);

    for (const id of sent) expect((await db.syncState.get(id))?.status).toBe('synced');
    expect(await db.syncQueue.count()).toBe(0);
    // queue-only session was restored into the sessions table with its faults
    expect((await db.sessions.get('sess-queue-only'))?.status).toBe('COMPLETED');
    expect(await db.faults.get('fault-q')).toBeTruthy();
    // other user's stays pending, in-progress is never sent
    expect((await db.syncState.get('sess-other-user'))?.status).toBe('pending');
    expect(await db.syncState.get('sess-in-progress')).toBeUndefined();
  });

  it('uses the real session (remarks, completedAt), client_fault_id and the user unit uppercased', async () => {
    await seedOldAppData();
    await syncAll({ force: true });
    const body = syncCalls().find((c) => (c.body as { inspection: { client_session_id: string } }).inspection.client_session_id === 'sess-stuck')!.body as {
      vehicle: { unit: string }; inspection: { remarks: string; completed_at: string }; faults: { client_fault_id: string }[];
    };
    expect(body.inspection.remarks).toBe('Real remarks');
    expect(body.inspection.completed_at).toBe('2026-04-02T12:30:00.000Z');
    expect(body.vehicle.unit).toBe('WABC12');
    expect(body.faults.map((f) => f.client_fault_id)).toEqual(['fault-a', 'fault-b']);
  });

  it('uploads photos to the server fault id and diagnosis attempts with server fault ids', async () => {
    await seedOldAppData();
    await syncAll({ force: true });
    const photoCall = calls.find((c) => c.path.includes('/photos'))!;
    expect(photoCall.path).toBe('/faults/remote-fault-b/photos');
    expect(photoCall.query).toMatchObject({ session: 'sess-stuck', photo: 'photo-1', ext: 'jpg' });
    const diag = calls.find((c) => c.path === '/diagnosis-attempts')!;
    expect(diag.body).toEqual([expect.objectContaining({ id: 'diag-1', fault_id: 'remote-fault-a', session_id: 'sess-stuck', outcome: 'needs-maintenance' })]);
    const st = await db.syncState.get('sess-stuck');
    expect(st).toMatchObject({ status: 'synced', remoteInspectionId: 'remote-sess-stuck', uploadedPhotoIds: ['photo-1'], diagnosisUploaded: true });
  });

  it('asks the server for the DA 2404 once per inspection, with the supervisor from the phone', async () => {
    await db.sessions.put({ ...oldSession('with-sup'), supervisorName: 'SSG Example', supervisorDodId: '1234567890' });
    await syncAll({ force: true });
    const form = calls.filter((c) => c.path === '/inspections/remote-with-sup/da2404');
    expect(form).toHaveLength(1);
    expect(form[0].method).toBe('POST');
    expect(form[0].body).toMatchObject({ supervisor_name: 'SSG Example', supervisor_dod_id: '1234567890' });
    expect((await db.syncState.get('with-sup'))?.formCreated).toBe(true);
    await db.syncState.update('with-sup', { status: 'pending' });
    await syncAll({ force: true });
    expect(calls.filter((c) => c.path === '/inspections/remote-with-sup/da2404')).toHaveLength(1);
  });

  it('recoverLocalData creates pending sync rows without network', async () => {
    await seedOldAppData();
    await recoverLocalData();
    expect((await db.syncState.get('sess-never-queued'))?.status).toBe('pending');
    expect((await db.syncState.get('sess-stuck'))?.status).toBe('failed');
    expect((await db.syncState.get('sess-stuck'))?.attempts).toBe(0);
  });

  it('a session already on the server is just re-confirmed (idempotent)', async () => {
    await db.sessions.put(oldSession('dup'));
    await syncAll({ force: true });
    await db.syncState.update('dup', { status: 'pending' });
    await syncAll({ force: true });
    expect(syncCalls()).toHaveLength(2);
    expect((await db.syncState.get('dup'))?.status).toBe('synced');
  });
});

describe('reliability', () => {
  it('single-flight: concurrent runs share one pass', async () => {
    await db.sessions.put(oldSession('s1'));
    syncDelay = 30;
    const [a, b, c] = await Promise.all([syncAll(), syncAll(), syncAll()]);
    expect(a).toBe(b);
    expect(b).toBe(c);
    expect(syncCalls()).toHaveLength(1);
  });

  it('a forced request during a run queues one follow-up run instead of overlapping', async () => {
    await db.sessions.put(oldSession('s1'));
    syncDelay = 30;
    const p1 = syncAll();
    const p2 = syncAll({ force: true });
    const p3 = syncAll({ force: true });
    expect(p2).toBe(p3);
    await Promise.all([p1, p2]);
    expect(syncCalls()).toHaveLength(1); // second run found it already synced
  });

  it('server errors use exponential backoff and never give up', async () => {
    await db.sessions.put(oldSession('s1'));
    serverFault = (c) => (c.path === '/inspections/sync' ? new ApiError('trigger exploded', 500) : undefined);

    await syncAll();
    let st = await db.syncState.get('s1');
    expect(st).toMatchObject({ status: 'failed', attempts: 1, lastError: 'trigger exploded' });
    const firstNext = Date.parse(st!.nextAttemptAt!);

    await syncAll(); // within backoff: skipped
    expect(syncCalls()).toHaveLength(1);

    await syncAll({ force: true }); // forced: retried
    st = await db.syncState.get('s1');
    expect(st!.attempts).toBe(2);
    expect(Date.parse(st!.nextAttemptAt!) - Date.now()).toBeGreaterThan(firstNext - Date.now());

    // far past the old cap of 3
    await db.syncState.update('s1', { attempts: 25, nextAttemptAt: new Date(Date.now() - 1000).toISOString() });
    serverFault = null;
    const r = await syncAll();
    expect(r.synced).toBe(1);
    expect((await db.syncState.get('s1'))?.status).toBe('synced');
  });

  it('401 is not counted as an attempt and stops the run', async () => {
    await db.sessions.put(oldSession('s1'));
    await db.sessions.put(oldSession('s2', ME, { completedAt: '2026-04-03T00:00:00Z' }));
    serverFault = (c) => (c.path === '/inspections/sync' ? new ApiError('Unauthorized', 401) : undefined);
    const r = await syncAll({ force: true });
    expect(r.authFailed).toBe(true);
    expect(syncCalls()).toHaveLength(1);
    const st = await db.syncState.get('s1');
    expect(st!.attempts).toBe(0);
    expect(st!.status).toBe('pending');
  });

  it('not signed in: nothing is sent and nothing is counted', async () => {
    await db.sessions.put(oldSession('s1'));
    auth.dodId = null;
    const r = await syncAll({ force: true });
    expect(r.skipped).toBe('signed-out');
    expect(calls).toHaveLength(0);
    expect(await db.syncState.get('s1')).toMatchObject({ status: 'pending', attempts: 0 });
  });

  it('offline: skipped without attempts', async () => {
    await db.sessions.put(oldSession('s1'));
    Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });
    const r = await syncAll({ force: true });
    expect(r.skipped).toBe('offline');
    expect(calls).toHaveLength(0);
  });

  it('network errors are not counted', async () => {
    await db.sessions.put(oldSession('s1'));
    serverFault = () => new NetworkError();
    const r = await syncAll({ force: true });
    expect(r.networkFailed).toBe(true);
    expect(await db.syncState.get('s1')).toMatchObject({ status: 'pending', attempts: 0 });
  });

  it('only syncs sessions of the signed-in user; the other user syncs when they sign in', async () => {
    await db.sessions.put(oldSession('mine'));
    await db.sessions.put(oldSession('theirs', OTHER));
    await syncAll({ force: true });
    expect(syncCalls()).toHaveLength(1);
    expect((await db.syncState.get('theirs'))?.status).toBe('pending');

    auth.dodId = OTHER;
    useUserStore.setState({ user: { dodId: OTHER, rank: '', firstName: '', lastName: '', mi: '', unit: 'WXYZ99' } });
    await syncAll({ force: true });
    expect((await db.syncState.get('theirs'))?.status).toBe('synced');
  });

  it('a failed photo upload keeps the session unsynced; the retry only re-sends what is missing', async () => {
    await seedOldAppData();
    serverFault = (c) => (c.path.includes('/photos') ? new ApiError('R2 down', 503) : undefined);
    await syncAll({ force: true });
    let st = await db.syncState.get('sess-stuck');
    expect(st!.status).toBe('failed');
    expect(st!.remoteInspectionId).toBe('remote-sess-stuck');
    expect(st!.lastError).toBe('R2 down');

    serverFault = null;
    calls = [];
    await syncAll({ force: true });
    st = await db.syncState.get('sess-stuck');
    expect(st!.status).toBe('synced');
    expect(calls.filter((c) => c.path.includes('/photos'))).toHaveLength(1);
  });

  it('queued prior-fault resolutions are flushed', async () => {
    await queueFaultResolution(['f1', 'f2'], 'CORRECTED', ME);
    await syncAll({ force: true });
    expect(calls.find((c) => c.method === 'PATCH')?.body).toEqual({ ids: ['f1', 'f2'], resolution_status: 'CORRECTED' });
    expect(await db.pendingFaultResolutions.count()).toBe(0);
  });
});
