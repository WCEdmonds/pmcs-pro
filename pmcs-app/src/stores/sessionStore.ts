import { create } from 'zustand';
import { db } from '../utils/db';
import { loadPmcsData } from '../utils/loadPmcsData';
import type {
  InspectionSession, StepResult, Fault, FaultPhoto,
  PmcsStepData, PmcsVehicleData, StepStatus, VehicleType,
} from '../types';

const PERSIST_KEY = 'pmcs_active_session';

function persistActiveSession(sessionId: string, stepIndex: number) {
  localStorage.setItem(PERSIST_KEY, JSON.stringify({ sessionId, stepIndex }));
}

function clearPersistedSession() {
  localStorage.removeItem(PERSIST_KEY);
}

export function getPersistedSession(): { sessionId: string; stepIndex: number } | null {
  const raw = localStorage.getItem(PERSIST_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

interface SessionState {
  currentSession: InspectionSession | null;
  steps: PmcsStepData[];
  stepResults: StepResult[];
  faults: Fault[];
  currentStepIndex: number;

  startSession: (session: InspectionSession, vehicleData: PmcsVehicleData) => void;
  restoreSession: (sessionId: string) => Promise<boolean>;
  updateStepStatus: (stepId: string, status: StepStatus) => Promise<void>;
  addFault: (fault: Fault) => Promise<void>;
  updateFault: (faultId: string, updates: Partial<Fault>) => Promise<void>;
  removeFault: (faultId: string) => Promise<void>;
  nextStep: () => void;
  prevStep: () => void;
  jumpToStep: (index: number) => void;
  completeSession: (remarks?: string) => Promise<void>;
  addPhoto: (photo: FaultPhoto) => Promise<void>;
  clearSession: () => void;
}

export const useSessionStore = create<SessionState>((set, get) => ({
  currentSession: null,
  steps: [],
  stepResults: [],
  faults: [],
  currentStepIndex: 0,

  startSession: (session, vehicleData) => {
    const inspType = session.inspectionType;
    const allSteps = vehicleData.zones
      .flatMap((z) => z.steps)
      .filter((s) => {
        if (inspType === '30_DAY') return true;
        return s.conditionSet === inspType;
      });
    const stepResults: StepResult[] = allSteps.map((s) => ({
      id: `sr-${s.id}`,
      sessionId: session.id,
      stepId: s.id,
      sequence: s.sequence,
      zone: s.zone,
      itemDescription: s.itemDescription,
      status: 'NOT_CHECKED' as const,
    }));
    db.sessions.put(session);
    db.stepResults.bulkPut(stepResults);
    persistActiveSession(session.id, 0);
    set({ currentSession: session, steps: allSteps, stepResults, faults: [], currentStepIndex: 0 });
  },

  restoreSession: async (sessionId: string) => {
    const session = await db.sessions.get(sessionId);
    if (!session || session.status !== 'IN_PROGRESS') {
      clearPersistedSession();
      return false;
    }

    // Reload PMCS data for this vehicle type
    const vehicleData = await loadPmcsData(session.vehicleType as VehicleType);
    const allSteps = vehicleData.zones.flatMap((z) => z.steps);

    // Load step results and faults from Dexie
    const stepResults = await db.stepResults.where('sessionId').equals(sessionId).toArray();
    const faults = await db.faults.where('sessionId').equals(sessionId).toArray();

    // Restore step index from localStorage
    const persisted = getPersistedSession();
    const stepIndex = persisted?.stepIndex || 0;

    set({ currentSession: session, steps: allSteps, stepResults, faults, currentStepIndex: stepIndex });
    return true;
  },

  updateStepStatus: async (stepId, status) => {
    const { stepResults } = get();
    const updated = stepResults.map((sr) =>
      sr.stepId === stepId ? { ...sr, status, checkedAt: new Date().toISOString() } : sr
    );
    const result = updated.find((sr) => sr.stepId === stepId);
    if (result) await db.stepResults.put(result);
    set({ stepResults: updated });
  },

  addFault: async (fault) => {
    await db.faults.put(fault);
    set((s) => ({ faults: [...s.faults, fault] }));
  },

  updateFault: async (faultId, updates) => {
    const { faults } = get();
    const updated = faults.map((f) => (f.id === faultId ? { ...f, ...updates } : f));
    const fault = updated.find((f) => f.id === faultId);
    if (fault) await db.faults.put(fault);
    set({ faults: updated });
  },

  removeFault: async (faultId) => {
    await db.faults.delete(faultId);
    set((s) => ({ faults: s.faults.filter((f) => f.id !== faultId) }));
  },

  nextStep: () => set((s) => {
    const idx = Math.min(s.currentStepIndex + 1, s.steps.length - 1);
    if (s.currentSession) persistActiveSession(s.currentSession.id, idx);
    return { currentStepIndex: idx };
  }),

  prevStep: () => set((s) => {
    const idx = Math.max(s.currentStepIndex - 1, 0);
    if (s.currentSession) persistActiveSession(s.currentSession.id, idx);
    return { currentStepIndex: idx };
  }),

  jumpToStep: (index) => {
    const { currentSession } = get();
    if (currentSession) persistActiveSession(currentSession.id, index);
    set({ currentStepIndex: index });
  },

  completeSession: async (remarks) => {
    const { currentSession } = get();
    if (!currentSession) return;
    const now = new Date().toISOString();
    const completed: InspectionSession = {
      ...currentSession,
      status: 'COMPLETED',
      completedAt: now,
      remarks,
    };
    await db.sessions.put(completed);
    clearPersistedSession();
    set({ currentSession: completed });
  },

  addPhoto: async (photo) => {
    await db.photos.put(photo);
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
}));
