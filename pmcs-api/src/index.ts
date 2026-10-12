import { Hono, type Context } from 'hono';
import { cors } from 'hono/cors';
import {
  hashPin, verifyPin, dummyVerifyPin, signToken, verifyToken, signFileUrl, verifyFileUrl, safeEqual, randomDigits,
} from './auth';
import { fillDa2404 } from './da2404';
import {
  HttpError, bad, isObj, parseUic, normalizeBumper, str, num, int, bool01, timestamp, dateOnly, id as idField,
  readCapped, sniffImage, isPdf, toBase64, emailList, type Obj,
} from './validate';
import { AUDIT_INSERT, actorOf, actorParams, audit, auditStmt, type Actor, type AuditEntry } from './audit';
import { recipientsFor, sendEmail, sendJoinEmail, type Member } from './email';
import { runBackup, DAILY_CRON } from './backup';

export interface Env {
  DB: D1Database;
  FILES: R2Bucket;
  JWT_SECRET: string;
  /** Comma-separated list of browser origins allowed to call the API (exact match). */
  ALLOWED_ORIGINS?: string;
  /** Comma-separated regexes of further allowed origins (staging: Firebase preview channels). CORS only. */
  ALLOWED_ORIGIN_PATTERNS?: string;
  /** One-time code that lets the caller of POST /admin/claim become admin. Delete it after use. */
  ADMIN_BOOTSTRAP_CODE?: string;
  /** Workers rate-limiting binding for /auth/*. Absent in some local setups. */
  LOGIN_LIMITER?: RateLimit;
  AUTH_IP_LIMITER?: RateLimit;
  /** Resend API key (secret). With NOTIFICATION_EMAIL, every new DA 2404 is emailed. */
  RESEND_API_KEY?: string;
  /** Comma-separated recipients of new DA 2404 PDFs. */
  NOTIFICATION_EMAIL?: string;
  /** Sender for those emails; defaults to Resend's shared test sender. */
  NOTIFICATION_FROM?: string;
  /** Override of https://api.resend.com/emails (tests only). */
  RESEND_API_URL?: string;
}

/** What the caller may see and change. Computed once per request by visibleUnits(). */
export interface Access {
  userId: string;
  dodId: string;
  /** The caller's own unit (profiles.unit), or null if they have not set one. */
  own: string | null;
  /** Units the caller can read: own unit first, then watched UICs. */
  read: string[];
  /** Units the caller can write: only the own unit. */
  write: string[];
  role: Role;
  tokenVersion: number;
  mustChangePin: boolean;
  /** Who the caller is, for audit rows. */
  actor: Actor;
}

/** Not exported: the Worker's main module may only export handlers. */
const ROLES = ['member', 'admin'] as const;
export type Role = (typeof ROLES)[number];
const asRole = (v: unknown): Role => (v === 'admin' ? 'admin' : 'member');

type Vars = { access: Access };
type Ctx = Context<{ Bindings: Env; Variables: Vars }>;

const MAX_FAILED_LOGINS = 5;
const LOCKOUT_MINUTES = 15;
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
const MAX_SYNC_FAULTS = 300;
const PUBLIC_BUCKETS = new Set(['fault-photos', 'tm-documents']);
/** R2 prefixes /files never serves, signed link or not. */
const BLOCKED_BUCKETS = new Set(['backups']);
const RESOLUTION_STATUSES = new Set(['ACKNOWLEDGED', 'CORRECTED']);
const OUTCOMES = new Set(['operator-fix', 'needs-maintenance', 'skipped']);

/** `<column> IN (...)` against a JSON array parameter: no 100-parameter limit, no chunking. */
const IN_JSON = 'IN (SELECT value FROM json_each(?))';
const J = (v: unknown) => JSON.stringify(v);

export const app = new Hono<{ Bindings: Env; Variables: Vars }>();

const patternCache = new Map<string, RegExp[]>();

/** ALLOWED_ORIGIN_PATTERNS → regexes (compiled once per value; invalid ones are logged and skipped). */
function originPatterns(raw: string | undefined): RegExp[] {
  if (!raw) return [];
  let list = patternCache.get(raw);
  if (!list) {
    list = [];
    for (const p of raw.split(',').map((s) => s.trim()).filter(Boolean)) {
      try { list.push(new RegExp(p)); } catch { console.error({ event: 'bad_origin_pattern', pattern: p }); }
    }
    patternCache.set(raw, list);
  }
  return list;
}

app.use('*', async (c, next) => {
  const allowed = (c.env.ALLOWED_ORIGINS ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  const patterns = originPatterns(c.env.ALLOWED_ORIGIN_PATTERNS);
  return cors({
    origin: (origin) =>
      allowed.includes(origin) || /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)
        || patterns.some((re) => re.test(origin)) ? origin : null,
    allowHeaders: ['Authorization', 'Content-Type'],
    allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    maxAge: 86400,
  })(c, next);
});

app.onError((err, c) => {
  if (err instanceof HttpError) {
    return c.json(err.code ? { error: err.message, code: err.code } : { error: err.message }, err.status);
  }
  // Structured for Workers Logs. The route pattern, not the raw path (which can hold a DoD ID).
  console.error({
    route: `${c.req.method} ${c.req.routePath}`,
    status: 500,
    message: err instanceof Error ? err.message : String(err),
    stack: err instanceof Error ? err.stack?.split('\n').slice(0, 5).join('\n') : undefined,
  });
  return c.json({ error: 'Internal error' }, 500);
});

app.notFound((c) => c.json({ error: 'Not found' }, 404));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const now = () => new Date().toISOString();
const uuid = () => crypto.randomUUID();

type Row = Record<string, unknown>;

/** Converts SQLite storage types back to the shapes the apps expect. */
function out(row: Row | null): Row | null {
  if (!row) return row;
  const r: Row = { ...row };
  delete r.pin_hash;
  delete r.failed_logins;
  delete r.locked_until;
  delete r.token_version;
  for (const k of ['photo_urls', 'steps_completed']) {
    if (typeof r[k] === 'string') {
      try { r[k] = JSON.parse(r[k] as string); } catch { r[k] = []; }
    }
  }
  for (const k of ['corrected_on_site', 'needs_maintenance', 'part_needed', 'must_change_pin']) {
    if (k in r && r[k] != null) r[k] = r[k] === 1;
  }
  return r;
}

async function all(db: D1Database, sql: string, params: unknown[] = []): Promise<Row[]> {
  const res = await db.prepare(sql).bind(...params).all<Row>();
  return res.results.map((r) => out(r) as Row);
}

async function first(db: D1Database, sql: string, params: unknown[] = []): Promise<Row | null> {
  return out(await db.prepare(sql).bind(...params).first<Row>());
}

/** Parses a JSON body; malformed JSON is a 400. */
async function readJson(c: Ctx): Promise<unknown> {
  try {
    return await c.req.json();
  } catch {
    throw bad('Request body must be valid JSON');
  }
}

async function readObject(c: Ctx): Promise<Obj> {
  const body = await readJson(c);
  if (!isObj(body)) throw bad('Request body must be a JSON object');
  return body;
}

/** Like readObject, but an empty body means `{}`. */
async function readOptionalObject(c: Ctx): Promise<Obj> {
  const text = await c.req.text();
  if (!text.trim()) return {};
  let body: unknown;
  try { body = JSON.parse(text); } catch { throw bad('Request body must be valid JSON'); }
  if (!isObj(body)) throw bad('Request body must be a JSON object');
  return body;
}

/** Repeated query parameter values (`?id=a&id=b`), blanks dropped. */
const queries = (c: Ctx, name: string) => (c.req.queries(name) ?? []).map((s) => s.trim()).filter(Boolean);

const PROFILE_COLS = 'id, dod_id, rank, last_name, first_name, mi, unit, role, must_change_pin, created_at';
/** PROFILE_COLS plus what signing a session needs (stripped from responses by out()). */
const SESSION_COLS = `${PROFILE_COLS}, token_version`;

async function sessionResponse(c: Ctx, profile: Row) {
  const token = await signToken(c.env.JWT_SECRET, profile.id as string, profile.dod_id as string, Number(profile.token_version ?? 0));
  const p = out(profile)!;
  return c.json({ token, profile: { ...p, role: asRole(p.role) } });
}

/**
 * Cloudflare rate limits for /auth/*: one bucket per client IP + key (vertical guessing on one
 * DoD ID) and one per client IP alone (spraying many DoD IDs). No-op without the bindings.
 */
async function rateLimit(c: Ctx, key: string, { perIp = true } = {}) {
  const ip = c.req.header('CF-Connecting-IP') ?? 'unknown';
  const checks: Array<Promise<{ success: boolean }>> = [];
  if (c.env.LOGIN_LIMITER) checks.push(c.env.LOGIN_LIMITER.limit({ key: `${ip}|${key}` }));
  if (perIp && c.env.AUTH_IP_LIMITER) checks.push(c.env.AUTH_IP_LIMITER.limit({ key: ip }));
  const results = await Promise.all(checks);
  if (results.some((r) => !r.success)) throw new HttpError(429, 'Too many requests. Wait a minute and try again.');
}

/** Runs work after the response is sent; failures are logged, never surfaced. */
function background(c: Ctx, work: Promise<unknown>) {
  const safe = work.catch((err) => console.error('Background task failed', err));
  try {
    c.executionCtx.waitUntil(safe);
  } catch {
    // No ExecutionContext (unit tests): the promise still runs.
  }
}

// ---------------------------------------------------------------------------
// Access model — the single place that decides which units a user can see.
// Reads: own unit + every UIC the user watches (self-service, like the old
// Supabase get_user_visible_uics()). Writes: own unit only.
// ---------------------------------------------------------------------------

export async function visibleUnits(db: D1Database, userId: string): Promise<Access | null> {
  const { results } = await db.prepare(
    `SELECT p.id, p.dod_id, p.unit, p.rank, p.first_name, p.last_name, p.role, p.token_version, p.must_change_pin, w.uic
     FROM profiles p LEFT JOIN dashboard_watched_uics w ON w.user_id = p.id
     WHERE p.id = ? ORDER BY w.created_at, w.uic`,
  ).bind(userId).all<{
    id: string; dod_id: string; unit: string | null; rank: string | null; first_name: string | null; last_name: string | null;
    role: string; token_version: number; must_change_pin: number; uic: string | null;
  }>();
  if (!results.length) return null;
  const p = results[0];
  const own = p.unit ? p.unit.trim().toUpperCase() : null;
  const read = [...new Set([...(own ? [own] : []), ...results.map((r) => r.uic).filter((u): u is string => !!u)])];
  return {
    userId, dodId: p.dod_id, own, read, write: own ? [own] : [],
    role: asRole(p.role), tokenVersion: Number(p.token_version ?? 0), mustChangePin: p.must_change_pin === 1,
    actor: actorOf(p),
  };
}

