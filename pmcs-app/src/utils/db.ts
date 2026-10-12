import Dexie, { type EntityTable } from 'dexie';
import type { User, Vehicle, InspectionSession, StepResult, Fault, FaultPhoto } from '../types';
import type { DiagnosisAttempt } from '../types/diagnosis';

export interface UicEntry {
  uic: string;
  unitName: string;
}

/** Legacy (v4) retry queue. Kept so old entries can be recovered; no longer written. */
export interface SyncQueueEntry {
  id: string;
  session: InspectionSession;
  faults: Fault[];
  attempts: number;
  lastAttempt: string | null;
  createdAt: string;
}

export type SyncStatus = 'pending' | 'synced' | 'failed';

/** Per-session server sync state. A session is only "synced" once the server confirmed everything. */
export interface SyncStateEntry {
  sessionId: string;
  status: SyncStatus;
  remoteInspectionId?: string;
  /** local fault id → server fault id */
  remoteFaultIds?: Record<string, string>;
  /** local photo ids already uploaded */
  uploadedPhotoIds?: string[];
  diagnosisUploaded?: boolean;
  lastError?: string;
  attempts: number;
  lastAttempt?: string;
  /** ISO time before which automatic retries are skipped (exponential backoff). */
  nextAttemptAt?: string;
  syncedAt?: string;
}

/** A prior-fault "Fixed"/"Acknowledged" decision that still needs to reach the server. */
export interface PendingFaultResolution {
  id: string;
  faultIds: string[];
  resolutionStatus: 'CORRECTED' | 'ACKNOWLEDGED';
  dodId: string;
  createdAt: string;
  attempts: number;
  lastError?: string;
  nextAttemptAt?: string;
}

export type PmcsDB = Dexie & {
  users: EntityTable<User, 'dodId'>;
  vehicles: EntityTable<Vehicle, 'id'>;
  sessions: EntityTable<InspectionSession, 'id'>;
  stepResults: EntityTable<StepResult, 'id'>;
  faults: EntityTable<Fault, 'id'>;
  photos: EntityTable<FaultPhoto, 'id'>;
  uicLookup: EntityTable<UicEntry, 'uic'>;
  diagnosisAttempts: EntityTable<DiagnosisAttempt, 'id'>;
  syncQueue: EntityTable<SyncQueueEntry, 'id'>;
  syncState: EntityTable<SyncStateEntry, 'sessionId'>;
  pendingFaultResolutions: EntityTable<PendingFaultResolution, 'id'>;
};

/** Step result ids are scoped to their session so inspections never overwrite each other. */
export function stepResultId(sessionId: string, stepId: string): string {
  return `${sessionId}:${stepId}`;
}

export function createDb(name = 'PMCSProDB'): PmcsDB {
  const db = new Dexie(name) as PmcsDB;

  db.version(2).stores({
    users: 'dodId',
    vehicles: 'id, type, bumperNumber',
    sessions: 'id, vehicleId, date, status, inspectorDodId',
    stepResults: 'id, sessionId',
    faults: 'id, sessionId, vehicleId',
    photos: 'id, faultId, sessionId',
    uicLookup: 'uic',
  });

  db.version(3).stores({
    faults: 'id, sessionId, vehicleId, categoryId',
    diagnosisAttempts: 'id, faultId, sessionId, categoryId',
  });

  db.version(4).stores({
    syncQueue: 'id',
  });

  // v5: per-session sync state, queued prior-fault resolutions, and session-scoped
  // step result ids (old ids were `sr-<stepId>`, shared across sessions).
  db.version(5)
    .stores({
      syncState: 'sessionId, status',
      pendingFaultResolutions: 'id, dodId',
    })
    .upgrade(async (tx) => {
      const table = tx.table<StepResult, string>('stepResults');
      const legacy = await table.filter((r) => typeof r.id === 'string' && r.id.startsWith('sr-')).toArray();
      for (const r of legacy) {
        const newId = stepResultId(r.sessionId, r.stepId);
        await table.delete(r.id);
        // If a newer-format row already exists for this session+step keep it.
        const existing = await table.get(newId);
        if (!existing) await table.put({ ...r, id: newId });
      }
    });

  return db;
}

const db = createDb();

export { db };
