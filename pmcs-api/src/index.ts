import { Hono, type Context } from 'hono';
import { cors } from 'hono/cors';
import { hashPin, verifyPin, signToken, verifyToken, signFileUrl, verifyFileUrl } from './auth';
import { fillDa2404 } from './da2404';

export interface Env {
  DB: D1Database;
  FILES: R2Bucket;
  JWT_SECRET: string;
  /** Comma-separated list of browser origins allowed to call the API. */
  ALLOWED_ORIGINS?: string;
}

type Vars = { userId: string; dodId: string };
type Ctx = Context<{ Bindings: Env; Variables: Vars }>;

const MAX_FAILED_LOGINS = 5;
const LOCKOUT_MINUTES = 15;
const PUBLIC_BUCKETS = new Set(['fault-photos', 'tm-documents']);
// D1 caps bound parameters per statement at 100.
const IN_CHUNK = 90;

const app = new Hono<{ Bindings: Env; Variables: Vars }>();

app.use('*', async (c, next) => {
  const allowed = (c.env.ALLOWED_ORIGINS ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  return cors({
    origin: (origin) =>
      allowed.includes(origin) || /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin) ? origin : null,
    allowHeaders: ['Authorization', 'Content-Type'],
    allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    maxAge: 86400,
  })(c, next);
});

