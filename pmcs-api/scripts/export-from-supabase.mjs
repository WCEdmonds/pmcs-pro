#!/usr/bin/env node
// One-time export of the Supabase project into files the Cloudflare stack imports.
//
// Two ways to reach the database (the first one that is configured wins):
//   1. Management API over HTTPS (works where Postgres TCP is blocked):
//        SUPABASE_ACCESS_TOKEN=<personal access token>  SUPABASE_PROJECT_REF=<ref>
//   2. Direct Postgres:
//        SUPABASE_DB_URL=postgresql://postgres.<ref>:<password>@<host>:5432/postgres
//
// Storage (optional): SUPABASE_URL (defaults to https://<ref>.supabase.co) and
// SUPABASE_SERVICE_ROLE_KEY (in Management API mode it is fetched automatically).
// API_URL=https://pmcs-api.<subdomain>.workers.dev rewrites Supabase storage URLs.
//
//   node scripts/export-from-supabase.mjs [out-dir] [--unit-map map.json] [--unit-names names.json] [--skip-orphans]
//     --unit-names: {"UIC123": "A Co, 1st BN"} sets the display name per UIC (overrides what users typed)
//   node scripts/export-from-supabase.mjs --freeze     # revoke writes for anon/authenticated
//   node scripts/export-from-supabase.mjs --unfreeze   # restore them
//
// Writes into <out-dir> (default supabase-export/, gitignored):
//   data.sql          import with scripts/import-to-d1.mjs (refuses a non-empty DB)
//   counts.json       rows written per table (the importer verifies against it)
//   secrets.env       app_config values for `wrangler secret bulk` (mode 600, never printed)
//   unit-report.json  every unit/UIC after --unit-map, with counts and invalid values
//   schema/           RLS policies, functions, triggers, edge functions (for the record)
//   files/<bucket>/…  every storage object, and upload-to-r2.sh to put them in R2
//
// Exit status is non-zero on any problem that would make the import wrong
// (orphans without --skip-orphans, oversized statements, storage failures, …).

process.env.TZ = 'UTC';

import { mkdir, writeFile, readFile, chmod, rm } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const MIGRATION = join(HERE, '..', 'migrations', '0001_init.sql');
const R2_BUCKET = 'pmcs-pro-files';
const PAGE_SIZE = 2000;
export const MAX_STATEMENT_BYTES = 90 * 1024; // D1 rejects statements over 100 KB
const UIC_RE = /^[A-Z0-9]{6}$/;

/** D1 target tables and columns, in foreign-key order. */
export const TABLES = {
  profiles: ['id', 'dod_id', 'pin_hash', 'rank', 'last_name', 'first_name', 'mi', 'unit', 'created_at'],
  vehicles: ['id', 'bumper_number', 'bumper_number_normalized', 'vehicle_type', 'serial_number', 'registration_number',
    'nomenclature', 'unit', 'current_odometer', 'status', 'section', 'lin_number', 'nsn', 'description', 'created_at', 'updated_at'],
  inspections: ['id', 'vehicle_id', 'inspector_id', 'inspection_type', 'status', 'odometer_reading', 'remarks', 'date',
    'started_at', 'completed_at', 'client_session_id', 'created_at'],
  faults: ['id', 'inspection_id', 'vehicle_id', 'item', 'item_description', 'zone', 'readiness', 'category_id', 'description',
    'corrective_action', 'part_needed', 'part_description', 'nsn', 'corrected_on_site', 'needs_maintenance',
    'resolution_status', 'gcss_work_order', 'photo_urls', 'resolved_at', 'resolved_by', 'created_at'],
  diagnosis_attempts: ['id', 'fault_id', 'session_id', 'category_id', 'steps_completed', 'outcome', 'skip_reason',
    'readiness_result', 'completed_at'],
  generated_forms: ['id', 'inspection_id', 'vehicle_id', 'pdf_storage_path', 'generated_at'],
  dashboard_watched_uics: ['id', 'user_id', 'uic', 'created_at'],
  uic_lookup: ['uic', 'unit_name', 'created_at'],
  vehicle_status_history: ['id', 'vehicle_id', 'status', 'recorded_at'],
};

/** Paging key and final row order per table. */
const ORDER = {
  faults: ['created_at', 'id'],
  vehicle_status_history: ['recorded_at', 'id'],
  inspections: ['created_at', 'id'],
};

const JSON_COLUMNS = new Set(['photo_urls', 'steps_completed']);
const BOOL_COLUMNS = new Set(['part_needed', 'corrected_on_site', 'needs_maintenance']);
/** NOT NULL columns with a DEFAULT in D1: a NULL from Supabase is left to the default. */
const NULL_TO_DEFAULT = new Set(['created_at', 'updated_at', 'generated_at']);
const NULL_TO_DEFAULT_BY_TABLE = { diagnosis_attempts: new Set(['completed_at']) };
const usesDefault = (table, col) => NULL_TO_DEFAULT.has(col) || !!NULL_TO_DEFAULT_BY_TABLE[table]?.has(col);

