-- 0003: optional personal email per user (verified by an emailed code) and
-- one-time codes for email verification and self-service PIN reset.
--
-- Safe on a populated database: only ADD COLUMN (nullable) and a new table.
-- Existing users start with no email; the apps prompt them to add one.

-- Lower-cased. Not unique: two accounts may share an address.
ALTER TABLE profiles ADD COLUMN email TEXT;
-- Set when the user enters the code sent to `email`; cleared whenever `email` changes.
-- Only a verified address receives PIN-reset codes and account notices.
ALTER TABLE profiles ADD COLUMN email_verified_at TEXT;

-- One-time codes. Only an HMAC of the code is stored. A new code of the same
-- purpose supersedes (marks used) the older unused ones.
CREATE TABLE IF NOT EXISTS email_codes (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  -- 'verify' | 'reset'
  purpose TEXT NOT NULL,
  -- The address the code was sent to (verify: must still be the profile's email).
  email TEXT NOT NULL,
  code_hash TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  used_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_email_codes_user ON email_codes (user_id, purpose, created_at);
