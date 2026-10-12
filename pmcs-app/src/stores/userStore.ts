import { create } from 'zustand';
import { db } from '../utils/db';
import {
  api,
  ApiError,
  changePin as apiChangePin,
  getSessionDodId,
  isPinChangeRequired,
  refreshTokenIfStale,
  signOut,
  signOutEverywhere as apiSignOutEverywhere,
  type ApiProfile,
} from '../utils/api';
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
  /** Locks the app to "Set a new PIN" (login/`/me` said so, or an API call returned PIN_CHANGE_REQUIRED). */
  requirePinChange: () => Promise<void>;
  /**
   * Changes the PIN on the server and stores the new session token (all other sessions
   * are signed out by the server). Clears the PIN-change lock. Local data is untouched.
   */
  changePin: (currentPin: string, newPin: string) => Promise<void>;
  /**
   * Sets the personal email (unconfirmed) and has the server email a 6-digit code.
   * Returns false when no code was sent (hourly cap, or the address was already confirmed).
   */
  setEmail: (email: string) => Promise<boolean>;
  /** Emails a new confirmation code to the unconfirmed address. */
  resendEmailCode: () => Promise<void>;
  /** Confirms the email with the emailed code. */
  verifyEmail: (code: string) => Promise<void>;
  /** Removes the email (PIN reset by email stops working). */
  removeEmail: () => Promise<void>;
  /** Signs out every session of this soldier, this device included. Local data is kept. */
  signOutEverywhere: () => Promise<void>;
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
        // A cached PIN-change lock stays in force offline.
        const cached = await db.users.get(dodId).catch(() => undefined);
        const user: User = cached ?? { dodId, rank: '', firstName: '', lastName: '', mi: '', unit: '' };
        if (isPinChangeRequired(err)) user.mustChangePin = true;
        set({ user, offlineProfile: true });
      }
    } finally {
      set({ isLoading: false });
    }
  },

  requirePinChange: async () => {
    const { user } = get();
    if (!user || user.mustChangePin) return;
    const updated = { ...user, mustChangePin: true };
    set({ user: updated });
    await cacheUser(updated);
  },

  changePin: async (currentPin, newPin) => {
    const before = get().user;
    let profile: ApiProfile;
    try {
      profile = await apiChangePin(currentPin, newPin);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        // Usually a wrong current PIN. If the session itself was revoked, /me says so
        // and api() signs this device out with a message.
        await api('GET', '/me').catch(() => undefined);
      }
      throw err;
    }
    if (profile && typeof profile === 'object' && profile.dod_id) {
      // The server just accepted the new PIN, so the lock is over whatever the payload says.
      await get().setFromProfile({ ...profile, must_change_pin: 0 });
    } else if (before) {
      const updated = { ...before, mustChangePin: false };
      await cacheUser(updated);
      set({ user: updated, offlineProfile: false });
    }
  },

  setEmail: async (email) => {
    const res = await api<ApiProfile & { email_code_sent?: boolean }>('PUT', '/me/email', { body: { email: email.trim() } });
    const { email_code_sent: sent, ...profile } = res;
    await get().setFromProfile(profile);
    return sent === true;
  },

  resendEmailCode: async () => {
    try {
      await api<{ ok: boolean }>('POST', '/me/email/resend');
    } catch (err) {
      // 409: already confirmed (e.g. on another device) — pick up the current profile.
      if (err instanceof ApiError && err.status === 409) {
        const profile = await fetchRemoteProfile().catch(() => null);
        if (profile) await get().setFromProfile(profile);
      }
      throw err;
    }
  },

  verifyEmail: async (code) => {
    const profile = await api<ApiProfile>('POST', '/me/email/verify', { body: { code: code.replace(/\s/g, '') } });
    await get().setFromProfile(profile);
  },

  removeEmail: async () => {
    const profile = await api<ApiProfile>('DELETE', '/me/email');
    await get().setFromProfile(profile);
  },

  signOutEverywhere: async () => {
    await apiSignOutEverywhere();
    set({ user: null, offlineProfile: false });
  },

  signOut: () => {
    signOut();
    set({ user: null, offlineProfile: false });
  },

  logout: () => set({ user: null, offlineProfile: false }),
}));
