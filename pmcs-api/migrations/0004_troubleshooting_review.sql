-- 0004: warrant review of the troubleshooting trees (field app page /review).
--
-- Safe on a populated database: new tables only.

-- A problem raised on one step of one tree. `tree` is "<vehicleType>.<categoryId>"
-- (e.g. "M1097.wont-start"), `node` the step id inside that tree.
CREATE TABLE IF NOT EXISTS review_flags (
  id TEXT PRIMARY KEY,
  tree TEXT NOT NULL,
  node TEXT NOT NULL,
  -- 'readiness' | 'level' | 'tm' | 'wording' | 'missing' | 'safety' | 'other'
  kind TEXT NOT NULL,
  text TEXT NOT NULL,
  user_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL,
  resolved_at TEXT,
  resolved_by TEXT
);
CREATE INDEX IF NOT EXISTS idx_review_flags_tree ON review_flags (tree, created_at);

-- One verdict per reviewer per tree.
CREATE TABLE IF NOT EXISTS review_verdicts (
  tree TEXT NOT NULL,
  user_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  -- 'approved' | 'changes'
  status TEXT NOT NULL,
  note TEXT,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (tree, user_id)
);