app.onError((err, c) => {
  console.error(err);
  return c.json({ error: err.message || 'Internal error' }, 500);
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const now = () => new Date().toISOString();
const uuid = () => crypto.randomUUID();
const placeholders = (n: number) => Array.from({ length: n }, () => '?').join(',');
const bool = (v: unknown) => (v == null ? null : v ? 1 : 0);

type Row = Record<string, unknown>;

/** Converts SQLite storage types back to the shapes the apps expect. */
function out(row: Row | null): Row | null {
  if (!row) return row;
  const r: Row = { ...row };
  delete r.pin_hash;
  delete r.failed_logins;
  delete r.locked_until;
  for (const k of ['photo_urls', 'steps_completed']) {
    if (typeof r[k] === 'string') {
      try { r[k] = JSON.parse(r[k] as string); } catch { r[k] = []; }
    }
  }
  for (const k of ['corrected_on_site', 'needs_maintenance', 'part_needed']) {
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

/** Runs `sql` (containing `IN (__IN__)`) once per chunk of `ids` and concatenates the results. */
async function allIn(db: D1Database, sql: string, ids: string[], params: unknown[] = []): Promise<Row[]> {
  const results: Row[] = [];
  for (let i = 0; i < ids.length; i += IN_CHUNK) {
    const chunk = ids.slice(i, i + IN_CHUNK);
    results.push(...(await all(db, sql.replace('__IN__', placeholders(chunk.length)), [...chunk, ...params])));
  }
  return results;
}

function sortBy(rows: Row[], key: string, dir: 'asc' | 'desc') {
  return rows.sort((a, b) => {
    const av = String(a[key] ?? ''), bv = String(b[key] ?? '');
    return dir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
  });
}

const PROFILE_COLS = 'id, dod_id, rank, last_name, first_name, mi, unit, created_at';

async function sessionResponse(c: Ctx, profile: Row) {
  const token = await signToken(c.env.JWT_SECRET, profile.id as string, profile.dod_id as string);
  return c.json({ token, profile: out(profile) });
}

// ---------------------------------------------------------------------------
// Auth (replaces Supabase Auth + the `signup` edge function + check_dod_id_exists)
// ---------------------------------------------------------------------------

app.post('/auth/signup', async (c) => {
  const body = await c.req.json<Record<string, string>>();
  const dodId = String(body.dod_id ?? '').trim();
  const pin = String(body.pin ?? '');
  if (!dodId || dodId.length > 20) return c.json({ error: 'A valid DOD ID is required' }, 400);
  if (pin.length < 4) return c.json({ error: 'PIN must be at least 4 digits' }, 400);

  const exists = await first(c.env.DB, 'SELECT id FROM profiles WHERE dod_id = ?', [dodId]);
  if (exists) return c.json({ error: 'This DOD ID is already registered' }, 409);

  const profile = {
    id: uuid(),
    dod_id: dodId,
    rank: body.rank ?? null,
    last_name: body.last_name ?? null,
    first_name: body.first_name ?? null,
    mi: body.mi ?? null,
    unit: body.unit ? body.unit.toUpperCase() : null,
    created_at: now(),
  };
  await c.env.DB.prepare(
    `INSERT INTO profiles (id, dod_id, pin_hash, rank, last_name, first_name, mi, unit, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).bind(profile.id, dodId, await hashPin(pin), profile.rank, profile.last_name, profile.first_name, profile.mi, profile.unit, profile.created_at).run();

  return sessionResponse(c, profile);
});

app.post('/auth/login', async (c) => {
  const body = await c.req.json<Record<string, string>>();
  const dodId = String(body.dod_id ?? '').trim();
  const pin = String(body.pin ?? '');
  const row = await c.env.DB.prepare('SELECT * FROM profiles WHERE dod_id = ?').bind(dodId).first<Row>();
  if (!row) return c.json({ error: 'Invalid DOD ID or PIN' }, 401);

  if (row.locked_until && String(row.locked_until) > now()) {
    return c.json({ error: `Too many failed attempts. Try again in ${LOCKOUT_MINUTES} minutes.` }, 429);
  }

  const { ok, needsRehash } = await verifyPin(pin, row.pin_hash as string);
  if (!ok) {
    const failed = Number(row.failed_logins ?? 0) + 1;
    const lockedUntil = failed >= MAX_FAILED_LOGINS ? new Date(Date.now() + LOCKOUT_MINUTES * 60_000).toISOString() : null;
    await c.env.DB.prepare('UPDATE profiles SET failed_logins = ?, locked_until = ? WHERE id = ?')
      .bind(lockedUntil ? 0 : failed, lockedUntil, row.id).run();
    return c.json({ error: 'Invalid DOD ID or PIN' }, 401);
  }

  await c.env.DB.prepare('UPDATE profiles SET failed_logins = 0, locked_until = NULL, pin_hash = ? WHERE id = ?')
    .bind(needsRehash ? await hashPin(pin) : row.pin_hash, row.id).run();
  return sessionResponse(c, row);
});

app.get('/auth/exists/:dodId', async (c) => {
  const row = await first(c.env.DB, 'SELECT 1 AS x FROM profiles WHERE dod_id = ?', [c.req.param('dodId').trim()]);
  return c.json({ exists: !!row });
});

// ---------------------------------------------------------------------------
// Files in R2 (replaces Supabase Storage). Keys are `<bucket>/<path>`.
// ---------------------------------------------------------------------------

app.get('/files/:bucket/:path{.+}', async (c) => {
  const bucket = c.req.param('bucket');
  const key = `${bucket}/${c.req.param('path')}`;
  if (!PUBLIC_BUCKETS.has(bucket)) {
    const ok = await verifyFileUrl(c.env.JWT_SECRET, key, c.req.query('exp'), c.req.query('sig'));
    if (!ok) return c.json({ error: 'Link expired or invalid' }, 403);
  }
  const obj = await c.env.FILES.get(key);
  if (!obj) return c.json({ error: 'Not found' }, 404);
  const headers = new Headers();
  obj.writeHttpMetadata(headers);
  headers.set('etag', obj.httpEtag);
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
  if (!claims) return c.json({ error: 'Not signed in' }, 401);
  c.set('userId', claims.sub);
  c.set('dodId', claims.dod_id);
  await next();
});

app.get('/me', async (c) => {
  const profile = await first(c.env.DB, `SELECT ${PROFILE_COLS} FROM profiles WHERE id = ?`, [c.get('userId')]);
  if (!profile) return c.json({ error: 'Profile not found' }, 404);
  return c.json(profile);
});

app.get('/profiles', async (c) => {
  const ids = c.req.queries('id') ?? [];
  if (ids.length === 0) return c.json([]);
  return c.json(await allIn(c.env.DB, 'SELECT id, rank, last_name, first_name FROM profiles WHERE id IN (__IN__)', ids));
});

// --- Vehicles --------------------------------------------------------------

app.get('/vehicles', async (c) => {
  const where: string[] = [];
  const params: unknown[] = [];
  const units = c.req.queries('unit') ?? [];
  if (units.length) { where.push(`unit IN (${placeholders(units.length)})`); params.push(...units); }
  const norm = c.req.query('bumper_normalized');
  if (norm) { where.push('bumper_number_normalized = ?'); params.push(norm); }
  const bumper = c.req.query('bumper_number');
  if (bumper) { where.push('bumper_number = ?'); params.push(bumper); }
  const sql = `SELECT * FROM vehicles ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY bumper_number`;
  return c.json(await all(c.env.DB, sql, params));
});

app.get('/vehicles/:id', async (c) => {
  const v = await first(c.env.DB, 'SELECT * FROM vehicles WHERE id = ?', [c.req.param('id')]);
  return v ? c.json(v) : c.json({ error: 'Not found' }, 404);
});

app.get('/vehicle-status-history', async (c) => {
  const since = c.req.query('since') ?? '0000-00-00';
  return c.json(await all(c.env.DB,
    'SELECT vehicle_id, status, recorded_at FROM vehicle_status_history WHERE recorded_at >= ? ORDER BY recorded_at', [since]));
});

// --- Faults ----------------------------------------------------------------

app.get('/faults', async (c) => {
  const open = c.req.query('open') === '1';
  const dir = c.req.query('order') === 'asc' ? 'asc' : 'desc';
  const openClause = open ? " AND resolution_status != 'CORRECTED'" : '';
  const vehicleIds = c.req.queries('vehicle_id') ?? [];
  const inspectionIds = c.req.queries('inspection_id') ?? [];
  const units = c.req.queries('unit') ?? [];

  let rows: Row[];
  if (vehicleIds.length) {
    rows = await allIn(c.env.DB, `SELECT * FROM faults WHERE vehicle_id IN (__IN__)${openClause}`, vehicleIds);
  } else if (inspectionIds.length) {
    rows = await allIn(c.env.DB, `SELECT * FROM faults WHERE inspection_id IN (__IN__)${openClause}`, inspectionIds);
  } else if (units.length) {
    rows = await allIn(c.env.DB,
      `SELECT f.* FROM faults f JOIN vehicles v ON v.id = f.vehicle_id WHERE v.unit IN (__IN__)${openClause.replace('resolution_status', 'f.resolution_status')}`, units);
  } else {
    rows = await all(c.env.DB, `SELECT * FROM faults WHERE 1=1${openClause}`);
  }
  return c.json(sortBy(rows, 'created_at', dir));
});

/** Acknowledge or resolve faults. Body: { ids, resolution_status, gcss_work_order? } */
app.patch('/faults', async (c) => {
  const body = await c.req.json<{ ids: string[]; resolution_status: string; gcss_work_order?: string }>();
  if (!Array.isArray(body.ids) || body.ids.length === 0) return c.json({ error: 'ids required' }, 400);
  if (!['ACKNOWLEDGED', 'CORRECTED'].includes(body.resolution_status)) return c.json({ error: 'Invalid resolution_status' }, 400);

  const resolved = body.resolution_status === 'CORRECTED';
  const stmts = body.ids.map((id) =>
    c.env.DB.prepare(
      `UPDATE faults SET resolution_status = ?,
         resolved_at = CASE WHEN ? THEN ? ELSE resolved_at END,
         resolved_by = CASE WHEN ? THEN ? ELSE resolved_by END,
         gcss_work_order = COALESCE(?, gcss_work_order)
       WHERE id = ?`,
    ).bind(body.resolution_status, resolved ? 1 : 0, now(), resolved ? 1 : 0, c.get('userId'), body.gcss_work_order || null, id),
  );
  await c.env.DB.batch(stmts);
  return c.json({ ok: true });
});

/** Upload one fault photo (raw image body). Query: session, photo, ext. */
app.post('/faults/:id/photos', async (c) => {
  const faultId = c.req.param('id');
  const fault = await first(c.env.DB, 'SELECT photo_urls FROM faults WHERE id = ?', [faultId]);
  if (!fault) return c.json({ error: 'Fault not found' }, 404);

  const ext = c.req.query('ext') === 'png' ? 'png' : 'jpg';
  const safe = (s: string | undefined) => (s ?? uuid()).replace(/[^A-Za-z0-9_-]/g, '');
  const key = `fault-photos/${safe(c.req.query('session'))}/${faultId}/${safe(c.req.query('photo'))}.${ext}`;
  await c.env.FILES.put(key, c.req.raw.body, {
    httpMetadata: { contentType: ext === 'png' ? 'image/png' : 'image/jpeg' },
  });

  const url = fileUrl(c, key);
  const urls = new Set((fault.photo_urls as string[]) ?? []);
  urls.add(url);
  await c.env.DB.prepare('UPDATE faults SET photo_urls = ? WHERE id = ?').bind(JSON.stringify([...urls]), faultId).run();
  return c.json({ url });
});

app.get('/diagnosis-attempts', async (c) => {
  const ids = c.req.queries('fault_id') ?? [];
  if (!ids.length) return c.json([]);
  return c.json(sortBy(await allIn(c.env.DB, 'SELECT * FROM diagnosis_attempts WHERE fault_id IN (__IN__)', ids), 'completed_at', 'desc'));
});

// --- Inspections -----------------------------------------------------------

app.get('/inspections', async (c) => {
  const ids = c.req.queries('id') ?? [];
  if (ids.length) return c.json(await allIn(c.env.DB, 'SELECT * FROM inspections WHERE id IN (__IN__)', ids));

  const where: string[] = [];
  const params: unknown[] = [];
  const vehicleId = c.req.query('vehicle_id');
  if (vehicleId) { where.push('vehicle_id = ?'); params.push(vehicleId); }
  const status = c.req.query('status');
  if (status) { where.push('status = ?'); params.push(status); }
  const limit = Math.min(Number(c.req.query('limit') ?? 1000) || 1000, 5000);
  const sql = `SELECT * FROM inspections ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
               ORDER BY completed_at DESC LIMIT ${limit}`;
  return c.json(await all(c.env.DB, sql, params));
});

interface SyncBody {
  vehicle: {
    bumper_number: string;
    vehicle_type: string;
    serial_number: string | null;
    registration_number: string | null;
    nomenclature: string | null;
    unit: string;
    current_odometer: number | null;
  };
  inspection: {
    inspector_dod_id: string;
    inspection_type: string;
    odometer_reading: number | null;
    remarks: string | null;
    date: string;
    started_at: string;
    completed_at: string;
    client_session_id: string;
  };
  faults: Array<Record<string, unknown>>;
}

/**
 * Uploads a completed inspection from the field app (vehicle upsert, inspection
 * upsert, fault insert). Idempotent on client_session_id so the offline retry
 * queue can resend safely. Returns fault ids in the same order as the request.
 */
app.post('/inspections/sync', async (c) => {
  const { vehicle: v, inspection: ins, faults } = await c.req.json<SyncBody>();
  const db = c.env.DB;
  const normalized = v.bumper_number.replace(/[-\s]/g, '').toUpperCase();

  const vehicleRow = await db.prepare(
    `INSERT INTO vehicles (id, bumper_number, bumper_number_normalized, vehicle_type, serial_number,
       registration_number, nomenclature, unit, current_odometer)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT (bumper_number_normalized, unit) DO UPDATE SET
       bumper_number = excluded.bumper_number,
       vehicle_type = excluded.vehicle_type,
       serial_number = COALESCE(excluded.serial_number, vehicles.serial_number),
       registration_number = COALESCE(excluded.registration_number, vehicles.registration_number),
       nomenclature = excluded.nomenclature,
       current_odometer = excluded.current_odometer,
       updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
     RETURNING id`,
  ).bind(uuid(), v.bumper_number, normalized, v.vehicle_type, v.serial_number, v.registration_number,
    v.nomenclature, v.unit, v.current_odometer).first<{ id: string }>();
  if (!vehicleRow) throw new Error('Vehicle upsert returned no row');

  const inspector = await first(db, 'SELECT id FROM profiles WHERE dod_id = ?', [ins.inspector_dod_id]);
  const inspectorId = (inspector?.id as string | undefined) ?? c.get('userId');

  const inspectionRow = await db.prepare(
    `INSERT INTO inspections (id, vehicle_id, inspector_id, inspection_type, status, odometer_reading,
       remarks, date, started_at, completed_at, client_session_id)
     VALUES (?, ?, ?, ?, 'COMPLETED', ?, ?, ?, ?, ?, ?)
     ON CONFLICT (client_session_id) DO UPDATE SET
       status = 'COMPLETED', remarks = excluded.remarks, completed_at = excluded.completed_at
     RETURNING id`,
  ).bind(uuid(), vehicleRow.id, inspectorId, ins.inspection_type, ins.odometer_reading, ins.remarks,
    ins.date, ins.started_at, ins.completed_at, ins.client_session_id).first<{ id: string }>();
  if (!inspectionRow) throw new Error('Inspection upsert returned no row');

  // Retry of an already-synced session: return the faults we stored last time.
  const existing = await all(db, 'SELECT id FROM faults WHERE inspection_id = ? ORDER BY rowid', [inspectionRow.id]);
  if (existing.length > 0) {
    return c.json({ inspection_id: inspectionRow.id, vehicle_id: vehicleRow.id, fault_ids: existing.map((f) => f.id) });
  }

  const faultIds = faults.map(() => uuid());
  if (faults.length) {
    await db.batch(faults.map((f, i) =>
      db.prepare(
        `INSERT INTO faults (id, inspection_id, vehicle_id, item, item_description, zone, readiness, category_id,
           description, corrective_action, part_needed, part_description, nsn, corrected_on_site,
           needs_maintenance, resolution_status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).bind(faultIds[i], inspectionRow.id, vehicleRow.id, f.item ?? null, f.item_description ?? null, f.zone ?? null,
        f.readiness ?? 'NMC', f.category_id ?? null, f.description ?? null, f.corrective_action ?? null,
        bool(f.part_needed), f.part_description ?? null, f.nsn ?? null, bool(f.corrected_on_site),
        bool(f.needs_maintenance), f.corrected_on_site ? 'CORRECTED' : 'OPEN'),
    ));
  }
  return c.json({ inspection_id: inspectionRow.id, vehicle_id: vehicleRow.id, fault_ids: faultIds });
});

/**
 * Generates the DA 2404 for an inspection, including other still-open faults on
 * the vehicle, stores it in R2 and returns a 1-hour download link.
 */
app.post('/inspections/:id/da2404', async (c) => {
  const db = c.env.DB;
  const inspection = await first(db, 'SELECT * FROM inspections WHERE id = ?', [c.req.param('id')]);
  if (!inspection) return c.json({ error: 'Inspection not found' }, 404);
  const [vehicle, inspector, faults] = await Promise.all([
    first(db, 'SELECT * FROM vehicles WHERE id = ?', [inspection.vehicle_id]),
    first(db, `SELECT ${PROFILE_COLS} FROM profiles WHERE id = ?`, [inspection.inspector_id]),
    all(db,
      `SELECT * FROM faults WHERE inspection_id = ?
       UNION
       SELECT * FROM faults WHERE vehicle_id = ? AND resolution_status != 'CORRECTED' AND inspection_id != ?
       ORDER BY created_at`,
      [inspection.id, inspection.vehicle_id, inspection.id]),
  ]);
  if (!vehicle) return c.json({ error: 'Vehicle not found' }, 404);
  type Opts = { supervisor_name?: string | null; supervisor_dod_id?: string | null };
  const opts = await c.req.json<Opts>().catch((): Opts => ({}));

  const uic = await first(db, 'SELECT unit_name FROM uic_lookup WHERE uic = ?', [String(vehicle.unit ?? '').toUpperCase()]);
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
    supervisorName: opts.supervisor_name ?? null,
    supervisorDodId: opts.supervisor_dod_id ?? null,
    faults: faults.map((f) => ({
      ...f,
      corrected_on_site: f.corrected_on_site ? 1 : 0,
      needs_maintenance: f.needs_maintenance ? 1 : 0,
      part_needed: f.part_needed ? 1 : 0,
    })) as never,
  });

  const path = `da2404/${inspection.id}.pdf`;
  await c.env.FILES.put(`generated/${path}`, bytes, { httpMetadata: { contentType: 'application/pdf' } });
  await db.batch([
    db.prepare('DELETE FROM generated_forms WHERE inspection_id = ?').bind(inspection.id),
    db.prepare('INSERT INTO generated_forms (id, inspection_id, vehicle_id, pdf_storage_path) VALUES (?, ?, ?, ?)')
      .bind(uuid(), inspection.id, vehicle.id, path),
  ]);
  return c.json({ url: await signedFileUrl(c, `generated/${path}`), path });
});

