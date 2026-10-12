import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { readToken, signUp, TOKEN_KEY, type ApiProfile } from '../utils/api';
import { db } from '../utils/db';
import { useUserStore } from '../stores/userStore';
import { profileToUser } from '../utils/auth';
import {
  EMAIL_PROMPT_SNOOZE_MS,
  emailErrorMessage,
  isEmailPromptSnoozed,
  isLikelyEmail,
  snoozeEmailPrompt,
} from '../utils/email';
import { ApiError, NetworkError } from '../utils/api';
import App from '../App';

const ME = '1000000001';
const EMAIL = 'soldier@example.com';

function b64url(obj: unknown) {
  return btoa(JSON.stringify(obj)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function makeToken(tag: string, dodId = ME) {
  return `${b64url({ alg: 'HS256' })}.${b64url({ sub: 'user-1', dod_id: dodId, exp: 4102444800, tag })}.sig-${tag}`;
}

function profile(extra: Partial<ApiProfile> = {}): ApiProfile {
  return {
    id: 'user-1', dod_id: ME, rank: 'SGT', last_name: 'Doe', first_name: 'Jane', mi: '', unit: 'WXYZA0',
    created_at: '2026-01-01T00:00:00Z', role: 'member', must_change_pin: 0, email: null, email_verified_at: null, ...extra,
  };
}

type Req = { method: string; path: string; body: unknown; auth: string | null };
type Handler = (req: Req) => { status: number; body?: unknown } | undefined;
let handler: Handler;
let requests: Req[];

function json(status: number, body?: unknown) {
  return new Response(body === undefined ? '' : JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

/** Answers the background calls a signed-in app makes (sync, heartbeat) unless the test handles them. */
function fallback(req: Req) {
  if (req.path === '/vehicles' || req.path.startsWith('/sessions') || req.path.startsWith('/faults')) return { status: 200, body: [] };
  return { status: 200, body: { ok: true } };
}

beforeEach(async () => {
  cleanup();
  requests = [];
  handler = () => undefined;
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
    const r = handler(req) ?? fallback(req);
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

function signedIn(tag = 't1') {
  localStorage.setItem(TOKEN_KEY, makeToken(tag));
  localStorage.setItem('pmcs-api-token-issued', String(Date.now()));
}

const HOME = { name: 'What are you PMCSing?' };

describe('email helpers', () => {
  it('checks email format lightly', () => {
    expect(isLikelyEmail('first.last.mil@army.mil')).toBe(true);
    expect(isLikelyEmail(' someone@example.com ')).toBe(true);
    expect(isLikelyEmail('someone@')).toBe(false);
    expect(isLikelyEmail('no at sign')).toBe(false);
    expect(isLikelyEmail('a@b')).toBe(false);
  });

  it('maps code errors and offline', () => {
    expect(emailErrorMessage(new ApiError('Incorrect code', 400, 'CODE_INVALID'))).toMatch(/code isn't right/);
    expect(emailErrorMessage(new ApiError('Too many wrong codes. Request a new one.', 429, 'CODE_LOCKED'))).toMatch(/Request a new one/);
    expect(emailErrorMessage(new NetworkError())).toMatch(/Can't reach the server/);
  });

  it('snoozes the prompt for 7 days per soldier and survives broken storage', () => {
    const now = Date.parse('2026-05-01T00:00:00Z');
    snoozeEmailPrompt(ME, now);
    expect(isEmailPromptSnoozed(ME, now + 1000)).toBe(true);
    expect(isEmailPromptSnoozed('1000000002', now + 1000)).toBe(false);
    expect(isEmailPromptSnoozed(ME, now + EMAIL_PROMPT_SNOOZE_MS + 1)).toBe(false);

    const spy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked'); });
    const spySet = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked'); });
    expect(() => snoozeEmailPrompt(ME)).not.toThrow();
    expect(isEmailPromptSnoozed(ME)).toBe(false);
    spy.mockRestore();
    spySet.mockRestore();
  });

  it('maps the email fields onto the cached user, keeping them when an older API omits them', () => {
    const u = profileToUser(profile({ email: EMAIL, email_verified_at: '2026-05-01T00:00:00Z' }));
    expect(u).toMatchObject({ email: EMAIL, emailVerifiedAt: '2026-05-01T00:00:00Z' });
    const older = profile();
    delete older.email;
    delete older.email_verified_at;
    expect(profileToUser(older, u)).toMatchObject({ email: EMAIL, emailVerifiedAt: '2026-05-01T00:00:00Z' });
    expect(profileToUser(older).email).toBeUndefined();
  });

  it('signup sends email only when given', async () => {
    handler = () => ({ status: 200, body: { token: makeToken('new'), profile: profile() } });
    const names = { rank: 'SGT', last_name: 'Doe', first_name: 'Jane', mi: '', unit: 'WXYZA0' };
    await signUp(ME, '135790', { ...names, email: EMAIL });
    await signUp(ME, '135790', names);
    expect((requests[0].body as { email?: string }).email).toBe(EMAIL);
    expect(requests[1].body).not.toHaveProperty('email');
  });
});

describe('Forgot PIN flow', () => {
  async function openResetFromLogin() {
    handler = ({ path }) => (path.startsWith('/auth/exists') ? { status: 200, body: { exists: true } } : undefined);
    window.history.pushState({}, '', '/login');
    render(<App />);
    fireEvent.change(await screen.findByLabelText('DOD ID Number', {}, { timeout: 5000 }), { target: { value: ME } });
    fireEvent.submit(screen.getByLabelText('DOD ID Number').closest('form')!);
    await screen.findByLabelText('PIN');
    fireEvent.click(screen.getByRole('button', { name: 'Forgot PIN?' }));
    await screen.findByRole('heading', { name: 'Reset your PIN' }, { timeout: 5000 });
  }

  it('requests a code, resets the PIN and signs in like a login', async () => {
    await openResetFromLogin();
    // The DOD ID typed on the login screen is carried over
    expect((screen.getByLabelText('DOD ID Number') as HTMLInputElement).value).toBe(ME);

    handler = ({ method, path, body }) => {
      if (path === '/auth/pin-reset/request') return { status: 200, body: { ok: true } };
      if (path === '/auth/pin-reset/confirm') {
        expect(body).toEqual({ dod_id: ME, code: '123456', new_pin: '246813' });
        return { status: 200, body: { token: makeToken('reset'), profile: profile({ email: EMAIL, email_verified_at: '2026-05-01T00:00:00Z' }) } };
      }
      if (method === 'GET' && path === '/me') return { status: 200, body: profile({ email: EMAIL, email_verified_at: '2026-05-01T00:00:00Z' }) };
      return undefined;
    };
    fireEvent.click(screen.getByRole('button', { name: 'Email Me a Code' }));
    expect((await screen.findByTestId('reset-code-sent')).textContent).toMatch(
      /If this account has a confirmed email, we sent a 6-digit code\. It expires in 15 minutes\. No email\? Ask your unit's PMCS Pro admin to reset your PIN\./,
    );
    expect(requests.find((r) => r.path === '/auth/pin-reset/request')?.body).toEqual({ dod_id: ME });

    // Mismatched PINs are caught before anything is sent
    fireEvent.change(screen.getByLabelText('6-digit code'), { target: { value: '123 456' } });
    fireEvent.change(screen.getByLabelText('New PIN'), { target: { value: '246813' } });
    fireEvent.change(screen.getByLabelText('Confirm New PIN'), { target: { value: '246810' } });
    fireEvent.click(screen.getByRole('button', { name: 'Reset PIN & Sign In' }));
    expect(await screen.findByText("The PINs don't match.")).toBeTruthy();
    expect(requests.some((r) => r.path === '/auth/pin-reset/confirm')).toBe(false);

    fireEvent.change(screen.getByLabelText('Confirm New PIN'), { target: { value: '246813' } });
    fireEvent.click(screen.getByRole('button', { name: 'Reset PIN & Sign In' }));

    expect(await screen.findByRole('heading', HOME, { timeout: 5000 })).toBeTruthy();
    expect(readToken()).toBe(makeToken('reset'));
    expect(useUserStore.getState().user).toMatchObject({ dodId: ME, email: EMAIL, mustChangePin: false });
    expect((await db.users.get(ME))?.emailVerifiedAt).toBe('2026-05-01T00:00:00Z');
    // Confirmed email: no prompt
    expect(screen.queryByTestId('email-prompt')).toBeNull();
  });

  it('shows the API error and offers a new code when the code is locked', async () => {
    await openResetFromLogin();
    handler = ({ path }) => {
      if (path === '/auth/pin-reset/request') return { status: 200, body: { ok: true } };
      if (path === '/auth/pin-reset/confirm') return { status: 429, body: { error: 'Too many wrong codes. Request a new one.', code: 'CODE_LOCKED' } };
      return undefined;
    };
    fireEvent.click(screen.getByRole('button', { name: 'Email Me a Code' }));
    await screen.findByTestId('reset-code-sent');
    fireEvent.change(screen.getByLabelText('6-digit code'), { target: { value: '000000' } });
    fireEvent.change(screen.getByLabelText('New PIN'), { target: { value: '246813' } });
    fireEvent.change(screen.getByLabelText('Confirm New PIN'), { target: { value: '246813' } });
    fireEvent.click(screen.getByRole('button', { name: 'Reset PIN & Sign In' }));

    expect((await screen.findByRole('alert')).textContent).toMatch(/Too many wrong codes\. Request a new one\./);
    expect(readToken()).toBeNull();
    expect(useUserStore.getState().user).toBeNull();

    const before = requests.filter((r) => r.path === '/auth/pin-reset/request').length;
    fireEvent.click(screen.getByRole('button', { name: 'Send a new code' }));
    await waitFor(() => expect(requests.filter((r) => r.path === '/auth/pin-reset/request').length).toBe(before + 1));
    expect((await screen.findByTestId('reset-code-sent')).textContent).toMatch(/New code requested/);
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('a wrong code shows a clear message and no "new code" offer', async () => {
    await openResetFromLogin();
    handler = ({ path }) => {
      if (path === '/auth/pin-reset/request') return { status: 200, body: { ok: true } };
      if (path === '/auth/pin-reset/confirm') return { status: 400, body: { error: 'Incorrect code', code: 'CODE_INVALID' } };
      return undefined;
    };
    fireEvent.click(screen.getByRole('button', { name: 'Email Me a Code' }));
    await screen.findByTestId('reset-code-sent');
    fireEvent.change(screen.getByLabelText('6-digit code'), { target: { value: '111111' } });
    fireEvent.change(screen.getByLabelText('New PIN'), { target: { value: '246813' } });
    fireEvent.change(screen.getByLabelText('Confirm New PIN'), { target: { value: '246813' } });
    fireEvent.click(screen.getByRole('button', { name: 'Reset PIN & Sign In' }));
    expect((await screen.findByRole('alert')).textContent).toMatch(/code isn't right/);
    expect(screen.queryByRole('button', { name: 'Send a new code' })).toBeNull();
  });

  it('says it needs the internet when offline', async () => {
    Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });
    window.history.pushState({ usr: { dodId: ME } }, '', '/forgot-pin');
    render(<App />);
    expect((await screen.findByTestId('forgot-pin-offline', {}, { timeout: 5000 })).textContent).toMatch(/offline/);
    expect((screen.getByRole('button', { name: 'Email Me a Code' }) as HTMLButtonElement).disabled).toBe(true);
  });
});

describe('Home-screen email prompt', () => {
  it('asks to add an email, and "Not now" hides it for 7 days', async () => {
    signedIn();
    handler = ({ method, path }) => (method === 'GET' && path === '/me' ? { status: 200, body: profile() } : undefined);
    window.history.pushState({}, '', '/');
    const { unmount } = render(<App />);
    const prompt = await screen.findByTestId('email-prompt', {}, { timeout: 5000 });
    expect(prompt.textContent).toMatch(/Add your email so you can reset your PIN yourself/);

    fireEvent.click(screen.getByRole('button', { name: 'Not now' }));
    expect(screen.queryByTestId('email-prompt')).toBeNull();
    expect(isEmailPromptSnoozed(ME)).toBe(true);
    // Inspections are still one tap away
    expect(screen.getByRole('heading', HOME)).toBeTruthy();

    unmount();
    render(<App />);
    await screen.findByRole('heading', HOME, { timeout: 5000 });
    expect(screen.queryByTestId('email-prompt')).toBeNull();
  });

  it('lets the soldier confirm an unconfirmed email right there', async () => {
    signedIn();
    let verified = false;
    handler = ({ method, path, body }) => {
      if (method === 'GET' && path === '/me') return { status: 200, body: profile({ email: EMAIL, email_verified_at: verified ? 'x' : null }) };
      if (path === '/me/email/verify') {
        if ((body as { code: string }).code !== '654321') return { status: 400, body: { error: 'Incorrect code', code: 'CODE_INVALID' } };
        verified = true;
        return { status: 200, body: profile({ email: EMAIL, email_verified_at: '2026-05-01T00:00:00Z' }) };
      }
      return undefined;
    };
    window.history.pushState({}, '', '/');
    render(<App />);
    const prompt = await screen.findByTestId('email-prompt', {}, { timeout: 5000 });
    expect(prompt.textContent).toContain(`Enter the code we sent to ${EMAIL}`);

    fireEvent.change(screen.getByLabelText('6-digit code'), { target: { value: '654321' } });
    fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));
    await waitFor(() => expect(screen.queryByTestId('email-prompt')).toBeNull());
    expect((await db.users.get(ME))?.emailVerifiedAt).toBe('2026-05-01T00:00:00Z');
  });

  it('stays hidden offline and when the server does not report an email', async () => {
    signedIn();
    const older = profile();
    delete older.email;
    delete older.email_verified_at;
    handler = ({ method, path }) => (method === 'GET' && path === '/me' ? { status: 200, body: older } : undefined);
    window.history.pushState({}, '', '/');
    const { unmount } = render(<App />);
    await screen.findByRole('heading', HOME, { timeout: 5000 });
    expect(screen.queryByTestId('email-prompt')).toBeNull();
    unmount();

    // Offline with a cached "no email" profile: the app works, no prompt
    await db.users.put({ ...profileToUser(profile()) });
    Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('Failed to fetch'); }));
    render(<App />);
    await screen.findByRole('heading', HOME, { timeout: 5000 });
    expect(useUserStore.getState().offlineProfile).toBe(true);
    expect(screen.queryByTestId('email-prompt')).toBeNull();
  });
});

describe('Settings → Email', () => {
  it('confirms an unconfirmed email with the code and keeps the cache in sync', async () => {
    signedIn();
    handler = ({ method, path, body }) => {
      if (method === 'GET' && path === '/me') return { status: 200, body: profile({ email: EMAIL }) };
      if (path === '/me/email/resend') return { status: 429, body: { error: 'Too many codes requested. Try again in an hour.', code: 'CODE_LIMIT' } };
      if (path === '/me/email/verify') {
        if ((body as { code: string }).code !== '654321') return { status: 400, body: { error: 'That code has expired or was already used. Request a new one.', code: 'CODE_EXPIRED' } };
        return { status: 200, body: profile({ email: EMAIL, email_verified_at: '2026-05-01T00:00:00Z' }) };
      }
      return undefined;
    };
    window.history.pushState({}, '', '/settings');
    render(<App />);
    const section = await screen.findByTestId('email-settings', {}, { timeout: 5000 });
    expect(screen.getByTestId('email-current').textContent).toBe(EMAIL);
    expect(section.textContent).toContain('Not confirmed');

    fireEvent.click(screen.getByRole('button', { name: 'Resend code' }));
    expect((await screen.findByRole('alert')).textContent).toMatch(/Too many codes requested/);

    fireEvent.change(screen.getByLabelText('6-digit code'), { target: { value: '111111' } });
    fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));
    expect((await screen.findByText(/expired or was already used/)).textContent).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Send a new code' })).toBeTruthy();

    fireEvent.change(screen.getByLabelText('6-digit code'), { target: { value: '654321' } });
    fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));
    await waitFor(() => expect(screen.getByTestId('email-settings').textContent).toContain('Confirmed'));
    expect(screen.getByTestId('email-settings').textContent).not.toContain('Not confirmed');
    expect(screen.queryByLabelText('6-digit code')).toBeNull();
    expect((await db.users.get(ME))?.emailVerifiedAt).toBe('2026-05-01T00:00:00Z');
  });

  it('adds, then removes, an email', async () => {
    signedIn();
    let current: string | null = null;
    handler = ({ method, path, body }) => {
      if (method === 'GET' && path === '/me') return { status: 200, body: profile({ email: current }) };
      if (method === 'PUT' && path === '/me/email') {
        current = (body as { email: string }).email;
        return { status: 200, body: { ...profile({ email: current }), email_code_sent: true } };
      }
      if (method === 'DELETE' && path === '/me/email') {
        current = null;
        return { status: 200, body: profile() };
      }
      return undefined;
    };
    window.history.pushState({}, '', '/settings');
    render(<App />);
    await screen.findByTestId('email-settings', {}, { timeout: 5000 });

    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'not-an-email' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add Email' }));
    expect(await screen.findByText('Enter a valid email address')).toBeTruthy();
    expect(requests.some((r) => r.path === '/me/email')).toBe(false);

    fireEvent.change(screen.getByLabelText('Email'), { target: { value: EMAIL } });
    fireEvent.click(screen.getByRole('button', { name: 'Add Email' }));
    expect(await screen.findByText(`We sent a 6-digit code to ${EMAIL}. It expires in 15 minutes.`)).toBeTruthy();
    expect(screen.getByTestId('email-settings').textContent).toContain('Not confirmed');
    expect((await db.users.get(ME))?.email).toBe(EMAIL);

    fireEvent.click(screen.getByRole('button', { name: 'Remove Email' }));
    fireEvent.click(screen.getByRole('button', { name: 'Remove' }));
    expect(await screen.findByText('Email removed.')).toBeTruthy();
    expect(screen.queryByTestId('email-current')).toBeNull();
    expect((await db.users.get(ME))?.email).toBeNull();
  });
});
