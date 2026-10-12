import { api, signIn, signUp, signOut, getSessionUserId, type ApiProfile } from './api';

export async function remoteSignUp(dodId: string, pin: string, profile: {
  rank: string;
  last_name: string;
  first_name: string;
  mi: string;
  unit: string;
}) {
  return signUp(dodId, pin, profile);
}

export async function remoteSignIn(dodId: string, pin: string) {
  return signIn(dodId, pin);
}

export function remoteSignOut() {
  signOut();
}

export async function getRemoteProfile(): Promise<ApiProfile | null> {
  if (!getSessionUserId()) return null;
  try {
    return await api<ApiProfile>('GET', '/me');
  } catch {
    return null;
  }
}

export async function checkDodIdExists(dodId: string): Promise<boolean> {
  try {
    const { exists } = await api<{ exists: boolean }>('GET', `/auth/exists/${encodeURIComponent(dodId)}`);
    return exists;
  } catch {
    return false;
  }
}

export function hasRemoteSession(): boolean {
  return getSessionUserId() !== null;
}
