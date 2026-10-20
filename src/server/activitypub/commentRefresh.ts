import type { Context, TaskRegistry } from '@fedify/fedify';
import { Note } from '@fedify/vocab';
import { and, asc, eq, isNull, lt, sql } from 'drizzle-orm';
import { Temporal } from 'temporal-polyfill';
import { isBlockedInstance } from './blocklist';
import createDatabase from './database';
import { D1KvStore } from './kv';
import { sanitizeCommentContent } from './sanitize';
import { comment } from './schema';
import type { Env } from './types';

const freshness = Temporal.Duration.from({ minutes: 15 });
const windowMs = 5 * 60 * 1000;
const freshKey = (id: string) => ['blog', 'comment-refresh', id] as const;

function safeRemote(value: string) {
  if (!URL.canParse(value)) return false;
  const url = new URL(value);
  return (
    url.protocol === 'https:' &&
    !url.username &&
    !url.password &&
    !isBlockedInstance(url)
  );
}

export function registerCommentRefresh(
  registry: TaskRegistry<Env>,
  identifier: string,
) {
  return registry.defineTask('blog-refresh-comment', {
    schema: {
      '~standard': {
        version: 1,
        vendor: 'blog',
        types: undefined as { input: unknown; output: string } | undefined,
        validate(value: unknown) {
          if (
            typeof value === 'string' &&
            URL.canParse(value) &&
            safeRemote(value)
          )
            return { value };
          return { issues: [{ message: 'Expected an HTTPS comment URL' }] };
        },
      },
    },
    handler: (ctx, id) => refreshComment(ctx, id, identifier),
  });
}

async function refreshComment(
  ctx: Context<Env>,
  id: string,
  identifier: string,
) {
  const kv = new D1KvStore(ctx.data.ap);
  if (await kv.get(freshKey(id))) return;
  const db = createDatabase(ctx.data.ap);
  const row = await db.select().from(comment).where(eq(comment.id, id)).get();
  if (!row || row.deletedAt || !safeRemote(row.authorId)) return;
  // lookupObject retains Fedify's SSRF protection. Never trust embedded objects,
  // redirects to another identity, or a changed author/parent/root.
  const note = await ctx.lookupObject(new URL(id), {
    signal: AbortSignal.timeout(15_000),
    // The default document loader has its own longer-lived KV cache. Signed
    // loaders intentionally bypass it, so this task actually revalidates remotely.
    documentLoader: await ctx.getDocumentLoader({ identifier }),
  });
  if (
    !(note instanceof Note) ||
    note.id?.href !== id ||
    note.attributionIds.length !== 1 ||
    note.attributionId?.href !== row.authorId ||
    note.id.origin !== note.attributionId.origin ||
    note.replyTargetIds.length !== 1 ||
    note.replyTargetId?.href !== row.inReplyTo
  ) {
    // Missing/unavailable objects are not proof of deletion; preserve the cache
    // and let the queue retry. Only authenticated inbox Delete creates tombstones.
    throw new Error('Remote comment could not be revalidated');
  }
  const updated = note.updated?.toString();
  if (updated) {
    await db
      .update(comment)
      .set({
        content: await sanitizeCommentContent(note.content?.toString() ?? ''),
        updatedAt: updated,
      })
      .where(
        and(
          eq(comment.id, id),
          eq(comment.authorId, row.authorId),
          eq(comment.inReplyTo, row.inReplyTo),
          isNull(comment.deletedAt),
          lt(sql`julianday(${comment.updatedAt})`, sql`julianday(${updated})`),
        ),
      )
      .run();
  }
  await kv.set(freshKey(id), true, { ttl: freshness });
}

export async function readComments(
  ctx: Context<Env>,
  task: ReturnType<typeof registerCommentRefresh>,
  postId: string,
) {
  const rows = await createDatabase(ctx.data.ap)
    .select()
    .from(comment)
    .where(and(eq(comment.postId, postId), isNull(comment.deletedAt)))
    .orderBy(asc(comment.publishedAt), asc(comment.id))
    .all();
  const visible = rows.filter(
    (row) => safeRemote(row.id) && safeRemote(row.authorId),
  );
  const kv = new D1KvStore(ctx.data.ap);
  for (const row of visible) {
    try {
      if (await kv.get(freshKey(row.id))) continue;
      // Per-reply tasks isolate failures. Stable keys coalesce readers across
      // Worker isolates through Fedify's D1 CAS fallback, not exactly-once delivery.
      await ctx.enqueueTask(task, row.id, {
        deduplicationKey: JSON.stringify([
          'comment-refresh',
          postId,
          row.id,
          Math.floor(Date.now() / windowMs),
        ]),
      });
    } catch (error) {
      // Queue availability must not hide already cached replies.
      console.error('Could not enqueue comment refresh', { id: row.id, error });
    }
  }
  return visible;
}
