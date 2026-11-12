-- For databases where 0004 has already run. Its hidden rows have ambiguous
-- provenance: do not silently reclassify a previous withdrawal as legacy.
ALTER TABLE ap_comment ADD COLUMN mutation_version INTEGER NOT NULL DEFAULT 0;
ALTER TABLE ap_comment ADD COLUMN undated_revocation INTEGER NOT NULL DEFAULT 0;
UPDATE ap_comment SET mutation_version = 1, undated_revocation = CASE WHEN is_public = 0 THEN 1 ELSE 0 END;