/** Foreign keys checked before writing: [table, column, parent table, required]. */
export const FOREIGN_KEYS = [
  ['inspections', 'vehicle_id', 'vehicles', true],
  ['inspections', 'inspector_id', 'profiles', true],
  ['faults', 'inspection_id', 'inspections', true],
  ['faults', 'vehicle_id', 'vehicles', true],
  ['diagnosis_attempts', 'fault_id', 'faults', true],
  ['generated_forms', 'inspection_id', 'inspections', true],
  ['generated_forms', 'vehicle_id', 'vehicles', false],
  ['dashboard_watched_uics', 'user_id', 'profiles', true],
  ['vehicle_status_history', 'vehicle_id', 'vehicles', true],
];

// ---------------------------------------------------------------------------
// Value conversion
// ---------------------------------------------------------------------------

/** 'true'/'t'/'yes'/'1' → 1, 'false'/'f'/'no'/'0' → 0, null → null; anything else throws. */
export function toBool01(v) {
  if (v === null || v === undefined) return null;
  if (typeof v === 'boolean') return v ? 1 : 0;
  if (typeof v === 'number') return v ? 1 : 0;
  const s = String(v).trim().toLowerCase();
  if (['true', 't', 'yes', 'y', '1', 'on'].includes(s)) return 1;
  if (['false', 'f', 'no', 'n', '0', 'off'].includes(s)) return 0;
  if (s === '' || s === 'null') return null;
  throw new Error(`not a boolean: ${JSON.stringify(v)}`);
}

/** Formats one value as a SQLite literal. */
export function sqlValue(column, value) {
  if (value === null || value === undefined) return JSON_COLUMNS.has(column) ? "'[]'" : 'NULL';
  if (JSON_COLUMNS.has(column)) return quote(JSON.stringify(value));
  if (BOOL_COLUMNS.has(column)) return String(toBool01(value));
  if (typeof value === 'boolean') return value ? '1' : '0';
  if (typeof value === 'number' || typeof value === 'bigint') return String(value);
  if (value instanceof Date) return quote(value.toISOString());
  if (typeof value === 'object') return quote(JSON.stringify(value));
  return quote(String(value));
}

function quote(s) {
  return `'${s.replace(/'/g, "''")}'`;
}

/** Postgres string literal (Management API queries take no parameters). */
export function pgQuote(s) {
  return `'${String(s).replace(/'/g, "''")}'`;
}

function shellQuote(s) {
  return `'${s.replace(/'/g, `'\\''`)}'`;
}

/** Points Supabase public storage URLs at the API's /files route. */
export function rewriteStorageUrl(url, supabaseUrl, apiUrl) {
  const prefix = `${supabaseUrl.replace(/\/$/, '')}/storage/v1/object/public/`;
  return url.startsWith(prefix) ? `${apiUrl.replace(/\/$/, '')}/files/${url.slice(prefix.length)}` : url;
}

export const normalizeBumper = (s) => String(s).replace(/[-\s]/g, '').toUpperCase();

/** Parses --unit-names: {"UIC123": "A Co, 1st BN"} → Map of upper-cased UIC → trimmed name. */
export function parseUnitNames(json) {
  if (typeof json !== 'object' || json === null || Array.isArray(json)) throw new Error('--unit-names must be a JSON object {"UIC123": "Unit name"}');
  const out = new Map();
  for (const [k, v] of Object.entries(json)) {
    const uic = String(k).trim().toUpperCase();
    if (!UIC_RE.test(uic)) throw new Error(`--unit-names key ${k} is not a 6-character UIC`);
    if (typeof v !== 'string' || !v.trim()) throw new Error(`--unit-names value for ${k} must be a non-empty string`);
    out.set(uic, v.trim());
  }
  return out;
}

/** Upper-cases/trims a unit, then applies the operator's --unit-map. */
export function mapUnit(value, unitMap) {
  if (value === null || value === undefined) return null;
  const u = String(value).trim().toUpperCase();
  if (!u) return null;
  return unitMap.get(u) ?? u;
}

export function parseUnitMap(json) {
  if (typeof json !== 'object' || json === null || Array.isArray(json)) throw new Error('--unit-map must be a JSON object {"bad": "GOOD00"}');
  const map = new Map();
  for (const [k, v] of Object.entries(json)) {
    if (typeof v !== 'string') throw new Error(`--unit-map value for ${k} must be a string`);
    map.set(k.trim().toUpperCase(), v.trim().toUpperCase());
  }
  return map;
}

/** Builds INSERT statements for rows already shaped like the D1 table. Never replaces existing rows. */
export function buildInserts(table, rows) {
  const targetCols = TABLES[table];
  return rows.map((row) => {
    const cols = targetCols.filter((c) => c in row && !(row[c] == null && usesDefault(table, c)));
    const vals = cols.map((c) => sqlValue(c, row[c]));
    return `INSERT INTO ${table} (${cols.join(', ')}) VALUES (${vals.join(', ')}) ON CONFLICT DO NOTHING;`;
  });
}

/** CREATE TRIGGER statements from the migration, so data.sql can drop and recreate them. */
export function extractTriggers(migrationSql) {
  return [...migrationSql.matchAll(/^CREATE TRIGGER (\w+)\b[\s\S]*?^END;/gm)].map((m) => ({ name: m[1], sql: m[0] }));
}

// ---------------------------------------------------------------------------
// Database access: one `query(sql) → rows` for both transports.
// ---------------------------------------------------------------------------

export function managementApi({ token, ref, baseUrl = 'https://api.supabase.com' }) {
  const api = async (method, path, body) => {
    const res = await fetch(`${baseUrl.replace(/\/$/, '')}/v1/projects/${ref}${path}`, {
      method,
      headers: { Authorization: `Bearer ${token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) throw new Error(`Management API ${method} ${path}: ${res.status} ${(await res.text()).slice(0, 500)}`);
    return res;
  };
  return {
    kind: 'management-api',
    async query(sql) {
      const rows = await (await api('POST', '/database/query', { query: sql })).json();
      if (!Array.isArray(rows)) throw new Error(`Management API returned ${JSON.stringify(rows).slice(0, 200)}`);
      return rows;
    },
    api,
    async end() {},
  };
}

