#!/usr/bin/env node
// Turns a weekly backup (R2 backups/YYYY-MM-DD.json.gz, written by src/backup.ts)
// into SQL for `wrangler d1 execute --file`. Restore into an EMPTY database that
// already has the migrations applied; the plain INSERTs fail on any existing row.
//
//   npx wrangler r2 object get pmcs-pro-files/backups/2026-10-11.json.gz --file backup.json.gz --remote
//   node scripts/backup-to-sql.mjs backup.json.gz > restore.sql
//   npx wrangler d1 execute <empty-db> --remote --file restore.sql
//
// The four vehicle-status triggers are dropped before the inserts and recreated
// after, so restored statuses, updated_at and history are kept exactly.
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';

/** Parents before children, so foreign keys hold at every step. Unknown tables follow. */
const ORDER = ['profiles', 'vehicles', 'inspections', 'faults', 'diagnosis_attempts', 'generated_forms',
  'dashboard_watched_uics', 'uic_lookup', 'vehicle_status_history', 'app_config', 'audit_log', 'unit_settings', 'client_status'];
/** Managed by wrangler/D1, not data. */
const SKIP = new Set(['d1_migrations']);

const ident = (s) => `"${String(s).replace(/"/g, '""')}"`;

function literal(v) {
  if (v === null || v === undefined) return 'NULL';
  if (typeof v === 'number') {
    if (!Number.isFinite(v)) throw new Error(`Cannot restore non-finite number ${v}`);
    return String(v);
  }
  if (typeof v === 'boolean') return v ? '1' : '0';
  if (typeof v === 'string') return `'${v.replace(/'/g, "''")}'`;
  throw new Error(`Cannot restore value of type ${typeof v}`);
}

export function toSql(snapshot) {
  if (snapshot?.format !== 'pmcs-pro-d1-backup' || snapshot.version !== 1) throw new Error('Not a PMCS Pro backup (format/version)');
  const triggers = snapshot.schema.filter((s) => s.type === 'trigger' && s.sql);
  const names = Object.keys(snapshot.tables).filter((t) => !SKIP.has(t));
  const tables = [...ORDER.filter((t) => names.includes(t)), ...names.filter((t) => !ORDER.includes(t)).sort()];
  const out = [`-- PMCS Pro restore of backup taken ${snapshot.created_at}`, 'PRAGMA defer_foreign_keys = true;'];
  for (const t of triggers) out.push(`DROP TRIGGER IF EXISTS ${ident(t.name)};`);
  for (const table of tables) {
    for (const row of snapshot.tables[table]) {
      const cols = Object.keys(row);
      out.push(`INSERT INTO ${ident(table)} (${cols.map(ident).join(', ')}) VALUES (${cols.map((c) => literal(row[c])).join(', ')});`);
    }
  }
  for (const t of triggers) out.push(`${t.sql.trim().replace(/;?$/, ';')}`);
  return `${out.join('\n')}\n`;
}

export function readBackup(path) {
  const raw = readFileSync(path);
  const text = raw[0] === 0x1f && raw[1] === 0x8b ? gunzipSync(raw).toString('utf8') : raw.toString('utf8');
  return JSON.parse(text);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const file = process.argv[2];
  if (!file) {
    console.error('Usage: node scripts/backup-to-sql.mjs <backup.json.gz> > restore.sql');
    process.exit(2);
  }
  const snap = readBackup(file);
  const counts = Object.fromEntries(Object.entries(snap.tables).map(([t, rows]) => [t, rows.length]));
  console.error(`Backup taken ${snap.created_at}:`, JSON.stringify(counts));
  process.stdout.write(toSql(snap));
}
