import type { D1Database } from '@cloudflare/workers-types';
import type { KvKey, KvStore, KvStoreSetOptions } from '@fedify/fedify';
import { and, asc, eq, gt, isNull, lte, or, sql } from 'drizzle-orm';
import createDatabase, { type Database } from './database';
import { fedifyKv } from './schema';

const unexpired = (now: number) =>
  or(isNull(fedifyKv.expires), gt(fedifyKv.expires, now));

/** Fedify cache and inbox deduplication, shared across Worker isolates. */
export class D1KvStore implements KvStore {
  private readonly database: Database;

  constructor(database: D1Database) {
    this.database = createDatabase(database);
  }

  async get<T>(key: KvKey): Promise<T | undefined> {
    const row = await this.database
      .select({ value: fedifyKv.value })
      .from(fedifyKv)
      .where(and(eq(fedifyKv.key, JSON.stringify(key)), unexpired(Date.now())))
      .get();
    return row ? JSON.parse(row.value) : undefined;
  }

  async set(key: KvKey, value: unknown, options?: KvStoreSetOptions) {
    const now = Date.now();
    const expires = options?.ttl
      ? now + options.ttl.total('milliseconds')
      : null;
    await this.database.batch([
      this.database.delete(fedifyKv).where(lte(fedifyKv.expires, now)),
      this.database
        .insert(fedifyKv)
        .values({
          key: JSON.stringify(key),
          value: JSON.stringify(value),
          expires,
        })
        .onConflictDoUpdate({
          target: fedifyKv.key,
          set: { value: JSON.stringify(value), expires },
        }),
    ]);
  }

  async delete(key: KvKey) {
    await this.database
      .delete(fedifyKv)
      .where(eq(fedifyKv.key, JSON.stringify(key)))
      .run();
  }

  async *list(prefix?: KvKey) {
    const encodedPrefix = prefix ? JSON.stringify(prefix).slice(0, -1) : '';
    const rows = await this.database
      .select({ key: fedifyKv.key, value: fedifyKv.value })
      .from(fedifyKv)
      .where(
        and(
          unexpired(Date.now()),
          eq(
            sql<string>`substr(${fedifyKv.key}, 1, length(${encodedPrefix}))`,
            encodedPrefix,
          ),
        ),
      )
      .orderBy(asc(fedifyKv.key))
      .all();
    for (const row of rows) {
      const key: KvKey = JSON.parse(row.key);
      if (!prefix || prefix.every((part, index) => key[index] === part))
        yield { key, value: JSON.parse(row.value) };
    }
  }
}
