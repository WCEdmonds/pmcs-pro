// In-memory stand-ins for the Worker bindings, so the real Hono app and the real
// migration can be exercised by vitest. D1 is emulated with node:sqlite.
import { readFileSync } from 'node:fs';
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

export class FakeD1 {
  constructor() {
    this.db = new DatabaseSync(':memory:');
    this.db.exec('PRAGMA foreign_keys = ON;');
    this.db.exec(readFileSync(new URL('../migrations/0001_init.sql', import.meta.url), 'utf8'));
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