export async function pgClient(url) {
  const { default: pg } = await import('pg');
  const local = /@(localhost|127\.0\.0\.1)[:/]/.test(url) || url.includes('host=/');
  const client = new pg.Client({ connectionString: url, ssl: local ? false : { rejectUnauthorized: false } });
  await client.connect();
  return {
    kind: 'postgres',
    async query(sql) {
      const res = await client.query(sql);
      return (Array.isArray(res) ? res[res.length - 1] : res).rows;
    },
    end: () => client.end(),
  };
}

/** Column expression that returns a predictable JSON type through either transport. */
export function columnExpr(column, dataType, alias = 't') {
  const c = `${alias}."${column}"`;
  switch (dataType) {
    case 'timestamp with time zone':
      return `to_char(${c} AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')`;
    case 'timestamp without time zone':
      return `to_char(${c}, 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')`;
    case 'date':
      return `to_char(${c}, 'YYYY-MM-DD')`;
    case 'boolean': case 'smallint': case 'integer': case 'bigint': case 'real': case 'double precision':
    case 'numeric': case 'jsonb': case 'json':
      return c;
    case 'ARRAY':
      return `to_jsonb(${c})`;
    default:
      return `${c}::text`;
  }
}

async function sourceColumns(db, table, schema = 'public') {
  const rows = await db.query(
    `SELECT column_name, data_type FROM information_schema.columns
     WHERE table_schema = ${pgQuote(schema)} AND table_name = ${pgQuote(table)} ORDER BY ordinal_position`);
  return new Map(rows.map((r) => [r.column_name, r.data_type]));
}

/**
 * Reads a whole table as plain JSON objects, PAGE_SIZE rows per query, using
 * keyset paging on `key` (compared as text). `from` may join other tables;
 * `select` maps output names to SQL expressions.
 */
export async function fetchAll(db, { select, from, key }) {
  const out = [];
  let last = null;
  for (;;) {
    const cols = Object.entries(select).map(([name, expr]) => `${expr} AS "${name}"`).join(', ');
    const where = last === null ? '' : `WHERE (${key})::text > ${pgQuote(last)}`;
    const rows = await db.query(
      `SELECT row_to_json(x)::text AS j, x.__key FROM (
         SELECT ${cols}, (${key})::text AS __key FROM ${from} ${where} ORDER BY (${key})::text LIMIT ${PAGE_SIZE}
       ) x ORDER BY x.__key`);
    for (const r of rows) {
      const obj = JSON.parse(r.j);
      delete obj.__key;
      out.push(obj);
    }
    if (rows.length < PAGE_SIZE) return out;
    last = rows[rows.length - 1].__key;
  }
}

async function readTable(db, table, warnings) {
  const available = await sourceColumns(db, table);
  if (available.size === 0) return null;
  const select = {};
  for (const col of TABLES[table]) {
    if (col === 'pin_hash' && table === 'profiles') continue;
    if (available.has(col)) select[col] = columnExpr(col, available.get(col));
  }
  const missing = TABLES[table].filter((c) => !available.has(c) && !(table === 'profiles' && c === 'pin_hash'));
  if (missing.length) warnings.push(`${table}: not in Supabase, D1 defaults used: ${missing.join(', ')}`);
  let from = `public.${table} t`;
  if (table === 'profiles') {
    // PINs: bcrypt hashes from auth.users; '!' marks a profile without an auth user,
    // which its owner can claim through /auth/signup.
    select.pin_hash = `COALESCE(NULLIF(u.encrypted_password, ''), '!')`;
    from = 'public.profiles t LEFT JOIN auth.users u ON u.id = t.id';
  }
  const key = available.has('id') ? 't."id"' : table === 'uic_lookup' ? 't."uic"' : 't.ctid';
  return fetchAll(db, { select, from, key });
}

const byKeys = (keys) => (a, b) => {
  for (const k of keys) {
    const av = a[k] ?? '', bv = b[k] ?? '';
    if (av < bv) return -1;
    if (av > bv) return 1;
  }
  return 0;
};

// ---------------------------------------------------------------------------
// Transform + checks (pure; unit-tested)
// ---------------------------------------------------------------------------

