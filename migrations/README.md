# Comment visibility upgrade

Inspect `PRAGMA table_info(ap_comment)` before choosing a path. Do not run migrations automatically against production.

- New database: use `setup.sql`; no comment-visibility migration is needed.
- Database that has never had `is_public`: run `legacy_comment_visibility.sql` **instead of both 0004 and 0005**. Its rows are known legacy records and can hydrate from an equal-version authoritative public object.
- Database with the old `is_public` column but without `mutation_version`: run `0005_comment_mutation_version.sql`. Hidden rows cannot be distinguished from past privacy withdrawals. They stay hidden until a newer authenticated public inbox Update, even if a background fetch returns public content.
- Database with all three columns: do not rerun these migrations.

Apply the selected migration before deploying the new reader. No production migration has been performed as part of this change.

Versioned withdrawals require a strictly newer authoritative public version to restore visibility. An undated withdrawal cannot safely be ordered against a later fetch, so only a newer authenticated public inbox Update clears that latch. Delayed fetches and public inbox edits compare a row mutation version before writing.
