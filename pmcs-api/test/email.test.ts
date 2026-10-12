import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { app } from '../src/index';
import { makeEnv, migrations, FakeD1 } from './fake-env.mjs';
import type { Env } from '../src/index';

// Fake UICs, DoD IDs and addresses only.
const A = 'WXYZA0';
const CODE = 'test-bootstrap-code-1234';

let env: Env;
let DB: FakeD1;

async function req(method: string, path: string, opts: { token?: string; body?: unknown } = {}) {
  const headers: Record<string, string> = {};
  if (opts.token) headers.Authorization = `Bearer ${opts.token}`;
  let body: BodyInit | undefined;
  if (opts.body !== undefined) { headers['Content-Type'] = 'application/json'; body = JSON.stringify(opts.body); }
  const res = await app.request(`http://api.test${path}`, { method, headers, body }, env);
  const text = await res.text();
  let json: any;
  try { json = JSON.parse(text); } catch { json = text; }
  return { status: res.status, json };
}

async function signup(dodId: string, extra: Record<string, unknown> = {}) {
  const r = await req('POST', '/auth/signup', { body: { dod_id: dodId, pin: '123456', unit: A, rank: 'SGT', first_name: 'Test', last_name: 'User', ...extra } });
  expect(r.status).toBe(200);
  return r.json as { token: string; profile: Record<string, any> };
}

let fetchSpy: ReturnType<typeof vi.spyOn>;
const sent = (): any[] => fetchSpy.mock.calls.map((c: any) => JSON.parse(c[1].body as string));
/** Waits for background sends, then returns the 6-digit code in the newest email to `to`. */
async function lastCode(to: string) {
  await new Promise((r) => setTimeout(r, 0));
  const mail = sent().filter((m) => m.to.includes(to)).at(-1);
  expect(mail).toBeTruthy();
  return /\b(\d{6})\b/.exec(mail.text)![1];
}
const actions = () => DB.q<{ action: string }>('SELECT action FROM audit_log ORDER BY at, rowid').map((r) => r.action);

beforeEach(() => {
  ({ env, DB } = makeEnv({ ADMIN_BOOTSTRAP_CODE: CODE, RESEND_API_KEY: 'k' }));
  fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}'));
});
afterEach(() => fetchSpy.mockRestore());

async function verifiedUser(dodId: string, email: string) {
  const u = await signup(dodId, { email });
  expect(u.profile).toMatchObject({ email, email_verified_at: null });
  const r = await req('POST', '/me/email/verify', { token: u.token, body: { code: await lastCode(email) } });
  expect(r.status).toBe(200);
  expect(r.json.email_verified_at).toEqual(expect.any(String));
  return u;
}

describe('user email', () => {
  it('migration 0003 applies on top of 0002 with existing rows', () => {
    const db = new FakeD1({ upTo: '0002_admin_audit.sql' });
    db.q("INSERT INTO profiles (id, dod_id, pin_hash, unit) VALUES ('p1', '1000000001', 'x', 'WXYZA0') RETURNING id");
    db.db.exec(migrations().find((m) => m.name.startsWith('0003'))!.sql);
    expect(db.q("SELECT email, email_verified_at FROM profiles WHERE id = 'p1'")).toEqual([{ email: null, email_verified_at: null }]);
  });

  it('signup without email works; with a bad email is a 400', async () => {
    const u = await signup('1000000001');
    expect(u.profile).toMatchObject({ email: null, email_verified_at: null });
    expect((await req('POST', '/auth/signup', { body: { dod_id: '1000000002', pin: '123456', unit: A, email: 'nope' } })).status).toBe(400);
  });

  it('signup with email sends a code; verifying confirms it and is audited', async () => {
    await verifiedUser('1000000003', 'soldier@example.com');
    const mail = sent().find((m) => m.subject.includes('confirm your email'));
    expect(mail.to).toEqual(['soldier@example.com']);
    expect(actions()).toContain('user.email_verified');
    // Only a hash is stored.
    const code = await lastCode('soldier@example.com');
    expect(JSON.stringify(DB.q('SELECT * FROM email_codes'))).not.toContain(code);
  });

  it('wrong codes are limited to 5 attempts; old codes are superseded', async () => {
    const u = await signup('1000000004');
    let r = await req('PUT', '/me/email', { token: u.token, body: { email: ' New@Example.com ' } });
    expect(r.json).toMatchObject({ email: 'new@example.com', email_verified_at: null, email_code_sent: true });
    const first = await lastCode('new@example.com');
    expect((await req('POST', '/me/email/resend', { token: u.token })).status).toBe(200);
    const second = await lastCode('new@example.com');
    if (first !== second) {
      expect((await req('POST', '/me/email/verify', { token: u.token, body: { code: first } })).json.code).toBe('CODE_INVALID');
    }
    const wrong = second === '000000' ? '111111' : '000000';
    for (let i = 0; i < 4; i++) await req('POST', '/me/email/verify', { token: u.token, body: { code: wrong } });
    r = await req('POST', '/me/email/verify', { token: u.token, body: { code: second } });
    expect(r.status).toBe(429);
    expect(r.json.code).toBe('CODE_LOCKED');
  });

  it('caps codes at 3 per hour', async () => {
    const u = await signup('1000000005', { email: 'cap@example.com' }); // 1
    expect((await req('POST', '/me/email/resend', { token: u.token })).status).toBe(200); // 2
    expect((await req('POST', '/me/email/resend', { token: u.token })).status).toBe(200); // 3
    const r = await req('POST', '/me/email/resend', { token: u.token });
    expect(r.status).toBe(429);
    expect(r.json.code).toBe('CODE_LIMIT');
  });

  it('changing a verified email un-verifies it and notifies the old address; remove clears it', async () => {
    const u = await verifiedUser('1000000006', 'old@example.com');
    const r = await req('PUT', '/me/email', { token: u.token, body: { email: 'new@example.com' } });
    expect(r.json).toMatchObject({ email: 'new@example.com', email_verified_at: null });
    await new Promise((res) => setTimeout(res, 0));
    expect(sent().some((m) => m.to.includes('old@example.com') && m.subject.includes('email was changed'))).toBe(true);
    const del = await req('DELETE', '/me/email', { token: u.token });
    expect(del.json).toMatchObject({ email: null, email_verified_at: null });
    expect(actions()).toEqual(expect.arrayContaining(['user.email_change', 'user.email_remove']));
    const details = DB.q<{ details: string }>("SELECT details FROM audit_log WHERE action = 'user.email_change'")[0].details;
    expect(details).toContain('o***@example.com');
    expect(details).not.toContain('old@example.com');
  });
});

