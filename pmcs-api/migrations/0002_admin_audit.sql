-- 0002: roles, session revocation, forced PIN change, audit log, per-unit
-- notification settings and client sync status.
--
-- Safe on a populated database: only ADD COLUMN (with defaults) and new tables.
-- Existing users become 'member', token_version 0 (tokens issued before this
-- migration carry no `tv` claim and are treated as tv=0, so they keep working)
-- and must_change_pin 0.

-- 'member' | 'admin'. SQLite's ALTER TABLE cannot add a CHECK, so the Worker
-- enforces the allowed values (see ROLES in src/index.ts).
ALTER TABLE profiles ADD COLUMN role TEXT NOT NULL DEFAULT 'member';
-- Bumped to revoke every session of the user (sign out everywhere, PIN change/reset).
ALTER TABLE profiles ADD COLUMN token_version INTEGER NOT NULL DEFAULT 0;
-- 1 after an admin PIN reset: the user may only call /auth/* and GET /me until they change it.
ALTER TABLE profiles ADD COLUMN must_change_pin INTEGER NOT NULL DEFAULT 0;

-- Append-only record of every state change. `unit` is the affected unit (e.g.
-- the vehicle's unit) so unit-filtered views work. `details` is JSON and never
-- holds PINs, tokens or full DoD IDs.
CREATE TABLE IF NOT EXISTS audit_log (
  id TEXT PRIMARY KEY,
  at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  actor_id TEXT,
  actor_dod_last4 TEXT,
  actor_name TEXT,
  unit TEXT,
  action TEXT NOT NULL,
  target_type TEXT,
  target_id TEXT,
  details TEXT
);
CREATE INDEX IF NOT EXISTS idx_audit_log_unit_at ON audit_log (unit, at);
CREATE INDEX IF NOT EXISTS idx_audit_log_actor_at ON audit_log (actor_id, at);
CREATE INDEX IF NOT EXISTS idx_audit_log_action_at ON audit_log (action, at);

-- Per-unit email recipients (JSON array). Empty/absent → env NOTIFICATION_EMAIL.
CREATE TABLE IF NOT EXISTS unit_settings (
  uic TEXT PRIMARY KEY,
  notification_emails TEXT,
  updated_at TEXT,
  updated_by TEXT
);

-- Last sync heartbeat of each user's field app (one row per user).
CREATE TABLE IF NOT EXISTS client_status (
  user_id TEXT PRIMARY KEY,
  unit TEXT,
  unsent_count INTEGER,
  failed_count INTEGER,
  last_error TEXT,
  oldest_unsent_at TEXT,
  app_version TEXT,
  reported_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_client_status_unit ON client_status (unit);
