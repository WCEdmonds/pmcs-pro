-- Migration: 10-Level Diagnosis Flow
-- Replaces fault_type (SHORTCOMING/NO_GO) with readiness (PMC/NMC)
-- Adds category_id to faults
-- Creates diagnosis_attempts table
-- Date: 2026-03-30

BEGIN;

-- ============================================================
-- 1. Add new columns to faults table
-- ============================================================

ALTER TABLE faults
  ADD COLUMN IF NOT EXISTS readiness text,
  ADD COLUMN IF NOT EXISTS category_id text;

-- Migrate existing data: map old fault_type to new readiness
UPDATE faults
SET readiness = CASE
  WHEN fault_type = 'NO_GO' AND corrected_on_site = false THEN 'NMC'
  WHEN fault_type = 'NO_GO' AND corrected_on_site = true THEN 'PMC'
  WHEN fault_type = 'SHORTCOMING' THEN 'PMC'
  ELSE 'PMC'
END
WHERE readiness IS NULL;

-- Set default for new rows
ALTER TABLE faults
  ALTER COLUMN readiness SET DEFAULT 'NMC';

-- Add constraint
ALTER TABLE faults
  ADD CONSTRAINT faults_readiness_check
  CHECK (readiness IN ('PMC', 'NMC'));

-- Drop old fault_type column (after data migration)
ALTER TABLE faults
  DROP COLUMN IF EXISTS fault_type;

-- Index for dashboard queries filtering by readiness
CREATE INDEX IF NOT EXISTS idx_faults_readiness
  ON faults (readiness);

CREATE INDEX IF NOT EXISTS idx_faults_category_id
  ON faults (category_id);

-- ============================================================
-- 2. Create diagnosis_attempts table
-- ============================================================

CREATE TABLE IF NOT EXISTS diagnosis_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fault_id uuid NOT NULL REFERENCES faults(id) ON DELETE CASCADE,
  session_id text NOT NULL,
  category_id text NOT NULL,
  steps_completed jsonb NOT NULL DEFAULT '[]'::jsonb,
  outcome text NOT NULL CHECK (outcome IN ('operator-fix', 'needs-maintenance', 'skipped')),
  skip_reason text,
  readiness_result text NOT NULL CHECK (readiness_result IN ('PMC', 'NMC')),
  completed_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_diagnosis_attempts_fault_id
  ON diagnosis_attempts (fault_id);

CREATE INDEX IF NOT EXISTS idx_diagnosis_attempts_session_id
  ON diagnosis_attempts (session_id);

-- ============================================================
-- 3. Enable Row Level Security
-- ============================================================

ALTER TABLE diagnosis_attempts ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read all diagnosis attempts (same unit visibility as faults)
CREATE POLICY "Authenticated users can read diagnosis attempts"
  ON diagnosis_attempts
  FOR SELECT
  TO authenticated
  USING (true);

-- Allow authenticated users to insert their own diagnosis attempts
CREATE POLICY "Authenticated users can insert diagnosis attempts"
  ON diagnosis_attempts
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- ============================================================
-- 4. Enable Realtime for diagnosis_attempts
-- ============================================================

ALTER PUBLICATION supabase_realtime ADD TABLE diagnosis_attempts;

-- ============================================================
-- 5. Update vehicle status trigger to use readiness
-- ============================================================

-- Update the function that computes vehicle status from faults
-- (if it exists — adjust based on your actual trigger name)
CREATE OR REPLACE FUNCTION update_vehicle_status_on_fault()
RETURNS trigger AS $$
DECLARE
  v_has_nmc boolean;
BEGIN
  -- Check if vehicle has any uncorrected NMC faults
  SELECT EXISTS (
    SELECT 1 FROM faults
    WHERE vehicle_id = COALESCE(NEW.vehicle_id, OLD.vehicle_id)
      AND resolution_status != 'CORRECTED'
      AND readiness = 'NMC'
  ) INTO v_has_nmc;

  -- Update vehicle status
  UPDATE vehicles
  SET status = CASE
    WHEN v_has_nmc THEN 'NMC'
    ELSE 'FMC'
  END,
  updated_at = now()
  WHERE id = COALESCE(NEW.vehicle_id, OLD.vehicle_id);

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

COMMIT;
