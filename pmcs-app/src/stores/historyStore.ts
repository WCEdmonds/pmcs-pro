import { create } from 'zustand';
import { db } from '../utils/db';
import type { InspectionSession, Fault, StepResult } from '../types';

export interface HistoryEntry {
  session: InspectionSession;
  faultCount: number;
  /** NMC faults that were NOT corrected on site (matches Summary / DA 2404). */
  nogoCount: number;
  /** Overall readiness from the open faults (same rule as the server). */
  readiness: Readiness;
}

export type Readiness = 'FMC' | 'PMC' | 'NMC';

/**
 * Vehicle readiness from an inspection's faults, matching the server's status rule:
 * NMC if any open NMC fault, else PMC if any open PMC fault, else FMC.
 * A fault corrected on site is closed.
 */
export function readinessOf(faults: Pick<Fault, 'readiness' | 'correctedOnSite'>[]): Readiness {
  const open = faults.filter((f) => !f.correctedOnSite);
  if (open.some((f) => f.readiness === 'NMC')) return 'NMC';
  if (open.some((f) => f.readiness === 'PMC')) return 'PMC';
  return 'FMC';
}

export const READINESS_BADGE: Record<Readiness, 'green' | 'amber' | 'red'> = { FMC: 'green', PMC: 'amber', NMC: 'red' };

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
            readiness: readinessOf(faults),
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
