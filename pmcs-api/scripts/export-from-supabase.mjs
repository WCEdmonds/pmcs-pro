#!/usr/bin/env node
// One-time export of the Supabase project into files the Cloudflare stack can import.
//
//   SUPABASE_DB_URL=postgresql://postgres.<ref>:<password>@<host>:5432/postgres \
//   SUPABASE_URL=https://<ref>.supabase.co \
//   SUPABASE_SERVICE_ROLE_KEY=<service role key> \
//   API_URL=https://pmcs-api.<subdomain>.workers.dev \
//   node scripts/export-from-supabase.mjs [out-dir]
//
// Writes:
//   <out>/data.sql          INSERTs for `wrangler d1 execute pmcs-pro --remote --file <out>/data.sql`
//   <out>/files/<bucket>/…  every object in the storage buckets
//   <out>/upload-to-r2.sh   uploads those files into the R2 bucket under the same keys
//
// PINs: Supabase stores bcrypt hashes in auth.users.encrypted_password. They are
// copied into profiles.pin_hash; the API verifies them and upgrades them on next login.
// If SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are unset, storage is skipped.

import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';

const BUCKETS = ['fault-photos', 'tm-documents', 'generated'];
const R2_BUCKET = 'pmcs-pro-files';

/** D1 target tables and columns, in foreign-key order. */
export const TABLES = {
  profiles: ['id', 'dod_id', 'pin_hash', 'rank', 'last_name', 'first_name', 'mi', 'unit', 'created_at'],
  vehicles: ['id', 'bumper_number', 'bumper_number_normalized', 'vehicle_type', 'serial_number', 'registration_number',
    'nomenclature', 'unit', 'current_odometer', 'status', 'section', 'lin_number', 'nsn', 'description', 'created_at', 'updated_at'],
  inspections: ['id', 'vehicle_id', 'inspector_id', 'inspection_type', 'status', 'odometer_reading', 'remarks', 'date',
    'started_at', 'completed_at', 'client_session_id'],
  faults: ['id', 'inspection_id', 'vehicle_id', 'item', 'item_description', 'zone', 'readiness', 'category_id', 'description',
    'corrective_action', 'part_needed', 'part_description', 'nsn', 'corrected_on_site', 'needs_maintenance',
    'resolution_status', 'gcss_work_order', 'photo_urls', 'resolved_at', 'resolved_by', 'created_at'],
  diagnosis_attempts: ['id', 'fault_id', 'session_id', 'category_id', 'steps_completed', 'outcome', 'skip_reason',
    'readiness_result', 'completed_at'],
  generated_forms: ['id', 'inspection_id', 'vehicle_id', 'pdf_storage_path', 'generated_at'],
  dashboard_watched_uics: ['id', 'user_id', 'uic', 'created_at'],
  uic_lookup: ['uic', 'unit_name'],
  vehicle_status_history: ['id', 'vehicle_id', 'status', 'recorded_at'],
};

const JSON_COLUMNS = new Set(['photo_urls', 'steps_completed']);
const DATE_ONLY_COLUMNS = new Set(['date', 'recorded_at']);

/** Formats one value as a SQLite literal. */
export function sqlValue(column, value) {
  if (value === null || value === undefined) {
    return JSON_COLUMNS.has(column) ? "'[]'" : 'NULL';
  }
  if (JSON_COLUMNS.has(column)) return quote(JSON.stringify(value));
  if (typeof value === 'boolean') return value ? '1' : '0';
  if (typeof value === 'number' || typeof value === 'bigint') return String(value);
  if (value instanceof Date) {
    return quote(DATE_ONLY_COLUMNS.has(column) ? value.toISOString().slice(0, 10) : value.toISOString());
  }
  if (typeof value === 'object') return quote(JSON.stringify(value));
  return quote(String(value));
}

function quote(s) {
  return `'${s.replace(/'/g, "''")}'`;
}

