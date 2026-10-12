import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import Dexie from 'dexie';
import type { InspectionSession, PmcsVehicleData } from '../types';

const vehicleData: PmcsVehicleData = {
  vehicleType: 'M1101_TRAILER',
  tmReference: 'TM',
  zones: [
    { id: 'z1', name: 'Front', description: '', steps: [
      { id: 'b1', sequence: 1, zone: 'Front', zoneId: 'z1', item: '1', itemDescription: 'Before 1', procedure: '', conditionSet: 'BEFORE', isNoGo: false },
      { id: 'a1', sequence: 2, zone: 'Front', zoneId: 'z1', item: '2', itemDescription: 'After 1', procedure: '', conditionSet: 'AFTER', isNoGo: false },
      { id: 'b2', sequence: 3, zone: 'Front', zoneId: 'z1', item: '3', itemDescription: 'Before 2', procedure: '', conditionSet: 'BEFORE', isNoGo: true },
    ] },
    { id: 'z2', name: 'Rear', description: '', steps: [
      { id: 'w1', sequence: 4, zone: 'Rear', zoneId: 'z2', item: '4', itemDescription: 'Weekly 1', procedure: '', conditionSet: 'WEEKLY', isNoGo: false },
      { id: 'b3', sequence: 5, zone: 'Rear', zoneId: 'z2', item: '5', itemDescription: 'Before 3', procedure: '', conditionSet: 'BEFORE', isNoGo: false },
    ] },
  ],
};

vi.mock('../utils/loadPmcsData', () => ({ loadPmcsData: vi.fn(async () => vehicleData) }));

const { db, createDb, stepResultId } = await import('../utils/db');
const { useSessionStore, alignResults } = await import('../stores/sessionStore');

function session(id: string, type: InspectionSession['inspectionType'] = 'BEFORE'): InspectionSession {
  return {
    id, date: '2026-10-12', vehicleId: 'M1101_TRAILER-T1', vehicleType: 'M1101_TRAILER', bumperNumber: 'T1',
    odometer: 100, inspectorDodId: '1234567890', inspectorRank: 'SGT', inspectorName: 'A B', unit: 'WABC12',
    inspectionType: type, status: 'IN_PROGRESS', createdAt: new Date().toISOString(),
  };
}

beforeEach(async () => {
  useSessionStore.getState().clearSession();
  localStorage.clear();
  await db.delete();
  await db.open();
});

