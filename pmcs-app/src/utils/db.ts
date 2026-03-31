import Dexie, { type EntityTable } from 'dexie';
import type { User, Vehicle, InspectionSession, StepResult, Fault, FaultPhoto } from '../types';
import type { DiagnosisAttempt } from '../types/diagnosis';

export interface UicEntry {
  uic: string;
  unitName: string;
}

export interface SyncQueueEntry {
  id: string;
  session: InspectionSession;
  faults: Fault[];
  attempts: number;
  lastAttempt: string | null;
  createdAt: string;
}

const db = new Dexie('PMCSProDB') as Dexie & {
  users: EntityTable<User, 'dodId'>;
  vehicles: EntityTable<Vehicle, 'id'>;
  sessions: EntityTable<InspectionSession, 'id'>;
  stepResults: EntityTable<StepResult, 'id'>;
  faults: EntityTable<Fault, 'id'>;
  photos: EntityTable<FaultPhoto, 'id'>;
  uicLookup: EntityTable<UicEntry, 'uic'>;
  diagnosisAttempts: EntityTable<DiagnosisAttempt, 'id'>;
  syncQueue: EntityTable<SyncQueueEntry, 'id'>;
};

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
  users: 'dodId',
  vehicles: 'id, type, bumperNumber',
  sessions: 'id, vehicleId, date, status, inspectorDodId',
  stepResults: 'id, sessionId',
  faults: 'id, sessionId, vehicleId, categoryId',
  photos: 'id, faultId, sessionId',
  uicLookup: 'uic',
  diagnosisAttempts: 'id, faultId, sessionId, categoryId',
});

db.version(4).stores({
  users: 'dodId',
  vehicles: 'id, type, bumperNumber',
  sessions: 'id, vehicleId, date, status, inspectorDodId',
  stepResults: 'id, sessionId',
  faults: 'id, sessionId, vehicleId, categoryId',
  photos: 'id, faultId, sessionId',
  uicLookup: 'uic',
  diagnosisAttempts: 'id, faultId, sessionId, categoryId',
  syncQueue: 'id',
});

export { db };
