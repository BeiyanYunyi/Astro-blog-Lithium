import './logging';
import { getCollection } from 'astro:content';
import { createFederation } from '@fedify/fedify';
import {
  Accept,
  Create,
  Follow,
  Image,
  Note,
  Person,
  PropertyValue,
  Undo,
} from '@fedify/vocab';
import { filePathToSlug } from '@utils/idToSlug';
import postToCreate from '@utils/noteToCreate';
import postToNote from '@utils/postToNote';
import { desc, eq } from 'drizzle-orm';
import { Temporal } from 'temporal-polyfill';
import actorURL from './actorURL';
import createDatabase from './database';
import { getPrivateKey, getPublicKey } from './getKey';
import { D1KvStore } from './kv';
import follower from './schema';
import type { Env } from './types';

// The identifier is a path segment, independent of the public account handle.
export const identifier = 'activitypub';
export const origin = 'https://blog.yunyi.beiyan.us';
export const webFingerResources = new Set([
  `acct:BeiyanYunyi@blog.yunyi.beiyan.us`,
  `acct:BeiyanYunyi@stblog.penclub.club`,
  actorURL,
  origin,
  'https://stblog.penclub.club',
]);

export async function getPosts() {
  return (await getCollection('posts')).sort(
    (a, b) => b.data.date.getTime() - a.data.date.getTime(),
  );
}

export function createBlogFederation(bindings: Env) {
  const federation = createFederation<Env>({
    origin,
    kv: new D1KvStore(bindings.ap),
    // No in-process queue: Workers can stop after a response. Await delivery.
  });

  federation
    .setActorDispatcher('/api/{identifier}/actor', async (ctx, id) => {
      if (id !== identifier) return null;
      const keys = await ctx.getActorKeyPairs(id);
      return new Person({
        id: ctx.getActorUri(id),
        name: '北雁云依',
        preferredUsername: 'BeiyanYunyi',
        summary:
          '<p>北雁云依的博客<br />拿去吧，你可以假戏真做<br />君子协定：内容默认可自由转发，特别注明除外</p>',
        url: new URL(`${origin}/intro`),
        inbox: ctx.getInboxUri(id),
        outbox: ctx.getOutboxUri(id),
        followers: ctx.getFollowersUri(id),
        attachments: [
          new PropertyValue({ name: '立场', value: '泛左翼缝合' }),
          new PropertyValue({
            name: '爱好',
            value: '百科知识。人文社科自然科学计算机科学',
          }),
          new PropertyValue({
            name: '博客',
            value: `<a href="${origin}" target="_blank" rel="nofollow noopener noreferrer me" translate="no"><span class="invisible">https://</span><span class="">blog.yunyi.beiyan.us</span><span class="invisible"></span></a>`,
          }),
        ],
        icon: new Image({
          mediaType: 'image/png',
          url: new URL(`${origin}/头像方.png`),
        }),
        manuallyApprovesFollowers: false,
        discoverable: true,
        indexable: true,
        published: Temporal.Instant.from('2018-05-31T00:00:00Z'),
        publicKeys: keys.map((key) => key.cryptographicKey),
      });
    })
    .setKeyPairsDispatcher(async (ctx, id) =>
      id === identifier
        ? [
            {
              publicKey: await getPublicKey(ctx.data),
              privateKey: await getPrivateKey(ctx.data),
            },
          ]
        : [],
    )
    .mapHandle((_ctx, username) =>
      username === 'BeiyanYunyi' ? identifier : null,
    );

  federation
    .setFollowersDispatcher('/api/{identifier}/followers', async (ctx, id) => {
      if (id !== identifier) return null;
      const rows = await createDatabase(ctx.data.ap)
        .select()
        .from(follower)
        .orderBy(desc(follower.actorId))
        .all();
      return {
        items: rows.map((row) => ({
          id: new URL(row.actorId),
          inboxId: new URL(row.inbox),
        })),
      };
    })
    .setCounter(async (ctx, id) =>
      id === identifier
        ? ((
            await ctx.data.ap
              .prepare('SELECT count(*) AS count FROM follower')
              .first<{ count: number }>()
          )?.count ?? 0)
        : null,
    );

  federation
    .setOutboxDispatcher('/api/{identifier}/outbox', async (_ctx, id) =>
      id === identifier
        ? { items: (await getPosts()).map(postToCreate) }
        : null,
    )
    .setCounter(async (_ctx, id) =>
      id === identifier ? (await getPosts()).length : null,
    );

  federation.setObjectDispatcher(
    Note,
    '/api/activitypub/note/{id}',
    async (_ctx, { id }) => {
      const post = (await getPosts()).find(
        (post) => filePathToSlug(post.filePath) === id,
      );
      return post ? postToNote(post) : null;
    },
  );
  federation.setObjectDispatcher(
    Create,
    '/api/activitypub/create/{id}',
    async (_ctx, { id }) => {
      const post = (await getPosts()).find(
        (post) => filePathToSlug(post.filePath) === id,
      );
      return post ? postToCreate(post) : null;
    },
  );

  federation
    .setInboxListeners('/api/{identifier}/inbox')
    .on(Follow, async (ctx, activity) => {
      if (!activity.id || activity.objectId?.href !== actorURL) return;
      const actor = await activity.getActor(ctx);
      if (!actor?.id || !actor.inboxId) return;
      // A failed Accept leaves the activity retryable (Fedify marks success later).
      await ctx.sendActivity(
        { identifier },
        actor,
        new Accept({
          id: new URL(
            `${origin}/api/activitypub/accepts/follows/${encodeURIComponent(activity.id.href)}`,
          ),
          actor: new URL(actorURL),
          object: activity,
          to: actor.id,
        }),
        { immediate: true },
      );
      await createDatabase(ctx.data.ap)
        .insert(follower)
        .values({ actorId: actor.id.href, inbox: actor.inboxId.href })
        .onConflictDoUpdate({
          target: follower.actorId,
          set: { inbox: actor.inboxId.href },
        })
        .run();
    })
    .on(Undo, async (ctx, activity) => {
      const follow = await activity.getObject(ctx);
      if (
        !(follow instanceof Follow) ||
        follow.objectId?.href !== actorURL ||
        !activity.actorId ||
        follow.actorId?.href !== activity.actorId.href
      )
        return;
      await createDatabase(ctx.data.ap)
        .delete(follower)
        .where(eq(follower.actorId, activity.actorId.href))
        .run();
    });

  return federation;
}
