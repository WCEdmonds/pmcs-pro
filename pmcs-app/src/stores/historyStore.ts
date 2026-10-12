import { create } from 'zustand';
import { db } from '../utils/db';
import type { InspectionSession, Fault, StepResult } from '../types';

export interface HistoryEntry {
  session: InspectionSession;
  faultCount: number;
  /** NMC faults that were NOT corrected on site (matches Summary / DA 2404). */
  nogoCount: number;
}

/** Same rule as Summary and the 5988 page. */
export function isNotMissionCapable(faults: Pick<Fault, 'readiness' | 'correctedOnSite'>[]): boolean {
  return faults.some((f) => f.readiness === 'NMC' && !f.correctedOnSite);
}

interface HistoryState {
  entries: HistoryEntry[];
  isLoading: boolean;
  loadHistory: (dodId?: string) => Promise<void>;
  getSession: (id: string) => Promise<InspectionSession | undefined>;
  getSessionFaults: (sessionId: string) => Promise<Fault[]>;
  getSessionStepResults: (sessionId: string) => Promise<StepResult[]>;
}

export const useHistoryStore = create<HistoryState>((set) => ({
  entries: [],
  isLoading: false,

  loadHistory: async (dodId) => {
    set({ isLoading: true });
    try {
      const sessions = dodId
        ? await db.sessions.where('inspectorDodId').equals(dodId).toArray()
        : await db.sessions.toArray();
      sessions.sort((a, b) =>
        (b.date || '').localeCompare(a.date || '') || (b.createdAt || '').localeCompare(a.createdAt || ''));
      const entries: HistoryEntry[] = await Promise.all(
        sessions.map(async (session) => {
          const faults = await db.faults.where('sessionId').equals(session.id).toArray();
          return {
            session,
            faultCount: faults.length,
            nogoCount: faults.filter((f) => f.readiness === 'NMC' && !f.correctedOnSite).length,
          };
        })
      );
      set({ entries, isLoading: false });
    } catch (err) {
      console.error('Loading history failed:', err);
      set({ entries: [], isLoading: false });
    }
  },

  getSession: async (id) => db.sessions.get(id),

  getSessionFaults: async (sessionId) =>
    db.faults.where('sessionId').equals(sessionId).toArray(),

  getSessionStepResults: async (sessionId) =>
    db.stepResults.where('sessionId').equals(sessionId).toArray(),
}));