/**
 * Normalises the raw tables in place: units, booleans, arrays, dedupes. Returns
 * a report and a list of errors that must stop the export.
 */
export function transform(data, { unitMap = new Map(), unitNames = new Map(), supabaseUrl = '', apiUrl = '' } = {}) {
  const errors = [];
  const warnings = [];
  const unitCounts = {};
  const countUnit = (table, u) => {
    const key = u ?? '(null)';
    unitCounts[key] ??= {};
    unitCounts[key][table] = (unitCounts[key][table] ?? 0) + 1;
  };

  for (const p of data.profiles ?? []) { p.unit = mapUnit(p.unit, unitMap); countUnit('profiles', p.unit); }
  for (const v of data.vehicles ?? []) {
    v.unit = mapUnit(v.unit, unitMap);
    countUnit('vehicles', v.unit);
    if (!v.bumper_number_normalized && v.bumper_number) v.bumper_number_normalized = normalizeBumper(v.bumper_number);
  }
  const mismatched = (data.vehicles ?? []).filter((v) => v.bumper_number && v.bumper_number_normalized !== normalizeBumper(v.bumper_number));
  if (mismatched.length) warnings.push(`vehicles: ${mismatched.length} with bumper_number_normalized not matching the API's normalization (kept as is): ${mismatched.slice(0, 10).map((v) => v.id).join(', ')}`);
  const seenVehicle = new Map();
  for (const v of data.vehicles ?? []) {
    if (v.bumper_number_normalized == null) continue;
    const k = `${v.bumper_number_normalized}|${v.unit}`;
    if (seenVehicle.has(k)) errors.push(`vehicles ${seenVehicle.get(k)} and ${v.id} are both ${v.bumper_number_normalized} in ${v.unit} after unit mapping; merge or remap them`);
    else seenVehicle.set(k, v.id);
  }

  if (data.uic_lookup) {
    const best = new Map();
    for (const r of data.uic_lookup) {
      r.uic = mapUnit(r.uic, unitMap);
      const cur = best.get(r.uic);
      if (!cur || String(r.created_at ?? '') > String(cur.created_at ?? '')) {
        if (cur) warnings.push(`uic_lookup: ${r.uic} mapped twice; kept "${r.unit_name}" (newest), dropped "${cur.unit_name}"`);
        best.set(r.uic, r);
      } else {
        warnings.push(`uic_lookup: ${r.uic} mapped twice; kept "${cur.unit_name}" (newest), dropped "${r.unit_name}"`);
      }
    }
    for (const [uic, name] of unitNames) {
      const cur = best.get(uic);
      if (cur) { if (cur.unit_name !== name) warnings.push(`uic_lookup: ${uic} name set to "${name}" (was "${cur.unit_name}")`); cur.unit_name = name; }
      else best.set(uic, { uic, unit_name: name, created_at: new Date().toISOString() });
    }
    data.uic_lookup = [...best.values()];
    for (const r of data.uic_lookup) countUnit('uic_lookup', r.uic);
  }

  if (data.dashboard_watched_uics) {
    const seen = new Set();
    data.dashboard_watched_uics = data.dashboard_watched_uics
      .map((w) => ({ ...w, uic: mapUnit(w.uic, unitMap) }))
      .sort(byKeys(['created_at', 'id']))
      .filter((w) => {
        const k = `${w.user_id}|${w.uic}`;
        if (!w.uic || seen.has(k)) return false;
        seen.add(k);
        return true;
      });
    for (const w of data.dashboard_watched_uics) countUnit('dashboard_watched_uics', w.uic);
  }

  for (const f of data.faults ?? []) {
    for (const col of BOOL_COLUMNS) {
      try { f[col] = toBool01(f[col]); } catch (err) { errors.push(`faults ${f.id}.${col}: ${err.message}`); }
    }
    let urls = Array.isArray(f.photo_urls) ? f.photo_urls : [];
    urls = urls.filter((u) => u !== null && u !== undefined && u !== '');
    if (supabaseUrl && apiUrl) urls = urls.map((u) => rewriteStorageUrl(u, supabaseUrl, apiUrl));
    f.photo_urls = urls;
  }
  for (const d of data.diagnosis_attempts ?? []) {
    if (d.steps_completed == null) d.steps_completed = [];
  }

  if (data.vehicle_status_history) {
    // D1 keeps one snapshot per vehicle per day; the last one (by recorded_at, id) wins.
    const byDay = new Map();
    for (const r of [...data.vehicle_status_history].sort(byKeys(['recorded_at', 'id']))) {
      const day = String(r.recorded_at).slice(0, 10);
      byDay.set(`${r.vehicle_id}|${day}`, { ...r, recorded_at: day });
    }
    data.vehicle_status_history = [...byDay.values()];
  }
  for (const [table, keys] of Object.entries(ORDER)) data[table]?.sort(byKeys(keys));

  const invalidUnits = Object.keys(unitCounts).filter((u) => !UIC_RE.test(u));
  return { errors, warnings, unitReport: { units: unitCounts, invalid: invalidUnits } };
}

