import type { D1Database } from '@cloudflare/workers-types';
import type { KvKey, KvStore, KvStoreSetOptions } from '@fedify/fedify';

/** Fedify cache and inbox deduplication, shared across Worker isolates. */
export class D1KvStore implements KvStore {
  constructor(private readonly database: D1Database) {}

  async get<T>(key: KvKey): Promise<T | undefined> {
    const row = await this.database
      .prepare(
        'SELECT value FROM fedify_kv WHERE key = ? AND (expires IS NULL OR expires > ?)',
      )
      .bind(JSON.stringify(key), Date.now())
      .first<{ value: string }>();
    return row ? JSON.parse(row.value) : undefined;
  }

  async set(key: KvKey, value: unknown, options?: KvStoreSetOptions) {
    const now = Date.now();
    const expires = options?.ttl
      ? now + options.ttl.total('milliseconds')
      : null;
    await this.database.batch([
      this.database
        .prepare('DELETE FROM fedify_kv WHERE expires <= ?')
        .bind(now),
      this.database
        .prepare(
          'INSERT INTO fedify_kv(key, value, expires) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, expires = excluded.expires',
        )
        .bind(JSON.stringify(key), JSON.stringify(value), expires),
    ]);
  }

  async delete(key: KvKey) {
    await this.database
      .prepare('DELETE FROM fedify_kv WHERE key = ?')
      .bind(JSON.stringify(key))
      .run();
  }

  async *list(prefix?: KvKey) {
    const rows = await this.database
      .prepare(
        'SELECT key, value FROM fedify_kv WHERE (expires IS NULL OR expires > ?) AND substr(key, 1, length(?)) = ? ORDER BY key',
      )
      .bind(
        Date.now(),
        prefix ? JSON.stringify(prefix).slice(0, -1) : '',
        prefix ? JSON.stringify(prefix).slice(0, -1) : '',
      )
      .all<{ key: string; value: string }>();
    for (const row of rows.results) {
      const key: KvKey = JSON.parse(row.key);
      if (!prefix || prefix.every((part, index) => key[index] === part))
        yield { key, value: JSON.parse(row.value) };
    }
  }
}
