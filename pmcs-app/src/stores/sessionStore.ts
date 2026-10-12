import { create } from 'zustand';
import { db, stepResultId } from '../utils/db';
import { loadPmcsData } from '../utils/loadPmcsData';
import { stepsForInspection } from '../utils/inspectionTypes';
import type {
  InspectionSession, StepResult, Fault, FaultPhoto,
  PmcsStepData, PmcsVehicleData, StepStatus, VehicleType,
} from '../types';

const PERSIST_KEY = 'pmcs_active_session';

function persistActiveSession(sessionId: string, stepIndex: number) {
  try {
    localStorage.setItem(PERSIST_KEY, JSON.stringify({ sessionId, stepIndex }));
  } catch {
    // ignore
  }
}

export function clearPersistedSession() {
  try {
    localStorage.removeItem(PERSIST_KEY);
  } catch {
    // ignore
  }
}

export function getPersistedSession(): { sessionId: string; stepIndex: number } | null {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(PERSIST_KEY);
  } catch {
    return null;
  }
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function blankResult(sessionId: string, step: PmcsStepData): StepResult {
  return {
    id: stepResultId(sessionId, step.id),
    sessionId,
    stepId: step.id,
    sequence: step.sequence,
    zone: step.zone,
    itemDescription: step.itemDescription,
    status: 'NOT_CHECKED',
  };
}

/**
 * Builds one result per step, in step order, from whatever rows exist in Dexie.
 * Tolerates legacy `sr-<stepId>` rows and rows for steps no longer in the data.
 */
export function alignResults(sessionId: string, steps: PmcsStepData[], rows: StepResult[]): StepResult[] {
  const byStep = new Map<string, StepResult>();
  for (const r of rows) {
    if (r.sessionId !== sessionId) continue;
    const prev = byStep.get(r.stepId);
    // Prefer a checked row over NOT_CHECKED, then the newest
    if (!prev || (prev.status === 'NOT_CHECKED' && r.status !== 'NOT_CHECKED') ||
        (r.status !== 'NOT_CHECKED' && (r.checkedAt ?? '') > (prev.checkedAt ?? ''))) {
      byStep.set(r.stepId, r);
    }
  }
  return steps.map((s) => {
    const r = byStep.get(s.id);
    return r ? { ...r, id: stepResultId(sessionId, s.id) } : blankResult(sessionId, s);
  });
}

interface SessionState {
  currentSession: InspectionSession | null;
  steps: PmcsStepData[];
  stepResults: StepResult[];
  faults: Fault[];
  currentStepIndex: number;

  startSession: (session: InspectionSession, vehicleData: PmcsVehicleData) => Promise<void>;
  /** Loads a session (in progress or completed) from Dexie into the store. */
  restoreSession: (sessionId: string) => Promise<boolean>;
  updateStepStatus: (stepId: string, status: StepStatus) => Promise<void>;
  addFault: (fault: Fault) => Promise<void>;
  updateFault: (faultId: string, updates: Partial<Fault>) => Promise<void>;
  removeFault: (faultId: string) => Promise<void>;
  nextStep: () => void;
  prevStep: () => void;
  jumpToStep: (index: number) => void;
  completeSession: (remarks?: string, extra?: Partial<InspectionSession>) => Promise<InspectionSession | null>;
  addPhoto: (photo: FaultPhoto) => Promise<void>;
  /** Saves draft fields (remarks, supervisor) on the in-progress session. */
  updateSession: (updates: Partial<Pick<InspectionSession, 'remarks' | 'supervisorName' | 'supervisorDodId'>>) => Promise<void>;
  /** Detaches the in-memory session (data stays in Dexie and can be resumed). */
  clearSession: () => void;
  /** Deletes an in-progress session and everything recorded for it. */
  discardSession: (sessionId: string) => Promise<void>;
}