/** Audit rows by the caller (best effort, after the main write). */
const auditAs = (c: Ctx, ...entries: AuditEntry[]) => audit(c.env.DB, c.get('access').actor, ...entries);
/** An audit statement by the caller, to batch with the main write. */
const auditStmtAs = (c: Ctx, e: AuditEntry) => auditStmt(c.env.DB, c.get('access').actor, e);

/** Join notification to the unit's recipients, after the response. */
function notifyJoin(c: Ctx, uic: string | null | undefined, member: Member) {
  if (uic) background(c, sendJoinEmail(c.env, uic, member));
}

/** Read scope narrowed by an optional repeated `?unit=` filter (intersected with what the user can read). */
function readScope(c: Ctx): string[] {
  const { read } = c.get('access');
  const asked = queries(c, 'unit').map((u) => u.toUpperCase());
  if (!asked.length) return read;
  const set = new Set(asked);
  return read.filter((u) => set.has(u));
}

function ownUnit(c: Ctx): string {
  const { own } = c.get('access');
  if (!own) throw new HttpError(403, 'Set your unit (UIC) in your profile first');
  return own;
}

// ---------------------------------------------------------------------------
// Auth (replaces Supabase Auth + the `signup` edge function + check_dod_id_exists)
// ---------------------------------------------------------------------------

function parseDodId(v: unknown): string {
  if (typeof v !== 'string') throw bad('dod_id must be a string');
  const dodId = v.trim();
  if (!/^\d{10}$/.test(dodId)) throw bad('DOD ID must be exactly 10 digits');
  return dodId;
}

function parseNameFields(body: Obj) {
  return {
    rank: str(body, 'rank', { max: 16 }) || null,
    first_name: str(body, 'first_name', { max: 64 }) || null,
    last_name: str(body, 'last_name', { max: 64 }) || null,
    mi: str(body, 'mi', { max: 4 }) || null,
  };
}

app.post('/auth/signup', async (c) => {
  const body = await readObject(c);
  const dodId = parseDodId(body.dod_id);
  if (typeof body.pin !== 'string' || !/^\d{6,12}$/.test(body.pin)) throw bad('PIN must be 6 to 12 digits');
  const pin = body.pin;
  const unit = parseUic(body.unit);
  const names = parseNameFields(body);
  await rateLimit(c, `signup:${dodId}`);

  const db = c.env.DB;
  const pinHash = await hashPin(pin);
  try {
    const inserted = await db.prepare(
      `INSERT INTO profiles (id, dod_id, pin_hash, rank, last_name, first_name, mi, unit, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT (dod_id) DO NOTHING
       RETURNING ${SESSION_COLS}`,
    ).bind(uuid(), dodId, pinHash, names.rank, names.last_name, names.first_name, names.mi, unit, now()).first<Row>();
    if (inserted) return signedUp(c, inserted, false);

    // Imported Supabase profile that never had an auth user (pin_hash '!'):
    // let its owner claim it by signing up. The id and existing data are kept;
    // only empty fields are filled in.
    const claimed = await db.prepare(
      `UPDATE profiles SET pin_hash = ?, failed_logins = 0, locked_until = NULL,
         rank = COALESCE(NULLIF(rank, ''), ?), last_name = COALESCE(NULLIF(last_name, ''), ?),
         first_name = COALESCE(NULLIF(first_name, ''), ?), mi = COALESCE(NULLIF(mi, ''), ?),
         unit = COALESCE(NULLIF(unit, ''), ?)
       WHERE dod_id = ? AND pin_hash = '!'
       RETURNING ${SESSION_COLS}`,
    ).bind(pinHash, names.rank, names.last_name, names.first_name, names.mi, unit, dodId).first<Row>();
    if (claimed) return signedUp(c, claimed, true);
  } catch (err) {
    if (!String((err as Error)?.message).includes('UNIQUE')) throw err;
  }
  throw new HttpError(409, 'This DOD ID is already registered. Sign in instead.');
});

async function signedUp(c: Ctx, profile: Row, claimed: boolean) {
  const unit = (profile.unit as string | null) ?? null;
  await audit(c.env.DB, actorOf(profile), {
    action: 'user.signup', unit, targetType: 'profile', targetId: profile.id as string,
    details: { unit, ...(claimed ? { claimed_imported_profile: true } : {}) },
  });
  notifyJoin(c, unit, profile);
  return sessionResponse(c, profile);
}

const lockedError = () =>
  new HttpError(429, `Too many failed PIN attempts. This account is locked for ${LOCKOUT_MINUTES} minutes.`);

/**
 * Checks `pin` against the profile's hash with the lockout rules: each attempt is
 * reserved atomically before the check, so N parallel guesses can never test more
 * than MAX_FAILED_LOGINS PINs; the 5th failure locks the account (audited as
 * 'auth.locked'). Throws lockedError() or `wrongPin()`. Does not reset the counter.
 */
async function checkPin(c: Ctx, row: Row, pin: string, via: string, wrongPin: () => HttpError) {
  const db = c.env.DB;
  const lock = async () => {
    const until = new Date(Date.now() + LOCKOUT_MINUTES * 60_000).toISOString();
    const fresh = await db.prepare(
      'UPDATE profiles SET locked_until = ?, failed_logins = 0 WHERE id = ? AND locked_until IS NULL RETURNING unit',
    ).bind(until, row.id).first<{ unit: string | null }>();
    if (!fresh) {
      // A parallel attempt locked it first: keep its lock, just reset the counter.
      await db.prepare('UPDATE profiles SET failed_logins = 0 WHERE id = ?').bind(row.id).run();
      return;
    }
    await audit(db, actorOf(row), {
      action: 'auth.locked', unit: fresh.unit, targetType: 'profile', targetId: row.id as string,
      details: { via, failed_attempts: MAX_FAILED_LOGINS, locked_until: until },
    });
  };
  const reserved = await db.prepare(
    `UPDATE profiles SET failed_logins = failed_logins + 1, locked_until = NULL
     WHERE id = ? AND (locked_until IS NULL OR locked_until <= ?)
     RETURNING failed_logins`,
  ).bind(row.id, now()).first<{ failed_logins: number }>();
  if (!reserved) throw lockedError();
  if (reserved.failed_logins > MAX_FAILED_LOGINS) {
    await lock();
    throw lockedError();
  }

  const { ok, needsRehash } = await verifyPin(pin, row.pin_hash as string);
  if (!ok) {
    if (reserved.failed_logins >= MAX_FAILED_LOGINS) {
      await lock();
      throw lockedError();
    }
    throw wrongPin();
  }
  return { needsRehash };
}

app.post('/auth/login', async (c) => {
  const body = await readObject(c);
  if (typeof body.dod_id !== 'string' || typeof body.pin !== 'string') throw bad('dod_id and pin must be strings');
  const dodId = body.dod_id.trim();
  const pin = body.pin;
  if (!dodId || !pin) throw bad('DOD ID and PIN are required');
  await rateLimit(c, `login:${dodId}`);

  const db = c.env.DB;
  const row = await db.prepare('SELECT * FROM profiles WHERE dod_id = ?').bind(dodId).first<Row>();
  if (!row || row.pin_hash === '!') {
    await dummyVerifyPin(pin);
    throw new HttpError(401, 'Invalid DOD ID or PIN');
  }
  const { needsRehash } = await checkPin(c, row, pin, 'login', () => new HttpError(401, 'Invalid DOD ID or PIN'));

  // Success: clear the counter (unless a parallel attempt locked the account meanwhile)
  // and upgrade legacy bcrypt hashes from Supabase.
  const stmts = [db.prepare('UPDATE profiles SET failed_logins = 0 WHERE id = ? AND locked_until IS NULL').bind(row.id)];
  if (needsRehash) {
    stmts.push(db.prepare('UPDATE profiles SET pin_hash = ? WHERE id = ? AND pin_hash = ?').bind(await hashPin(pin), row.id, row.pin_hash));
  }
  await db.batch(stmts);
  return sessionResponse(c, row);
});

/** Used by the field app's login flow. Unclaimed imported profiles report false so the app offers signup. */
app.get('/auth/exists/:dodId', async (c) => {
  const dodId = c.req.param('dodId').trim();
  await rateLimit(c, `exists:${dodId}`);
  const row = await first(c.env.DB, "SELECT 1 AS x FROM profiles WHERE dod_id = ? AND pin_hash != '!'", [dodId]);
  return c.json({ exists: !!row });
});

// ---------------------------------------------------------------------------
// Public: UIC names (signup shows the unit name) and files in R2.
// ---------------------------------------------------------------------------

app.get('/uic/:uic', async (c) => {
  const uic = parseUic(c.req.param('uic'), 'uic');
  const row = await first(c.env.DB, 'SELECT uic, unit_name FROM uic_lookup WHERE uic = ?', [uic]);
  if (!row) throw new HttpError(404, 'Unknown UIC');
  return c.json(row);
});

// Keys are `<bucket>/<path>`. fault-photos (unguessable UUID paths) and
// tm-documents are public; everything else (generated/, templates/) needs a signed link.
app.get('/files/:bucket/:path{.+}', async (c) => {
  const bucket = c.req.param('bucket');
  const key = `${bucket}/${c.req.param('path')}`;
  if (BLOCKED_BUCKETS.has(bucket)) throw new HttpError(404, 'Not found');
  if (!PUBLIC_BUCKETS.has(bucket)) {
    const ok = await verifyFileUrl(c.env.JWT_SECRET, key, c.req.query('exp'), c.req.query('sig'));
    if (!ok) throw new HttpError(403, 'Link expired or invalid');
  }
  const obj = await c.env.FILES.get(key);
  if (!obj) throw new HttpError(404, 'Not found');
  const headers = new Headers();
  obj.writeHttpMetadata(headers);
  headers.set('etag', obj.httpEtag);
  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('cache-control', PUBLIC_BUCKETS.has(bucket) ? 'public, max-age=86400' : 'private, max-age=0');
  return new Response(obj.body, { headers });
});

