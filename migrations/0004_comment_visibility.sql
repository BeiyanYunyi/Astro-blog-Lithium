-- Run once before deploying the public comment reader. Historical rows have
-- unknown audiences and stay hidden until an authoritative public Note is fetched.
ALTER TABLE ap_comment ADD COLUMN is_public INTEGER NOT NULL DEFAULT 0;
