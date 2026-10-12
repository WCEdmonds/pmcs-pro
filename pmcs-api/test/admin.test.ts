import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import worker, { app } from '../src/index';
import { runBackup, BACKUP_CRON, DAILY_CRON } from '../src/backup';
import { makeEnv, migrations, FakeD1, type FakeR2 } from './fake-env.mjs';
import type { Env } from '../src/index';

// Fake UICs and DoD IDs only.
const A = 'WXYZA0';
const B = 'WXYZB0';
const CODE = 'test-bootstrap-code-1234';

let env: Env;
let DB: FakeD1;
let FILES: FakeR2;

async function req(method: string, path: string, opts: { token?: string; body?: unknown; raw?: BodyInit; headers?: Record<string, string> } = {}) {
  const headers: Record<string, string> = { ...opts.headers };
  if (opts.token) headers.Authorization = `Bearer ${opts.token}`;
  let body: BodyInit | undefined = opts.raw;
  if (opts.body !== undefined) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(opts.body);
  }
  const res = await app.request(`http://api.test${path}`, { method, headers, body }, env);
  const text = await res.text();
  let json: any;
  try { json = JSON.parse(text); } catch { json = text; }
  return { status: res.status, json, headers: res.headers };
}

async function signup(dodId: string, unit: string, pin = '123456', names: Record<string, string> = {}) {
  const r = await req('POST', '/auth/signup', { body: { dod_id: dodId, pin, unit, rank: 'SGT', first_name: 'Test', last_name: 'User', ...names } });
  expect(r.status).toBe(200);
  return r.json as { token: string; profile: { id: string; role: string; must_change_pin: boolean } };
}

const login = (dodId: string, pin: string) => req('POST', '/auth/login', { body: { dod_id: dodId, pin } });

async function makeAdmin(dodId = '9000000001', unit = A) {
  const u = await signup(dodId, unit);
  const r = await req('POST', '/admin/claim', { token: u.token, body: { code: CODE } });
  expect(r.json).toEqual({ ok: true, role: 'admin' });
  return u;
}

const actions = () => DB.q<{ action: string }>('SELECT action FROM audit_log ORDER BY at, rowid').map((r) => r.action);

const syncBody = (sessionId: string, unit = A) => ({
  vehicle: { bumper_number: 'HQ-1', vehicle_type: 'HMMWV', unit, current_odometer: 10 },
  inspection: { inspection_type: 'BEFORE', date: '2026-10-12', completed_at: '2026-10-12T10:30:00Z', client_session_id: sessionId },
  faults: [
    { client_fault_id: 'a', item: '1', readiness: 'NMC', description: 'Flat' },
    { client_fault_id: 'b', item: '2', readiness: 'PMC', description: 'Dim' },
  ],
});