const fileUrl = (c: Ctx, key: string) => `${new URL(c.req.url).origin}/files/${key}`;
const signedFileUrl = async (c: Ctx, key: string) => `${fileUrl(c, key)}?${await signFileUrl(c.env.JWT_SECRET, key)}`;

// ---------------------------------------------------------------------------
// Everything below requires a session token.
// ---------------------------------------------------------------------------

app.use('*', async (c, next) => {
  const header = c.req.header('Authorization') ?? '';
  const claims = header.startsWith('Bearer ') ? await verifyToken(c.env.JWT_SECRET, header.slice(7)) : null;
  if (!claims) throw new HttpError(401, 'Not signed in');
  const access = await visibleUnits(c.env.DB, claims.sub);
  if (!access || access.dodId !== claims.dod_id) throw new HttpError(401, 'Not signed in');
  // Revoked by sign-out-everywhere or a PIN change/reset. Tokens from before `tv` existed count as 0.
  if ((claims.tv ?? 0) !== access.tokenVersion) throw new HttpError(401, 'Session ended. Sign in again.');
  if (access.mustChangePin && !c.req.path.startsWith('/auth/') && !(c.req.method === 'GET' && c.req.path === '/me')) {
    throw new HttpError(403, 'PIN change required', 'PIN_CHANGE_REQUIRED');
  }
  c.set('access', access);
  await next();
});

/** Sliding sessions: clients call this on startup for a fresh 30-day token. */
app.post('/auth/refresh', async (c) => {
  const { userId, dodId, tokenVersion } = c.get('access');
  return c.json({ token: await signToken(c.env.JWT_SECRET, userId, dodId, tokenVersion) });
});

/** Revokes every session of the user, including the caller's. */
async function bumpTokenVersion(db: D1Database, userId: string, extra: D1PreparedStatement[] = []) {
  const [res] = await db.batch([
    db.prepare('UPDATE profiles SET token_version = token_version + 1 WHERE id = ?').bind(userId),
    ...extra,
  ]);
  if (!res.meta.changes) throw new HttpError(404, 'User not found');
}

app.post('/auth/sign-out-everywhere', async (c) => {
  const { userId, own } = c.get('access');
  await bumpTokenVersion(c.env.DB, userId, [
    auditStmtAs(c, { action: 'user.sign_out_everywhere', unit: own, targetType: 'profile', targetId: userId }),
  ]);
  return c.json({ ok: true });
});

const PIN_RE = /^\d{6,12}$/;

/** Changes the caller's PIN (current PIN required, with lockout). Ends every other session. */
app.post('/auth/change-pin', async (c) => {
  const body = await readObject(c);
  if (typeof body.current_pin !== 'string' || typeof body.new_pin !== 'string') throw bad('current_pin and new_pin must be strings');
  if (!PIN_RE.test(body.new_pin)) throw bad('New PIN must be 6 to 12 digits');
  if (body.new_pin === body.current_pin) throw bad('New PIN must be different from the current PIN');
  const { userId, own } = c.get('access');
  await rateLimit(c, `change-pin:${userId}`);

  const db = c.env.DB;
  const row = await db.prepare('SELECT * FROM profiles WHERE id = ?').bind(userId).first<Row>();
  if (!row) throw new HttpError(401, 'Not signed in');
  await checkPin(c, row, body.current_pin, 'change-pin',
    () => new HttpError(403, 'Current PIN is incorrect', 'INVALID_PIN'));

  const [updated] = await db.batch([
    db.prepare(
      `UPDATE profiles SET pin_hash = ?, must_change_pin = 0, failed_logins = 0, locked_until = NULL,
         token_version = token_version + 1
       WHERE id = ? RETURNING ${SESSION_COLS}`,
    ).bind(await hashPin(body.new_pin), userId),
    auditStmtAs(c, {
      action: 'user.pin_change', unit: own, targetType: 'profile', targetId: userId,
      details: { was_required: row.must_change_pin === 1 },
    }),
  ]);
  return sessionResponse(c, updated.results[0] as Row);
});

async function meResponse(c: Ctx) {
  const access = (await visibleUnits(c.env.DB, c.get('access').userId))!;
  const profile = await first(c.env.DB, `SELECT ${PROFILE_COLS} FROM profiles WHERE id = ?`, [access.userId]);
  if (!profile) throw new HttpError(404, 'Profile not found');
  return c.json({ ...profile, role: asRole(profile.role), visible_units: access.read });
}

app.get('/me', (c) => meResponse(c));

const NAME_FIELDS = ['rank', 'first_name', 'last_name', 'mi'] as const;

app.patch('/me', async (c) => {
  const body = await readObject(c);
  const sets: string[] = [];
  const params: unknown[] = [];
  const names = parseNameFields(body);
  for (const k of NAME_FIELDS) {
    if (k in body) { sets.push(`${k} = ?`); params.push(names[k]); }
  }
  const newUnit = 'unit' in body ? parseUic(body.unit) : undefined;
  if (newUnit !== undefined) { sets.push('unit = ?'); params.push(newUnit); }
  if (!sets.length) throw bad('Nothing to update');

  const db = c.env.DB;
  const { userId } = c.get('access');
  const before = (await db.prepare(`SELECT ${PROFILE_COLS} FROM profiles WHERE id = ?`).bind(userId).first<Row>())!;
  const changes: Record<string, { from: unknown; to: unknown }> = {};
  for (const k of NAME_FIELDS) {
    if (k in body && (before[k] ?? null) !== names[k]) changes[k] = { from: before[k] ?? null, to: names[k] };
  }
  const unitChanged = newUnit !== undefined && newUnit !== before.unit;
  const unit = newUnit ?? (before.unit as string | null);
  const auditRows: AuditEntry[] = [];
  if (Object.keys(changes).length) {
    auditRows.push({ action: 'user.profile_update', unit, targetType: 'profile', targetId: userId, details: { changes } });
  }
  if (unitChanged) {
    auditRows.push({ action: 'user.unit_change', unit: newUnit, targetType: 'profile', targetId: userId, details: { from: before.unit ?? null, to: newUnit } });
  }
  await db.batch([
    db.prepare(`UPDATE profiles SET ${sets.join(', ')} WHERE id = ?`).bind(...params, userId),
    ...(unitChanged ? [db.prepare('UPDATE client_status SET unit = ? WHERE user_id = ?').bind(newUnit, userId)] : []),
    ...auditRows.map((e) => auditStmtAs(c, e)),
  ]);
  if (unitChanged) {
    const member: Row = { ...before };
    for (const k of NAME_FIELDS) if (k in body) member[k] = names[k];
    notifyJoin(c, newUnit, member);
  }
  return meResponse(c);
});

/**
 * Minimal names for display: profiles in the caller's own unit, plus the
 * inspectors of inspections on vehicles the caller can read.
 */
app.get('/profiles', async (c) => {
  const ids = queries(c, 'id');
  if (!ids.length) return c.json([]);
  const { own, read } = c.get('access');
  return c.json(await all(c.env.DB,
    `SELECT id, rank, last_name, first_name FROM profiles
     WHERE id ${IN_JSON} AND (unit = ? OR id IN (
       SELECT i.inspector_id FROM inspections i JOIN vehicles v ON v.id = i.vehicle_id WHERE v.unit ${IN_JSON}))`,
    [J(ids), own, J(read)]));
});

// --- Watched UICs (self-service read access to other units) ----------------

app.get('/watched-uics', async (c) => {
  return c.json(await all(c.env.DB,
    'SELECT id, uic, created_at FROM dashboard_watched_uics WHERE user_id = ? ORDER BY created_at, uic', [c.get('access').userId]));
});

app.post('/watched-uics', async (c) => {
  const body = await readObject(c);
  const uic = parseUic(body.uic, 'uic');
  const { userId, own } = c.get('access');
  if (uic === own) throw bad('That is your own unit; you already see it');
  const row = { id: uuid(), uic };
  const res = await c.env.DB.prepare(
    'INSERT INTO dashboard_watched_uics (id, user_id, uic, created_at) VALUES (?, ?, ?, ?) ON CONFLICT (user_id, uic) DO NOTHING',
  ).bind(row.id, userId, uic, now()).run();
  if (!res.meta.changes) throw new HttpError(409, 'You are already watching this UIC');
  await auditAs(c, { action: 'watch.add', unit: uic, targetType: 'watched_uic', targetId: row.id, details: { uic } });
  return c.json(row);
});

app.delete('/watched-uics/:id', async (c) => {
  const gone = await c.env.DB.prepare('DELETE FROM dashboard_watched_uics WHERE id = ? AND user_id = ? RETURNING id, uic')
    .bind(c.req.param('id'), c.get('access').userId).first<{ id: string; uic: string }>();
  if (!gone) throw new HttpError(404, 'Not found');
  await auditAs(c, { action: 'watch.remove', unit: gone.uic, targetType: 'watched_uic', targetId: gone.id, details: { uic: gone.uic } });
  return c.json({ ok: true });
});

// --- UIC names ---------------------------------------------------------------

/** Anyone signed in may name a UIC that has no name yet; only its own members may rename it. */
app.put('/uic/:uic', async (c) => {
  const uic = parseUic(c.req.param('uic'), 'uic');
  const body = await readObject(c);
  const unitName = str(body, 'unit_name', { required: true, max: 200 })!;
  const { own } = c.get('access');
  const before = await first(c.env.DB, 'SELECT unit_name FROM uic_lookup WHERE uic = ?', [uic]);
  const res = await c.env.DB.prepare(
    `INSERT INTO uic_lookup (uic, unit_name, created_at) VALUES (?, ?, ?)
     ON CONFLICT (uic) DO UPDATE SET unit_name = excluded.unit_name WHERE excluded.uic = ?`,
  ).bind(uic, unitName, now(), own).run();
  if (!res.meta.changes) {
    const existing = await first(c.env.DB, 'SELECT unit_name FROM uic_lookup WHERE uic = ?', [uic]);
    if (existing?.unit_name !== unitName) throw new HttpError(403, `${uic} already has a name; only its members can change it`);
  } else if (before?.unit_name !== unitName) {
    await auditAs(c, before
      ? { action: 'uic.rename', unit: uic, targetType: 'uic', targetId: uic, details: { from: before.unit_name, to: unitName } }
      : { action: 'uic.name', unit: uic, targetType: 'uic', targetId: uic, details: { to: unitName } });
  }
  return c.json({ ok: true });
});