app.get('/generated-forms', async (c) => {
  const ids = c.req.queries('inspection_id') ?? [];
  if (!ids.length) return c.json([]);
  return c.json(await allIn(c.env.DB, 'SELECT inspection_id, pdf_storage_path FROM generated_forms WHERE inspection_id IN (__IN__)', ids));
});

/** Signed download link for a generated form (replaces storage.createSignedUrl). */
app.get('/generated-forms/link', async (c) => {
  const path = c.req.query('path');
  if (!path) return c.json({ error: 'path required' }, 400);
  return c.json({ url: await signedFileUrl(c, `generated/${path}`) });
});

// --- UIC lookup & dashboard watch list ------------------------------------

app.get('/uic/:uic', async (c) => {
  const row = await first(c.env.DB, 'SELECT uic, unit_name FROM uic_lookup WHERE uic = ?', [c.req.param('uic').toUpperCase()]);
  return row ? c.json(row) : c.json({ error: 'Not found' }, 404);
});

app.put('/uic/:uic', async (c) => {
  const { unit_name } = await c.req.json<{ unit_name: string }>();
  if (!unit_name) return c.json({ error: 'unit_name required' }, 400);
  await c.env.DB.prepare('INSERT INTO uic_lookup (uic, unit_name) VALUES (?, ?) ON CONFLICT (uic) DO UPDATE SET unit_name = excluded.unit_name')
    .bind(c.req.param('uic').toUpperCase(), unit_name).run();
  return c.json({ ok: true });
});

