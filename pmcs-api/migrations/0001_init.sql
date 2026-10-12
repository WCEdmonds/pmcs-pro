-- PMCS Pro schema for Cloudflare D1 (SQLite).
-- Ported from the Supabase Postgres schema. Differences:
--   * uuid/timestamptz are TEXT (uuids generated in the Worker, ISO-8601 UTC timestamps)
--   * text[] / jsonb columns are JSON-encoded TEXT
--   * booleans are INTEGER 0/1
--   * auth.users is folded into profiles.pin_hash ('!' = imported profile with no
--     auth user; it can be claimed through /auth/signup)
--   * units (profiles.unit, vehicles.unit, uic_lookup.uic) are stored trimmed and
--     upper-case; the API compares them with plain equality
--   * access (see visibleUnits() in src/index.ts): reads cover the caller's own unit
--     plus the UICs in their dashboard_watched_uics rows; writes cover the own unit only

CREATE TABLE profiles (
  id TEXT PRIMARY KEY,
  dod_id TEXT NOT NULL UNIQUE,
  pin_hash TEXT NOT NULL,
  failed_logins INTEGER NOT NULL DEFAULT 0,
  locked_until TEXT,
  rank TEXT,
  last_name TEXT,
  first_name TEXT,
  mi TEXT,
  unit TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX idx_profiles_unit ON profiles (unit);

CREATE TABLE vehicles (
  id TEXT PRIMARY KEY,
  bumper_number TEXT,
  bumper_number_normalized TEXT,
  vehicle_type TEXT,
  serial_number TEXT,
  registration_number TEXT,
  nomenclature TEXT,
  unit TEXT,
  current_odometer REAL,
  status TEXT DEFAULT 'FMC' CHECK (status IN ('FMC', 'PMC', 'NMC', 'DEADLINE')),
  section TEXT,
  lin_number TEXT,
  nsn TEXT,
  description TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (bumper_number_normalized, unit)
);
CREATE INDEX idx_vehicles_unit ON vehicles (unit);

CREATE TABLE inspections (
  id TEXT PRIMARY KEY,
  vehicle_id TEXT NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  inspector_id TEXT NOT NULL REFERENCES profiles(id),
  inspection_type TEXT,
  status TEXT CHECK (status IN ('IN_PROGRESS', 'COMPLETED')),
  odometer_reading REAL,
  remarks TEXT,
  date TEXT,
  started_at TEXT,
  completed_at TEXT,
  client_session_id TEXT UNIQUE,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX idx_inspections_vehicle ON inspections (vehicle_id, completed_at);

CREATE TABLE faults (
  id TEXT PRIMARY KEY,
  inspection_id TEXT NOT NULL REFERENCES inspections(id) ON DELETE CASCADE,
  vehicle_id TEXT NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  -- Id the field app gave the fault; makes /inspections/sync retries idempotent
  -- and maps local photos to the stored fault. NULL for imported/legacy faults.
  client_fault_id TEXT,
  item TEXT,
  item_description TEXT,
  zone TEXT,
  readiness TEXT DEFAULT 'NMC' CHECK (readiness IN ('PMC', 'NMC')),
  category_id TEXT,
  description TEXT,
  corrective_action TEXT,
  part_needed INTEGER,
  part_description TEXT,
  nsn TEXT,
  corrected_on_site INTEGER,
  needs_maintenance INTEGER,
  resolution_status TEXT DEFAULT 'OPEN' CHECK (resolution_status IN ('OPEN', 'ACKNOWLEDGED', 'CORRECTED')),
  gcss_work_order TEXT,
  photo_urls TEXT NOT NULL DEFAULT '[]',
  resolved_at TEXT,
  resolved_by TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (inspection_id, client_fault_id)
);
CREATE INDEX idx_faults_vehicle ON faults (vehicle_id, resolution_status);
CREATE INDEX idx_faults_inspection ON faults (inspection_id);
CREATE INDEX idx_faults_readiness ON faults (readiness);
CREATE INDEX idx_faults_category_id ON faults (category_id);

CREATE TABLE diagnosis_attempts (
  id TEXT PRIMARY KEY,
  fault_id TEXT NOT NULL REFERENCES faults(id) ON DELETE CASCADE,
  session_id TEXT NOT NULL,
  category_id TEXT NOT NULL,
  steps_completed TEXT NOT NULL DEFAULT '[]',
  outcome TEXT NOT NULL CHECK (outcome IN ('operator-fix', 'needs-maintenance', 'skipped')),
  skip_reason TEXT,
  readiness_result TEXT NOT NULL CHECK (readiness_result IN ('PMC', 'NMC')),
  completed_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX idx_diagnosis_attempts_fault_id ON diagnosis_attempts (fault_id);
CREATE INDEX idx_diagnosis_attempts_session_id ON diagnosis_attempts (session_id);

CREATE TABLE generated_forms (
  id TEXT PRIMARY KEY,
  inspection_id TEXT NOT NULL REFERENCES inspections(id) ON DELETE CASCADE,
  vehicle_id TEXT REFERENCES vehicles(id) ON DELETE CASCADE,
  -- Path inside the `generated` bucket; the R2 key is `generated/<path>`.
  pdf_storage_path TEXT,
  generated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX idx_generated_forms_inspection ON generated_forms (inspection_id);

-- Dashboard "watched UICs": self-service read access to other units (battalion
-- and higher staff overseeing several companies). Grants READ access only.
CREATE TABLE dashboard_watched_uics (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  uic TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (user_id, uic)
);

CREATE TABLE uic_lookup (
  uic TEXT PRIMARY KEY,
  unit_name TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE vehicle_status_history (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  vehicle_id TEXT NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  status TEXT NOT NULL,
  recorded_at TEXT NOT NULL, -- YYYY-MM-DD (UTC)
  UNIQUE (vehicle_id, recorded_at)
);
CREATE INDEX idx_vehicle_status_history_recorded ON vehicle_status_history (recorded_at);

-- Key/value settings. Supabase's app_config held notification_email and
-- resend_api_key; those now live in Worker vars/secrets (NOTIFICATION_EMAIL,
-- RESEND_API_KEY), so the export writes them to secrets.env, not here.
CREATE TABLE app_config (
  key TEXT PRIMARY KEY,
  value TEXT
);

-- Vehicle status is computed from open (not CORRECTED) faults:
--   NMC if any open NMC fault, else PMC if any open PMC fault, else FMC.
-- (A manually set DEADLINE is overwritten on the next fault change; there is no UI for it.)
-- scripts/export-from-supabase.mjs copies every CREATE TRIGGER below into data.sql
-- (dropped before the import, recreated after it), so keep each one ending in `END;`.
CREATE TRIGGER faults_vehicle_status_insert AFTER INSERT ON faults
BEGIN
  UPDATE vehicles SET
    status = CASE
      WHEN EXISTS (SELECT 1 FROM faults WHERE vehicle_id = NEW.vehicle_id AND resolution_status != 'CORRECTED' AND readiness = 'NMC') THEN 'NMC'
      WHEN EXISTS (SELECT 1 FROM faults WHERE vehicle_id = NEW.vehicle_id AND resolution_status != 'CORRECTED' AND readiness = 'PMC') THEN 'PMC'
      ELSE 'FMC' END,
    updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
  WHERE id = NEW.vehicle_id;
END;

CREATE TRIGGER faults_vehicle_status_update AFTER UPDATE OF resolution_status, readiness, vehicle_id ON faults
BEGIN
  UPDATE vehicles SET
    status = CASE
      WHEN EXISTS (SELECT 1 FROM faults WHERE vehicle_id = vehicles.id AND resolution_status != 'CORRECTED' AND readiness = 'NMC') THEN 'NMC'
      WHEN EXISTS (SELECT 1 FROM faults WHERE vehicle_id = vehicles.id AND resolution_status != 'CORRECTED' AND readiness = 'PMC') THEN 'PMC'
      ELSE 'FMC' END,
    updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
  WHERE id IN (NEW.vehicle_id, OLD.vehicle_id);
END;

CREATE TRIGGER faults_vehicle_status_delete AFTER DELETE ON faults
BEGIN
  UPDATE vehicles SET
    status = CASE
      WHEN EXISTS (SELECT 1 FROM faults WHERE vehicle_id = OLD.vehicle_id AND resolution_status != 'CORRECTED' AND readiness = 'NMC') THEN 'NMC'
      WHEN EXISTS (SELECT 1 FROM faults WHERE vehicle_id = OLD.vehicle_id AND resolution_status != 'CORRECTED' AND readiness = 'PMC') THEN 'PMC'
      ELSE 'FMC' END,
    updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
  WHERE id = OLD.vehicle_id;
END;

-- Record a daily status snapshot whenever a vehicle's status changes
-- (the Worker's daily cron also snapshots every vehicle).
CREATE TRIGGER vehicles_status_history AFTER UPDATE OF status ON vehicles
WHEN NEW.status IS NOT OLD.status
BEGIN
  INSERT INTO vehicle_status_history (vehicle_id, status, recorded_at)
  VALUES (NEW.id, NEW.status, date('now'))
  ON CONFLICT (vehicle_id, recorded_at) DO UPDATE SET status = excluded.status;
END;
