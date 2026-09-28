-- Additive migration. Never rerun setup.sql against an existing database.
CREATE TABLE IF NOT EXISTS ap_inbox_credit (
  hostname TEXT PRIMARY KEY NOT NULL,
  credit INTEGER NOT NULL CHECK (credit BETWEEN 1 AND 120),
  decayed_at INTEGER NOT NULL,
  last_failure_at INTEGER NOT NULL
);
