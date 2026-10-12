import { describe, it, expect, beforeEach, vi } from 'vitest';
import { app, visibleUnits } from '../src/index';
import { makeEnv, type FakeD1, type FakeR2 } from './fake-env.mjs';
import type { Env } from '../src/index';

let env: Env;
let DB: FakeD1;
let FILES: FakeR2;

async function req(method: string, path: string, opts: { token?: string; body?: unknown; raw?: BodyInit } = {}) {
  const headers: Record<string, string> = {};
  if (opts.token) headers.Authorization = `Bearer ${opts.token}`;
  let body: BodyInit | undefined = opts.raw;
  if (opts.body !== undefined) {
    headers['Content-Type'] = 'application/json';
    body = typeof opts.body === 'string' ? opts.body : JSON.stringify(opts.body);
  }
  const res = await app.request(`http://api.test${path}`, { method, headers, body }, env);
  const text = await res.text();
  let json: any;
  try { json = JSON.parse(text); } catch { json = text; }
  return { status: res.status, json, headers: res.headers };
}

async function signup(dodId: string, unit: string, pin = '123456') {
  const r = await req('POST', '/auth/signup', { body: { dod_id: dodId, pin, unit, rank: 'SGT', first_name: 'Test', last_name: 'User' } });
  expect(r.status).toBe(200);
  return r.json as { token: string; profile: { id: string } };
}

const syncBody = (sessionId: string, over: Record<string, unknown> = {}) => ({
  vehicle: { bumper_number: 'HHC-20', vehicle_type: 'HMMWV', serial_number: null, registration_number: null, nomenclature: null, unit: 'AAAAA1', current_odometer: 100 },
  inspection: { inspector_dod_id: '0000000000', inspection_type: 'BEFORE', odometer_reading: 100, remarks: 'first', date: '2026-10-12', started_at: '2026-10-12T10:00:00Z', completed_at: '2026-10-12T10:30:00Z', client_session_id: sessionId },
  faults: [
    { client_fault_id: 'a', item: '1', item_description: 'Tires', readiness: 'NMC', description: 'Flat', corrected_on_site: false, needs_maintenance: true, part_needed: true },
    { client_fault_id: 'b', item: '2', item_description: 'Lights', readiness: 'FMC', description: 'Dim', corrected_on_site: false },
  ],
  ...over,
});

beforeEach(() => {
  ({ env, DB, FILES } = makeEnv());
});

