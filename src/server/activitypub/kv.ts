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

  /** Atomically compare JSON values, treating expired keys as absent. */
  async cas(
    key: KvKey,
    expectedValue: unknown,
    newValue: unknown,
    options?: KvStoreSetOptions,
  ): Promise<boolean> {
    const encodedKey = JSON.stringify(key);
    const now = Date.now();

    if (expectedValue === undefined) {
      if (newValue === undefined) {
        // No mutation is needed; this read is the operation's atomic point.
        return (await this.get(key)) === undefined;
      }
      const expires = options?.ttl
        ? now + options.ttl.total('milliseconds')
        : null;
      const result = await this.database
        .insert(fedifyKv)
        .values({ key: encodedKey, value: JSON.stringify(newValue), expires })
        .onConflictDoUpdate({
          target: fedifyKv.key,
          set: { value: JSON.stringify(newValue), expires },
          setWhere: lte(fedifyKv.expires, now),
        })
        .run();
      return result.meta.changes > 0;
    }

    const expectedJson = JSON.stringify(expectedValue);
    // Compare the JSON trees in both directions: object member order is ignored,
    // but array order, container types, empty containers and scalar types matter.
    // The predicate runs inside the mutation, so no JS read/write race or
    // interactive transaction is needed on D1.
    const matches = and(
      eq(fedifyKv.key, encodedKey),
      unexpired(now),
      sql`NOT EXISTS (
        SELECT fullkey, type, atom FROM json_tree(${fedifyKv.value})
        EXCEPT SELECT fullkey, type, atom FROM json_tree(${expectedJson})
      ) AND NOT EXISTS (
        SELECT fullkey, type, atom FROM json_tree(${expectedJson})
        EXCEPT SELECT fullkey, type, atom FROM json_tree(${fedifyKv.value})
      )`,
    );
    const result =
      newValue === undefined
        ? await this.database.delete(fedifyKv).where(matches).run()
        : await this.database
            .update(fedifyKv)
            .set({
              value: JSON.stringify(newValue),
              expires: options?.ttl
                ? now + options.ttl.total('milliseconds')
                : null,
            })
            .where(matches)
            .run();
    return result.meta.changes > 0;
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
