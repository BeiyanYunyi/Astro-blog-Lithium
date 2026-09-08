import type { Federation } from '@fedify/fedify';
import { filePathToSlug } from '@utils/idToSlug';
import postToCreate from '@utils/noteToCreate';
import { and, asc, eq, exists, gt, min, sql } from 'drizzle-orm';
import createDatabase from './database';
import { getPosts, identifier, origin } from './federation';
import follower, {
  publicationState,
  publication as publicationTable,
} from './schema';
import type { Env } from './types';

export interface PublicationTask {
  type: 'blog-publish';
  postId: string;
}

const publicationsPerScan = 5;
const inboxesPerTask = 25;

/** Atomic first-run baseline; subsequent scans discover only unseen published posts. */
export async function scanPublications(env: Env) {
  const posts = (await getPosts()).filter(
    (post) => post.data.date.getTime() <= Date.now(),
  );
  const ids = posts.map((post) => filePathToSlug(post.filePath));
  const now = new Date().toISOString();
  const database = createDatabase(env.ap);
  const initialized = exists(
    database.select({ id: publicationState.id }).from(publicationState),
  );
  await database.batch([
    database
      .insert(publicationTable)
      .select(
        database
          .select({
            postId: sql<string>`value`.as('post_id'),
            status: sql<
              'pending' | 'baseline'
            >`case when ${initialized} then 'pending' else 'baseline' end`.as(
              'status',
            ),
            cursor: sql<string>`''`.as('cursor'),
            createdAt: sql<string>`${now}`.as('created_at'),
          })
          .from(sql`json_each(${JSON.stringify(ids)})`)
          // Disambiguate SQLite INSERT ... SELECT ... ON CONFLICT syntax.
          .where(sql`true`),
      )
      .onConflictDoNothing({ target: publicationTable.postId }),
    database
      .insert(publicationState)
      .values({ id: 1, initializedAt: now })
      .onConflictDoNothing({ target: publicationState.id }),
  ]);
  // Pending rows are a durable repair log if enqueueing or a continuation fails.
  const pending = await database
    .select({ postId: publicationTable.postId })
    .from(publicationTable)
    .where(eq(publicationTable.status, 'pending'))
    .orderBy(asc(publicationTable.createdAt), asc(publicationTable.postId))
    .limit(publicationsPerScan)
    .all();
  if (pending.length) {
    await env.FEDERATION_QUEUE.sendBatch(
      pending.map((row) => ({
        body: {
          type: 'blog-publish',
          postId: row.postId,
        } satisfies PublicationTask,
      })),
    );
  }
  return { queued: pending.length };
}

export async function publishBatch(
  env: Env,
  federation: Federation<Env>,
  task: PublicationTask,
) {
  const database = createDatabase(env.ap);
  const publication = await database
    .select({ cursor: publicationTable.cursor })
    .from(publicationTable)
    .where(
      and(
        eq(publicationTable.postId, task.postId),
        eq(publicationTable.status, 'pending'),
      ),
    )
    .get();
  if (!publication) return;
  const post = (await getPosts()).find(
    (post) => filePathToSlug(post.filePath) === task.postId,
  );
  if (!post) {
    // A later deployment can remove a post while its publication is queued.
    // Stop that publication rather than occupying a scan slot forever.
    await database
      .update(publicationTable)
      .set({ status: 'cancelled' })
      .where(eq(publicationTable.postId, task.postId))
      .run();
    return;
  }
  // Page distinct inboxes rather than actors, including across page boundaries.
  const inboxes = await database
    .select({
      inbox: follower.inbox,
      actorId: min(follower.actorId),
    })
    .from(follower)
    .where(gt(follower.inbox, publication.cursor))
    .groupBy(follower.inbox)
    .orderBy(asc(follower.inbox))
    .limit(inboxesPerTask)
    .all();
  if (inboxes.length) {
    const ctx = federation.createContext(new URL(origin), env);
    await ctx.sendActivity(
      { identifier },
      inboxes.map((row) => {
        // MIN is nullable in Drizzle's types; each group has a NOT NULL actorId.
        if (row.actorId === null)
          throw new Error('Follower inbox has no actor');
        return { id: new URL(row.actorId), inboxId: new URL(row.inbox) };
      }),
      postToCreate(post),
    );
  }
  // Advance only after all deliveries in this page are durably in Workers Queues.
  // A crash between these operations can repeat a page, using stable activity IDs.
  const complete = inboxes.length < inboxesPerTask;
  await database
    .update(publicationTable)
    .set({
      cursor: inboxes.at(-1)?.inbox ?? publication.cursor,
      status: complete ? 'complete' : 'pending',
    })
    .where(eq(publicationTable.postId, task.postId))
    .run();
  if (!complete) await env.FEDERATION_QUEUE.send(task);
}