describe('auth', () => {
  it('validates signup input and returns 409 for a taken DoD ID', async () => {
    expect((await req('POST', '/auth/signup', { body: 'nope' })).status).toBe(400);
    expect((await req('POST', '/auth/signup', { body: { dod_id: '123', pin: '123456', unit: 'AAAAA1' } })).json.error).toMatch(/10 digits/);
    expect((await req('POST', '/auth/signup', { body: { dod_id: '1234567890', pin: '1234', unit: 'AAAAA1' } })).json.error).toMatch(/6 to 12/);
    expect((await req('POST', '/auth/signup', { body: { dod_id: '1234567890', pin: '123456', unit: 'AAAAA12' } })).status).toBe(400);
    expect((await req('POST', '/auth/signup', { body: { dod_id: '1234567890', pin: '123456', unit: 'AAAAA1', last_name: ['x'] } })).status).toBe(400);
    const s = await signup('1234567890', ' aaaaa1 ');
    expect(s.profile).toMatchObject({ unit: 'AAAAA1', dod_id: '1234567890' });
    expect(s.profile).not.toHaveProperty('pin_hash');
    expect((await req('POST', '/auth/signup', { body: { dod_id: '1234567890', pin: '654321', unit: 'AAAAA1' } })).status).toBe(409);
  });

  it('lets the owner claim an imported profile without a PIN', async () => {
    DB.q(`INSERT INTO profiles (id, dod_id, pin_hash, last_name, unit) VALUES ('old-id', '1111111111', '!', 'Imported', 'AAAAA1') RETURNING id`);
    expect((await req('GET', '/auth/exists/1111111111')).json.exists).toBe(false);
    expect((await req('POST', '/auth/login', { body: { dod_id: '1111111111', pin: '123456' } })).status).toBe(401);
    const r = await req('POST', '/auth/signup', { body: { dod_id: '1111111111', pin: '123456', unit: 'BBBBB1', first_name: 'New', last_name: 'Name' } });
    expect(r.status).toBe(200);
    expect(r.json.profile).toMatchObject({ id: 'old-id', last_name: 'Imported', first_name: 'New', unit: 'AAAAA1' });
    expect((await req('POST', '/auth/login', { body: { dod_id: '1111111111', pin: '123456' } })).status).toBe(200);
    expect((await req('POST', '/auth/signup', { body: { dod_id: '1111111111', pin: '123456', unit: 'AAAAA1' } })).status).toBe(409);
  });

  it('locks the account at 5 failures even under parallel guesses', async () => {
    await signup('2222222222', 'AAAAA1', '246810');
    const results = await Promise.all(Array.from({ length: 9 }, () =>
      req('POST', '/auth/login', { body: { dod_id: '2222222222', pin: '000000' } })));
    const statuses = results.map((r) => r.status);
    expect(statuses.filter((s) => s === 401)).toHaveLength(4);
    expect(statuses.filter((s) => s === 429)).toHaveLength(5);
    const locked = await req('POST', '/auth/login', { body: { dod_id: '2222222222', pin: '246810' } });
    expect(locked.status).toBe(429);
    expect(locked.json.error).toMatch(/locked/);
  });

  it('resets the counter on success and upgrades bcrypt hashes', async () => {
    const bcrypt = (await import('bcryptjs')).default;
    DB.q(`INSERT INTO profiles (id, dod_id, pin_hash, unit, failed_logins) VALUES ('u', '3333333333', ?, 'AAAAA1', 3) RETURNING id`, bcrypt.hashSync('135790', 4));
    const r = await req('POST', '/auth/login', { body: { dod_id: '3333333333', pin: '135790' } });
    expect(r.status).toBe(200);
    const row = DB.q<{ pin_hash: string; failed_logins: number }>(`SELECT pin_hash, failed_logins FROM profiles WHERE id = 'u'`)[0];
    expect(row.pin_hash.startsWith('pbkdf2$')).toBe(true);
    expect(row.failed_logins).toBe(0);
  });

  it('uses the rate limiter when bound', async () => {
    let calls = 0;
    env = { ...env, LOGIN_LIMITER: { limit: async () => ({ success: ++calls <= 2 }) } } as Env;
    expect((await req('GET', '/auth/exists/1234567890')).status).toBe(200);
    expect((await req('GET', '/auth/exists/1234567890')).status).toBe(200);
    expect((await req('GET', '/auth/exists/1234567890')).status).toBe(429);
  });

  it('refreshes tokens and rejects missing ones', async () => {
    const { token } = await signup('4444444444', 'AAAAA1');
    const r = await req('POST', '/auth/refresh', { token });
    expect(Object.keys(r.json)).toEqual(['token']);
    expect((await req('GET', '/me', { token: r.json.token })).json.visible_units).toEqual(['AAAAA1']);
    expect((await req('GET', '/me')).status).toBe(401);
  });
});

describe('access model', () => {
  it('visibleUnits = own unit first + watched UICs; writes = own only', async () => {
    const { token, profile } = await signup('5555555555', 'AAAAA1');
    expect((await req('POST', '/watched-uics', { token, body: { uic: 'aaaaa1' } })).status).toBe(400);
    expect((await req('POST', '/watched-uics', { token, body: { uic: 'ccccc1' } })).status).toBe(200);
    expect((await req('POST', '/watched-uics', { token, body: { uic: 'CCCCC1' } })).status).toBe(409);
    const access = await visibleUnits(env.DB, profile.id);
    expect(access).toMatchObject({ own: 'AAAAA1', read: ['AAAAA1', 'CCCCC1'], write: ['AAAAA1'] });
  });

  it('scopes every read and write to the caller\'s units', async () => {
    const a = await signup('6666666666', 'AAAAA1');
    const b = await signup('7777777777', 'BBBBB1');
    const s = await req('POST', '/inspections/sync', { token: a.token, body: syncBody('s1') });
    expect(s.status).toBe(200);
    const { inspection_id, vehicle_id, fault_ids } = s.json;

    expect((await req('GET', '/vehicles', { token: b.token })).json).toEqual([]);
    expect((await req('GET', `/vehicles/${vehicle_id}`, { token: b.token })).status).toBe(404);
    expect((await req('GET', `/faults?vehicle_id=${vehicle_id}`, { token: b.token })).json).toEqual([]);
    expect((await req('GET', `/inspections?id=${inspection_id}`, { token: b.token })).json).toEqual([]);
    expect((await req('PATCH', '/faults', { token: b.token, body: { ids: fault_ids, resolution_status: 'CORRECTED' } })).status).toBe(404);
    expect((await req('POST', `/inspections/${inspection_id}/da2404`, { token: b.token })).status).toBe(404);
    expect((await req('POST', '/inspections/sync', { token: b.token, body: syncBody('s2') })).status).toBe(403);
    expect((await req('POST', '/inspections/sync', { token: b.token, body: syncBody('s1', { vehicle: { ...syncBody('s1').vehicle, unit: 'BBBBB1' } }) })).status).toBe(409);

    // Watching grants reads, not writes.
    await req('POST', '/watched-uics', { token: b.token, body: { uic: 'AAAAA1' } });
    expect((await req('GET', '/vehicles', { token: b.token })).json).toHaveLength(1);
    expect((await req('GET', '/vehicles?unit=BBBBB1', { token: b.token })).json).toHaveLength(0);
    expect((await req('GET', `/faults?vehicle_id=${vehicle_id}`, { token: b.token })).json).toHaveLength(2);
    expect((await req('PATCH', '/faults', { token: b.token, body: { ids: fault_ids, resolution_status: 'CORRECTED' } })).status).toBe(404);
    expect((await req('POST', `/inspections/${inspection_id}/da2404`, { token: b.token })).status).toBe(403);
  });
});