// --- Vehicles --------------------------------------------------------------

app.get('/vehicles', async (c) => {
  const scope = readScope(c);
  if (!scope.length) return c.json([]);
  const where = [`unit ${IN_JSON}`];
  const params: unknown[] = [J(scope)];
  const norm = c.req.query('bumper_normalized');
  if (norm) { where.push('bumper_number_normalized = ?'); params.push(normalizeBumper(norm)); }
  const bumper = c.req.query('bumper_number');
  if (bumper) { where.push('UPPER(TRIM(bumper_number)) = ?'); params.push(bumper.trim().toUpperCase()); }
  return c.json(await all(c.env.DB,
    `SELECT * FROM vehicles WHERE ${where.join(' AND ')} ORDER BY unit, bumper_number, id`, params));
});

/** Latest completed inspection per vehicle (replaces the dashboard pulling 1000 inspections). */
app.get('/vehicles/last-inspections', async (c) => {
  const scope = readScope(c);
  if (!scope.length) return c.json([]);
  return c.json(await all(c.env.DB,
    `SELECT v.id AS vehicle_id, MAX(i.completed_at) AS last_completed_at
     FROM vehicles v LEFT JOIN inspections i ON i.vehicle_id = v.id AND i.status = 'COMPLETED'
     WHERE v.unit ${IN_JSON} GROUP BY v.id ORDER BY v.id`, [J(scope)]));
});

app.get('/vehicles/:id', async (c) => {
  const v = await first(c.env.DB, `SELECT * FROM vehicles WHERE id = ? AND unit ${IN_JSON}`, [c.req.param('id'), J(c.get('access').read)]);
  if (!v) throw new HttpError(404, 'Vehicle not found');
  return c.json(v);
});

app.get('/vehicle-status-history', async (c) => {
  const since = c.req.query('since') ?? '0000-01-01';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(since)) throw bad('since must be a date (YYYY-MM-DD)');
  const scope = readScope(c);
  if (!scope.length) return c.json([]);
  return c.json(await all(c.env.DB,
    `SELECT h.vehicle_id, h.status, h.recorded_at FROM vehicle_status_history h
     JOIN vehicles v ON v.id = h.vehicle_id
     WHERE v.unit ${IN_JSON} AND h.recorded_at >= ? ORDER BY h.recorded_at, h.vehicle_id`, [J(scope), since]));
});

// --- Faults ----------------------------------------------------------------

app.get('/faults', async (c) => {
  const scope = readScope(c);
  if (!scope.length) return c.json([]);
  const dir = c.req.query('order') === 'asc' ? 'ASC' : 'DESC';
  const where = [`v.unit ${IN_JSON}`];
  const params: unknown[] = [J(scope)];
  if (c.req.query('open') === '1') where.push("f.resolution_status != 'CORRECTED'");
  const vehicleIds = queries(c, 'vehicle_id');
  if (vehicleIds.length) { where.push(`f.vehicle_id ${IN_JSON}`); params.push(J(vehicleIds)); }
  const inspectionIds = queries(c, 'inspection_id');
  if (inspectionIds.length) { where.push(`f.inspection_id ${IN_JSON}`); params.push(J(inspectionIds)); }
  return c.json(await all(c.env.DB,
    `SELECT f.* FROM faults f JOIN vehicles v ON v.id = f.vehicle_id
     WHERE ${where.join(' AND ')} ORDER BY f.created_at ${dir}, f.id ${dir}`, params));
});

/** Acknowledge or resolve faults of the caller's own unit. Others are skipped. */
app.patch('/faults', async (c) => {
  const body = await readObject(c);
  const ids = body.ids;
  if (!Array.isArray(ids) || !ids.length || !ids.every((x) => typeof x === 'string' && x.length <= 64)) {
    throw bad('ids must be a non-empty array of fault ids');
  }
  if (ids.length > 1000) throw bad('Too many ids (max 1000)');
  const status = body.resolution_status;
  if (typeof status !== 'string' || !RESOLUTION_STATUSES.has(status)) throw bad('resolution_status must be ACKNOWLEDGED or CORRECTED');
  const workOrder = str(body, 'gcss_work_order', { max: 64 }) || null;
  const own = ownUnit(c);
  const resolved = status === 'CORRECTED' ? 1 : 0;
  const db = c.env.DB;

  // One audit row per fault with its old → new status, written in the same batch
  // (before the UPDATE, so it reads the old values).
  const [, updated] = await db.batch([
    db.prepare(
      `${AUDIT_INSERT}
       SELECT lower(hex(randomblob(16))), ?, ?, ?, ?, v.unit, ?, 'fault', f.id,
         json_object('from', f.resolution_status, 'to', ?, 'gcss_work_order', COALESCE(?, f.gcss_work_order),
           'vehicle_id', v.id, 'bumper_number', v.bumper_number, 'item', f.item)
       FROM faults f JOIN vehicles v ON v.id = f.vehicle_id
       WHERE f.id ${IN_JSON} AND v.unit = ?`,
    ).bind(...actorParams(c.get('access').actor), resolved ? 'fault.resolve' : 'fault.acknowledge', status, workOrder, J(ids), own),
    db.prepare(
      `UPDATE faults SET resolution_status = ?,
         resolved_at = CASE WHEN ? THEN ? ELSE resolved_at END,
         resolved_by = CASE WHEN ? THEN ? ELSE resolved_by END,
         gcss_work_order = COALESCE(?, gcss_work_order)
       WHERE id ${IN_JSON} AND vehicle_id IN (SELECT id FROM vehicles WHERE unit = ?)
       RETURNING id`,
    ).bind(status, resolved, now(), resolved, c.get('access').userId, workOrder, J(ids), own),
  ]);
  const results = updated.results as Array<{ id: string }>;
  if (!results.length) throw new HttpError(404, 'No matching faults in your unit');
  return c.json({ ok: true, updated: results.map((r) => r.id) });
});

/** Upload one fault photo (raw JPEG/PNG body, ≤10 MB). Query: session, photo, ext. */
app.post('/faults/:id/photos', async (c) => {
  const faultId = c.req.param('id');
  const own = ownUnit(c);
  const fault = await first(c.env.DB,
    'SELECT f.id FROM faults f JOIN vehicles v ON v.id = f.vehicle_id WHERE f.id = ? AND v.unit = ?', [faultId, own]);
  if (!fault) throw new HttpError(404, 'Fault not found');

  const bytes = await readCapped(c.req.raw, MAX_UPLOAD_BYTES);
  const ext = sniffImage(bytes);
  if (!ext) throw bad('Photo must be a JPEG or PNG image');

  const safe = (s: string | undefined) => (s ?? '').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 64) || uuid();
  const key = `fault-photos/${safe(c.req.query('session'))}/${faultId}/${safe(c.req.query('photo'))}.${ext}`;
  await c.env.FILES.put(key, bytes, { httpMetadata: { contentType: ext === 'png' ? 'image/png' : 'image/jpeg' } });

  const url = fileUrl(c, key);
  await c.env.DB.prepare(
    `UPDATE faults SET photo_urls = CASE
       WHEN EXISTS (SELECT 1 FROM json_each(photo_urls) WHERE value = ?) THEN photo_urls
       ELSE json_insert(photo_urls, '$[#]', ?) END
     WHERE id = ?`,
  ).bind(url, url, faultId).run();
  await auditAs(c, { action: 'photo.upload', unit: own, targetType: 'fault', targetId: faultId, details: { key, bytes: bytes.byteLength } });
  return c.json({ url });
});

// --- Diagnosis attempts ------------------------------------------------------

app.get('/diagnosis-attempts', async (c) => {
  const ids = queries(c, 'fault_id');
  if (!ids.length) return c.json([]);
  return c.json(await all(c.env.DB,
    `SELECT d.* FROM diagnosis_attempts d JOIN faults f ON f.id = d.fault_id JOIN vehicles v ON v.id = f.vehicle_id
     WHERE d.fault_id ${IN_JSON} AND v.unit ${IN_JSON} ORDER BY d.completed_at DESC, d.id`,
    [J(ids), J(c.get('access').read)]));
});

/**
 * Uploads the field app's diagnosis attempts (array body). Faults must belong
 * to the caller's own unit. Idempotent on `id` when the client provides one.
 */
app.post('/diagnosis-attempts', async (c) => {
  const body = await readJson(c);
  const items = Array.isArray(body) ? body : isObj(body) ? [body] : null;
  if (!items || !items.length) throw bad('Body must be a non-empty array of diagnosis attempts');
  if (items.length > 500) throw bad('Too many attempts (max 500)');
  const own = ownUnit(c);

  const attempts = items.map((a, i) => {
    try {
      if (!isObj(a)) throw bad('must be an object');
      const steps = a.steps_completed ?? [];
      if (!Array.isArray(steps)) throw bad('steps_completed must be an array');
      const outcome = a.outcome;
      if (typeof outcome !== 'string' || !OUTCOMES.has(outcome)) throw bad('outcome must be operator-fix, needs-maintenance or skipped');
      const readiness = a.readiness_result;
      if (readiness !== 'PMC' && readiness !== 'NMC') throw bad('readiness_result must be PMC or NMC');
      return {
        id: idField(a, 'id') ?? uuid(),
        fault_id: idField(a, 'fault_id', true)!,
        session_id: str(a, 'session_id', { required: true, max: 128 })!,
        category_id: str(a, 'category_id', { required: true, max: 128 })!,
        steps_completed: J(steps),
        outcome,
        skip_reason: str(a, 'skip_reason', { max: 2000 }),
        readiness_result: readiness,
        completed_at: timestamp(a, 'completed_at') ?? now(),
      };
    } catch (err) {
      if (err instanceof HttpError) throw bad(`Attempt ${i}: ${err.message}`);
      throw err;
    }
  });

  const db = c.env.DB;
  const faultIds = [...new Set(attempts.map((a) => a.fault_id))];
  const { results } = await db.prepare(
    `SELECT f.id FROM faults f JOIN vehicles v ON v.id = f.vehicle_id WHERE f.id ${IN_JSON} AND v.unit = ?`,
  ).bind(J(faultIds), own).all<{ id: string }>();
  const found = new Set(results.map((r) => r.id));
  const missing = faultIds.filter((f) => !found.has(f));
  if (missing.length) throw new HttpError(404, `Fault not found in your unit: ${missing.join(', ')}`);

  const inserted = await db.batch(attempts.map((a) => db.prepare(
    `INSERT INTO diagnosis_attempts (id, fault_id, session_id, category_id, steps_completed, outcome, skip_reason,
       readiness_result, completed_at)
     SELECT ?, f.id, ?, ?, ?, ?, ?, ?, ? FROM faults f JOIN vehicles v ON v.id = f.vehicle_id
     WHERE f.id = ? AND v.unit = ?
     ON CONFLICT (id) DO NOTHING`,
  ).bind(a.id, a.session_id, a.category_id, a.steps_completed, a.outcome, a.skip_reason, a.readiness_result,
    a.completed_at, a.fault_id, own)));
  // Re-sends of already stored attempts are not audited again.
  const fresh = attempts.filter((_, i) => inserted[i].meta.changes);
  if (fresh.length) {
    const fids = [...new Set(fresh.map((a) => a.fault_id))];
    await auditAs(c, {
      action: 'diagnosis.upload', unit: own, targetType: 'fault', targetId: fids.length === 1 ? fids[0] : null,
      details: { count: fresh.length, fault_ids: fids.slice(0, 50), outcomes: fresh.map((a) => a.outcome).slice(0, 50) },
    });
  }
  return c.json({ ids: attempts.map((a) => a.id) });
});