/** Rows whose parent is missing, cascading (an orphaned inspection orphans its faults). */
export function findOrphans(data) {
  const orphans = {};
  const ids = (table) => new Set((data[table] ?? []).map((r) => r.id));
  for (let changed = true; changed;) {
    changed = false;
    for (const [table, col, parent, required] of FOREIGN_KEYS) {
      if (!data[table] || !data[parent]) continue;
      const parentIds = ids(parent);
      for (const row of data[table]) {
        const ref = row[col];
        if (ref == null || parentIds.has(ref)) continue;
        if (!required) continue; // nullable reference: cleared in dropOrphans
        orphans[table] ??= new Map();
        if (!orphans[table].has(row.id)) {
          orphans[table].set(row.id, `${col} → ${parent} ${ref}`);
        }
      }
      if (orphans[table]) {
        const before = data[table].length;
        data[table] = data[table].filter((r) => !orphans[table].has(r.id));
        if (data[table].length !== before) changed = true;
      }
    }
  }
  // Nullable references to missing rows are cleared rather than dropped.
  const cleared = [];
  for (const [table, col, parent, required] of FOREIGN_KEYS) {
    if (required || !data[table] || !data[parent]) continue;
    const parentIds = ids(parent);
    for (const row of data[table]) {
      if (row[col] != null && !parentIds.has(row[col])) { cleared.push(`${table} ${row.id}.${col} (${row[col]})`); row[col] = null; }
    }
  }
  return { orphans: Object.fromEntries(Object.entries(orphans).map(([t, m]) => [t, [...m].map(([id, why]) => ({ id, why }))])), cleared };
}

/** Assembles data.sql: empty-DB guard, triggers off, inserts, triggers back on. */
export function buildDataSql(data, triggers) {
  const tables = Object.keys(TABLES);
  const lines = [
    '-- Generated by scripts/export-from-supabase.mjs. Import into an EMPTY database only.',
    'PRAGMA defer_foreign_keys = true;',
    '-- Guard: aborts here (CHECK constraint failed: target_database_must_be_empty) if any table has rows.',
    'DROP TABLE IF EXISTS _import_guard;',
    'CREATE TABLE _import_guard (target_database_must_be_empty INTEGER CHECK (target_database_must_be_empty = 0));',
    `INSERT INTO _import_guard VALUES (${[...tables, 'app_config'].map((t) => `(SELECT COUNT(*) FROM ${t})`).join(' + ')});`,
    'DROP TABLE _import_guard;',
    '-- Status triggers off, so imported status/updated_at/history are kept exactly.',
    ...triggers.map((t) => `DROP TRIGGER IF EXISTS ${t.name};`),
  ];
  const counts = {};
  for (const table of tables) {
    if (!data[table]) continue;
    lines.push(...buildInserts(table, data[table]));
    counts[table] = data[table].length;
  }
  lines.push('-- Status triggers back on.', ...triggers.map((t) => t.sql));
  return { sql: lines.join('\n') + '\n', counts, statements: lines };
}

export function oversizedStatements(statements) {
  return statements
    .map((s, i) => ({ i, bytes: Buffer.byteLength(s), head: s.slice(0, 80) }))
    .filter((s) => s.bytes > MAX_STATEMENT_BYTES);
}

export function countSupabaseUrls(sql) {
  return (sql.match(/[a-z0-9]+\.supabase\.co/gi) ?? []).length;
}

/** Writes app_config to secrets.env (mode 600) for `wrangler secret bulk`. Returns key names only. */
export async function writeSecrets(outDir, rows) {
  const known = { notification_email: 'NOTIFICATION_EMAIL', resend_api_key: 'RESEND_API_KEY' };
  const lines = ['# app_config from Supabase. Load with: npx wrangler secret bulk secrets.env', '# Delete this file after use.'];
  const names = [];
  for (const { key, value } of rows) {
    const text = typeof value === 'string' ? value : JSON.stringify(value);
    if (text == null || /[\r\n]/.test(text)) { names.push(`${key} (skipped: empty or multi-line)`); continue; }
    if (known[key]) { lines.push(`${known[key]}=${text}`); names.push(`${key} → ${known[key]}`); }
    else { lines.push(`# not used by the Worker: APP_CONFIG_${key.toUpperCase().replace(/[^A-Z0-9_]/g, '_')}=${text}`); names.push(`${key} (commented out, unused)`); }
  }
  const file = join(outDir, 'secrets.env');
  await writeFile(file, lines.join('\n') + '\n', { mode: 0o600 });
  await chmod(file, 0o600);
  return names;
}

// ---------------------------------------------------------------------------
// Schema dump (for the record)
// ---------------------------------------------------------------------------