export const useSessionStore = create<SessionState>((set, get) => ({
  currentSession: null,
  steps: [],
  stepResults: [],
  faults: [],
  currentStepIndex: 0,

  startSession: async (session, vehicleData) => {
    const steps = stepsForInspection(vehicleData, session.inspectionType);
    if (steps.length === 0) {
      throw new Error('This vehicle has no PMCS items for that inspection type.');
    }
    const stepResults = steps.map((s) => blankResult(session.id, s));
    await db.transaction('rw', db.sessions, db.stepResults, async () => {
      await db.sessions.put(session);
      await db.stepResults.bulkPut(stepResults);
    });
    persistActiveSession(session.id, 0);
    set({ currentSession: session, steps, stepResults, faults: [], currentStepIndex: 0 });
  },

  restoreSession: async (sessionId: string) => {
    const session = await db.sessions.get(sessionId);
    if (!session) {
      if (getPersistedSession()?.sessionId === sessionId) clearPersistedSession();
      return false;
    }

    const vehicleData = await loadPmcsData(session.vehicleType as VehicleType);
    const steps = stepsForInspection(vehicleData, session.inspectionType);
    const rows = await db.stepResults.where('sessionId').equals(sessionId).toArray();
    const stepResults = alignResults(sessionId, steps, rows);
    const faults = (await db.faults.where('sessionId').equals(sessionId).toArray())
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));

    let stepIndex = 0;
    const persisted = getPersistedSession();
    if (session.status === 'IN_PROGRESS') {
      if (persisted?.sessionId === sessionId) {
        stepIndex = persisted.stepIndex || 0;
      } else {
        const firstUnchecked = stepResults.findIndex((r) => r.status === 'NOT_CHECKED');
        stepIndex = firstUnchecked >= 0 ? firstUnchecked : 0;
      }
      stepIndex = Math.max(0, Math.min(stepIndex, steps.length - 1));
      persistActiveSession(sessionId, stepIndex);
    }

    set({ currentSession: session, steps, stepResults, faults, currentStepIndex: stepIndex });
    return true;
  },

  updateStepStatus: async (stepId, status) => {
    const { stepResults, currentSession } = get();
    if (!currentSession) return;
    const now = new Date().toISOString();
    const updated = stepResults.map((sr) =>
      sr.stepId === stepId ? { ...sr, status, checkedAt: now } : sr
    );
    const result = updated.find((sr) => sr.stepId === stepId);
    set({ stepResults: updated });
    if (result) await db.stepResults.put({ ...result, id: stepResultId(currentSession.id, stepId) });
  },

  addFault: async (fault) => {
    await db.faults.put(fault);
    set((s) => ({ faults: [...s.faults.filter((f) => f.id !== fault.id), fault] }));
  },

  updateFault: async (faultId, updates) => {
    const { faults } = get();
    const updated = faults.map((f) => (f.id === faultId ? { ...f, ...updates } : f));
    const fault = updated.find((f) => f.id === faultId);
    if (fault) await db.faults.put(fault);
    set({ faults: updated });
  },

  removeFault: async (faultId) => {
    await db.transaction('rw', db.faults, db.photos, db.diagnosisAttempts, async () => {
      await db.faults.delete(faultId);
      await db.photos.where('faultId').equals(faultId).delete();
      await db.diagnosisAttempts.where('faultId').equals(faultId).delete();
    });
    set((s) => ({ faults: s.faults.filter((f) => f.id !== faultId) }));
  },

  nextStep: () => set((s) => {
    const idx = Math.max(0, Math.min(s.currentStepIndex + 1, s.steps.length - 1));
    if (s.currentSession) persistActiveSession(s.currentSession.id, idx);
    return { currentStepIndex: idx };
  }),

  prevStep: () => set((s) => {
    const idx = Math.max(s.currentStepIndex - 1, 0);
    if (s.currentSession) persistActiveSession(s.currentSession.id, idx);
    return { currentStepIndex: idx };
  }),

  jumpToStep: (index) => {
    const { currentSession, steps } = get();
    const idx = Math.max(0, Math.min(index, steps.length - 1));
    if (currentSession) persistActiveSession(currentSession.id, idx);
    set({ currentStepIndex: idx });
  },

  completeSession: async (remarks, extra) => {
    const { currentSession } = get();
    if (!currentSession) return null;
    const completed: InspectionSession = {
      ...currentSession,
      ...(extra ?? {}),
      status: 'COMPLETED',
      completedAt: currentSession.completedAt ?? new Date().toISOString(),
      remarks: remarks?.trim() ? remarks.trim() : currentSession.remarks,
    };
    await db.sessions.put(completed);
    clearPersistedSession();
    set({ currentSession: completed });
    return completed;
  },

  addPhoto: async (photo) => {
    await db.photos.put(photo);
  },

  updateSession: async (updates) => {
    const { currentSession } = get();
    if (!currentSession) return;
    const updated = { ...currentSession, ...updates };
    await db.sessions.put(updated);
    set({ currentSession: updated });
  },

  clearSession: () => {
    clearPersistedSession();
    set({
      currentSession: null,
      steps: [],
      stepResults: [],
      faults: [],
      currentStepIndex: 0,
    });
  },

  discardSession: async (sessionId) => {
    const session = await db.sessions.get(sessionId);
    if (session && session.status !== 'IN_PROGRESS') {
      throw new Error('Only in-progress inspections can be discarded');
    }
    await db.transaction('rw', [db.sessions, db.stepResults, db.faults, db.photos, db.diagnosisAttempts], async () => {
      await db.stepResults.where('sessionId').equals(sessionId).delete();
      await db.faults.where('sessionId').equals(sessionId).delete();
      await db.photos.where('sessionId').equals(sessionId).delete();
      await db.diagnosisAttempts.where('sessionId').equals(sessionId).delete();
      await db.sessions.delete(sessionId);
    });
    if (get().currentSession?.id === sessionId) get().clearSession();
    else if (getPersistedSession()?.sessionId === sessionId) clearPersistedSession();
  },
}));