// --- Inspections -----------------------------------------------------------

/** The inspection's local day: its `date`, else the UTC day it was completed. */
const INSPECTION_DAY = 'COALESCE(i.date, substr(i.completed_at, 1, 10))';

function sinceParam(c: Ctx): string | null {
  const since = c.req.query('since');
  if (since === undefined || since === '') return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(since)) throw bad('since must be a date (YYYY-MM-DD)');
  return since;
}

app.get('/inspections', async (c) => {
  const since = sinceParam(c);
  const scope = readScope(c);
  if (!scope.length) return c.json([]);
  const where = [`v.unit ${IN_JSON}`];
  const params: unknown[] = [J(scope)];
  if (since) { where.push(`${INSPECTION_DAY} >= ?`); params.push(since); }
  const ids = queries(c, 'id');
  if (ids.length) { where.push(`i.id ${IN_JSON}`); params.push(J(ids)); }
  const vehicleId = c.req.query('vehicle_id');
  if (vehicleId) { where.push('i.vehicle_id = ?'); params.push(vehicleId); }
  const status = c.req.query('status');
  if (status) { where.push('i.status = ?'); params.push(status); }
  const raw = Number.parseInt(c.req.query('limit') ?? '', 10);
  const limit = Number.isNaN(raw) ? 1000 : Math.min(Math.max(raw, 1), 1000);
  params.push(limit);
  return c.json(await all(c.env.DB,
    `SELECT i.* FROM inspections i JOIN vehicles v ON v.id = i.vehicle_id
     WHERE ${where.join(' AND ')} ORDER BY i.completed_at DESC, i.id DESC LIMIT ?`, params));
});

/** Compliance chart: distinct (vehicle, day) pairs with a COMPLETED inspection on or after `since`. */
app.get('/inspections/coverage', async (c) => {
  const since = sinceParam(c) ?? '0000-01-01';
  const scope = readScope(c);
  if (!scope.length) return c.json([]);
  return c.json(await all(c.env.DB,
    `SELECT DISTINCT i.vehicle_id, ${INSPECTION_DAY} AS day
     FROM inspections i JOIN vehicles v ON v.id = i.vehicle_id
     WHERE v.unit ${IN_JSON} AND i.status = 'COMPLETED' AND ${INSPECTION_DAY} >= ?
     ORDER BY day, i.vehicle_id`, [J(scope), since]));
});

interface SyncFault {
  client_fault_id: string | null;
  item: string | null; item_description: string | null; zone: string | null;
  readiness: 'PMC' | 'NMC'; category_id: string | null; description: string | null;
  corrective_action: string | null; part_needed: 0 | 1 | null; part_description: string | null;
  nsn: string | null; corrected_on_site: 0 | 1 | null; needs_maintenance: 0 | 1 | null;
}

function parseSyncFault(f: unknown): SyncFault {
  if (!isObj(f)) throw bad('must be an object');
  return {
    client_fault_id: str(f, 'client_fault_id', { max: 128 }) || null,
    item: str(f, 'item', { max: 64 }),
    item_description: str(f, 'item_description', { max: 1000 }),
    zone: str(f, 'zone', { max: 128 }),
    // Faults are PMC or NMC; anything else (e.g. 'FMC') is recorded as PMC.
    readiness: f.readiness === 'NMC' ? 'NMC' : 'PMC',
    category_id: str(f, 'category_id', { max: 128 }),
    description: str(f, 'description', { max: 4000 }),
    corrective_action: str(f, 'corrective_action', { max: 4000 }),
    part_needed: bool01(f, 'part_needed'),
    part_description: str(f, 'part_description', { max: 1000 }),
    nsn: str(f, 'nsn', { max: 64 }),
    corrected_on_site: bool01(f, 'corrected_on_site'),
    needs_maintenance: bool01(f, 'needs_maintenance'),
  };
}

/**
 * Uploads a completed inspection from the field app: vehicle upsert, inspection
 * upsert and fault inserts in ONE atomic D1 batch. Idempotent on
 * client_session_id (and on client_fault_id per fault), so the offline retry
 * queue can resend safely. Returns fault ids in the same order as the request.
 *
 * Vehicles are matched on (normalized bumper, unit): 'HHC-20', 'hhc 20' and
 * 'HHC20' are the same vehicle. An existing vehicle keeps its bumper_number
 * spelling, vehicle_type and nomenclature (roster values are more specific);
 * serial/registration are filled in, current_odometer only ever increases.
 */
