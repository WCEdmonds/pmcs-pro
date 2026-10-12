import { create } from 'zustand';
import { db } from '../utils/db';
import { api, ApiError, getSessionDodId, refreshTokenIfStale, signOut, type ApiProfile } from '../utils/api';
import { fetchRemoteProfile, normalizeUic, profileToUser } from '../utils/auth';
import type { User } from '../types';

export interface ProfileUpdate {
  rank?: string;
  firstName?: string;
  lastName?: string;
  mi?: string;
  unit?: string;
}

interface UserState {
  user: User | null;
  isLoading: boolean;
  /** True when the user was restored from the device cache because the server was unreachable. */
  offlineProfile: boolean;
  /** Sets the signed-in user from a server profile and caches it in Dexie. */
  setFromProfile: (profile: ApiProfile) => Promise<User>;
  /** Local-only preferences (theme, default inspection type). */
  updateUser: (updates: Partial<Pick<User, 'theme' | 'defaultInspectionType'>>) => Promise<void>;
  /** Profile fields go to the server (PATCH /me) and are then cached locally. */
  updateProfile: (updates: ProfileUpdate) => Promise<void>;
  setUser: (user: User) => void;
  /** Restores the signed-in user on app start: /me when online, Dexie cache when offline. */
  restore: () => Promise<void>;
  /** Clears the token and the in-memory user. Local inspection data is kept. */
  signOut: () => void;
  logout: () => void;
}

async function cacheUser(user: User) {
  try {
    await db.users.put(user);
  } catch (err) {
    console.warn('Could not cache profile:', err);
  }
}

export const useUserStore = create<UserState>((set, get) => ({
  user: null,
  isLoading: false,
  offlineProfile: false,

  setFromProfile: async (profile) => {
    const existing = await db.users.get(profile.dod_id).catch(() => undefined);
    const user = profileToUser(profile, existing);
    await cacheUser(user);
    set({ user, offlineProfile: false });
    return user;
  },

  updateUser: async (updates) => {
    const { user } = get();
    if (!user) return;
    const updated = { ...user, ...updates };
    await cacheUser(updated);
    set({ user: updated });
  },

  updateProfile: async (updates) => {
    const { user } = get();
    if (!user) return;
    const body: Record<string, string> = {};
    if (updates.rank !== undefined) body.rank = updates.rank;
    if (updates.firstName !== undefined) body.first_name = updates.firstName.trim();
    if (updates.lastName !== undefined) body.last_name = updates.lastName.trim();
    if (updates.mi !== undefined) body.mi = updates.mi.trim();
    if (updates.unit !== undefined) body.unit = normalizeUic(updates.unit);
    const profile = await api<ApiProfile>('PATCH', '/me', { body });
    await get().setFromProfile(profile);
  },

  setUser: (user) => set({ user }),

  restore: async () => {
    const dodId = getSessionDodId();
    if (!dodId) {
      set({ user: null });
      return;
    }
    set({ isLoading: true });
    try {
      if (typeof navigator === 'undefined' || navigator.onLine) await refreshTokenIfStale();
      const profile = await fetchRemoteProfile();
      await get().setFromProfile(profile);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        // api() already cleared the token
        set({ user: null });
      } else {
        // Offline / server trouble: keep working from the cached profile.
        const cached = await db.users.get(dodId).catch(() => undefined);
        const user: User = cached ?? { dodId, rank: '', firstName: '', lastName: '', mi: '', unit: '' };
        set({ user, offlineProfile: true });
      }
    } finally {
      set({ isLoading: false });
    }
  },

  signOut: () => {
    signOut();
    set({ user: null, offlineProfile: false });
  },

  logout: () => set({ user: null, offlineProfile: false }),
}));
