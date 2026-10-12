// In-memory stand-ins for the Worker bindings, so the real Hono app and the real
// migration can be exercised by vitest. D1 is emulated with node:sqlite.
import { readFileSync, readdirSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';

class FakeStatement {
  constructor(db, sql, params = []) { this.db = db; this.sql = sql; this.params = params; }
  bind(...params) {
    for (const p of params) if (p === undefined) throw new Error('D1_TYPE_ERROR: undefined bound');
    return new FakeStatement(this.db, this.sql, params);
  }
  exec() {
    const st = this.db.prepare(this.sql);
    if (st.columns().length > 0) {
      const results = st.all(...this.params);
      return { results, meta: { changes: results.length } };
    }
    const r = st.run(...this.params);
    return { results: [], meta: { changes: Number(r.changes) } };
  }
  async all() { return { success: true, ...this.exec() }; }
  async run() { return { success: true, ...this.exec() }; }
  async first(col) {
    const row = this.exec().results[0] ?? null;
    return col && row ? row[col] : row;
  }
  _exec() { return { success: true, ...this.exec() }; }
}

const MIGRATIONS = new URL('../migrations/', import.meta.url);
/** Every migration in order, as wrangler applies them. */
export const migrations = () => readdirSync(MIGRATIONS).filter((f) => f.endsWith('.sql')).sort()
  .map((name) => ({ name, sql: readFileSync(new URL(name, MIGRATIONS), 'utf8') }));

export class FakeD1 {
  /** `upTo`: apply only migrations whose file name sorts at or before it (e.g. '0001_init.sql'). */
  constructor({ upTo } = {}) {
    this.db = new DatabaseSync(':memory:');
    this.db.exec('PRAGMA foreign_keys = ON;');
    for (const m of migrations()) if (!upTo || m.name <= upTo) this.db.exec(m.sql);
  }
  prepare(sql) { return new FakeStatement(this.db, sql); }
  /** Like D1: all statements in one transaction, rolled back on any error. */
  async batch(stmts) {
    this.db.exec('BEGIN');
    try {
      const out = stmts.map((s) => s._exec());
      this.db.exec('COMMIT');
      return out;
    } catch (err) {
      this.db.exec('ROLLBACK');
      throw err;
    }
  }
  async exec(sql) { this.db.exec(sql); return { count: 0, duration: 0 }; }
  /** Synchronous helper for assertions. */
  q(sql, ...params) {
    return this.db.prepare(sql).all(...params);
  }
}

export class FakeR2 {
  objects = new Map();
  async put(key, value, opts) {
    const bytes = value instanceof Uint8Array ? value
      : value instanceof ArrayBuffer ? new Uint8Array(value)
      : typeof value === 'string' ? new TextEncoder().encode(value)
      : new Uint8Array(await new Response(value).arrayBuffer());
    this.objects.set(key, { bytes, contentType: opts?.httpMetadata?.contentType });
    return {};
  }
  async head(key) { return this.objects.has(key) ? { key } : null; }
  async delete(keys) { for (const k of [keys].flat()) this.objects.delete(k); }
  /** Paged like R2 (limit 2 per page here, to exercise the cursor). */
  async list({ prefix = '', cursor, limit = 2 } = {}) {
    const keys = [...this.objects.keys()].filter((k) => k.startsWith(prefix)).sort();
    const start = cursor ? Number(cursor) : 0;
    const page = keys.slice(start, start + limit);
    const truncated = start + limit < keys.length;
    return { objects: page.map((key) => ({ key })), truncated, cursor: truncated ? String(start + limit) : undefined };
  }
  async get(key) {
    const o = this.objects.get(key);
    if (!o) return null;
    return {
      body: new Response(o.bytes).body,
      httpEtag: '"etag"',
      writeHttpMetadata(h) { if (o.contentType) h.set('content-type', o.contentType); },
    };
  }
}

export function makeEnv(extra = {}) {
  const DB = new FakeD1();
  const FILES = new FakeR2();
  const env = { DB, FILES, JWT_SECRET: 'test-secret', ...extra };
  return { env, DB, FILES };
}