app.post('/inspections/sync', async (c) => {
  const body = await readObject(c);
  const own = ownUnit(c);
  const { userId } = c.get('access');
  if (!isObj(body.vehicle)) throw bad('vehicle is required');
  if (!isObj(body.inspection)) throw bad('inspection is required');
  if (body.faults != null && !Array.isArray(body.faults)) throw bad('faults must be an array');
  const v = body.vehicle;
  const ins = body.inspection;
  const rawFaults = (body.faults ?? []) as unknown[];
  if (rawFaults.length > MAX_SYNC_FAULTS) throw bad(`Too many faults (max ${MAX_SYNC_FAULTS})`);

  const bumper = str(v, 'bumper_number', { required: true, max: 32 })!;
  const normalized = normalizeBumper(bumper);
  if (!normalized) throw bad('vehicle.bumper_number is required');
  const unit = parseUic(v.unit, 'vehicle.unit');
  if (unit !== own) throw new HttpError(403, `You can only sync inspections for your own unit (${own})`);
  const vehicle = {
    vehicle_type: str(v, 'vehicle_type', { max: 64 }),
    serial_number: str(v, 'serial_number', { max: 64 }) || null,
    registration_number: str(v, 'registration_number', { max: 64 }) || null,
    nomenclature: str(v, 'nomenclature', { max: 200 }),
    current_odometer: num(v, 'current_odometer'),
  };
  const sessionId = str(ins, 'client_session_id', { required: true, max: 128 })!;
  const inspection = {
    inspection_type: str(ins, 'inspection_type', { max: 32 }),
    odometer_reading: num(ins, 'odometer_reading'),
    remarks: str(ins, 'remarks', { max: 4000, trim: false }) || null,
    date: dateOnly(ins, 'date'),
    started_at: timestamp(ins, 'started_at'),
    completed_at: timestamp(ins, 'completed_at') ?? now(),
  };
  const faults = rawFaults.map((f, i) => {
    try { return parseSyncFault(f); } catch (err) {
      if (err instanceof HttpError) throw bad(`faults[${i}]: ${err.message}`);
      throw err;
    }
  });
  const clientIds = faults.map((f) => f.client_fault_id).filter(Boolean);
  if (new Set(clientIds).size !== clientIds.length) throw bad('client_fault_id must be unique within an inspection');

  const db = c.env.DB;
  const prior = await db.prepare(
    'SELECT v.unit FROM inspections i JOIN vehicles v ON v.id = i.vehicle_id WHERE i.client_session_id = ?',
  ).bind(sessionId).first<{ unit: string }>();
  if (prior && prior.unit !== own) throw new HttpError(409, 'This inspection session belongs to another unit');

  const base = Date.now();
  const ts = new Date(base).toISOString();
  const faultIds = faults.map(() => uuid());
  // Strictly increasing created_at keeps request order under ORDER BY created_at, id.
  const faultTs = faults.map((_, i) => new Date(base + i).toISOString());
  const thisBatch = J(faultIds);
  const ownVehicles = 'SELECT id FROM vehicles WHERE unit = ?';
  const inspectionId = uuid();

  const stmts: D1PreparedStatement[] = [
    db.prepare(
      `INSERT INTO vehicles (id, bumper_number, bumper_number_normalized, vehicle_type, serial_number,
         registration_number, nomenclature, unit, current_odometer, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT (bumper_number_normalized, unit) DO UPDATE SET
         serial_number = COALESCE(excluded.serial_number, vehicles.serial_number),
         registration_number = COALESCE(excluded.registration_number, vehicles.registration_number),
         vehicle_type = COALESCE(vehicles.vehicle_type, excluded.vehicle_type),
         nomenclature = COALESCE(vehicles.nomenclature, excluded.nomenclature),
         current_odometer = CASE
           WHEN excluded.current_odometer IS NOT NULL
             AND (vehicles.current_odometer IS NULL OR excluded.current_odometer > vehicles.current_odometer)
           THEN excluded.current_odometer ELSE vehicles.current_odometer END,
         updated_at = excluded.updated_at`,
    ).bind(uuid(), bumper, normalized, vehicle.vehicle_type, vehicle.serial_number, vehicle.registration_number,
      vehicle.nomenclature, unit, vehicle.current_odometer, ts, ts),

    db.prepare(
      `INSERT INTO inspections (id, vehicle_id, inspector_id, inspection_type, status, odometer_reading,
         remarks, date, started_at, completed_at, client_session_id, created_at)
       SELECT ?, id, ?, ?, 'COMPLETED', ?, ?, ?, ?, ?, ?, ? FROM vehicles
       WHERE bumper_number_normalized = ? AND unit = ?
       ON CONFLICT (client_session_id) DO UPDATE SET
         status = 'COMPLETED',
         remarks = COALESCE(excluded.remarks, inspections.remarks),
         completed_at = COALESCE(inspections.completed_at, excluded.completed_at)
       WHERE inspections.vehicle_id IN (${ownVehicles})`,
    ).bind(inspectionId, userId, inspection.inspection_type, inspection.odometer_reading, inspection.remarks,
      inspection.date, inspection.started_at, inspection.completed_at, sessionId, ts, normalized, unit, unit),

    // Faults with a client_fault_id are deduplicated by the UNIQUE (inspection_id, client_fault_id).
    // Legacy faults without one are only inserted when the inspection has no faults from an earlier sync.
    ...faults.map((f, i) => db.prepare(
      `INSERT INTO faults (id, inspection_id, vehicle_id, client_fault_id, item, item_description, zone, readiness,
         category_id, description, corrective_action, part_needed, part_description, nsn, corrected_on_site,
         needs_maintenance, resolution_status, created_at)
       SELECT ?, i.id, i.vehicle_id, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ? FROM inspections i
       WHERE i.client_session_id = ? AND i.vehicle_id IN (${ownVehicles})
         AND (? IS NOT NULL OR NOT EXISTS (
           SELECT 1 FROM faults x WHERE x.inspection_id = i.id AND x.id NOT ${IN_JSON}))
       ON CONFLICT (inspection_id, client_fault_id) DO NOTHING`,
    ).bind(faultIds[i], f.client_fault_id, f.item, f.item_description, f.zone, f.readiness, f.category_id,
      f.description, f.corrective_action, f.part_needed, f.part_description, f.nsn, f.corrected_on_site,
      f.needs_maintenance, f.corrected_on_site ? 'CORRECTED' : 'OPEN', faultTs[i],
      sessionId, unit, f.client_fault_id, thisBatch)),

    // Audited only when this request created the inspection (a re-send keeps the first id).
    db.prepare(
      `${AUDIT_INSERT}
       SELECT lower(hex(randomblob(16))), ?, ?, ?, ?, v.unit, 'inspection.synced', 'inspection', i.id,
         json_object('vehicle_id', v.id, 'bumper_number', v.bumper_number, 'inspection_type', i.inspection_type,
           'fault_count', (SELECT COUNT(*) FROM faults x WHERE x.inspection_id = i.id),
           'nmc_count', (SELECT COUNT(*) FROM faults x WHERE x.inspection_id = i.id AND x.readiness = 'NMC'),
           'client_session_id', i.client_session_id)
       FROM inspections i JOIN vehicles v ON v.id = i.vehicle_id WHERE i.id = ?`,
    ).bind(...actorParams(c.get('access').actor, ts), inspectionId),

    db.prepare(`SELECT id, vehicle_id FROM inspections WHERE client_session_id = ? AND vehicle_id IN (${ownVehicles})`)
      .bind(sessionId, unit),
    db.prepare(
      `SELECT f.id, f.client_fault_id FROM faults f JOIN inspections i ON i.id = f.inspection_id
       WHERE i.client_session_id = ? ORDER BY f.created_at, f.rowid`,
    ).bind(sessionId),
  ];

  const results = await db.batch(stmts);
  const stored = results[results.length - 2].results[0] as { id: string; vehicle_id: string } | undefined;
  if (!stored) throw new HttpError(409, 'This inspection session belongs to another unit');
  const rows = results[results.length - 1].results as Array<{ id: string; client_fault_id: string | null }>;

  const byClientId = new Map(rows.filter((r) => r.client_fault_id).map((r) => [r.client_fault_id, r.id]));
  const legacy = rows.filter((r) => !r.client_fault_id).map((r) => r.id);
  const storedIds = new Set(rows.map((r) => r.id));
  let legacyIndex = 0;
  const fault_ids = faults.map((f, i) => {
    if (f.client_fault_id) return byClientId.get(f.client_fault_id) ?? null;
    const id = storedIds.has(faultIds[i]) ? faultIds[i] : legacy[legacyIndex] ?? null;
    legacyIndex++;
    return id;
  });
  return c.json({ inspection_id: stored.id, vehicle_id: stored.vehicle_id, fault_ids });
});

// --- DA 2404 -------------------------------------------------------------------

async function inspectionInScope(c: Ctx, inspectionId: string): Promise<Row> {
  const row = await first(c.env.DB,
    `SELECT i.*, v.unit AS vehicle_unit FROM inspections i JOIN vehicles v ON v.id = i.vehicle_id
     WHERE i.id = ? AND v.unit ${IN_JSON}`, [inspectionId, J(c.get('access').read)]);
  if (!row) throw new HttpError(404, 'Inspection not found');
  return row;
}

function requireWritable(c: Ctx, inspection: Row) {
  if (inspection.vehicle_unit !== c.get('access').own) {
    throw new HttpError(403, 'You can only create forms for your own unit');
  }
}

async function latestForm(db: D1Database, inspectionId: string) {
  return db.prepare(
    'SELECT pdf_storage_path FROM generated_forms WHERE inspection_id = ? ORDER BY generated_at DESC, rowid DESC LIMIT 1',
  ).bind(inspectionId).first<{ pdf_storage_path: string | null }>();
}

/**
 * Emails a new DA 2404 through Resend (port of the old edge function) to the
 * vehicle unit's recipients (unit_settings, else NOTIFICATION_EMAIL). Skipped unless configured.
 */
async function emailForm(env: Env, unit: string | null, subject: string, filename: string, bytes: Uint8Array) {
  if (!env.RESEND_API_KEY) return;
  await sendEmail(env, {
    to: await recipientsFor(env, unit),
    subject,
    text: `${subject}\n\nThe DA Form 2404 is attached.`,
    attachments: [{ filename, content: toBase64(bytes) }],
  });
}

type FormAction = 'da2404.generate' | 'da2404.regenerate' | 'da2404.upload';

/** Stores a DA 2404 PDF in R2 + generated_forms, emails it, returns a 1-hour signed link. */
async function storeForm(c: Ctx, inspection: Row, bytes: Uint8Array, action: FormAction): Promise<string> {
  const db = c.env.DB;
  const path = `da2404/${inspection.id}.pdf`;
  await c.env.FILES.put(`generated/${path}`, bytes, { httpMetadata: { contentType: 'application/pdf' } });
  const vehicle = await first(db, 'SELECT bumper_number, unit FROM vehicles WHERE id = ?', [inspection.vehicle_id]);
  const bumper = String(vehicle?.bumper_number ?? 'vehicle');
  const unit = (vehicle?.unit as string | undefined) ?? (inspection.vehicle_unit as string | undefined) ?? null;
  await db.batch([
    db.prepare('DELETE FROM generated_forms WHERE inspection_id = ?').bind(inspection.id),
    db.prepare('INSERT INTO generated_forms (id, inspection_id, vehicle_id, pdf_storage_path, generated_at) VALUES (?, ?, ?, ?, ?)')
      .bind(uuid(), inspection.id, inspection.vehicle_id, path, now()),
    auditStmtAs(c, {
      action, unit, targetType: 'inspection', targetId: inspection.id as string,
      details: { vehicle_id: inspection.vehicle_id, bumper_number: bumper, bytes: bytes.byteLength },
    }),
  ]);
  const date = String(inspection.date ?? now().slice(0, 10));
  background(c, emailForm(c.env, unit, `DA 2404 - ${bumper} - ${date}`,
    `DA2404_${bumper.replace(/[^A-Za-z0-9_-]/g, '')}_${date}.pdf`, bytes));
  return signedFileUrl(c, `generated/${path}`);
}

/**
 * Returns a 1-hour link to the inspection's DA 2404. Reuses the stored form
 * unless `?regenerate=1`; generating requires the inspection to be in the
 * caller's own unit. The form includes other still-open faults on the vehicle.
 */
app.post('/inspections/:id/da2404', async (c) => {
  const opts = await readOptionalObject(c);
  const supervisorName = str(opts, 'supervisor_name', { max: 100 });
  const supervisorDodId = str(opts, 'supervisor_dod_id', { max: 20 });
  const localTime = str(opts, 'local_time', { max: 4 });
  if (localTime && !/^([01]\d|2[0-3])[0-5]\d$/.test(localTime)) throw bad("local_time must be 'HHMM'");

  const db = c.env.DB;
  const inspection = await inspectionInScope(c, c.req.param('id'));
  const regenerate = c.req.query('regenerate') === '1';
  if (!regenerate) {
    const form = await latestForm(db, inspection.id as string);
    if (form?.pdf_storage_path && await c.env.FILES.head(`generated/${form.pdf_storage_path}`)) {
      return c.json({ url: await signedFileUrl(c, `generated/${form.pdf_storage_path}`) });
    }
  }
  requireWritable(c, inspection);

  const [vehicle, inspector, faults] = await Promise.all([
    first(db, 'SELECT * FROM vehicles WHERE id = ?', [inspection.vehicle_id]),
    first(db, `SELECT ${PROFILE_COLS} FROM profiles WHERE id = ?`, [inspection.inspector_id]),
    all(db,
      `SELECT * FROM faults WHERE inspection_id = ? OR (vehicle_id = ? AND resolution_status != 'CORRECTED')
       ORDER BY created_at, rowid`,
      [inspection.id, inspection.vehicle_id]),
  ]);
  if (!vehicle) throw new HttpError(404, 'Vehicle not found');
  const uic = await first(db, 'SELECT unit_name FROM uic_lookup WHERE uic = ?', [vehicle.unit]);

  const bytes = await fillDa2404({
    unitName: (uic?.unit_name as string) || (vehicle.unit as string) || '',
    vehicleType: vehicle.vehicle_type as string | null,
    nomenclature: vehicle.nomenclature as string | null,
    registration: (vehicle.serial_number as string) || (vehicle.bumper_number as string) || '',
    odometer: inspection.odometer_reading as number | null,
    date: inspection.date as string | null,
    inspectionType: inspection.inspection_type as string | null,
    inspectorName: inspector ? `${inspector.rank ?? ''} ${inspector.first_name ?? ''} ${inspector.last_name ?? ''}`.replace(/\s+/g, ' ').trim() : '',
    inspectorDodId: (inspector?.dod_id as string) ?? null,
    supervisorName,
    supervisorDodId,
    localTime,
    remarks: inspection.remarks as string | null,
    faults: faults.map((f) => ({
      ...f,
      corrected_on_site: f.corrected_on_site ? 1 : 0,
      needs_maintenance: f.needs_maintenance ? 1 : 0,
      part_needed: f.part_needed ? 1 : 0,
    })) as never,
  });
  const hadForm = regenerate && !!(await latestForm(db, inspection.id as string));
  return c.json({ url: await storeForm(c, inspection, bytes, hadForm ? 'da2404.regenerate' : 'da2404.generate') });
});