function shellQuote(s) {
  return `'${s.replace(/'/g, `'\\''`)}'`;
}

/** Points Supabase public storage URLs at the API's /files route. */
export function rewriteStorageUrl(url, supabaseUrl, apiUrl) {
  const prefix = `${supabaseUrl.replace(/\/$/, '')}/storage/v1/object/public/`;
  return url.startsWith(prefix) ? `${apiUrl.replace(/\/$/, '')}/files/${url.slice(prefix.length)}` : url;
}

/** Builds INSERT statements for rows already shaped like the D1 table. */
export function buildInserts(table, rows) {
  const targetCols = TABLES[table];
  return rows.map((row) => {
    const cols = targetCols.filter((c) => c in row);
    const vals = cols.map((c) => sqlValue(c, row[c]));
    return `INSERT OR REPLACE INTO ${table} (${cols.join(', ')}) VALUES (${vals.join(', ')});`;
  });
}

async function sourceColumns(db, table) {
  const { rows } = await db.query(
    `SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = $1`, [table]);
  return new Set(rows.map((r) => r.column_name));
}

export async function exportDatabase(db, { supabaseUrl = '', apiUrl = '' } = {}) {
  const lines = ['PRAGMA defer_foreign_keys = true;'];
  const counts = {};

  for (const table of Object.keys(TABLES)) {
    const available = await sourceColumns(db, table);
    if (available.size === 0) {
      console.warn(`  ${table}: not found in Supabase, skipping`);
      continue;
    }

    let rows;
    if (table === 'profiles') {
      // Profiles without an auth user get an unusable hash; they must re-register.
      const cols = TABLES.profiles.filter((c) => c !== 'pin_hash' && available.has(c)).map((c) => `p.${c}`);
      ({ rows } = await db.query(
        `SELECT ${cols.join(', ')}, COALESCE(u.encrypted_password, '!') AS pin_hash
         FROM public.profiles p LEFT JOIN auth.users u ON u.id = p.id`));
      const noPin = rows.filter((r) => r.pin_hash === '!').length;
      if (noPin) console.warn(`  profiles: ${noPin} without an auth user — they will need to re-register`);
    } else {
      const cols = TABLES[table].filter((c) => available.has(c));
      ({ rows } = await db.query(`SELECT ${cols.map((c) => `"${c}"`).join(', ')} FROM public.${table}`));
    }

    if (table === 'faults' && supabaseUrl && apiUrl) {
      for (const r of rows) {
        if (Array.isArray(r.photo_urls)) r.photo_urls = r.photo_urls.map((u) => rewriteStorageUrl(u, supabaseUrl, apiUrl));
      }
    }
    if (table === 'vehicle_status_history') {
      // D1 keeps one snapshot per vehicle per day; the last one of the day wins.
      const byDay = new Map();
      for (const r of rows) {
        const day = r.recorded_at instanceof Date ? r.recorded_at.toISOString().slice(0, 10) : String(r.recorded_at).slice(0, 10);
        byDay.set(`${r.vehicle_id}|${day}`, { ...r, recorded_at: day });
      }
      rows = [...byDay.values()];
    }

    lines.push(...buildInserts(table, rows));
    counts[table] = rows.length;
    console.log(`  ${table}: ${rows.length} rows`);
  }
  return { sql: lines.join('\n') + '\n', counts };
}

async function listBucket(supabaseUrl, key, bucket, prefix = '') {
  const files = [];
  for (let offset = 0; ; offset += 1000) {
    const res = await fetch(`${supabaseUrl}/storage/v1/object/list/${bucket}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, apikey: key, 'Content-Type': 'application/json' },
      body: JSON.stringify({ prefix, limit: 1000, offset }),
    });
    if (!res.ok) throw new Error(`list ${bucket}/${prefix}: ${res.status} ${await res.text()}`);
    const items = await res.json();
    for (const item of items) {
      const path = prefix ? `${prefix}/${item.name}` : item.name;
      if (item.id === null) files.push(...(await listBucket(supabaseUrl, key, bucket, path)));
      else files.push(path);
    }
    if (items.length < 1000) return files;
  }
}

async function exportStorage(supabaseUrl, key, outDir) {
  const uploads = ['#!/usr/bin/env bash', 'set -euo pipefail', 'cd "$(dirname "$0")"'];
  for (const bucket of BUCKETS) {
    let paths;
    try {
      paths = await listBucket(supabaseUrl, key, bucket);
    } catch (err) {
      console.warn(`  ${bucket}: ${err.message}`);
      continue;
    }
    for (const path of paths) {
      const res = await fetch(`${supabaseUrl}/storage/v1/object/${bucket}/${path.split('/').map(encodeURIComponent).join('/')}`, {
        headers: { Authorization: `Bearer ${key}`, apikey: key },
      });
      if (!res.ok) {
        console.warn(`  ${bucket}/${path}: download failed (${res.status})`);
        continue;
      }
      const local = join(outDir, 'files', bucket, path);
      await mkdir(dirname(local), { recursive: true });
      await writeFile(local, Buffer.from(await res.arrayBuffer()));
      const type = res.headers.get('content-type') || 'application/octet-stream';
      uploads.push(`npx wrangler r2 object put ${shellQuote(`${R2_BUCKET}/${bucket}/${path}`)} --file ${shellQuote(`files/${bucket}/${path}`)} --content-type ${shellQuote(type)} --remote`);
    }
    console.log(`  ${bucket}: ${paths.length} files`);
  }
  await writeFile(join(outDir, 'upload-to-r2.sh'), uploads.join('\n') + '\n', { mode: 0o755 });
}

async function main() {
  const outDir = process.argv[2] || 'supabase-export';
  const { SUPABASE_DB_URL, SUPABASE_URL = '', SUPABASE_SERVICE_ROLE_KEY, API_URL = '' } = process.env;
  if (!SUPABASE_DB_URL) {
    console.error('Set SUPABASE_DB_URL (Supabase dashboard → Connect → connection string). See header of this file.');
    process.exit(1);
  }
  await mkdir(outDir, { recursive: true });

  const { default: pg } = await import('pg');
  // Keep DATE columns as 'YYYY-MM-DD' strings (pg would parse them as local-midnight Dates).
  pg.types.setTypeParser(1082, (v) => v);
  const db = new pg.Client({ connectionString: SUPABASE_DB_URL, ssl: SUPABASE_DB_URL.includes('localhost') ? false : { rejectUnauthorized: false } });
  await db.connect();
  console.log('Exporting database…');
  try {
    const { sql } = await exportDatabase(db, { supabaseUrl: SUPABASE_URL, apiUrl: API_URL });
    await writeFile(join(outDir, 'data.sql'), sql);
  } finally {
    await db.end();
  }

  if (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
    console.log('Exporting storage…');
    await exportStorage(SUPABASE_URL.replace(/\/$/, ''), SUPABASE_SERVICE_ROLE_KEY, outDir);
  } else {
    console.warn('SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set — skipping storage export.');
  }
  console.log(`Done. Output in ${outDir}/`);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