app.get('/watched-uics', async (c) => {
  return c.json(await all(c.env.DB, 'SELECT id, uic FROM dashboard_watched_uics WHERE user_id = ? ORDER BY created_at', [c.get('userId')]));
});

app.post('/watched-uics', async (c) => {
  const { uic } = await c.req.json<{ uic: string }>();
  const value = String(uic ?? '').trim().toUpperCase();
  if (!value) return c.json({ error: 'uic required' }, 400);
  const row = { id: uuid(), uic: value };
  const res = await c.env.DB.prepare('INSERT OR IGNORE INTO dashboard_watched_uics (id, user_id, uic) VALUES (?, ?, ?)')
    .bind(row.id, c.get('userId'), value).run();
  if (!res.meta.changes) return c.json({ error: 'You are already watching this UIC' }, 409);
  return c.json(row);
});

app.delete('/watched-uics/:id', async (c) => {
  await c.env.DB.prepare('DELETE FROM dashboard_watched_uics WHERE id = ? AND user_id = ?').bind(c.req.param('id'), c.get('userId')).run();
  return c.json({ ok: true });
});

export default {
  fetch: app.fetch,
  /** Daily readiness snapshot for the dashboard's 30-day chart. */
  async scheduled(_event: ScheduledController, env: Env) {
    await env.DB.prepare(
      `INSERT INTO vehicle_status_history (vehicle_id, status, recorded_at)
       SELECT id, COALESCE(status, 'FMC'), date('now') FROM vehicles WHERE true
       ON CONFLICT (vehicle_id, recorded_at) DO UPDATE SET status = excluded.status`,
    ).run();
  },
} satisfies ExportedHandler<Env>;