/** Stores a PDF the field app generated itself (offline fallback). Raw application/pdf body, ≤10 MB. */
app.put('/inspections/:id/da2404', async (c) => {
  const inspection = await inspectionInScope(c, c.req.param('id'));
  requireWritable(c, inspection);
  const bytes = await readCapped(c.req.raw, MAX_UPLOAD_BYTES);
  if (!isPdf(bytes)) throw bad('Body must be a PDF');
  return c.json({ url: await storeForm(c, inspection, bytes, 'da2404.upload') });
});

app.get('/generated-forms', async (c) => {
  const ids = queries(c, 'inspection_id');
  if (!ids.length) return c.json([]);
  return c.json(await all(c.env.DB,
    `SELECT g.id, g.inspection_id, g.vehicle_id, g.pdf_storage_path, g.generated_at
     FROM generated_forms g JOIN inspections i ON i.id = g.inspection_id JOIN vehicles v ON v.id = i.vehicle_id
     WHERE g.inspection_id ${IN_JSON} AND v.unit ${IN_JSON} ORDER BY g.generated_at DESC, g.id`,
    [J(ids), J(c.get('access').read)]));
});

/** Signed 1-hour download link for an inspection's stored DA 2404. */
app.get('/generated-forms/link', async (c) => {
  const inspectionId = c.req.query('inspection_id');
  if (!inspectionId) throw bad('inspection_id is required');
  const inspection = await inspectionInScope(c, inspectionId);
  const form = await latestForm(c.env.DB, inspection.id as string);
  if (!form?.pdf_storage_path) throw new HttpError(404, 'No form has been generated for this inspection');
  return c.json({ url: await signedFileUrl(c, `generated/${form.pdf_storage_path}`) });
});

// ---------------------------------------------------------------------------
// Admin (role 'admin', global scope across all units). Becoming admin needs the
// one-time ADMIN_BOOTSTRAP_CODE secret, or an existing admin's promotion.
// ---------------------------------------------------------------------------

const MAX_FAILED_CLAIMS = 5;

/** Makes the caller admin when `code` matches ADMIN_BOOTSTRAP_CODE (constant-time). Rate-limited, audited. */
app.post('/admin/claim', async (c) => {
  const body = await readObject(c);
  if (typeof body.code !== 'string' || !body.code || body.code.length > 256) throw bad('code is required');
  const { userId, own, role } = c.get('access');
  await rateLimit(c, `admin-claim:${userId}`);
  const db = c.env.DB;
  // Also limited in D1 (works without the rate-limit bindings): 5 failures per user per 15 minutes.
  // Reserve a failure row atomically (insert only while under the limit), so parallel requests
  // can't all read a stale count. A correct code deletes its reservation and logs the claim instead.
  const since = new Date(Date.now() - LOCKOUT_MINUTES * 60_000).toISOString();
  const reservationId = crypto.randomUUID();
  const reserved = await db.prepare(
    `${AUDIT_INSERT} SELECT ?, ?, ?, ?, ?, ?, 'admin.claim_failed', 'profile', ?, NULL
     WHERE (SELECT COUNT(*) FROM audit_log WHERE actor_id = ? AND action = 'admin.claim_failed' AND at >= ?) < ?`,
  ).bind(reservationId, ...actorParams(c.get('access').actor), own, userId, userId, since, MAX_FAILED_CLAIMS).run();
  if (!reserved.meta.changes) throw new HttpError(429, 'Too many attempts. Try again later.');

  const expected = c.env.ADMIN_BOOTSTRAP_CODE;
  if (!expected || !(await safeEqual(body.code, expected))) {
    throw new HttpError(403, 'Invalid or expired admin code'); // the reserved row is the audit entry
  }
  await db.batch([
    db.prepare('DELETE FROM audit_log WHERE id = ?').bind(reservationId),
    db.prepare("UPDATE profiles SET role = 'admin' WHERE id = ?").bind(userId),
    auditStmtAs(c, { action: 'admin.claim', unit: own, targetType: 'profile', targetId: userId, details: { from: role, to: 'admin', ...(role === 'admin' ? { repeat: true } : {}) } }),
  ]);
  return c.json({ ok: true, role: 'admin' });
});

app.use('/admin/*', async (c, next) => {
  if (c.get('access').role !== 'admin') throw new HttpError(403, 'Admins only');
  await next();
});

const ADMIN_USER_COLS = `id, substr(dod_id, -4) AS dod_last4, rank, first_name, last_name, mi, unit, role, created_at,
  locked_until, must_change_pin`;

/** Admin view of a profile. Never the full DoD ID. `locked_until` is null unless the lock is still in force. */
function adminUser(r: Row) {
  const locked = typeof r.locked_until === 'string' && r.locked_until > now() ? r.locked_until : null;
  return {
    id: r.id, dod_last4: r.dod_last4, rank: r.rank, first_name: r.first_name, last_name: r.last_name, mi: r.mi,
    unit: r.unit, role: asRole(r.role), created_at: r.created_at, locked_until: locked, must_change_pin: r.must_change_pin === 1,
  };
}

async function targetUser(c: Ctx): Promise<Row> {
  const row = await c.env.DB.prepare(`SELECT ${ADMIN_USER_COLS}, dod_id FROM profiles WHERE id = ?`).bind(c.req.param('id')).first<Row>();
  if (!row) throw new HttpError(404, 'User not found');
  return row;
}

const reloadUser = async (c: Ctx, id: string) =>
  adminUser((await c.env.DB.prepare(`SELECT ${ADMIN_USER_COLS} FROM profiles WHERE id = ?`).bind(id).first<Row>())!);

function clampLimit(raw: string | undefined, def: number, max: number) {
  const n = Number.parseInt(raw ?? '', 10);
  return Number.isNaN(n) ? def : Math.min(Math.max(n, 1), max);
}

const likeEscape = (s: string) => s.replace(/[\\%_]/g, (ch) => `\\${ch}`);

/** All users (optionally one unit). `q` matches rank/name/UIC, or exactly the last 4 of the DoD ID. */
app.get('/admin/users', async (c) => {
  const where: string[] = [];
  const params: unknown[] = [];
  const unit = c.req.query('unit');
  if (unit) { where.push('unit = ?'); params.push(parseUic(unit, 'unit')); }
  const q = (c.req.query('q') ?? '').trim().slice(0, 64);
  if (q) {
    const like = `%${likeEscape(q)}%`;
    where.push(`(last_name LIKE ? ESCAPE '\\' OR first_name LIKE ? ESCAPE '\\' OR rank LIKE ? ESCAPE '\\'
      OR unit LIKE ? ESCAPE '\\' OR substr(dod_id, -4) = ?)`);
    params.push(like, like, like, like, q);
  }
  params.push(clampLimit(c.req.query('limit'), 200, 1000));
  const { results } = await c.env.DB.prepare(
    `SELECT ${ADMIN_USER_COLS} FROM profiles ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
     ORDER BY unit, last_name COLLATE NOCASE, first_name COLLATE NOCASE, id LIMIT ?`,
  ).bind(...params).all<Row>();
  return c.json(results.map(adminUser));
});

/** Sets a random 8-digit temporary PIN, forces a PIN change, unlocks and signs the user out everywhere. */
app.post('/admin/users/:id/reset-pin', async (c) => {
  const user = await targetUser(c);
  const tempPin = randomDigits(8);
  await bumpTokenVersion(c.env.DB, user.id as string, [
    c.env.DB.prepare(
      'UPDATE profiles SET pin_hash = ?, must_change_pin = 1, failed_logins = 0, locked_until = NULL WHERE id = ?',
    ).bind(await hashPin(tempPin), user.id),
    auditStmtAs(c, {
      action: 'admin.pin_reset', unit: user.unit as string | null, targetType: 'profile', targetId: user.id as string,
      details: { target_dod_last4: user.dod_last4 },
    }),
  ]);
  return c.json({ temp_pin: tempPin });
});

app.post('/admin/users/:id/sign-out-everywhere', async (c) => {
  const user = await targetUser(c);
  await bumpTokenVersion(c.env.DB, user.id as string, [
    auditStmtAs(c, {
      action: 'admin.sign_out_everywhere', unit: user.unit as string | null, targetType: 'profile', targetId: user.id as string,
      details: { target_dod_last4: user.dod_last4 },
    }),
  ]);
  return c.json({ ok: true });
});

/** Promote/demote. The last admin can never be demoted (checked atomically). */
app.post('/admin/users/:id/role', async (c) => {
  const body = await readObject(c);
  const role = body.role;
  if (typeof role !== 'string' || !(ROLES as readonly string[]).includes(role)) throw bad("role must be 'member' or 'admin'");
  const user = await targetUser(c);
  const from = asRole(user.role);
  if (from !== role) {
    const changed = await c.env.DB.prepare(
      `UPDATE profiles SET role = ? WHERE id = ? AND role IS NOT ?
         AND (? = 'admin' OR (SELECT COUNT(*) FROM profiles WHERE role = 'admin' AND id != ?) > 0)
       RETURNING id`,
    ).bind(role, user.id, role, role, user.id).first();
    if (!changed) throw new HttpError(409, 'Cannot demote the last admin');
    await auditAs(c, {
      action: 'admin.role_change', unit: user.unit as string | null, targetType: 'profile', targetId: user.id as string,
      details: { from, to: role, target_dod_last4: user.dod_last4 },
    });
  }
  return c.json({ ok: true, user: await reloadUser(c, user.id as string) });
});