async function dumpSchema(db, outDir, mgmt) {
  const dir = join(outDir, 'schema');
  await mkdir(dir, { recursive: true });
  const dumps = {
    'rls-policies.json': `SELECT schemaname, tablename, policyname, permissive, roles::text[] AS roles, cmd, qual, with_check
                          FROM pg_policies ORDER BY schemaname, tablename, policyname`,
    'functions.sql': `SELECT p.proname AS name, pg_get_functiondef(p.oid) AS def FROM pg_proc p
                      JOIN pg_namespace n ON n.oid = p.pronamespace
                      WHERE n.nspname = 'public' AND p.prokind IN ('f', 'p')
                        AND NOT EXISTS (SELECT 1 FROM pg_depend d WHERE d.objid = p.oid AND d.deptype = 'e')
                      ORDER BY p.proname`,
    'triggers.sql': `SELECT c.relname AS table, t.tgname AS name, pg_get_triggerdef(t.oid) AS def FROM pg_trigger t
                     JOIN pg_class c ON c.oid = t.tgrelid JOIN pg_namespace n ON n.oid = c.relnamespace
                     WHERE NOT t.tgisinternal AND n.nspname IN ('public', 'auth', 'storage') ORDER BY 1, 2`,
  };
  const summary = [];
  for (const [file, sql] of Object.entries(dumps)) {
    try {
      const rows = await db.query(sql);
      const body = file.endsWith('.json') ? JSON.stringify(rows, null, 2)
        : rows.map((r) => `-- ${r.table ? `${r.table}.` : ''}${r.name}\n${r.def};\n`).join('\n');
      await writeFile(join(dir, file), body + '\n');
      summary.push(`${file}: ${rows.length}`);
    } catch (err) {
      summary.push(`${file}: FAILED (${err.message})`);
    }
  }
  if (mgmt) {
    try {
      const fns = await (await mgmt.api('GET', '/functions')).json();
      await writeFile(join(dir, 'edge-functions.json'), JSON.stringify(fns, null, 2) + '\n');
      summary.push(`edge-functions.json: ${fns.length}`);
      for (const fn of fns) {
        try {
          const res = await mgmt.api('GET', `/functions/${encodeURIComponent(fn.slug)}/body`);
          await writeFile(join(dir, `edge-function-${fn.slug}.body`), Buffer.from(await res.arrayBuffer()));
        } catch (err) {
          summary.push(`edge function ${fn.slug} body: unavailable (${err.message.slice(0, 120)})`);
        }
      }
    } catch (err) {
      summary.push(`edge-functions: FAILED (${err.message})`);
    }
  } else {
    summary.push('edge-functions: skipped (needs the Management API)');
  }
  return summary;
}

// ---------------------------------------------------------------------------
// Storage
// ---------------------------------------------------------------------------

async function storageJson(supabaseUrl, key, path, init = {}) {
  const res = await fetch(`${supabaseUrl}/storage/v1/${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${key}`, apikey: key, 'Content-Type': 'application/json', ...(init.headers ?? {}) },
  });
  if (!res.ok) throw new Error(`${path}: ${res.status} ${(await res.text()).slice(0, 200)}`);
  return res.json();
}

async function listBucket(supabaseUrl, key, bucket, prefix = '') {
  const files = [];
  for (let offset = 0; ; offset += 1000) {
    const items = await storageJson(supabaseUrl, key, `object/list/${encodeURIComponent(bucket)}`, {
      method: 'POST', body: JSON.stringify({ prefix, limit: 1000, offset, sortBy: { column: 'name', order: 'asc' } }),
    });
    for (const item of items) {
      const path = prefix ? `${prefix}/${item.name}` : item.name;
      if (item.id === null) files.push(...(await listBucket(supabaseUrl, key, bucket, path)));
      else files.push(path);
    }
    if (items.length < 1000) return files;
  }
}

