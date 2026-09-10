import { getCollection } from 'astro:content';
import type { InboxContext, InboxListenerSetters } from '@fedify/fedify';
import { Create, Delete, Note, Update } from '@fedify/vocab';
import { filePathToSlug } from '@utils/idToSlug';
import { and, eq, isNull, lt, sql } from 'drizzle-orm';
import { isBlockedInstance } from './blocklist';
import createDatabase from './database';
import { sanitizeCommentContent } from './sanitize';
import { comment } from './schema';
import type { Env } from './types';

async function localPostId(ctx: InboxContext<Env>, target: URL) {
  const parsed = ctx.parseUri(target);
  if (parsed?.type !== 'object' || parsed.class !== Note) return null;
  const id = parsed.values.id;
  return (await getCollection('posts')).some(
    (post) => filePathToSlug(post.filePath) === id,
  )
    ? id
    : null;
}

function ownsNote(activity: Create | Update, note: Note) {
  return (
    activity.actorId?.protocol === 'https:' &&
    note.id?.origin === activity.actorId.origin &&
    note.attributionIds.length === 1 &&
    note.attributionId?.href === activity.actorId.href
  );
}

export function registerCommentListeners(listeners: InboxListenerSetters<Env>) {
  listeners
    .on(Create, async (ctx, activity) => {
      if (activity.actorIds.some((id) => isBlockedInstance(id))) return;
      const note = await activity.getObject(ctx);
      if (
        !(note instanceof Note) ||
        !note.id ||
        !activity.actorId ||
        !ownsNote(activity, note) ||
        !note.replyTargetId
      )
        return;
      const postId = await localPostId(ctx, note.replyTargetId);
      if (!postId) return;
      const author = await activity.getActor(ctx);
      if (author?.id?.href !== activity.actorId.href) return;
      const published = note.published?.toString() ?? new Date().toISOString();
      await createDatabase(ctx.data.ap)
        .insert(comment)
        .values({
          id: note.id.href,
          postId,
          authorId: author.id.href,
          authorName:
            author.name?.toString() ??
            author.preferredUsername?.toString() ??
            author.id.host,
          inReplyTo: note.replyTargetId.href,
          content: await sanitizeCommentContent(note.content?.toString() ?? ''),
          publishedAt: published,
          updatedAt: note.updated?.toString() ?? published,
        })
        .onConflictDoNothing({ target: comment.id })
        .run();
    })
    .on(Update, async (ctx, activity) => {
      if (activity.actorIds.some((id) => isBlockedInstance(id))) return;
      const note = await activity.getObject(ctx);
      if (
        !(note instanceof Note) ||
        !note.id ||
        !activity.actorId ||
        !ownsNote(activity, note)
      )
        return;
      const updated =
        note.updated?.toString() ?? activity.published?.toString();
      // Without a version timestamp, a retried old edit could overwrite a newer one.
      if (!updated) return;
      await createDatabase(ctx.data.ap)
        .update(comment)
        .set({
          content: await sanitizeCommentContent(note.content?.toString() ?? ''),
          updatedAt: updated,
        })
        .where(
          and(
            eq(comment.id, note.id.href),
            eq(comment.authorId, activity.actorId.href),
            isNull(comment.deletedAt),
            lt(
              sql`julianday(${comment.updatedAt})`,
              sql`julianday(${updated})`,
            ),
          ),
        )
        .run();
    })
    .on(Delete, async (ctx, activity) => {
      if (activity.actorIds.some((id) => isBlockedInstance(id))) return;
      if (!activity.actorId || !activity.objectId) return;
      // Keep the ID and author as a tombstone so late Create/Update retries cannot resurrect it.
      await createDatabase(ctx.data.ap)
        .update(comment)
        .set({
          content: '',
          authorName: '',
          deletedAt: new Date().toISOString(),
        })
        .where(
          and(
            eq(comment.id, activity.objectId.href),
            eq(comment.authorId, activity.actorId.href),
            isNull(comment.deletedAt),
          ),
        )
        .run();
    });
}