/** Moves a user to another unit. Emails the new unit like a self-service join. */
app.patch('/admin/users/:id', async (c) => {
  const body = await readObject(c);
  const extra = Object.keys(body).filter((k) => k !== 'unit');
  if (extra.length) throw bad(`Only unit can be changed here (got ${extra.join(', ')})`);
  if (!('unit' in body)) throw bad('Nothing to update');
  const unit = parseUic(body.unit);
  const user = await targetUser(c);
  if (user.unit !== unit) {
    await c.env.DB.batch([
      c.env.DB.prepare('UPDATE profiles SET unit = ? WHERE id = ?').bind(unit, user.id),
      c.env.DB.prepare('UPDATE client_status SET unit = ? WHERE user_id = ?').bind(unit, user.id),
      auditStmtAs(c, {
        action: 'user.unit_change', unit, targetType: 'profile', targetId: user.id as string,
        details: { from: user.unit ?? null, to: unit, by_admin: true, target_dod_last4: user.dod_last4 },
      }),
    ]);
    notifyJoin(c, unit, user);
  }
  return c.json({ ok: true, user: await reloadUser(c, user.id as string) });
});

/** `YYYY-MM-DD` or ISO timestamp → ISO; `endOfDay` makes a bare date inclusive of that whole day. */
function auditTime(v: string | undefined, key: string, endOfDay = false): string | null {
  if (!v) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return endOfDay ? `${v}T23:59:59.999Z` : `${v}T00:00:00.000Z`;
  const t = Date.parse(v);
  if (Number.isNaN(t)) throw bad(`${key} must be a date (YYYY-MM-DD) or ISO-8601 timestamp`);
  return new Date(t).toISOString();
}

/**
 * Audit log, newest first, keyset-paginated: pass the previous page's `next_before`
 * as `before` (`null` = no more rows). `since`/`until` are inclusive.
 */
app.get('/admin/audit', async (c) => {
  const where: string[] = [];
  const params: unknown[] = [];
  const unit = c.req.query('unit');
  if (unit) { where.push('unit = ?'); params.push(parseUic(unit, 'unit')); }
  const actorId = c.req.query('actor_id');
  if (actorId) { where.push('actor_id = ?'); params.push(actorId); }
  const action = c.req.query('action');
  if (action) {
    // "admin." (trailing dot) filters a whole family; anything else is an exact action.
    if (action.endsWith('.')) { where.push("substr(action, 1, length(?)) = ?"); params.push(action, action); }
    else { where.push('action = ?'); params.push(action); }
  }
  const since = auditTime(c.req.query('since'), 'since');
  if (since) { where.push('at >= ?'); params.push(since); }
  const until = auditTime(c.req.query('until'), 'until', true);
  if (until) { where.push('at <= ?'); params.push(until); }
  const before = c.req.query('before');
  if (before) {
    const cut = before.lastIndexOf('|');
    if (cut < 1) throw bad('before must be a next_before value from a previous page');
    const [at, id] = [before.slice(0, cut), before.slice(cut + 1)];
    where.push('(at < ? OR (at = ? AND id < ?))');
    params.push(at, at, id);
  }
  const limit = clampLimit(c.req.query('limit'), 100, 500);
  const { results } = await c.env.DB.prepare(
    `SELECT id, at, actor_id, actor_dod_last4, actor_name, unit, action, target_type, target_id, details FROM audit_log
     ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY at DESC, id DESC LIMIT ?`,
  ).bind(...params, limit + 1).all<Row>();
  const page = results.slice(0, limit);
  const items = page.map((r) => {
    let details: unknown = null;
    if (typeof r.details === 'string') { try { details = JSON.parse(r.details); } catch { details = r.details; } }
    return { ...r, details };
  });
  const last = page[page.length - 1];
  return c.json({ items, next_before: results.length > limit && last ? `${last.at}|${last.id}` : null });
});

const parseEmails = (v: unknown): string[] => {
  if (typeof v !== 'string') return [];
  try { const a = JSON.parse(v); return Array.isArray(a) ? a.filter((e) => typeof e === 'string') : []; } catch { return []; }
};

const UNIT_SETTINGS_SQL = `SELECT u.uic, l.unit_name, s.notification_emails, s.updated_at FROM (
    SELECT uic FROM uic_lookup
    UNION SELECT unit FROM profiles WHERE unit IS NOT NULL AND unit != ''
    UNION SELECT unit FROM vehicles WHERE unit IS NOT NULL AND unit != ''
    UNION SELECT uic FROM unit_settings
  ) u LEFT JOIN uic_lookup l ON l.uic = u.uic LEFT JOIN unit_settings s ON s.uic = u.uic`;

const unitSettingsRow = (r: Row) => ({
  uic: r.uic, unit_name: r.unit_name ?? null, notification_emails: parseEmails(r.notification_emails), updated_at: r.updated_at ?? null,
});

/** Every UIC known from uic_lookup, profiles or vehicles, with its notification recipients. */
app.get('/admin/unit-settings', async (c) => {
  const { results } = await c.env.DB.prepare(`${UNIT_SETTINGS_SQL} ORDER BY u.uic`).all<Row>();
  return c.json(results.map(unitSettingsRow));
});

/** Sets a unit's email recipients (max 10). `[]` clears them (falls back to NOTIFICATION_EMAIL). */
app.put('/admin/unit-settings/:uic', async (c) => {
  const uic = parseUic(c.req.param('uic'), 'uic');
  const body = await readObject(c);
  const emails = emailList(body.notification_emails, 'notification_emails', 10);
  const db = c.env.DB;
  const before = await db.prepare('SELECT notification_emails FROM unit_settings WHERE uic = ?').bind(uic).first<Row>();
  const { userId } = c.get('access');
  await db.batch([
    db.prepare(
      `INSERT INTO unit_settings (uic, notification_emails, updated_at, updated_by) VALUES (?, ?, ?, ?)
       ON CONFLICT (uic) DO UPDATE SET notification_emails = excluded.notification_emails,
         updated_at = excluded.updated_at, updated_by = excluded.updated_by`,
    ).bind(uic, J(emails), now(), userId),
    auditStmtAs(c, {
      action: 'unit_settings.update', unit: uic, targetType: 'unit_settings', targetId: uic,
      details: { notification_emails: { from: parseEmails(before?.notification_emails), to: emails } },
    }),
  ]);
  const row = await db.prepare(`${UNIT_SETTINGS_SQL} WHERE u.uic = ?`).bind(uic).first<Row>();
  return c.json(unitSettingsRow(row!));
});

// ---------------------------------------------------------------------------
// Client status: the field app's sync heartbeat, so the dashboard can see
// inspections stuck on devices. Not audited.
// ---------------------------------------------------------------------------

const STALE_MS = 3 * 86_400_000;

app.post('/client-status', async (c) => {
  const body = await readObject(c);
  const unsent = int(body, 'unsent_count', { required: true })!;
  const failed = int(body, 'failed_count', { required: true })!;
  if (body.last_error != null && typeof body.last_error !== 'string') throw bad('last_error must be a string');
  const lastError = typeof body.last_error === 'string' ? body.last_error.trim().slice(0, 1000) || null : null;
  const oldest = timestamp(body, 'oldest_unsent_at');
  const appVersion = str(body, 'app_version', { max: 64 }) || null;
  const { userId, own } = c.get('access');
  // Gentle: 10 per minute per user (and IP), without touching the shared per-IP auth budget.
  await rateLimit(c, `client-status:${userId}`, { perIp: false });
  await c.env.DB.prepare(
    `INSERT INTO client_status (user_id, unit, unsent_count, failed_count, last_error, oldest_unsent_at, app_version, reported_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT (user_id) DO UPDATE SET unit = excluded.unit, unsent_count = excluded.unsent_count,
       failed_count = excluded.failed_count, last_error = excluded.last_error, oldest_unsent_at = excluded.oldest_unsent_at,
       app_version = excluded.app_version, reported_at = excluded.reported_at`,
  ).bind(userId, own, unsent, failed, lastError, oldest, appVersion, now()).run();
  return c.json({ ok: true });
});

/** Devices with unsent or failed uploads in the caller's visible units († `?unit=`). */
app.get('/client-status', async (c) => {
  const scope = readScope(c);
  if (!scope.length) return c.json([]);
  const { results } = await c.env.DB.prepare(
    `SELECT s.user_id, p.rank, p.last_name, p.first_name, s.unit, s.unsent_count, s.failed_count, s.last_error,
       s.oldest_unsent_at, s.reported_at, s.app_version
     FROM client_status s JOIN profiles p ON p.id = s.user_id
     WHERE s.unit ${IN_JSON} AND (s.unsent_count > 0 OR s.failed_count > 0)
     ORDER BY s.unit, s.reported_at DESC, s.user_id`,
  ).bind(J(scope)).all<Row>();
  const staleBefore = new Date(Date.now() - STALE_MS).toISOString();
  return c.json(results.map((r) => ({
    ...r, stale: Number(r.unsent_count) > 0 && typeof r.reported_at === 'string' && r.reported_at < staleBefore,
  })));
});

// ---------------------------------------------------------------------------
// Cron
// ---------------------------------------------------------------------------

/** Daily readiness snapshot of every vehicle for the dashboard's 30-day chart. */
async function dailySnapshot(env: Env) {
  await env.DB.prepare(
    `INSERT INTO vehicle_status_history (vehicle_id, status, recorded_at)
     SELECT id, COALESCE(status, 'FMC'), date('now') FROM vehicles WHERE true
     ON CONFLICT (vehicle_id, recorded_at) DO UPDATE SET status = excluded.status`,
  ).run();
}

export default {
  fetch: app.fetch,
  /** Dispatches on the cron expression: the daily status snapshot, otherwise the weekly R2 backup
   *  (matched loosely because Cloudflare may hand back the weekly expression in a normalized form). */
  async scheduled(event: ScheduledController, env: Env) {
    try {
      if (event.cron !== DAILY_CRON) await runBackup(env);
      else await dailySnapshot(env);
    } catch (err) {
      console.error({ route: `cron ${event.cron}`, status: 500, message: (err as Error)?.message });
      throw err;
    }
  },
} satisfies ExportedHandler<Env>;
