import { getCollection } from 'astro:content';
import type { InboxContext, InboxListenerSetters } from '@fedify/fedify';
import {
  type Actor,
  Create,
  Delete,
  isActor,
  Note,
  Update,
} from '@fedify/vocab';
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

async function replyPostId(ctx: InboxContext<Env>, target: URL) {
  const postId = await localPostId(ctx, target);
  if (postId) return postId;
  // Every stored reply carries its root post, including deletion tombstones.
  const parent = await createDatabase(ctx.data.ap)
    .select({ postId: comment.postId })
    .from(comment)
    .where(eq(comment.id, target.href))
    .get();
  return parent?.postId ?? null;
}

function ownsNote(activity: Create | Update, note: Note) {
  return (
    note.attributionId?.href === activity.actorId?.href && validAuthor(note)
  );
}

function validAuthor(note: Note) {
  return (
    note.attributionId?.protocol === 'https:' &&
    note.id?.origin === note.attributionId.origin &&
    note.attributionIds.length === 1 &&
    !isBlockedInstance(note.attributionId)
  );
}

// The incoming Note is depth 0; fetch at most five missing ancestors.
async function resolveReplyThread(ctx: InboxContext<Env>, note: Note) {
  const ancestors: Note[] = [];
  const seen = new Set([note.id?.href]);
  const signal = AbortSignal.timeout(15_000);
  let target = note.replyTargetId;
  while (target) {
    if (seen.has(target.href) || isBlockedInstance(target)) return null;
    const postId = await replyPostId(ctx, target);
    if (postId) return { postId, ancestors };
    // A recognized local URI that failed resolution cannot be recovered remotely.
    if (ctx.parseUri(target)) return null;
    if (ancestors.length >= 5 || target.protocol !== 'https:') return null;
    seen.add(target.href);
    // Fetch by URI even if inReplyTo embeds an object: the signed sender does
    // not vouch for other authors' content. Resolve it at its authoritative URI.
    const parent = await ctx.lookupObject(target, { signal });
    if (
      !(parent instanceof Note) ||
      parent.id?.href !== target.href ||
      !validAuthor(parent) ||
      parent.replyTargetIds.length !== 1
    )
      return null;
    ancestors.push(parent);
    target = parent.replyTargetId;
  }
  return null;
}

async function commentValues(note: Note, author: Actor, postId: string) {
  if (!note.id || !note.replyTargetId || !author.id)
    throw new Error('Cannot store a comment without its identity and parent');
  const published = note.published?.toString() ?? new Date().toISOString();
  return {
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
  };
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
      const author = await activity.getActor(ctx);
      if (author?.id?.href !== activity.actorId.href) return;
      // Fedify verifies the incoming activity before dispatching this listener.
      const thread = await resolveReplyThread(ctx, note);
      if (!thread) return;
      const authors = new Map<string, Actor>([[author.id.href, author]]);
      const rows = [];
      const signal = AbortSignal.timeout(15_000);
      for (const ancestor of thread.ancestors.toReversed()) {
        const id = ancestor.attributionId;
        if (!id) return;
        let ancestorAuthor = authors.get(id.href);
        if (!ancestorAuthor) {
          const resolved = await ctx.lookupObject(id, { signal });
          if (!isActor(resolved) || resolved.id?.href !== id.href) return;
          ancestorAuthor = resolved;
          authors.set(id.href, resolved);
        }
        rows.push(await commentValues(ancestor, ancestorAuthor, thread.postId));
      }
      rows.push(await commentValues(note, author, thread.postId));
      // Persist only a fully validated, blog-rooted chain, in one atomic insert.
      // Existing edits and deletion tombstones must never be overwritten.
      await createDatabase(ctx.data.ap)
        .insert(comment)
        .values(rows)
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
