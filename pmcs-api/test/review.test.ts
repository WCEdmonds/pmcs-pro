import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { app } from '../src/index';
import { makeEnv, FakeD1 } from './fake-env.mjs';
import type { Env } from '../src/index';

// Fake UICs and DoD IDs only.
const A = 'WXYZA0';
const CODE = 'test-bootstrap-code-1234';
const TREE = 'M1097.wont-start';
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
async function signup(dodId: string, last = 'User') {
  const r = await req('POST', '/auth/signup', { body: { dod_id: dodId, pin: '123456', unit: A, rank: 'CW2', first_name: 'Test', last_name: last } });
  expect(r.status).toBe(200);
  return r.json as { token: string; profile: { id: string } };
}
const flag = (token: string, extra: Record<string, unknown> = {}) =>
  req('POST', '/review/flags', { token, body: { tree: TREE, node: 'ws-q1', kind: 'readiness', text: 'Should be NMC per para 2-10', ...extra } });
const actions = () => DB.q<{ action: string }>('SELECT action FROM audit_log ORDER BY at, rowid').map((r) => r.action);

beforeEach(() => {
  ({ env, DB } = makeEnv({ ADMIN_BOOTSTRAP_CODE: CODE }));
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}'));
});
afterEach(() => vi.restoreAllMocks());

describe('troubleshooting review', () => {
  it('needs a session', async () => {
    expect((await req('GET', '/review')).status).toBe(401);
  });

  it('flags: create, list with names, validate', async () => {
    const w = await signup('1000000001', 'Warrant');
    const r = await flag(w.token);
    expect(r.status).toBe(200);
    expect(r.json).toMatchObject({ tree: TREE, node: 'ws-q1', kind: 'readiness', user_id: w.profile.id, resolved_at: null });
    const list = await req('GET', '/review', { token: w.token });
    expect(list.json.flags).toHaveLength(1);
    expect(list.json.people[w.profile.id]).toEqual({ rank: 'CW2', first_name: 'Test', last_name: 'Warrant' });
    for (const bad of [{ tree: 'nope' }, { node: 'bad id!' }, { kind: 'x' }, { text: '' }, { text: 'x'.repeat(4001) }]) {
      expect((await flag(w.token, bad)).status).toBe(400);
    }
    expect(actions()).toContain('review.flag');
  });

  it('resolve: author or admin only; delete: author and unresolved only', async () => {
    const author = await signup('1000000002');
    const other = await signup('1000000003');
    const admin = await signup('1000000004');
    await req('POST', '/admin/claim', { token: admin.token, body: { code: CODE } });
    const f = (await flag(author.token)).json;
    expect((await req('PATCH', `/review/flags/${f.id}`, { token: other.token, body: { resolved: true } })).status).toBe(403);
    expect((await req('DELETE', `/review/flags/${f.id}`, { token: other.token })).status).toBe(403);
    const res = await req('PATCH', `/review/flags/${f.id}`, { token: admin.token, body: { resolved: true } });
    expect(res.json).toMatchObject({ resolved_by: admin.profile.id, resolved_at: expect.any(String) });
    expect((await req('DELETE', `/review/flags/${f.id}`, { token: author.token })).status).toBe(409);
    expect((await req('PATCH', `/review/flags/${f.id}`, { token: author.token, body: { resolved: false } })).json.resolved_at).toBeNull();
    expect((await req('DELETE', `/review/flags/${f.id}`, { token: author.token })).status).toBe(200);
    expect((await req('GET', '/review', { token: author.token })).json.flags).toHaveLength(0);
    expect(actions()).toEqual(expect.arrayContaining(['review.flag_resolve', 'review.flag_reopen', 'review.flag_delete']));
  });

  it('verdicts: approve blocked by open flags, one per reviewer, withdraw', async () => {
    const w = await signup('1000000005');
    const v = await signup('1000000006');
    const f = (await flag(w.token)).json;
    let r = await req('PUT', `/review/verdicts/${TREE}`, { token: w.token, body: { status: 'approved' } });
    expect(r.status).toBe(409);
    expect(r.json.code).toBe('OPEN_FLAGS');
    r = await req('PUT', `/review/verdicts/${TREE}`, { token: w.token, body: { status: 'changes', note: 'Step 1 readiness wrong' } });
    expect(r.json).toMatchObject({ tree: TREE, user_id: w.profile.id, status: 'changes', note: 'Step 1 readiness wrong' });
    await req('PATCH', `/review/flags/${f.id}`, { token: w.token, body: { resolved: true } });
    r = await req('PUT', `/review/verdicts/${TREE}`, { token: w.token, body: { status: 'approved' } });
    expect(r.json).toMatchObject({ status: 'approved', note: null });
    await req('PUT', `/review/verdicts/${TREE}`, { token: v.token, body: { status: 'approved' } });
    expect((await req('GET', '/review', { token: v.token })).json.verdicts).toHaveLength(2);
    expect((await req('PUT', '/review/verdicts/bad', { token: v.token, body: { status: 'approved' } })).status).toBe(400);
    expect((await req('PUT', `/review/verdicts/${TREE}`, { token: v.token, body: { status: 'maybe' } })).status).toBe(400);
    await req('DELETE', `/review/verdicts/${TREE}`, { token: v.token });
    const left = (await req('GET', '/review', { token: v.token })).json.verdicts;
    expect(left.map((x: any) => x.user_id)).toEqual([w.profile.id]);
    expect(actions()).toEqual(expect.arrayContaining(['review.verdict', 'review.verdict_withdraw']));
  });
});