describe('PIN reset by email', () => {
  it('resets the PIN with the emailed code, unlocks, ends old sessions and notifies', async () => {
    const u = await verifiedUser('1000000010', 'r@example.com');
    for (let i = 0; i < 5; i++) await req('POST', '/auth/login', { body: { dod_id: '1000000010', pin: '999999' } });
    expect((await req('POST', '/auth/login', { body: { dod_id: '1000000010', pin: '123456' } })).status).toBe(429);

    expect((await req('POST', '/auth/pin-reset/request', { body: { dod_id: '1000000010' } })).json).toEqual({ ok: true });
    const code = await lastCode('r@example.com');
    const r = await req('POST', '/auth/pin-reset/confirm', { body: { dod_id: '1000000010', code, new_pin: '24681357' } });
    expect(r.status).toBe(200);
    expect(r.json.token).toEqual(expect.any(String));
    expect((await req('GET', '/me', { token: u.token })).status).toBe(401); // old session revoked
    expect((await req('POST', '/auth/login', { body: { dod_id: '1000000010', pin: '24681357' } })).status).toBe(200);
    // Single use.
    expect((await req('POST', '/auth/pin-reset/confirm', { body: { dod_id: '1000000010', code, new_pin: '11112222' } })).json.code).toBe('CODE_EXPIRED');
    await new Promise((res) => setTimeout(res, 0));
    expect(sent().some((m) => m.subject.includes('PIN was reset'))).toBe(true);
    expect(actions()).toContain('user.pin_reset_email');
  });

  it('answers the same for unknown, unverified and verified accounts, and only emails verified ones', async () => {
    await signup('1000000011', { email: 'unverified@example.com' });
    fetchSpy.mockClear();
    for (const id of ['1000000011', '1999999999']) {
      expect((await req('POST', '/auth/pin-reset/request', { body: { dod_id: id } })).json).toEqual({ ok: true });
    }
    await new Promise((res) => setTimeout(res, 0));
    expect(sent()).toHaveLength(0);
    const r = await req('POST', '/auth/pin-reset/confirm', { body: { dod_id: '1999999999', code: '123456', new_pin: '24681357' } });
    expect(r.json.code).toBe('CODE_EXPIRED');
    expect((await req('POST', '/auth/pin-reset/confirm', { body: { dod_id: '1000000011', code: '123456', new_pin: '12' } })).status).toBe(400);
  });

  it('a verify code cannot reset a PIN', async () => {
    await signup('1000000012', { email: 'v@example.com' });
    const code = await lastCode('v@example.com');
    const r = await req('POST', '/auth/pin-reset/confirm', { body: { dod_id: '1000000012', code, new_pin: '24681357' } });
    expect(r.json.code).toBe('CODE_EXPIRED');
  });

  it('PIN change and admin reset notify a verified address; admins see emails', async () => {
    const u = await verifiedUser('1000000013', 'n@example.com');
    expect((await req('POST', '/auth/change-pin', { token: u.token, body: { current_pin: '123456', new_pin: '13572468' } })).status).toBe(200);
    const admin = await signup('9000000001');
    await req('POST', '/admin/claim', { token: admin.token, body: { code: CODE } });
    const users = (await req('GET', '/admin/users', { token: admin.token })).json as any[];
    expect(users.find((x) => x.id === u.profile.id)).toMatchObject({ email: 'n@example.com', email_verified: true });
    await req('POST', `/admin/users/${u.profile.id}/reset-pin`, { token: admin.token });
    await new Promise((res) => setTimeout(res, 0));
    const subjects = sent().filter((m) => m.to.includes('n@example.com')).map((m) => m.subject);
    expect(subjects).toEqual(expect.arrayContaining(['PMCS Pro: your PIN was changed', 'PMCS Pro: an admin reset your PIN']));
  });
});