describe('POST /inspections/sync', () => {
  it('is idempotent, keeps remarks/completed_at and respects roster vehicle fields', async () => {
    const { token, profile } = await signup('8888888888', 'AAAAA1');
    DB.q(`INSERT INTO vehicles (id, bumper_number, bumper_number_normalized, vehicle_type, nomenclature, unit, current_odometer)
          VALUES ('v1', 'HHC-20', 'HHC20', 'M1151A1', 'TRUCK UTILITY', 'AAAAA1', 500) RETURNING id`);
    const first = await req('POST', '/inspections/sync', { token, body: syncBody('sess') });
    expect(first.json.vehicle_id).toBe('v1');
    const retryBody = syncBody('sess');
    retryBody.inspection.remarks = null as never;
    retryBody.inspection.completed_at = '2030-01-01T00:00:00Z';
    retryBody.faults.reverse();
    const retry = await req('POST', '/inspections/sync', { token, body: retryBody });
    expect(retry.json.inspection_id).toBe(first.json.inspection_id);
    expect(retry.json.fault_ids).toEqual([...first.json.fault_ids].reverse());

    const ins = DB.q(`SELECT * FROM inspections`);
    expect(ins).toHaveLength(1);
    expect(ins[0]).toMatchObject({ remarks: 'first', completed_at: '2026-10-12T10:30:00.000Z', inspector_id: profile.id });
    expect(DB.q(`SELECT readiness FROM faults ORDER BY created_at, id`).map((f) => f.readiness)).toEqual(['NMC', 'PMC']);
    expect(DB.q(`SELECT * FROM vehicles WHERE id = 'v1'`)[0]).toMatchObject({ vehicle_type: 'M1151A1', nomenclature: 'TRUCK UTILITY', current_odometer: 500, status: 'NMC' });
  });

  it('stores nothing when any statement of the batch fails', async () => {
    const { token } = await signup('9999999999', 'AAAAA1');
    DB.q(`CREATE TRIGGER boom BEFORE INSERT ON faults WHEN NEW.item = 'BOOM' BEGIN SELECT RAISE(ABORT, 'boom'); END`);
    const body = syncBody('atomic');
    body.faults[1].item = 'BOOM';
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const r = await req('POST', '/inspections/sync', { token, body });
    spy.mockRestore();
    expect(r.status).toBe(500);
    expect(r.json).toEqual({ error: 'Internal error' });
    expect(DB.q('SELECT * FROM inspections')).toHaveLength(0);
    expect(DB.q('SELECT * FROM vehicles')).toHaveLength(0);
    expect(DB.q('SELECT * FROM faults')).toHaveLength(0);
  });

  it('rejects malformed faults with 400 before writing', async () => {
    const { token } = await signup('1212121212', 'AAAAA1');
    const body = syncBody('bad');
    (body.faults[0] as Record<string, unknown>).description = { evil: true };
    const r = await req('POST', '/inspections/sync', { token, body });
    expect(r.status).toBe(400);
    expect(r.json.error).toMatch(/faults\[0\]: description must be a string/);
    expect(DB.q('SELECT * FROM inspections')).toHaveLength(0);
  });
});

describe('vehicle status triggers', () => {
  it('computes NMC > PMC > FMC from open faults and records history', async () => {
    const { token } = await signup('1313131313', 'AAAAA1');
    const s = await req('POST', '/inspections/sync', { token, body: syncBody('t') });
    const status = () => DB.q<{ status: string }>(`SELECT status FROM vehicles`)[0].status;
    expect(status()).toBe('NMC');
    await req('PATCH', '/faults', { token, body: { ids: [s.json.fault_ids[0]], resolution_status: 'CORRECTED' } });
    expect(status()).toBe('PMC');
    await req('PATCH', '/faults', { token, body: { ids: [s.json.fault_ids[1]], resolution_status: 'CORRECTED' } });
    expect(status()).toBe('FMC');
    expect(DB.q(`SELECT status FROM vehicle_status_history`)).toEqual([{ status: 'FMC' }]);
  });
});

