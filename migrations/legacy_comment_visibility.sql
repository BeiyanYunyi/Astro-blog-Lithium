-- Alternative to BOTH 0004 and 0005, only when is_public has NEVER existed.
-- These rows are provably legacy, so equal-version public hydration is safe.
ALTER TABLE ap_comment ADD COLUMN is_public INTEGER NOT NULL DEFAULT 0;
ALTER TABLE ap_comment ADD COLUMN mutation_version INTEGER NOT NULL DEFAULT 0;
ALTER TABLE ap_comment ADD COLUMN undated_revocation INTEGER NOT NULL DEFAULT 0;
