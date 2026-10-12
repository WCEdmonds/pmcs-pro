// Weekly logical backup: every table as JSON, gzipped, to R2 `backups/YYYY-MM-DD.json.gz`.
// The `backups/` prefix is never served by /files (see BLOCKED_BUCKETS in index.ts).
// Restore: scripts/backup-to-sql.mjs turns a snapshot into SQL for `wrangler d1 execute`.
import type { Env } from './index';

/** Must match [triggers] crons in wrangler.toml (here, not in index.ts: the main module may only export handlers). */
export const DAILY_CRON = '5 4 * * *';
export const BACKUP_CRON = '17 3 * * SUN';

export const BACKUP_PREFIX = 'backups/';
export const BACKUP_RETENTION_DAYS = 12 * 7;
const PAGE = 2000;

export interface Snapshot {
  format: 'pmcs-pro-d1-backup';
  version: 1;
  created_at: string;
  /** CREATE statements of every table, index and trigger (sqlite_master). */
  schema: Array<{ type: string; name: string; tbl_name: string; sql: string | null }>;
  tables: Record<string, Array<Record<string, unknown>>>;
}

export async function snapshot(db: D1Database, at = new Date()): Promise<Snapshot> {
  const { results: schema } = await db.prepare(
    `SELECT type, name, tbl_name, sql FROM sqlite_master
     WHERE substr(name, 1, 7) != 'sqlite_' AND substr(name, 1, 4) != '_cf_' ORDER BY type = 'table' DESC, rowid`,
  ).all<Snapshot['schema'][number]>();
  const tables: Snapshot['tables'] = {};
  for (const { name } of schema.filter((s) => s.type === 'table')) {
    const rows: Array<Record<string, unknown>> = [];
    for (let offset = 0; ; offset += PAGE) {
      const { results } = await db.prepare(`SELECT * FROM "${name.replace(/"/g, '""')}" ORDER BY rowid LIMIT ? OFFSET ?`)
        .bind(PAGE, offset).all<Record<string, unknown>>();
      rows.push(...results);
      if (results.length < PAGE) break;
    }
    tables[name] = rows;
  }
  return { format: 'pmcs-pro-d1-backup', version: 1, created_at: at.toISOString(), schema, tables };
}

export async function gzip(text: string): Promise<Uint8Array> {
  const stream = new Blob([text]).stream().pipeThrough(new CompressionStream('gzip'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

/** Writes today's snapshot and deletes backups older than 12 weeks. Returns the key and pruned keys. */
export async function runBackup(env: Env, at = new Date()): Promise<{ key: string; bytes: number; deleted: string[] }> {
  const day = at.toISOString().slice(0, 10);
  const key = `${BACKUP_PREFIX}${day}.json.gz`;
  const bytes = await gzip(JSON.stringify(await snapshot(env.DB, at)));
  await env.FILES.put(key, bytes, { httpMetadata: { contentType: 'application/gzip' } });

  const cutoff = new Date(at.getTime() - BACKUP_RETENTION_DAYS * 86_400_000).toISOString().slice(0, 10);
  const deleted: string[] = [];
  let cursor: string | undefined;
  do {
    const page = await env.FILES.list({ prefix: BACKUP_PREFIX, cursor });
    for (const obj of page.objects) {
      const m = /^backups\/(\d{4}-\d{2}-\d{2})\.json\.gz$/.exec(obj.key);
      if (m && m[1] < cutoff) deleted.push(obj.key);
    }
    cursor = page.truncated ? page.cursor : undefined;
  } while (cursor);
  if (deleted.length) await env.FILES.delete(deleted);
  console.log({ event: 'backup_written', key, bytes: bytes.byteLength, deleted });
  return { key, bytes: bytes.byteLength, deleted };
}