describe('files and forms', () => {
  it('checks photo magic bytes and size, serves with nosniff', async () => {
    const { token } = await signup('1414141414', 'AAAAA1');
    const s = await req('POST', '/inspections/sync', { token, body: syncBody('p') });
    const fid = s.json.fault_ids[0];
    expect((await req('POST', `/faults/${fid}/photos?session=x&photo=1`, { token, raw: 'GIF89a' })).status).toBe(400);
    expect((await req('POST', `/faults/${fid}/photos?session=x&photo=1`, { token, raw: new Uint8Array(10 * 1024 * 1024 + 1) })).status).toBe(413);
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0]);
    const up = await req('POST', `/faults/${fid}/photos?session=x&photo=1&ext=jpg`, { token, raw: png });
    expect(up.json.url).toMatch(/\/files\/fault-photos\/x\/.+\/1\.png$/);
    const file = await app.request(new URL(up.json.url).pathname, {}, env);
    expect(file.headers.get('x-content-type-options')).toBe('nosniff');
    expect(file.headers.get('content-type')).toBe('image/png');
  });

  it('generates a DA 2404 with non-WinAnsi text, reuses it, and emails new forms', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}'));
    env = { ...env, RESEND_API_KEY: 'k', NOTIFICATION_EMAIL: 'ops@example.com' } as Env;
    const { token, profile } = await signup('1515151515', 'AAAAA1');
    DB.q(`UPDATE profiles SET last_name = 'Nguyễn ✓ 😀' WHERE id = ? RETURNING id`, profile.id);
    const s = await req('POST', '/inspections/sync', { token, body: syncBody('pdf') });
    const r = await req('POST', `/inspections/${s.json.inspection_id}/da2404`, { token, body: { supervisor_name: 'Trần ✓ 😀', local_time: '0915' } });
    expect(r.status).toBe(200);
    expect(Object.keys(r.json)).toEqual(['url']);
    const key = `generated/da2404/${s.json.inspection_id}.pdf`;
    expect(new TextDecoder().decode(FILES.objects.get(key)!.bytes.subarray(0, 4))).toBe('%PDF');
    await new Promise((res) => setTimeout(res, 10));
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const sent = JSON.parse(fetchSpy.mock.calls[0][1]!.body as string);
    expect(sent.subject).toBe('DA 2404 - HHC-20 - 2026-10-12');
    expect(sent.attachments[0].content.length).toBeGreaterThan(100);

    // Reuse without regenerate: no new email.
    expect((await req('POST', `/inspections/${s.json.inspection_id}/da2404`, { token })).status).toBe(200);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    // Signed link works, unsigned does not.
    const ok = await app.request(new URL(r.json.url).pathname + new URL(r.json.url).search, {}, env);
    expect(ok.status).toBe(200);
    expect((await app.request(new URL(r.json.url).pathname, {}, env)).status).toBe(403);

    // PUT a client-generated PDF.
    expect((await req('PUT', `/inspections/${s.json.inspection_id}/da2404`, { token, raw: 'not a pdf' })).status).toBe(400);
    const put = await req('PUT', `/inspections/${s.json.inspection_id}/da2404`, { token, raw: '%PDF-1.4 test' });
    expect(put.status).toBe(200);
    expect(new TextDecoder().decode(FILES.objects.get(key)!.bytes)).toBe('%PDF-1.4 test');
    expect(DB.q('SELECT * FROM generated_forms')).toHaveLength(1);
    fetchSpy.mockRestore();
  });
});

describe('misc', () => {
  it('clamps /inspections limit and reports coverage', async () => {
    const { token } = await signup('1616161616', 'AAAAA1');
    await req('POST', '/inspections/sync', { token, body: syncBody('c1') });
    await req('POST', '/inspections/sync', { token, body: syncBody('c2') });
    expect((await req('GET', '/inspections?limit=-1', { token })).json).toHaveLength(1);
    expect((await req('GET', '/inspections?limit=abc', { token })).json).toHaveLength(2);
    expect((await req('GET', '/inspections/coverage?since=2026-10-01', { token })).json).toEqual([
      { vehicle_id: expect.any(String), day: '2026-10-12' },
    ]);
  });

  it('never leaks internal error messages', async () => {
    const { token } = await signup('1717171717', 'AAAAA1');
    DB.db.exec('DROP TABLE uic_lookup');
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const r = await req('PUT', '/uic/AAAAA1', { token, body: { unit_name: 'x' } });
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
    expect(r).toMatchObject({ status: 500, json: { error: 'Internal error' } });
  });
});
