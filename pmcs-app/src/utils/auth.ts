import { api, signIn, signUp, signOut, getSessionUserId, ApiError, type ApiProfile } from './api';
import type { User } from '../types';
import { normalizeUic } from './uicLookup';

export async function remoteSignUp(dodId: string, pin: string, profile: {
  rank: string;
  last_name: string;
  first_name: string;
  mi: string;
  unit: string;
  email?: string;
}) {
  return signUp(dodId, pin, profile);
}

export async function remoteSignIn(dodId: string, pin: string) {
  return signIn(dodId, pin);
}

export function remoteSignOut() {
  signOut();
}

/** GET /me. Throws NetworkError / ApiError so callers can tell offline from signed-out. */
export async function fetchRemoteProfile(): Promise<ApiProfile> {
  return api<ApiProfile>('GET', '/me');
}

/** Best-effort /me that returns null on any failure. */
export async function getRemoteProfile(): Promise<ApiProfile | null> {
  if (!getSessionUserId()) return null;
  try {
    return await fetchRemoteProfile();
  } catch {
    return null;
  }
}

export type DodIdCheck = { status: 'exists' } | { status: 'new' } | { status: 'error'; message: string };

/** Distinguishes "new user" from "can't tell" so a network error never routes an existing user to signup. */
export async function checkDodIdExists(dodId: string): Promise<DodIdCheck> {
  try {
    const { exists } = await api<{ exists: boolean }>('GET', `/auth/exists/${encodeURIComponent(dodId)}`);
    if (typeof exists !== 'boolean') return { status: 'error', message: 'Unexpected response from the server' };
    return exists ? { status: 'exists' } : { status: 'new' };
  } catch (err) {
    if (err instanceof ApiError) {
      return { status: 'error', message: err.status === 429 ? err.message : `Server error: ${err.message}` };
    }
    return { status: 'error', message: "Can't reach the server. Check your connection and try again." };
  }
}

export function hasRemoteSession(): boolean {
  return getSessionUserId() !== null;
}

export function profileToUser(profile: ApiProfile, existing?: Partial<User> | null): User {
  return {
    ...(existing ?? {}),
    ...(profile.id ? { id: profile.id } : {}),
    dodId: profile.dod_id,
    rank: profile.rank ?? '',
    firstName: profile.first_name ?? '',
    lastName: profile.last_name ?? '',
    mi: profile.mi ?? '',
    unit: normalizeUic(profile.unit ?? ''),
    role: profile.role === 'admin' ? 'admin' : 'member',
    mustChangePin: profile.must_change_pin === 1 || profile.must_change_pin === true,
    // Older API versions don't send the email fields: keep whatever was cached.
    ...(profile.email !== undefined
      ? { email: profile.email ?? null, emailVerifiedAt: profile.email_verified_at ?? null }
      : {}),
  };
}

export { normalizeUic };
