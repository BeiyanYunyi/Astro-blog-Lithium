CREATE TABLE follower(
  id INTEGER PRIMARY KEY,
  actorId TEXT NOT NULL,
  inbox TEXT NOT NULL,
  constraint actorId_unique UNIQUE (actorId)
);

CREATE index follower_inbox on follower(actorId);

-- Additive: preserve the existing follower table and its rows.
CREATE TABLE IF NOT EXISTS fedify_kv (
  key TEXT PRIMARY KEY NOT NULL,
  value TEXT NOT NULL,
  expires INTEGER
);
CREATE INDEX IF NOT EXISTS fedify_kv_expires ON fedify_kv(expires);

CREATE TABLE IF NOT EXISTS ap_comment (
  id TEXT PRIMARY KEY NOT NULL,
  post_id TEXT NOT NULL,
  author_id TEXT NOT NULL,
  author_name TEXT NOT NULL,
  in_reply_to TEXT NOT NULL,
  content TEXT NOT NULL,
  published_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT
);
CREATE INDEX IF NOT EXISTS ap_comment_post ON ap_comment(post_id, published_at);

CREATE TABLE IF NOT EXISTS ap_publication (
  post_id TEXT PRIMARY KEY NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('baseline', 'pending', 'complete', 'cancelled')),
  cursor TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS ap_publication_pending ON ap_publication(status, created_at);
CREATE INDEX IF NOT EXISTS follower_delivery_inbox ON follower(inbox, actorId);
CREATE TABLE IF NOT EXISTS ap_publication_state (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  initialized_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS ap_inbox_credit (
  hostname TEXT PRIMARY KEY NOT NULL,
  credit INTEGER NOT NULL CHECK (credit BETWEEN 1 AND 120),
  decayed_at INTEGER NOT NULL,
  last_failure_at INTEGER NOT NULL
);

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
