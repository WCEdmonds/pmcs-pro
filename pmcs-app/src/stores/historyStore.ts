import { create } from 'zustand';
import { db } from '../utils/db';
import type { InspectionSession, Fault, StepResult } from '../types';

export interface HistoryEntry {
  session: InspectionSession;
  faultCount: number;
  nogoCount: number;
}

interface HistoryState {
  entries: HistoryEntry[];
  isLoading: boolean;
  loadHistory: (dodId?: string) => Promise<void>;
  getSession: (id: string) => Promise<InspectionSession | undefined>;
  getSessionFaults: (sessionId: string) => Promise<Fault[]>;
  getSessionStepResults: (sessionId: string) => Promise<StepResult[]>;
  deleteSession: (id: string) => Promise<void>;
}

export const useHistoryStore = create<HistoryState>((set) => ({
  entries: [],
  isLoading: false,

  loadHistory: async (dodId) => {
    set({ isLoading: true });
    let sessions: InspectionSession[];
    if (dodId) {
      sessions = await db.sessions.where('inspectorDodId').equals(dodId).reverse().sortBy('date');
    } else {
      sessions = await db.sessions.reverse().sortBy('date');
    }
    const completed = sessions.filter((s) => s.status === 'COMPLETED');
    const entries: HistoryEntry[] = await Promise.all(
      completed.map(async (session) => {
        const faults = await db.faults.where('sessionId').equals(session.id).toArray();
        return {
          session,
          faultCount: faults.length,
          nogoCount: faults.filter((f) => f.readiness === 'NMC').length,
        };
      })
    );
    set({ entries, isLoading: false });
  },

  getSession: async (id) => db.sessions.get(id),

  getSessionFaults: async (sessionId) =>
    db.faults.where('sessionId').equals(sessionId).toArray(),

  getSessionStepResults: async (sessionId) =>
    db.stepResults.where('sessionId').equals(sessionId).toArray(),

  deleteSession: async (id) => {
    await db.stepResults.where('sessionId').equals(id).delete();
    await db.faults.where('sessionId').equals(id).delete();
    await db.photos.where('sessionId').equals(id).delete();
    await db.sessions.delete(id);
    set((s) => ({ entries: s.entries.filter((e) => e.session.id !== id) }));
  },
}));