/** A token signed the way they were before `tv` existed. */
async function legacyToken(secret: string, sub: string, dodId: string) {
  const b64 = (s: string | Uint8Array) => Buffer.from(s).toString('base64url');
  const head = b64(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = b64(JSON.stringify({ sub, dod_id: dodId, exp: Math.floor(Date.now() / 1000) + 3600 }));
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${head}.${body}`)));
  return `${head}.${body}.${b64(sig)}`;
}

let fetchSpy: ReturnType<typeof vi.spyOn>;
const sentEmails = () => fetchSpy.mock.calls.map((c: any) => JSON.parse(c[1].body as string));

beforeEach(() => {
  ({ env, DB, FILES } = makeEnv({ ADMIN_BOOTSTRAP_CODE: CODE }));
  fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}'));
});
afterEach(() => fetchSpy.mockRestore());

describe('migration 0002', () => {
  it('applies cleanly on top of 0001 with existing rows', () => {
    const db = new FakeD1({ upTo: '0001_init.sql' });
    db.q(`INSERT INTO profiles (id, dod_id, pin_hash, unit) VALUES ('p1', '1000000001', 'x', '${A}') RETURNING id`);
    db.q(`INSERT INTO vehicles (id, bumper_number, unit) VALUES ('v1', 'HQ-1', '${A}') RETURNING id`);
    const m2 = migrations().find((m) => m.name.startsWith('0002'))!;
    db.db.exec(m2.sql);
    expect(db.q('SELECT role, token_version, must_change_pin FROM profiles')).toEqual([{ role: 'member', token_version: 0, must_change_pin: 0 }]);
    for (const t of ['audit_log', 'unit_settings', 'client_status']) {
      expect(db.q(`SELECT COUNT(*) AS n FROM ${t}`)).toEqual([{ n: 0 }]);
    }
    const idx = db.q<{ name: string }>("SELECT name FROM sqlite_master WHERE type = 'index' AND tbl_name = 'audit_log' AND name LIKE 'idx_%' ORDER BY name").map((r) => r.name);
    expect(idx).toEqual(['idx_audit_log_action_at', 'idx_audit_log_actor_at', 'idx_audit_log_unit_at']);
    expect(db.q('SELECT COUNT(*) AS n FROM vehicles')).toEqual([{ n: 1 }]);
  });
});

describe('sessions', () => {
  it('login and /me include role and must_change_pin; tokens without tv still work', async () => {
    const s = await signup('1000000001', A);
    expect(s.profile).toMatchObject({ role: 'member', must_change_pin: false });
    expect(s.profile).not.toHaveProperty('token_version');
    const l = await login('1000000001', '123456');
    expect(l.json.profile).toMatchObject({ role: 'member', must_change_pin: false });
    expect(l.json.profile).not.toHaveProperty('token_version');
    const me = await req('GET', '/me', { token: l.json.token });
    expect(me.json).toMatchObject({ role: 'member', must_change_pin: false, visible_units: [A] });

    const legacy = await legacyToken('test-secret', s.profile.id, '1000000001');
    expect((await req('GET', '/me', { token: legacy })).status).toBe(200);
  });

  it('sign-out-everywhere revokes every token, including tokens without tv', async () => {
    const s = await signup('1000000002', A);
    const second = (await login('1000000002', '123456')).json.token;
    const legacy = await legacyToken('test-secret', s.profile.id, '1000000002');
    expect(await req('POST', '/auth/sign-out-everywhere', { token: s.token })).toMatchObject({ status: 200, json: { ok: true } });
    for (const t of [s.token, second, legacy]) expect((await req('GET', '/me', { token: t })).status).toBe(401);
    const fresh = (await login('1000000002', '123456')).json.token;
    expect((await req('GET', '/me', { token: fresh })).status).toBe(200);
    expect((await req('POST', '/auth/refresh', { token: fresh })).status).toBe(200);
    expect(actions()).toContain('user.sign_out_everywhere');
  });

  it('change-pin verifies the current PIN, validates, rotates the session', async () => {
    const s = await signup('1000000003', A);
    expect((await req('POST', '/auth/change-pin', { token: s.token, body: { current_pin: '123456', new_pin: '12' } })).status).toBe(400);
    expect((await req('POST', '/auth/change-pin', { token: s.token, body: { current_pin: '123456', new_pin: '123456' } })).status).toBe(400);
    const wrong = await req('POST', '/auth/change-pin', { token: s.token, body: { current_pin: '000000', new_pin: '87654321' } });
    expect(wrong).toMatchObject({ status: 403, json: { code: 'INVALID_PIN' } });

    const ok = await req('POST', '/auth/change-pin', { token: s.token, body: { current_pin: '123456', new_pin: '87654321' } });
    expect(ok.status).toBe(200);
    expect(Object.keys(ok.json).sort()).toEqual(['profile', 'token']);
    expect(ok.json.profile).toMatchObject({ must_change_pin: false });
    expect((await req('GET', '/me', { token: s.token })).status).toBe(401);
    expect((await req('GET', '/me', { token: ok.json.token })).status).toBe(200);
    expect((await login('1000000003', '123456')).status).toBe(401);
    expect((await login('1000000003', '87654321')).status).toBe(200);
    expect(DB.q('SELECT failed_logins FROM profiles')[0].failed_logins).toBe(0);
    const row = DB.q<{ details: string }>("SELECT details FROM audit_log WHERE action = 'user.pin_change'")[0];
    expect(row.details).not.toMatch(/87654321|123456|1000000003/);
  });

  it('change-pin has lockout semantics', async () => {
    const s = await signup('1000000004', A);
    const tries = [];
    for (let i = 0; i < 5; i++) tries.push((await req('POST', '/auth/change-pin', { token: s.token, body: { current_pin: '000000', new_pin: '87654321' } })).status);
    expect(tries).toEqual([403, 403, 403, 403, 429]);
    expect((await req('POST', '/auth/change-pin', { token: s.token, body: { current_pin: '123456', new_pin: '87654321' } })).status).toBe(429);
    expect((await login('1000000004', '123456')).status).toBe(429);
    const locked = DB.q<any>("SELECT * FROM audit_log WHERE action = 'auth.locked'");
    expect(locked).toHaveLength(1);
    expect(locked[0]).toMatchObject({ unit: A, actor_dod_last4: '0004', target_id: s.profile.id });
  });

  it('login lockout is audited once', async () => {
    await signup('1000000005', A);
    await Promise.all(Array.from({ length: 8 }, () => login('1000000005', '000000')));
    expect(actions().filter((a) => a === 'auth.locked')).toHaveLength(1);
  });
});

describe('admin', () => {
  it('claim limit holds under parallel guesses', async () => {
    const w = await signup('1000000019', A);
    const res = await Promise.all(Array.from({ length: 12 }, () => req('POST', '/admin/claim', { token: w.token, body: { code: 'nope' } })));
    expect(res.filter((r) => r.status === 403)).toHaveLength(5);
    expect(res.filter((r) => r.status === 429)).toHaveLength(7);
    expect((await req('POST', '/admin/claim', { token: w.token, body: { code: CODE } })).status).toBe(429);
  });

  it('claim: needs the configured code, is rate-limited and audited', async () => {
    const u = await signup('1000000010', A);
    env = { ...env, ADMIN_BOOTSTRAP_CODE: undefined };
    expect((await req('POST', '/admin/claim', { token: u.token, body: { code: CODE } })).status).toBe(403);
    env = { ...env, ADMIN_BOOTSTRAP_CODE: CODE };
    expect((await req('POST', '/admin/claim', { token: u.token, body: {} })).status).toBe(400);
    // The attempt without a configured code counts as a failure too: 1 + 3 = 4 (< 5).
    for (let i = 0; i < 3; i++) expect((await req('POST', '/admin/claim', { token: u.token, body: { code: 'nope' } })).status).toBe(403);
    expect((await req('POST', '/admin/claim', { token: u.token, body: { code: CODE } })).status).toBe(200);
    expect((await req('POST', '/admin/claim', { token: u.token, body: { code: CODE } })).status).toBe(200); // idempotent
    expect((await req('GET', '/me', { token: u.token })).json.role).toBe('admin');
    expect(actions().filter((a) => a.startsWith('admin.claim'))).toEqual([...Array(4).fill('admin.claim_failed'), 'admin.claim', 'admin.claim']); // repeat claims are audited too

    const v = await signup('1000000011', A);
    for (let i = 0; i < 5; i++) await req('POST', '/admin/claim', { token: v.token, body: { code: 'nope' } });
    expect((await req('POST', '/admin/claim', { token: v.token, body: { code: CODE } })).status).toBe(429);

    let calls = 0;
    env = { ...env, LOGIN_LIMITER: { limit: async () => ({ success: ++calls <= 1 }) } } as Env;
    const w = await signup('1000000012', A);
    calls = 0;
    expect((await req('POST', '/admin/claim', { token: w.token, body: { code: 'x' } })).status).toBe(403);
    expect((await req('POST', '/admin/claim', { token: w.token, body: { code: CODE } })).status).toBe(429);
  });

  it('members get 403 on every admin endpoint', async () => {
    const m = await signup('1000000020', A);
    const calls: Array<[string, string, unknown?]> = [
      ['GET', '/admin/users'], ['POST', `/admin/users/${m.profile.id}/reset-pin`],
      ['POST', `/admin/users/${m.profile.id}/sign-out-everywhere`], ['POST', `/admin/users/${m.profile.id}/role`, { role: 'admin' }],
      ['PATCH', `/admin/users/${m.profile.id}`, { unit: B }], ['GET', '/admin/audit'], ['GET', '/admin/unit-settings'],
      ['PUT', `/admin/unit-settings/${A}`, { notification_emails: [] }],
    ];
    for (const [method, path, body] of calls) {
      expect([method, path, (await req(method, path, { token: m.token, body })).status]).toEqual([method, path, 403]);
    }
    expect((await req('GET', '/me', { token: m.token })).json.role).toBe('member');
  });

  it('lists users with the DoD ID last 4 only, filters by unit and q', async () => {
    const admin = await makeAdmin();
    await signup('1000000031', B, '123456', { last_name: 'Alpha' });
    await signup('1000000032', B, '123456', { last_name: 'Bravo' });
    const all = await req('GET', '/admin/users', { token: admin.token });
    expect(all.json).toHaveLength(3);
    expect(JSON.stringify(all.json)).not.toMatch(/100000003|9000000001/);
    expect(Object.keys(all.json[0]).sort()).toEqual(
      ['created_at', 'dod_last4', 'first_name', 'id', 'last_name', 'locked_until', 'mi', 'must_change_pin', 'rank', 'role', 'unit'].sort());
    expect((await req('GET', `/admin/users?unit=${B.toLowerCase()}`, { token: admin.token })).json).toHaveLength(2);
    expect((await req('GET', '/admin/users?q=brav', { token: admin.token })).json.map((u: any) => u.last_name)).toEqual(['Bravo']);
    expect((await req('GET', '/admin/users?q=0031', { token: admin.token })).json.map((u: any) => u.dod_last4)).toEqual(['0031']);
    expect((await req('GET', '/admin/users?q=%25', { token: admin.token })).json).toHaveLength(0);
    expect((await req('GET', '/admin/users?limit=1', { token: admin.token })).json).toHaveLength(1);
  });

  it('reset-pin: temp PIN, forced change, unlock, sessions revoked; must_change_pin gates other routes', async () => {
    const admin = await makeAdmin();
    const u = await signup('1000000040', A);
    DB.q(`UPDATE profiles SET failed_logins = 3, locked_until = '2999-01-01T00:00:00Z' WHERE id = ? RETURNING id`, u.profile.id);
    expect((await req('GET', '/admin/users?q=0040', { token: admin.token })).json[0].locked_until).toBe('2999-01-01T00:00:00Z');

    const r = await req('POST', `/admin/users/${u.profile.id}/reset-pin`, { token: admin.token });
    expect(r.status).toBe(200);
    expect(r.json.temp_pin).toMatch(/^\d{8}$/);
    expect((await req('GET', '/me', { token: u.token })).status).toBe(401);
    expect(DB.q('SELECT failed_logins, locked_until, must_change_pin FROM profiles WHERE id = ?', u.profile.id)[0])
      .toEqual({ failed_logins: 0, locked_until: null, must_change_pin: 1 });
    expect((await req('POST', '/admin/users/nope/reset-pin', { token: admin.token })).status).toBe(404);

    const l = await login('1000000040', r.json.temp_pin);
    expect(l.json.profile.must_change_pin).toBe(true);
    const t = l.json.token;
    const gated = await req('GET', '/vehicles', { token: t });
    expect(gated).toMatchObject({ status: 403, json: { error: 'PIN change required', code: 'PIN_CHANGE_REQUIRED' } });
    expect((await req('PATCH', '/me', { token: t, body: { rank: 'SSG' } })).status).toBe(403);
    expect((await req('POST', '/client-status', { token: t, body: { unsent_count: 0, failed_count: 0 } })).status).toBe(403);
    expect((await req('GET', '/me', { token: t })).json.must_change_pin).toBe(true);
    expect((await req('POST', '/auth/refresh', { token: t })).status).toBe(200);

    const ch = await req('POST', '/auth/change-pin', { token: t, body: { current_pin: r.json.temp_pin, new_pin: '24681357' } });
    expect(ch.status).toBe(200);
    expect((await req('GET', '/vehicles', { token: ch.json.token })).status).toBe(200);
    const audit = DB.q<any>("SELECT * FROM audit_log WHERE action = 'admin.pin_reset'")[0];
    expect(audit).toMatchObject({ actor_id: admin.profile.id, target_id: u.profile.id, unit: A });
    expect(audit.details).not.toContain(r.json.temp_pin);
  });

  it('admin sign-out-everywhere revokes the target only', async () => {
    const admin = await makeAdmin();
    const u = await signup('1000000050', A);
    expect((await req('POST', `/admin/users/${u.profile.id}/sign-out-everywhere`, { token: admin.token })).json).toEqual({ ok: true });
    expect((await req('GET', '/me', { token: u.token })).status).toBe(401);
    expect((await req('GET', '/me', { token: admin.token })).status).toBe(200);
  });

  it('role changes never demote the last admin', async () => {
    const admin = await makeAdmin();
    const u = await signup('1000000060', B);
    expect((await req('POST', `/admin/users/${u.profile.id}/role`, { token: admin.token, body: { role: 'boss' } })).status).toBe(400);
    expect((await req('POST', `/admin/users/${admin.profile.id}/role`, { token: admin.token, body: { role: 'member' } })).status).toBe(409);
    const promoted = await req('POST', `/admin/users/${u.profile.id}/role`, { token: admin.token, body: { role: 'admin' } });
    expect(promoted.json).toMatchObject({ ok: true, user: { id: u.profile.id, role: 'admin' } });
    expect((await req('GET', '/admin/users', { token: u.token })).status).toBe(200);
    expect((await req('POST', `/admin/users/${admin.profile.id}/role`, { token: admin.token, body: { role: 'member' } })).status).toBe(200);
    expect((await req('GET', '/admin/users', { token: admin.token })).status).toBe(403);
    expect((await req('POST', `/admin/users/${u.profile.id}/role`, { token: u.token, body: { role: 'member' } })).status).toBe(409);
    expect(DB.q("SELECT COUNT(*) AS n FROM profiles WHERE role = 'admin'")[0].n).toBe(1);
    expect(actions().filter((a) => a === 'admin.role_change')).toHaveLength(2);
  });

  it('moves a user between units and emails the new unit', async () => {
    env = { ...env, RESEND_API_KEY: 'k', NOTIFICATION_EMAIL: 'fallback@example.com' };
    const admin = await makeAdmin();
    const u = await signup('1000000070', A);
    await req('PUT', `/admin/unit-settings/${B}`, { token: admin.token, body: { notification_emails: ['b-ops@example.com'] } });
    fetchSpy.mockClear();
    expect((await req('PATCH', `/admin/users/${u.profile.id}`, { token: admin.token, body: { unit: 'xx' } })).status).toBe(400);
    expect((await req('PATCH', `/admin/users/${u.profile.id}`, { token: admin.token, body: { unit: B, role: 'admin' } })).status).toBe(400);
    const r = await req('PATCH', `/admin/users/${u.profile.id}`, { token: admin.token, body: { unit: B.toLowerCase() } });
    expect(r.json).toMatchObject({ ok: true, user: { unit: B } });
    await new Promise((res) => setTimeout(res, 10));
    expect(sentEmails().map((m: any) => [m.subject, m.to])).toEqual([[`PMCS Pro: new member in ${B}`, ['b-ops@example.com']]]);
    const row = DB.q<any>("SELECT * FROM audit_log WHERE action = 'user.unit_change'")[0];
    expect(row).toMatchObject({ unit: B, actor_id: admin.profile.id, target_id: u.profile.id });
    expect(JSON.parse(row.details)).toMatchObject({ from: A, to: B, by_admin: true });
  });

  it('unit settings: every known UIC, validated emails', async () => {
    const admin = await makeAdmin();
    const u = await signup('1000000080', B);
    await req('PUT', `/uic/${B}`, { token: u.token, body: { unit_name: 'B Company' } });
    DB.q(`INSERT INTO vehicles (id, bumper_number, unit) VALUES ('v9', 'X-1', 'WXYZC0') RETURNING id`);
    const list = await req('GET', '/admin/unit-settings', { token: admin.token });
    expect(list.json).toEqual([
      { uic: A, unit_name: null, notification_emails: [], updated_at: null },
      { uic: B, unit_name: 'B Company', notification_emails: [], updated_at: null },
      { uic: 'WXYZC0', unit_name: null, notification_emails: [], updated_at: null },
    ]);
    const put = (body: unknown) => req('PUT', `/admin/unit-settings/${A}`, { token: admin.token, body });
    expect((await put({ notification_emails: 'a@b.com' })).status).toBe(400);
    expect((await put({ notification_emails: ['not-an-email'] })).status).toBe(400);
    expect((await put({ notification_emails: Array.from({ length: 11 }, (_, i) => `x${i}@example.com`) })).status).toBe(400);
    const ok = await put({ notification_emails: [' Ops@Example.com ', 'ops@example.com', 'xo@example.org'] });
    expect(ok.json).toMatchObject({ uic: A, notification_emails: ['ops@example.com', 'xo@example.org'], updated_at: expect.any(String) });
    expect((await req('PUT', '/admin/unit-settings/bad', { token: admin.token, body: { notification_emails: [] } })).status).toBe(400);
  });

  it('audit log: filters and keyset pagination, newest first', async () => {
    const admin = await makeAdmin();
    const u = await signup('1000000090', B);
    for (const uic of ['WXYZC0', 'WXYZD0', 'WXYZE0']) await req('POST', '/watched-uics', { token: u.token, body: { uic } });
    const p1 = await req('GET', '/admin/audit?limit=2', { token: admin.token });
    expect(p1.json.items).toHaveLength(2);
    expect(p1.json.items[0].at >= p1.json.items[1].at).toBe(true);
    const seen = [...p1.json.items];
    let before = p1.json.next_before;
    while (before) {
      const p = await req('GET', `/admin/audit?limit=2&before=${encodeURIComponent(before)}`, { token: admin.token });
      seen.push(...p.json.items);
      before = p.json.next_before;
    }
    expect(seen.map((i) => i.id)).toEqual(DB.q<{ id: string }>('SELECT id FROM audit_log ORDER BY at DESC, id DESC').map((r) => r.id));
    expect(new Set(seen.map((i) => i.id)).size).toBe(seen.length);

    const byUnit = await req('GET', `/admin/audit?unit=${B}`, { token: admin.token });
    expect(byUnit.json.items.map((i: any) => i.action)).toEqual(['user.signup']);
    expect(byUnit.json.items[0].details).toEqual({ unit: B });
    const byAction = await req('GET', '/admin/audit?action=watch.add', { token: admin.token });
    expect(byAction.json.items).toHaveLength(3);
    const byFamily = await req('GET', '/admin/audit?action=watch.', { token: admin.token });
    expect(byFamily.json.items).toHaveLength(3);
    expect((await req('GET', '/admin/audit?action=watch', { token: admin.token })).json.items).toHaveLength(0);
    const adminFamily = await req('GET', '/admin/audit?action=admin.', { token: admin.token });
    expect(adminFamily.json.items.every((i: any) => i.action.startsWith('admin.'))).toBe(true);
    expect((await req('GET', `/admin/audit?actor_id=${admin.profile.id}`, { token: admin.token })).json.items.map((i: any) => i.action))
      .toEqual(['admin.claim', 'user.signup']);
    expect((await req('GET', '/admin/audit?since=2999-01-01', { token: admin.token })).json).toEqual({ items: [], next_before: null });
    const today = new Date().toISOString().slice(0, 10);
    expect((await req('GET', `/admin/audit?until=${today}`, { token: admin.token })).json.items.length).toBe(seen.length);
    expect((await req('GET', '/admin/audit?since=garbage', { token: admin.token })).status).toBe(400);
    expect((await req('GET', '/admin/audit?before=nope', { token: admin.token })).status).toBe(400);
  });
});

describe('audit rows for every state change', () => {
  it('records each action category with the affected unit and no secrets', async () => {
    const admin = await makeAdmin('9000000002', B);
    const u = await signup('1000000100', A);
    const t = u.token;
    await req('PATCH', '/me', { token: t, body: { rank: 'SSG' } });
    await req('PATCH', '/me', { token: t, body: { unit: B } });
    await req('PATCH', '/me', { token: t, body: { unit: A } });
    const w = await req('POST', '/watched-uics', { token: t, body: { uic: 'WXYZC0' } });
    await req('DELETE', `/watched-uics/${w.json.id}`, { token: t });
    await req('PUT', `/uic/${A}`, { token: t, body: { unit_name: 'Alpha' } });
    await req('PUT', `/uic/${A}`, { token: t, body: { unit_name: 'Alpha' } }); // unchanged: no row
    await req('PUT', `/uic/${A}`, { token: t, body: { unit_name: 'Alpha Co' } });

    const s = await req('POST', '/inspections/sync', { token: t, body: syncBody('s1') });
    expect(s.status).toBe(200);
    await req('POST', '/inspections/sync', { token: t, body: syncBody('s1') }); // idempotent re-send: no row
    const [f1, f2] = s.json.fault_ids;
    await req('PATCH', '/faults', { token: t, body: { ids: [f1, f2], resolution_status: 'ACKNOWLEDGED', gcss_work_order: 'WO-1' } });
    await req('PATCH', '/faults', { token: t, body: { ids: [f1], resolution_status: 'CORRECTED' } });
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0]);
    await req('POST', `/faults/${f1}/photos?session=s1&photo=1`, { token: t, raw: png });
    const attempt = { id: 'att-1', fault_id: f2, session_id: 's1', category_id: 'c', outcome: 'skipped', readiness_result: 'PMC' };
    await req('POST', '/diagnosis-attempts', { token: t, body: [attempt] });
    await req('POST', '/diagnosis-attempts', { token: t, body: [attempt] }); // re-send: no row
    const iid = s.json.inspection_id;
    expect((await req('POST', `/inspections/${iid}/da2404`, { token: t })).status).toBe(200);
    expect((await req('POST', `/inspections/${iid}/da2404?regenerate=1`, { token: t })).status).toBe(200);
    expect((await req('PUT', `/inspections/${iid}/da2404`, { token: t, raw: '%PDF-1.4 x' })).status).toBe(200);
    await req('POST', '/auth/change-pin', { token: t, body: { current_pin: '123456', new_pin: '654321' } });
    await req('PUT', `/admin/unit-settings/${A}`, { token: admin.token, body: { notification_emails: ['a@example.com'] } });

    const counts: Record<string, number> = {};
    for (const a of actions()) counts[a] = (counts[a] ?? 0) + 1;
    expect(counts).toEqual({
      'user.signup': 2, 'admin.claim': 1, 'user.profile_update': 1, 'user.unit_change': 2,
      'watch.add': 1, 'watch.remove': 1, 'uic.name': 1, 'uic.rename': 1, 'inspection.synced': 1,
      'fault.acknowledge': 2, 'fault.resolve': 1, 'photo.upload': 1, 'diagnosis.upload': 1,
      'da2404.generate': 1, 'da2404.regenerate': 1, 'da2404.upload': 1, 'user.pin_change': 1, 'unit_settings.update': 1,
    });

    const rows = DB.q<any>('SELECT * FROM audit_log');
    const dump = JSON.stringify(rows);
    expect(dump).not.toMatch(/1000000100|9000000002|123456|654321|pbkdf2/);
    const synced = rows.find((r) => r.action === 'inspection.synced');
    expect(synced).toMatchObject({ unit: A, target_type: 'inspection', target_id: iid, actor_id: u.profile.id, actor_dod_last4: '0100', actor_name: 'SSG Test User' });
    expect(JSON.parse(synced.details)).toMatchObject({ bumper_number: 'HQ-1', inspection_type: 'BEFORE', fault_count: 2 });
    const resolved = rows.find((r) => r.action === 'fault.resolve');
    expect(resolved).toMatchObject({ target_id: f1, unit: A });
    expect(JSON.parse(resolved.details)).toMatchObject({ from: 'ACKNOWLEDGED', to: 'CORRECTED', gcss_work_order: 'WO-1' });
    const ack = rows.find((r) => r.action === 'fault.acknowledge' && r.target_id === f2);
    expect(JSON.parse(ack.details)).toMatchObject({ from: 'OPEN', to: 'ACKNOWLEDGED', gcss_work_order: 'WO-1' });
    const moves = rows.filter((r) => r.action === 'user.unit_change').map((r) => [r.unit, JSON.parse(r.details)]);
    expect(moves).toEqual([[B, { from: A, to: B }], [A, { from: B, to: A }]]);
    expect(JSON.parse(rows.find((r) => r.action === 'user.profile_update').details)).toEqual({ changes: { rank: { from: 'SGT', to: 'SSG' } } });
  });

  it('a failing audit write never fails a best-effort request', async () => {
    const u = await signup('1000000110', A);
    DB.db.exec('DROP TABLE audit_log');
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect((await req('POST', '/watched-uics', { token: u.token, body: { uic: B } })).status).toBe(200);
    spy.mockRestore();
  });
});

describe('client status', () => {
  it('validates, upserts and is visible only to the unit and its watchers', async () => {
    const a = await signup('1000000200', A, '123456', { last_name: 'Able' });
    const b = await signup('1000000201', B);
    const post = (body: unknown, token = a.token) => req('POST', '/client-status', { token, body });
    expect((await post({ unsent_count: -1, failed_count: 0 })).status).toBe(400);
    expect((await post({ unsent_count: 1 })).status).toBe(400);
    expect((await post({ unsent_count: 1, failed_count: 0, last_error: 5 })).status).toBe(400);
    expect((await post({ unsent_count: 1, failed_count: 0, oldest_unsent_at: 'yesterday' })).status).toBe(400);
    expect(await post({ unsent_count: 2, failed_count: 1, last_error: 'x'.repeat(5000), oldest_unsent_at: '2026-10-10T00:00:00Z', app_version: '1.2.3' }))
      .toMatchObject({ status: 200, json: { ok: true } });
    expect((await post({ unsent_count: 0, failed_count: 0 }, b.token)).status).toBe(200);

    const mine = await req('GET', '/client-status', { token: a.token });
    expect(mine.json).toEqual([{
      user_id: a.profile.id, rank: 'SGT', last_name: 'Able', first_name: 'Test', unit: A, unsent_count: 2, failed_count: 1,
      last_error: 'x'.repeat(1000), oldest_unsent_at: '2026-10-10T00:00:00.000Z', reported_at: expect.any(String), app_version: '1.2.3', stale: false,
    }]);
    expect((await req('GET', '/client-status', { token: b.token })).json).toEqual([]);
    await req('POST', '/watched-uics', { token: b.token, body: { uic: A } });
    expect((await req('GET', '/client-status', { token: b.token })).json).toHaveLength(1);
    expect((await req('GET', `/client-status?unit=${B}`, { token: b.token })).json).toHaveLength(0);

    DB.q(`UPDATE client_status SET reported_at = '2020-01-01T00:00:00.000Z' WHERE user_id = ? RETURNING user_id`, a.profile.id);
    expect((await req('GET', '/client-status', { token: a.token })).json[0].stale).toBe(true);
    expect(actions().some((x) => x.startsWith('client'))).toBe(false);
  });

  it('is rate-limited per user without using the per-IP auth budget', async () => {
    const a = await signup('1000000210', A);
    let login = 0;
    let ip = 0;
    env = { ...env, LOGIN_LIMITER: { limit: async () => ({ success: ++login <= 1 }) }, AUTH_IP_LIMITER: { limit: async () => ({ success: (++ip, true) }) } } as Env;
    expect((await req('POST', '/client-status', { token: a.token, body: { unsent_count: 0, failed_count: 0 } })).status).toBe(200);
    expect((await req('POST', '/client-status', { token: a.token, body: { unsent_count: 0, failed_count: 0 } })).status).toBe(429);
    expect(ip).toBe(0);
  });
});

describe('emails', () => {
  it('join email goes to the unit recipients, else NOTIFICATION_EMAIL, with escaped HTML', async () => {
    env = { ...env, RESEND_API_KEY: 'k', NOTIFICATION_EMAIL: 'fallback@example.com, second@example.com' };
    const admin = await makeAdmin('9000000003', 'WXYZC0');
    await req('PUT', `/admin/unit-settings/${B}`, { token: admin.token, body: { notification_emails: ['b1@example.com', 'b2@example.com'] } });
    fetchSpy.mockClear();

    const u = await signup('1000000300', A, '123456', { first_name: '<script>x</script>', last_name: 'O"Neil & Co' });
    await new Promise((r) => setTimeout(r, 10));
    let mails = sentEmails();
    expect(mails).toHaveLength(1);
    expect(mails[0]).toMatchObject({ subject: `PMCS Pro: new member in ${A}`, to: ['fallback@example.com', 'second@example.com'] });
    expect(mails[0].html).toContain('&lt;script&gt;x&lt;/script&gt;');
    expect(mails[0].html).toContain('O&quot;Neil &amp; Co');
    expect(mails[0].html).not.toContain('<script>');
    expect(mails[0].text).toContain('DoD ID (last 4): 0300');
    expect(mails[0].text).toMatch(/self-asserted/);
    expect(mails[0].text).toMatch(/audit log/);
    expect(JSON.stringify(mails[0])).not.toContain('1000000300');

    fetchSpy.mockClear();
    await req('PATCH', '/me', { token: u.token, body: { unit: B } });
    await req('PATCH', '/me', { token: u.token, body: { unit: B } }); // unchanged: no email
    await req('PATCH', '/me', { token: u.token, body: { rank: 'SSG' } });
    await new Promise((r) => setTimeout(r, 10));
    mails = sentEmails();
    expect(mails.map((m: any) => [m.subject, m.to])).toEqual([[`PMCS Pro: new member in ${B}`, ['b1@example.com', 'b2@example.com']]]);
    expect(mails[0].text).toContain('Rank: SGT');
  });

  it('DA 2404 goes to the vehicle unit recipients; no email without RESEND_API_KEY', async () => {
    const admin = await makeAdmin('9000000004', B);
    await req('PUT', `/admin/unit-settings/${A}`, { token: admin.token, body: { notification_emails: ['a-motorpool@example.com'] } });
    const u = await signup('1000000310', A);
    const s = await req('POST', '/inspections/sync', { token: u.token, body: syncBody('pdf') });
    await req('POST', `/inspections/${s.json.inspection_id}/da2404`, { token: u.token });
    await new Promise((r) => setTimeout(r, 10));
    expect(fetchSpy).not.toHaveBeenCalled();

    env = { ...env, RESEND_API_KEY: 'k', NOTIFICATION_EMAIL: 'fallback@example.com' };
    await req('POST', `/inspections/${s.json.inspection_id}/da2404?regenerate=1`, { token: u.token });
    await new Promise((r) => setTimeout(r, 10));
    expect(sentEmails().map((m: any) => m.to)).toEqual([['a-motorpool@example.com']]);
  });

  it('a failing Resend call never fails the request', async () => {
    fetchSpy.mockRejectedValue(new Error('network down'));
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    env = { ...env, RESEND_API_KEY: 'k', NOTIFICATION_EMAIL: 'fallback@example.com' };
    await signup('1000000320', A);
    await new Promise((r) => setTimeout(r, 10));
    spy.mockRestore();
  });
});

describe('backups', () => {
  it('weekly cron writes a gzip JSON snapshot and prunes backups older than 12 weeks', async () => {
    await signup('1000000400', A);
    for (const d of ['2026-01-04', '2026-07-19', '2026-07-26', '2026-10-04']) FILES.objects.set(`backups/${d}.json.gz`, { bytes: new Uint8Array([1]) });
    FILES.objects.set('backups/notes.txt', { bytes: new Uint8Array([1]) });
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    const res = await runBackup(env, new Date('2026-10-11T03:17:00Z'));
    log.mockRestore();
    expect(res.key).toBe('backups/2026-10-11.json.gz');
    // Cutoff is 2026-07-19 (84 days): strictly older ones go.
    expect(res.deleted).toEqual(['backups/2026-01-04.json.gz']);
    expect([...FILES.objects.keys()].filter((k) => k.startsWith('backups/')).sort()).toEqual([
      'backups/2026-07-19.json.gz', 'backups/2026-07-26.json.gz', 'backups/2026-10-04.json.gz', 'backups/2026-10-11.json.gz', 'backups/notes.txt',
    ]);
    const gz = new Blob([FILES.objects.get(res.key)!.bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
    const snap = JSON.parse(await new Response(gz).text());
    expect(snap).toMatchObject({ format: 'pmcs-pro-d1-backup', version: 1 });
    expect(snap.tables.profiles).toHaveLength(1);
    expect(snap.tables.profiles[0].dod_id).toBe('1000000400');
    expect(Object.keys(snap.tables)).toEqual(expect.arrayContaining(['profiles', 'vehicles', 'faults', 'audit_log', 'unit_settings', 'client_status']));
    expect(snap.schema.some((s: any) => s.type === 'trigger' && s.name === 'faults_vehicle_status_insert')).toBe(true);
  });

  it('scheduled() dispatches on event.cron; /files never serves backups', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    DB.q(`INSERT INTO vehicles (id, bumper_number, unit) VALUES ('v1', 'HQ-1', '${A}') RETURNING id`);
    await worker.scheduled({ cron: DAILY_CRON } as ScheduledController, env);
    expect(DB.q('SELECT COUNT(*) AS n FROM vehicle_status_history')[0].n).toBe(1);
    expect([...FILES.objects.keys()].some((k) => k.startsWith('backups/'))).toBe(false);
    await worker.scheduled({ cron: BACKUP_CRON } as ScheduledController, env);
    log.mockRestore();
    const key = [...FILES.objects.keys()].find((k) => k.startsWith('backups/'))!;
    expect(key).toMatch(/^backups\/\d{4}-\d{2}-\d{2}\.json\.gz$/);
    // Even with a valid signature for the key.
    const { signFileUrl } = await import('../src/auth');
    const signed = await signFileUrl('test-secret', key);
    expect((await app.request(`/files/${key}?${signed}`, {}, env)).status).toBe(404);
    expect((await app.request(`/files/${key}`, {}, env)).status).toBe(404);
  });
});

describe('CORS', () => {
  const preflight = async (origin: string) => (await app.request('/me',
    { method: 'OPTIONS', headers: { Origin: origin, 'Access-Control-Request-Method': 'GET' } }, env)).headers.get('access-control-allow-origin');

  it('production is exact-match; ALLOWED_ORIGIN_PATTERNS adds preview channels', async () => {
    env = { ...env, ALLOWED_ORIGINS: 'https://pmcs-pro.web.app' };
    expect(await preflight('https://pmcs-pro.web.app')).toBe('https://pmcs-pro.web.app');
    expect(await preflight('https://pmcs-pro--pr12-abc.web.app')).toBeNull();
    env = { ...env, ALLOWED_ORIGIN_PATTERNS: '^https://pmcs-(pro|dashboard)--[a-z0-9-]+\\.web\\.app$' };
    expect(await preflight('https://pmcs-pro--pr12-abc.web.app')).toBe('https://pmcs-pro--pr12-abc.web.app');
    expect(await preflight('https://pmcs-dashboard--x1.web.app')).toBe('https://pmcs-dashboard--x1.web.app');
    expect(await preflight('https://evil--x1.web.app')).toBeNull();
    expect(await preflight('https://pmcs-pro--x1.web.app.evil.com')).toBeNull();
  });
});

describe('worker module', () => {
  it('exports only handler-compatible values (workerd rejects plain values on the main module)', async () => {
    const mod: Record<string, unknown> = await import('../src/index');
    for (const [k, v] of Object.entries(mod)) {
      if (k === 'default') continue;
      expect([k, typeof v === 'function' || typeof (v as { fetch?: unknown })?.fetch === 'function']).toEqual([k, true]);
    }
  });
});
