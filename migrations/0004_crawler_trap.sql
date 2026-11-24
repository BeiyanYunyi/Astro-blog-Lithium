-- Additive migration. Never rerun setup.sql against an existing database.
CREATE TABLE IF NOT EXISTS crawler_trap_hit (
  id INTEGER PRIMARY KEY,
  ip TEXT NOT NULL,
  ua TEXT NOT NULL,
  via TEXT NOT NULL CHECK (via IN ('robots', 'link')),
  asn INTEGER,
  as_org TEXT,
  country TEXT,
  first_seen INTEGER NOT NULL,
  last_seen INTEGER NOT NULL,
  hit_count INTEGER NOT NULL DEFAULT 1,
  token TEXT NOT NULL UNIQUE,
  revoked_at INTEGER
);
CREATE UNIQUE INDEX IF NOT EXISTS crawler_trap_hit_active
  ON crawler_trap_hit(ip, ua, via) WHERE revoked_at IS NULL;
CREATE INDEX IF NOT EXISTS crawler_trap_hit_recent
  ON crawler_trap_hit(last_seen) WHERE revoked_at IS NULL;