export async function exportStorage(supabaseUrl, key, outDir) {
  const uploads = ['#!/usr/bin/env bash', 'set -euo pipefail', 'cd "$(dirname "$0")"'];
  const failures = [];
  const counts = {};
  const buckets = await storageJson(supabaseUrl, key, 'bucket');
  for (const { id: bucket, public: isPublic } of buckets) {
    let paths;
    try {
      paths = await listBucket(supabaseUrl, key, bucket);
    } catch (err) {
      failures.push(`${bucket}: listing failed: ${err.message}`);
      continue;
    }
    let ok = 0;
    for (const path of paths) {
      try {
        const res = await fetch(`${supabaseUrl}/storage/v1/object/${encodeURIComponent(bucket)}/${path.split('/').map(encodeURIComponent).join('/')}`, {
          headers: { Authorization: `Bearer ${key}`, apikey: key },
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const local = join(outDir, 'files', bucket, path);
        await mkdir(dirname(local), { recursive: true });
        await writeFile(local, Buffer.from(await res.arrayBuffer()));
        const type = res.headers.get('content-type') || 'application/octet-stream';
        uploads.push(`npx wrangler r2 object put ${shellQuote(`${R2_BUCKET}/${bucket}/${path}`)} --file ${shellQuote(`files/${bucket}/${path}`)} --content-type ${shellQuote(type)} --remote`);
        ok++;
      } catch (err) {
        failures.push(`${bucket}/${path}: download failed (${err.message})`);
      }
    }
    counts[bucket] = { files: paths.length, downloaded: ok, public: !!isPublic };
  }
  await writeFile(join(outDir, 'upload-to-r2.sh'), uploads.join('\n') + '\n', { mode: 0o755 });
  return { counts, failures };
}

async function serviceRoleKey(mgmt) {
  const keys = await (await mgmt.api('GET', '/api-keys?reveal=true')).json();
  const k = keys.find((x) => x.name === 'service_role') ?? keys.find((x) => x.type === 'secret');
  return k?.api_key ?? null;
}

// ---------------------------------------------------------------------------
// Dry run: import data.sql into an in-memory SQLite with the real migration.
// ---------------------------------------------------------------------------

export async function dryRunImport(sql, counts) {
  let DatabaseSync;
  try {
    ({ DatabaseSync } = await import('node:sqlite'));
  } catch {
    return { skipped: 'node:sqlite unavailable (Node 22.5+ needed)' };
  }
  const db = new DatabaseSync(':memory:');
  db.exec('PRAGMA foreign_keys = ON;');
  db.exec(await readFile(MIGRATION, 'utf8'));
  try {
    db.exec(`BEGIN; ${sql} COMMIT;`);
  } catch (err) {
    return { error: err.message };
  }
  const fk = db.prepare('PRAGMA foreign_key_check').all();
  if (fk.length) return { error: `foreign key violations: ${JSON.stringify(fk.slice(0, 5))}` };
  const mismatches = [];
  for (const [table, n] of Object.entries(counts)) {
    const got = db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get().n;
    if (got !== n) mismatches.push(`${table}: ${n} exported, ${got} imported (duplicate keys?)`);
  }
  const triggers = db.prepare("SELECT COUNT(*) AS n FROM sqlite_master WHERE type = 'trigger'").get().n;
  return { mismatches, triggers };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function parseArgs(argv) {
  const args = { outDir: 'supabase-export', unitMap: null, unitNames: null, skipOrphans: false, freeze: false, unfreeze: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--unit-map') args.unitMap = argv[++i];
    else if (a === '--unit-names') args.unitNames = argv[++i];
    else if (a === '--skip-orphans') args.skipOrphans = true;
    else if (a === '--freeze') args.freeze = true;
    else if (a === '--unfreeze') args.unfreeze = true;
    else if (a.startsWith('--')) throw new Error(`Unknown option ${a}`);
    else args.outDir = a;
  }
  return args;
}

async function connect(env) {
  if (env.SUPABASE_ACCESS_TOKEN && env.SUPABASE_PROJECT_REF) {
    const mgmt = managementApi({ token: env.SUPABASE_ACCESS_TOKEN, ref: env.SUPABASE_PROJECT_REF, baseUrl: env.SUPABASE_API_URL });
    return { db: mgmt, mgmt };
  }
  if (env.SUPABASE_DB_URL) return { db: await pgClient(env.SUPABASE_DB_URL), mgmt: null };
  throw new Error('Set SUPABASE_ACCESS_TOKEN + SUPABASE_PROJECT_REF (Management API) or SUPABASE_DB_URL (Postgres). See the header of this file.');
}

async function freeze(db, on) {
  const file = join(HERE, on ? 'freeze-supabase.sql' : 'unfreeze-supabase.sql');
  await db.query(await readFile(file, 'utf8'));
  const [row] = await db.query(
    `SELECT bool_or(has_table_privilege('authenticated', c.oid, 'INSERT')) AS can_write
     FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relkind = 'r'`);
  console.log(on
    ? `Frozen: anon/authenticated can no longer write public tables or storage (authenticated INSERT anywhere: ${row?.can_write}).`
    : `Unfrozen: write grants restored (authenticated INSERT: ${row?.can_write}).`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const env = process.env;
  const { db, mgmt } = await connect(env);
  console.log(`Connected via ${db.kind}.`);
  try {
    if (args.freeze || args.unfreeze) return await freeze(db, args.freeze);

    const unitMap = args.unitMap ? parseUnitMap(JSON.parse(await readFile(args.unitMap, 'utf8'))) : new Map();
    const unitNames = args.unitNames ? parseUnitNames(JSON.parse(await readFile(args.unitNames, 'utf8'))) : new Map();
    const outDir = args.outDir;
    await mkdir(outDir, { recursive: true });
    const problems = [];

    console.log('Reading tables…');
    const warnings = [];
    const data = {};
    for (const table of Object.keys(TABLES)) {
      const rows = await readTable(db, table, warnings);
      if (rows === null) { warnings.push(`${table}: not found in Supabase, skipped`); continue; }
      data[table] = rows;
      console.log(`  ${table}: ${rows.length} rows`);
    }
    const noPin = (data.profiles ?? []).filter((p) => p.pin_hash === '!').length;
    if (noPin) warnings.push(`profiles: ${noPin} without an auth user get pin_hash '!' (their owners re-register to claim them)`);

    const supabaseUrl = (env.SUPABASE_URL || (env.SUPABASE_PROJECT_REF ? `https://${env.SUPABASE_PROJECT_REF}.supabase.co` : '')).replace(/\/$/, '');
    const t = transform(data, { unitMap, unitNames, supabaseUrl, apiUrl: env.API_URL ?? '' });
    warnings.push(...t.warnings);
    problems.push(...t.errors);
    await writeFile(join(outDir, 'unit-report.json'), JSON.stringify(t.unitReport, null, 2) + '\n');
    console.log('Units after mapping (rows per table):');
    for (const [u, c] of Object.entries(t.unitReport.units).sort()) {
      console.log(`  ${u.padEnd(10)} ${Object.entries(c).map(([k, n]) => `${k}=${n}`).join(' ')}${UIC_RE.test(u) ? '' : '   <-- not a 6-character UIC'}`);
    }
    if (t.unitReport.invalid.length) {
      warnings.push(`units that are not 6-character UICs: ${t.unitReport.invalid.join(', ')}. Add them to --unit-map and re-run before importing.`);
    }

    const { orphans, cleared } = findOrphans(data);
    if (cleared.length) warnings.push(`cleared dangling optional references: ${cleared.join('; ')}`);
    const orphanCount = Object.values(orphans).reduce((n, l) => n + l.length, 0);
    if (orphanCount) {
      const lines = Object.entries(orphans).flatMap(([table, list]) => list.map((o) => `  ${table} ${o.id}: ${o.why}`));
      if (args.skipOrphans) {
        warnings.push(`dropped ${orphanCount} orphan rows (--skip-orphans):\n${lines.join('\n')}`);
        await writeFile(join(outDir, 'orphans.json'), JSON.stringify(orphans, null, 2) + '\n');
      } else {
        problems.push(`${orphanCount} orphan rows (parent missing). Fix them in Supabase or re-run with --skip-orphans to drop them:\n${lines.join('\n')}`);
      }
    }

    // app_config → secrets.env only (never data.sql, never stdout).
    if (await sourceColumns(db, 'app_config').then((c) => c.size > 0)) {
      const rows = await fetchAll(db, { select: { key: 't."key"', value: 't."value"' }, from: 'public.app_config t', key: 't."key"' });
      const names = await writeSecrets(outDir, rows);
      console.log(`app_config → secrets.env (mode 600): ${names.join(', ') || 'no keys'}`);
    }

    const triggers = extractTriggers(await readFile(MIGRATION, 'utf8'));
    if (triggers.length !== 4) problems.push(`expected 4 triggers in ${MIGRATION}, found ${triggers.length}`);
    const { sql, counts, statements } = buildDataSql(data, triggers);
    const big = oversizedStatements(statements);
    for (const b of big) problems.push(`statement ${b.i} is ${b.bytes} bytes (> ${MAX_STATEMENT_BYTES}); D1 rejects statements over 100 KB: ${b.head}…`);
    const leftover = countSupabaseUrls(sql);
    if (leftover) warnings.push(`${leftover} supabase.co URL(s) remain in data.sql${env.API_URL ? '' : ' (set API_URL to rewrite storage URLs)'}`);
    else console.log('supabase.co URLs left in data.sql: 0');

    console.log('Dry-run import into in-memory SQLite…');
    const dry = await dryRunImport(sql, counts);
    if (dry.skipped) warnings.push(`dry run skipped: ${dry.skipped}`);
    else if (dry.error) problems.push(`dry-run import failed: ${dry.error}`);
    else {
      problems.push(...dry.mismatches);
      console.log(`  ok (${dry.triggers} triggers recreated)`);
    }

    console.log('Dumping RLS policies, functions, triggers, edge functions…');
    for (const s of await dumpSchema(db, outDir, mgmt)) console.log(`  ${s}`);

    let serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceKey && mgmt) {
      try { serviceKey = await serviceRoleKey(mgmt); } catch (err) { warnings.push(`could not fetch the service_role key: ${err.message}`); }
    }
    if (supabaseUrl && serviceKey) {
      console.log('Exporting storage…');
      try {
        const { counts: files, failures } = await exportStorage(supabaseUrl, serviceKey, outDir);
        for (const [b, c] of Object.entries(files)) console.log(`  ${b}: ${c.downloaded}/${c.files} files${c.public ? ' (public)' : ''}`);
        if (failures.length) problems.push(`${failures.length} storage failure(s):\n${failures.map((f) => `  ${f}`).join('\n')}`);
        counts.__storage = files;
      } catch (err) {
        problems.push(`storage export failed: ${err.message}`);
      }
    } else {
      warnings.push('storage skipped (no SUPABASE_URL/project ref or service_role key)');
    }

    // data.sql only exists for a clean export, so a failed one can't be imported by accident.
    await rm(join(outDir, 'data.sql'), { force: true });
    await writeFile(join(outDir, problems.length ? 'data.rejected.sql' : 'data.sql'), sql);
    await writeFile(join(outDir, 'counts.json'), JSON.stringify(counts, null, 2) + '\n');

    console.log('\nSummary');
    for (const [table, n] of Object.entries(counts)) if (!table.startsWith('__')) console.log(`  ${table}: ${n}`);
    for (const w of warnings) console.warn(`WARNING: ${w}`);
    if (problems.length) {
      for (const p of problems) console.error(`ERROR: ${p}`);
      console.error(`\nExport finished with ${problems.length} error(s). No data.sql was written (see data.rejected.sql); fix them and re-run.`);
      process.exitCode = 1;
    } else {
      console.log(`\nDone. Output in ${outDir}/ — next: node scripts/import-to-d1.mjs ${outDir} --remote`);
    }
  } finally {
    await db.end();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => {
    console.error(err.message ?? err);
    process.exit(1);
  });
}
