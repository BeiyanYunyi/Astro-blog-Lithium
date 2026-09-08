-- Additive: preserve the existing follower table and its rows.
CREATE TABLE IF NOT EXISTS fedify_kv (
  key TEXT PRIMARY KEY NOT NULL,
  value TEXT NOT NULL,
  expires INTEGER
);
CREATE INDEX IF NOT EXISTS fedify_kv_expires ON fedify_kv(expires);
