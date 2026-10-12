import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import {
  api,
  ApiError,
  changePin,
  getSignOutNotice,
  onPinChangeRequired,
  readToken,
  signOutEverywhere,
  REVOKED_NOTICE,
  TOKEN_KEY,
  type ApiProfile,
} from '../utils/api';
import { db } from '../utils/db';
import { useUserStore } from '../stores/userStore';
import { syncAll } from '../utils/syncEngine';
import { validatePinChange, changePinErrorMessage } from '../utils/pin';
import App from '../App';

const ME = '1111111111';

function b64url(obj: unknown) {
  return btoa(JSON.stringify(obj)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function makeToken(tag: string, dodId = ME) {
  return `${b64url({ alg: 'HS256' })}.${b64url({ sub: 'user-1', dod_id: dodId, exp: 4102444800, tag })}.sig-${tag}`;
}

function profile(extra: Partial<ApiProfile> = {}): ApiProfile {
  return {
    id: 'user-1', dod_id: ME, rank: 'SGT', last_name: 'Doe', first_name: 'Jane', mi: '', unit: 'WXYZA0',
    created_at: '2026-01-01T00:00:00Z', role: 'member', must_change_pin: 0, ...extra,
  };
}

type Handler = (req: { method: string; path: string; body: unknown; auth: string | null }) => { status: number; body?: unknown };
let handler: Handler;
let requests: { method: string; path: string; body: unknown; auth: string | null }[];

function json(status: number, body?: unknown) {
  return new Response(body === undefined ? '' : JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

beforeEach(async () => {
  cleanup();
  requests = [];
  handler = () => ({ status: 200, body: { ok: true } });
  vi.stubGlobal('fetch', vi.fn(async (input: URL | string, init: RequestInit = {}) => {
    const url = new URL(String(input));
    const headers = (init.headers ?? {}) as Record<string, string>;
    const req = {
      method: init.method ?? 'GET',
      path: url.pathname,
      body: typeof init.body === 'string' ? JSON.parse(init.body) : undefined,
      auth: headers.Authorization ?? null,
    };
    requests.push(req);
    const r = handler(req);
    return json(r.status, r.body);
  }));
  localStorage.clear();
  sessionStorage.clear();
  await db.delete();
  await db.open();
  useUserStore.setState({ user: null, offlineProfile: false, isLoading: false });
  Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('api(): PIN_CHANGE_REQUIRED and revoked sessions', () => {
  it('turns a 403 PIN_CHANGE_REQUIRED into a coded ApiError, notifies, and keeps the session', async () => {
    localStorage.setItem(TOKEN_KEY, makeToken('t1'));
    handler = () => ({ status: 403, body: { error: 'PIN change required', code: 'PIN_CHANGE_REQUIRED' } });
    const seen = vi.fn();
    const off = onPinChangeRequired(seen);
    const err = (await api('GET', '/vehicles').catch((e: unknown) => e)) as ApiError;
    off();
    expect(err).toBeInstanceOf(ApiError);
    expect(err.code).toBe('PIN_CHANGE_REQUIRED');
    expect(seen).toHaveBeenCalledTimes(1);
    expect(readToken()).toBe(makeToken('t1'));
  });

  it('an ordinary 403 does not trigger the PIN gate', async () => {
    localStorage.setItem(TOKEN_KEY, makeToken('t1'));
    handler = () => ({ status: 403, body: { error: 'Not your unit' } });
    const seen = vi.fn();
    const off = onPinChangeRequired(seen);
    await api('GET', '/x').catch(() => undefined);
    off();
    expect(seen).not.toHaveBeenCalled();
  });

  it('a 401 on a normal call signs out and leaves a "You were signed out" notice', async () => {
    localStorage.setItem(TOKEN_KEY, makeToken('t1'));
    handler = () => ({ status: 401, body: { error: 'Not signed in' } });
    await api('GET', '/me').catch(() => undefined);
    expect(readToken()).toBeNull();
    expect(getSignOutNotice()).toBe(REVOKED_NOTICE);
  });
});

describe('changePin(): token replacement', () => {
  it('posts current/new PIN with the old token and stores the returned token', async () => {
    const oldToken = makeToken('old');
    const newToken = makeToken('new');
    localStorage.setItem(TOKEN_KEY, oldToken);
    handler = ({ path }) => (path === '/auth/change-pin' ? { status: 200, body: { token: newToken, profile: profile() } } : { status: 404 });
    const p = await changePin('4321', '123456');
    expect(p.dod_id).toBe(ME);
    expect(requests[0]).toMatchObject({ method: 'POST', path: '/auth/change-pin', body: { current_pin: '4321', new_pin: '123456' }, auth: `Bearer ${oldToken}` });
    expect(readToken()).toBe(newToken);

    // The next request uses the new token
    handler = () => ({ status: 200, body: profile() });
    await api('GET', '/me');
    expect(requests.at(-1)?.auth).toBe(`Bearer ${newToken}`);
  });

  it('a wrong current PIN (401) keeps the session', async () => {
    const token = makeToken('old');
    localStorage.setItem(TOKEN_KEY, token);
    handler = () => ({ status: 401, body: { error: 'Current PIN is incorrect' } });
    await expect(changePin('0000', '123456')).rejects.toMatchObject({ status: 401 });
    expect(readToken()).toBe(token);
    expect(getSignOutNotice()).toBeNull();
  });

  it('a response without a token is an error and the old token stays', async () => {
    const token = makeToken('old');
    localStorage.setItem(TOKEN_KEY, token);
    handler = () => ({ status: 200, body: { ok: true } });
    await expect(changePin('4321', '123456')).rejects.toBeInstanceOf(ApiError);
    expect(readToken()).toBe(token);
  });

  it('signOutEverywhere clears the token without a "revoked" notice', async () => {
    localStorage.setItem(TOKEN_KEY, makeToken('t'));
    handler = () => ({ status: 200, body: { ok: true } });
    await signOutEverywhere();
    expect(requests[0]).toMatchObject({ method: 'POST', path: '/auth/sign-out-everywhere' });
    expect(readToken()).toBeNull();
    expect(getSignOutNotice()).toBeNull();
  });

  it('signOutEverywhere offline keeps this device signed in', async () => {
    localStorage.setItem(TOKEN_KEY, makeToken('t'));
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('Failed to fetch'); }));
    await expect(signOutEverywhere()).rejects.toThrow();
    expect(readToken()).not.toBeNull();
  });
});

describe('PIN validation and messages', () => {
  it('requires 6–12 digit new PINs entered twice', () => {
    expect(validatePinChange('1234', '12345', '12345').next).toMatch(/6 to 12/);
    expect(validatePinChange('1234', '1234567890123', '1234567890123').next).toMatch(/6 to 12/);
    expect(validatePinChange('1234', '123456', '123457').confirm).toMatch(/match/);
    expect(validatePinChange('123456', '123456', '123456').next).toMatch(/different/);
    expect(validatePinChange('', '123456', '123456').current).toBeTruthy();
    expect(validatePinChange('1234', '123456', '123456')).toEqual({});
  });

  it('explains wrong PIN, lockout and offline', async () => {
    const { NetworkError } = await import('../utils/api');
    expect(changePinErrorMessage(new ApiError('x', 401), true)).toMatch(/temporary PIN/);
    expect(changePinErrorMessage(new ApiError('Current PIN is incorrect', 403, 'INVALID_PIN'), true)).toMatch(/temporary PIN/);
    expect(changePinErrorMessage(new ApiError('Current PIN is incorrect', 403, 'INVALID_PIN'), false)).toMatch(/current PIN isn't right/);
    expect(changePinErrorMessage(new ApiError('Too many failed PIN attempts. This account is locked for 15 minutes.', 429), true)).toMatch(/locked/);
    expect(changePinErrorMessage(new NetworkError(), true)).toMatch(/Can't reach the server/);
  });
});

describe('userStore + sync during the PIN-change lock', () => {
  it('requirePinChange locks; changePin unlocks, replaces the token and keeps local data', async () => {
    localStorage.setItem(TOKEN_KEY, makeToken('temp'));
    await useUserStore.getState().setFromProfile(profile({ must_change_pin: 1 }));
    expect(useUserStore.getState().user?.mustChangePin).toBe(true);
    expect((await db.users.get(ME))?.mustChangePin).toBe(true); // survives an offline restart

    await db.sessions.put({
      id: 's1', date: '2026-04-02', vehicleId: 'v', vehicleType: 'M1151', bumperNumber: 'HQ-31', odometer: 1,
      inspectorDodId: ME, inspectorRank: 'SGT', inspectorName: 'Jane Doe', unit: 'WXYZA0', inspectionType: 'BEFORE',
      status: 'COMPLETED', createdAt: '2026-04-02T12:00:00Z', completedAt: '2026-04-02T12:30:00Z',
    });
    await db.pendingFaultResolutions.put({ id: 'r1', faultIds: ['f'], resolutionStatus: 'CORRECTED', dodId: ME, createdAt: 'x', attempts: 0 });

    // Locked: sync doesn't even try
    expect((await syncAll({ force: true })).skipped).toBe('pin-change');
    expect(requests).toHaveLength(0);

    // Wrong temp PIN
    handler = ({ path }) => (path === '/auth/change-pin' ? { status: 401, body: { error: 'Current PIN is incorrect' } } : { status: 200, body: profile({ must_change_pin: 1 }) });
    await expect(useUserStore.getState().changePin('0000', '135790')).rejects.toMatchObject({ status: 401 });
    expect(useUserStore.getState().user?.mustChangePin).toBe(true);
    expect(readToken()).toBe(makeToken('temp'));

    // Right temp PIN
    handler = ({ path }) => (path === '/auth/change-pin' ? { status: 200, body: { token: makeToken('fresh'), profile: profile({ must_change_pin: 0 }) } } : { status: 404 });
    await useUserStore.getState().changePin('4321', '135790');
    expect(useUserStore.getState().user?.mustChangePin).toBe(false);
    expect(readToken()).toBe(makeToken('fresh'));
    expect(await db.sessions.count()).toBe(1);
    expect(await db.pendingFaultResolutions.count()).toBe(1);
  });

  it('a mid-session PIN_CHANGE_REQUIRED never marks inspections failed or drops queued fault updates', async () => {
    localStorage.setItem(TOKEN_KEY, makeToken('t'));
    await useUserStore.getState().setFromProfile(profile());
    const unsub = onPinChangeRequired(() => useUserStore.getState().requirePinChange());
    await db.sessions.put({
      id: 's1', date: '2026-04-02', vehicleId: 'v', vehicleType: 'M1151', bumperNumber: 'HQ-31', odometer: 1,
      inspectorDodId: ME, inspectorRank: 'SGT', inspectorName: 'Jane Doe', unit: 'WXYZA0', inspectionType: 'BEFORE',
      status: 'COMPLETED', createdAt: '2026-04-02T12:00:00Z', completedAt: '2026-04-02T12:30:00Z',
    });
    await db.pendingFaultResolutions.put({ id: 'r1', faultIds: ['f'], resolutionStatus: 'CORRECTED', dodId: ME, createdAt: 'x', attempts: 0 });
    handler = () => ({ status: 403, body: { error: 'PIN change required', code: 'PIN_CHANGE_REQUIRED' } });

    const r = await syncAll({ force: true });
    unsub();
    expect(r.pinChangeRequired).toBe(true);
    expect(await db.pendingFaultResolutions.count()).toBe(1);
    const st = await db.syncState.get('s1');
    expect(st?.status).not.toBe('failed');
    expect(st?.attempts ?? 0).toBe(0);
    expect(useUserStore.getState().user?.mustChangePin).toBe(true);
    expect(readToken()).not.toBeNull();
  });
});

describe('App routing', () => {
  it('locks the app to "Set a new PIN" and continues to the app after the change', async () => {
    localStorage.setItem(TOKEN_KEY, makeToken('temp'));
    localStorage.setItem('pmcs-api-token-issued', String(Date.now()));
    let locked = true;
    handler = ({ method, path, body }) => {
      if (method === 'GET' && path === '/me') return { status: 200, body: profile({ must_change_pin: locked ? 1 : 0 }) };
      if (path === '/auth/change-pin') {
        if ((body as { current_pin: string }).current_pin !== '4321') return { status: 403, body: { error: 'Current PIN is incorrect', code: 'INVALID_PIN' } };
        locked = false;
        return { status: 200, body: { token: makeToken('fresh'), profile: profile() } };
      }
      if (locked) return { status: 403, body: { error: 'PIN change required', code: 'PIN_CHANGE_REQUIRED' } };
      return { status: 200, body: path === '/vehicles' ? [] : { ok: true } };
    };

    window.history.pushState({}, '', '/settings');
    render(<App />);
    expect(await screen.findByRole('heading', { name: 'Set a new PIN' }, { timeout: 5000 })).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'Settings' })).toBeNull();

    fireEvent.change(screen.getByLabelText('Temporary PIN'), { target: { value: '0000' } });
    fireEvent.change(screen.getByLabelText('New PIN'), { target: { value: '135790' } });
    fireEvent.change(screen.getByLabelText('Confirm New PIN'), { target: { value: '135790' } });
    fireEvent.click(screen.getByRole('button', { name: 'Set New PIN' }));
    expect((await screen.findByRole('alert')).textContent).toMatch(/temporary PIN isn't right/);
    expect(readToken()).toBe(makeToken('temp'));

    fireEvent.change(screen.getByLabelText('Temporary PIN'), { target: { value: '4321' } });
    fireEvent.click(screen.getByRole('button', { name: 'Set New PIN' }));

    expect(await screen.findByRole('heading', { name: 'Settings' }, { timeout: 5000 })).toBeTruthy();
    expect(readToken()).toBe(makeToken('fresh'));
    await waitFor(() => expect(requests.some((r) => r.path === '/client-status' && r.auth === `Bearer ${makeToken('fresh')}`)).toBe(true));
  });
});

describe('Login after a revoked session', () => {
  it('shows "You were signed out" and the forgot-PIN note', async () => {
    localStorage.setItem(TOKEN_KEY, makeToken('revoked'));
    localStorage.setItem('pmcs-api-token-issued', String(Date.now()));
    handler = ({ path }) => (path.startsWith('/auth/exists') ? { status: 200, body: { exists: true } } : { status: 401, body: { error: 'Not signed in' } });
    window.history.pushState({}, '', '/');
    render(<App />);
    expect((await screen.findByTestId('signout-notice', {}, { timeout: 5000 })).textContent).toContain(REVOKED_NOTICE);
    expect(readToken()).toBeNull();

    fireEvent.change(screen.getByLabelText('DOD ID Number'), { target: { value: ME } });
    fireEvent.submit(screen.getByLabelText('DOD ID Number').closest('form')!);
    const pin = await screen.findByLabelText('PIN');
    expect(pin.getAttribute('aria-describedby')).toBe('forgot-pin-note');
    expect(screen.getByText(/Forgot your PIN\? Ask your unit's PMCS Pro admin to reset it\. You'll get a temporary PIN\./)).toBeTruthy();
  });
});
