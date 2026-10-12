// Audit log: one row per state change. Writes are best effort: they are batched
// with the main write where that is natural (so both commit together), and
// otherwise written afterwards by audit(), which logs and swallows failures.
// Never put PINs, tokens or full DoD IDs into `details`.

export interface Actor {
  id: string | null;
  /** Last 4 digits of the actor's DoD ID only. */
  dodLast4: string | null;
  name: string | null;
}

export interface AuditEntry {
  action: string;
  /** The affected unit (e.g. the vehicle's unit), so unit-filtered views work. */
  unit?: string | null;
  targetType?: string | null;
  targetId?: string | null;
  details?: Record<string, unknown> | null;
}

/** Profile row → Actor. */
export function actorOf(p: { id?: unknown; dod_id?: unknown; rank?: unknown; first_name?: unknown; last_name?: unknown }): Actor {
  const name = [p.rank, p.first_name, p.last_name].filter((s) => typeof s === 'string' && s.trim()).join(' ');
  return {
    id: typeof p.id === 'string' ? p.id : null,
    dodLast4: typeof p.dod_id === 'string' ? p.dod_id.slice(-4) : null,
    name: name || null,
  };
}

export const AUDIT_INSERT =
  'INSERT INTO audit_log (id, at, actor_id, actor_dod_last4, actor_name, unit, action, target_type, target_id, details)';

/** The four actor/at values for an INSERT … SELECT: `?, ?, ?, ?` = at, actor_id, actor_dod_last4, actor_name. */
export const actorParams = (actor: Actor | null, at = new Date().toISOString()) =>
  [at, actor?.id ?? null, actor?.dodLast4 ?? null, actor?.name ?? null];

export function auditStmt(db: D1Database, actor: Actor | null, e: AuditEntry): D1PreparedStatement {
  return db.prepare(`${AUDIT_INSERT} VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).bind(
    crypto.randomUUID(), ...actorParams(actor), e.unit ?? null, e.action, e.targetType ?? null, e.targetId ?? null,
    e.details ? JSON.stringify(e.details) : null,
  );
}

/** Writes audit rows on their own. Never throws. */
export async function audit(db: D1Database, actor: Actor | null, ...entries: AuditEntry[]): Promise<void> {
  if (!entries.length) return;
  try {
    await db.batch(entries.map((e) => auditStmt(db, actor, e)));
  } catch (err) {
    console.error({ event: 'audit_write_failed', actions: entries.map((e) => e.action), message: (err as Error)?.message });
  }
}