describe('sessionStore', () => {
  it('startSession filters steps by inspection type and scopes result ids to the session', async () => {
    await useSessionStore.getState().startSession(session('s1'), vehicleData);
    const st = useSessionStore.getState();
    expect(st.steps.map((s) => s.id)).toEqual(['b1', 'b2', 'b3']);
    expect(st.stepResults.map((r) => r.id)).toEqual(['s1:b1', 's1:b2', 's1:b3']);
  });

  it('refuses to start a session with zero steps', async () => {
    await expect(useSessionStore.getState().startSession(session('s0', 'MONTHLY'), vehicleData)).rejects.toThrow(/no PMCS items/);
    expect(await db.sessions.get('s0')).toBeUndefined();
  });

  it('30_DAY includes every item', async () => {
    await useSessionStore.getState().startSession(session('s30', '30_DAY'), vehicleData);
    expect(useSessionStore.getState().steps).toHaveLength(5);
  });

  it('restoreSession after reload uses the same filtered steps and pairs results by stepId', async () => {
    const store = useSessionStore.getState();
    await store.startSession(session('s1'), vehicleData);
    await useSessionStore.getState().updateStepStatus('b2', 'FAULT');
    useSessionStore.getState().jumpToStep(2);

    // simulate reload
    useSessionStore.setState({ currentSession: null, steps: [], stepResults: [], faults: [], currentStepIndex: 0 });
    expect(await useSessionStore.getState().restoreSession('s1')).toBe(true);
    const st = useSessionStore.getState();
    expect(st.steps.map((s) => s.id)).toEqual(['b1', 'b2', 'b3']);
    expect(st.stepResults.map((r) => r.stepId)).toEqual(['b1', 'b2', 'b3']);
    expect(st.stepResults[1].status).toBe('FAULT');
    expect(st.currentStepIndex).toBe(2);

    // taps after restore save to the right row
    await useSessionStore.getState().updateStepStatus('b3', 'GO');
    expect((await db.stepResults.get('s1:b3'))?.status).toBe('GO');
  });

  it('two inspections of the same type keep their own results', async () => {
    await useSessionStore.getState().startSession(session('s1'), vehicleData);
    await useSessionStore.getState().updateStepStatus('b1', 'FAULT');
    await useSessionStore.getState().completeSession();
    await useSessionStore.getState().startSession(session('s2'), vehicleData);
    await useSessionStore.getState().updateStepStatus('b1', 'GO');

    expect((await db.stepResults.get('s1:b1'))?.status).toBe('FAULT');
    expect((await db.stepResults.get('s2:b1'))?.status).toBe('GO');
    expect(await db.stepResults.where('sessionId').equals('s1').count()).toBe(3);
  });

  it('completeSession returns the completed session with remarks and completedAt', async () => {
    await useSessionStore.getState().startSession(session('s1'), vehicleData);
    const done = await useSessionStore.getState().completeSession('  Leaking hub  ');
    expect(done?.status).toBe('COMPLETED');
    expect(done?.remarks).toBe('Leaking hub');
    expect(done?.completedAt).toBeTruthy();
    expect((await db.sessions.get('s1'))?.remarks).toBe('Leaking hub');
  });

  it('restore tolerates legacy sr-<stepId> rows and missing rows', () => {
    const steps = vehicleData.zones.flatMap((z) => z.steps).filter((s) => s.conditionSet === 'BEFORE');
    const rows = [
      { id: 'sr-b2', sessionId: 's9', stepId: 'b2', sequence: 3, zone: 'Front', itemDescription: '', status: 'GO' as const, checkedAt: 'x' },
      { id: 'sr-a1', sessionId: 's9', stepId: 'a1', sequence: 2, zone: 'Front', itemDescription: '', status: 'GO' as const },
    ];
    const aligned = alignResults('s9', steps, rows);
    expect(aligned.map((r) => [r.stepId, r.status, r.id])).toEqual([
      ['b1', 'NOT_CHECKED', 's9:b1'], ['b2', 'GO', 's9:b2'], ['b3', 'NOT_CHECKED', 's9:b3'],
    ]);
  });

  it('discardSession removes an in-progress inspection only', async () => {
    await useSessionStore.getState().startSession(session('s1'), vehicleData);
    await useSessionStore.getState().discardSession('s1');
    expect(await db.sessions.get('s1')).toBeUndefined();
    expect(await db.stepResults.where('sessionId').equals('s1').count()).toBe(0);
    expect(useSessionStore.getState().currentSession).toBeNull();
  });
});

describe('Dexie v5 upgrade from the old app', () => {
  it('re-keys legacy sr-<stepId> step results to <session>:<step> and keeps everything else', async () => {
    const name = 'PMCSProDB-upgrade-test';
    await Dexie.delete(name);
    const old = new Dexie(name);
    old.version(4).stores({
      users: 'dodId', vehicles: 'id, type, bumperNumber', sessions: 'id, vehicleId, date, status, inspectorDodId',
      stepResults: 'id, sessionId', faults: 'id, sessionId, vehicleId, categoryId', photos: 'id, faultId, sessionId',
      uicLookup: 'uic', diagnosisAttempts: 'id, faultId, sessionId, categoryId', syncQueue: 'id',
    });
    await old.open();
    await old.table('sessions').put({ ...session('old1'), status: 'COMPLETED' });
    await old.table('stepResults').bulkPut([
      { id: 'sr-b1', sessionId: 'old1', stepId: 'b1', sequence: 1, zone: 'Front', itemDescription: '', status: 'GO' },
      { id: 'sr-b2', sessionId: 'old1', stepId: 'b2', sequence: 3, zone: 'Front', itemDescription: '', status: 'FAULT' },
    ]);
    await old.table('syncQueue').put({ id: 'old1', session: session('old1'), faults: [], attempts: 3, lastAttempt: 'x', createdAt: 'y' });
    old.close();

    const upgraded = createDb(name);
    await upgraded.open();
    const rows = await upgraded.stepResults.toArray();
    expect(rows.map((r) => r.id).sort()).toEqual([stepResultId('old1', 'b1'), stepResultId('old1', 'b2')].sort());
    expect(await upgraded.syncQueue.count()).toBe(1);
    expect((await upgraded.sessions.get('old1'))?.status).toBe('COMPLETED');
    upgraded.close();
    await Dexie.delete(name);
  });
});
