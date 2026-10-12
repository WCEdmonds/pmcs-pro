#!/usr/bin/env node
// Imports an export from scripts/export-from-supabase.mjs into D1, safely:
//   1. refuses unless every table in the target database is empty,
//   2. runs data.sql (which carries its own empty-DB guard as well),
//   3. checks the row counts against counts.json.
//
//   node scripts/import-to-d1.mjs <export-dir> --remote
//   node scripts/import-to-d1.mjs <export-dir> --local [--persist-to <dir>]
//   options: --database <name> (default pmcs-pro)

import { execFileSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const API_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const TABLES = ['profiles', 'vehicles', 'inspections', 'faults', 'diagnosis_attempts', 'generated_forms',
  'dashboard_watched_uics', 'uic_lookup', 'vehicle_status_history', 'app_config'];

function parseArgs(argv) {
  const a = { dir: null, target: [], database: 'pmcs-pro' };
  for (let i = 0; i < argv.length; i++) {
    const x = argv[i];
    if (x === '--remote' || x === '--local') a.target.push(x);
    else if (x === '--persist-to') a.target.push(x, resolve(argv[++i]));
    else if (x === '--database') a.database = argv[++i];
    else if (x.startsWith('--')) throw new Error(`Unknown option ${x}`);
    else a.dir = x;
  }
  if (!a.dir || !a.target.some((t) => t === '--remote' || t === '--local')) {
    throw new Error('Usage: node scripts/import-to-d1.mjs <export-dir> --remote|--local [--persist-to dir] [--database name]');
  }
  return a;
}

function wrangler(args, { json = false } = {}) {
  const out = execFileSync('npx', ['wrangler', ...args], {
    cwd: API_DIR, encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'], maxBuffer: 64 * 1024 * 1024,
  });
  return json ? JSON.parse(out) : out;
}

function counts(a) {
  const q = `SELECT ${TABLES.map((t) => `(SELECT COUNT(*) FROM ${t}) AS ${t}`).join(', ')}`;
  return wrangler(['d1', 'execute', a.database, ...a.target, '--json', '--command', q], { json: true })[0].results[0];
}

function main() {
  const a = parseArgs(process.argv.slice(2));
  const dataFile = resolve(a.dir, 'data.sql');
  const countsFile = resolve(a.dir, 'counts.json');
  if (!existsSync(dataFile) || !existsSync(countsFile)) throw new Error(`${a.dir} has no data.sql/counts.json; run the export first`);
  const expected = JSON.parse(readFileSync(countsFile, 'utf8'));

  console.log(`Checking that ${a.database} (${a.target.join(' ')}) is empty…`);
  const before = counts(a);
  const nonEmpty = Object.entries(before).filter(([, n]) => n > 0);
  if (nonEmpty.length) {
    throw new Error(`Refusing to import: the database already has rows (${nonEmpty.map(([t, n]) => `${t}=${n}`).join(', ')}). ` +
      'Import only into a freshly migrated database.');
  }

  console.log('Importing data.sql…');
  wrangler(['d1', 'execute', a.database, ...a.target, '--yes', '--file', dataFile]);

  const after = counts(a);
  const bad = Object.entries(expected).filter(([t]) => !t.startsWith('__')).filter(([t, n]) => after[t] !== n);
  for (const t of TABLES) console.log(`  ${t}: ${after[t]}${t in expected ? ` (expected ${expected[t]})` : ''}`);
  if (bad.length) throw new Error(`Row counts differ after import: ${bad.map(([t, n]) => `${t} expected ${n}, got ${after[t]}`).join('; ')}`);
  console.log(`Import verified. Next: bash ${join(a.dir, 'upload-to-r2.sh')} (files), then wrangler secret bulk ${join(a.dir, 'secrets.env')}.`);
}

try {
  main();
} catch (err) {
  console.error(`ERROR: ${err.message}`);
  process.exit(1);
}
