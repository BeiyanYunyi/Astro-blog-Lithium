-- Additive migration. Never rerun setup.sql against an existing database.
-- Replaces the mutable crawler_trap_hit table with an append-only event log.
CREATE TABLE IF NOT EXISTS crawler_trap_visitor (
  id INTEGER PRIMARY KEY,
  ip TEXT NOT NULL,
  ua TEXT NOT NULL,
  via TEXT NOT NULL CHECK (via IN ('robots', 'link')),
  UNIQUE (ip, ua, via)
);
CREATE TABLE IF NOT EXISTS crawler_trap_event (
  id INTEGER PRIMARY KEY,
  ts INTEGER NOT NULL,
  visitor_id INTEGER NOT NULL REFERENCES crawler_trap_visitor(id),
  visit TEXT NOT NULL,
  kind TEXT NOT NULL
    CHECK (kind IN ('hit', 'js', 'ts_pass', 'ts_fail', 'revoke')),
  asn INTEGER,
  as_org TEXT,
  country TEXT,
  detail TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS crawler_trap_event_visit
  ON crawler_trap_event(visit, kind);
CREATE INDEX IF NOT EXISTS crawler_trap_event_visitor
  ON crawler_trap_event(visitor_id, kind, id);

-- Backfill from crawler_trap_hit when it still exists. Each legacy row becomes
-- a hit at first_seen and, when later, a hit at last_seen carrying the live
-- revoke token. Hit counts in between are not recoverable. Legacy hits are
-- marked so the Turnstile funnel ignores them.
CREATE TABLE IF NOT EXISTS crawler_trap_hit (
  id INTEGER PRIMARY KEY,
  ip TEXT NOT NULL,
  ua TEXT NOT NULL,
  via TEXT NOT NULL,
  asn INTEGER,
  as_org TEXT,
  country TEXT,
  first_seen INTEGER NOT NULL,
  last_seen INTEGER NOT NULL,
  hit_count INTEGER NOT NULL DEFAULT 1,
  token TEXT NOT NULL UNIQUE,
  revoked_at INTEGER
);
INSERT OR IGNORE INTO crawler_trap_visitor (ip, ua, via)
  SELECT ip, ua, via FROM crawler_trap_hit ORDER BY id;
INSERT OR IGNORE INTO crawler_trap_event
  (ts, visitor_id, visit, kind, asn, as_org, country, detail)
SELECT ts, visitor_id, visit, kind, asn, as_org, country, detail FROM (
  SELECT h.first_seen AS ts, v.id AS visitor_id, h.id AS row_id, 0 AS step,
    CASE WHEN h.first_seen = h.last_seen THEN h.token
      ELSE 'rt-legacy-' || h.id END AS visit,
    'hit' AS kind, h.asn, h.as_org, h.country, '{"legacy":true}' AS detail
  FROM crawler_trap_hit h JOIN crawler_trap_visitor v USING (ip, ua, via)
  UNION ALL
  SELECT h.last_seen, v.id, h.id, 1, h.token, 'hit', h.asn, h.as_org,
    h.country, '{"legacy":true}'
  FROM crawler_trap_hit h JOIN crawler_trap_visitor v USING (ip, ua, via)
  WHERE h.last_seen > h.first_seen
  UNION ALL
  SELECT h.revoked_at, v.id, h.id, 2, h.token, 'revoke', NULL, NULL, NULL,
    NULL
  FROM crawler_trap_hit h JOIN crawler_trap_visitor v USING (ip, ua, via)
  WHERE h.revoked_at IS NOT NULL
)
ORDER BY ts, row_id, step;
DROP TABLE crawler_trap_hit;
