import type { Database } from '@server/activitypub/database';
import type { Env } from '@server/activitypub/types';
import type { AP } from 'activitypub-core-types';
import type { APIRoute } from 'astro';
import actorURL from '@server/activitypub/actorURL';
import AppRequest from '@server/activitypub/AppRequest';
import createDatabase from '@server/activitypub/database';
import follower from '@server/activitypub/schema';
import { env } from 'cloudflare:workers';
import { eq } from 'drizzle-orm';

async function handleFollow(body: AP.Follow, db: Database, env: Env) {
  if (Array.isArray(body.actor)) throw new Error('Not Implemented');
  let aid = '';
  if (typeof body.actor === 'string') aid = body.actor;
  if (typeof body.actor === 'object') aid = (body.actor as unknown as { id: string }).id;
  const info: AP.Actor = await (
    await fetch(aid, { headers: { Accept: 'application/activity+json' } })
  ).json();
  await db
    .insert(follower)
    .values({ actorId: aid, inbox: info.inbox as unknown as string })
    .onConflictDoUpdate({
      target: follower.actorId,
      set: { inbox: info.inbox as unknown as string },
    })
    .run();
  const reqBody = JSON.stringify({
    '@context': 'https://www.w3.org/ns/activitystreams',
    id: `https://blog.yunyi.beiyan.us/api/activitypub/accepts/follows/${Math.floor(
      Math.random() * 10000,
    )}`,
    type: 'Accept',
    actor: actorURL,
    object: {
      id: body.id,
      type: 'Follow',
      actor: aid,
      object: actorURL,
    },
  });
  const acceptReq = new AppRequest(info.inbox as unknown as string, {
    body: reqBody,
  });
  await acceptReq.digestAndSign(env);
  await fetch(acceptReq);
  return new Response('Ok');
}

async function handleUnfollow(body: AP.Undo, db: Database) {
  if ((body.object as { type: string })?.type !== 'Follow') throw new Error('Not Implemented');
  let aid = '';
  if (typeof body.actor === 'string') aid = body.actor;
  if (typeof body.actor === 'object') aid = (body.actor as unknown as { id: string }).id;
  await db.delete(follower).where(eq(follower.actorId, aid)).run();
  return new Response('Ok');
}

export const POST: APIRoute = async (ctx) => {
  const db = createDatabase(env.ap);

  // try {
  const body: AP.Follow | AP.Undo = await ctx.request.json();
  if (typeof body.type !== 'string') throw new Error('Not Implemented');
  // if (!['Follow', 'Undo'].includes(body.type))
  //   console.error(new Error(`Not Implemented: ${body.type}`));
  switch (body.type) {
    case 'Follow':
      return handleFollow(body as AP.Follow, db, env);
    case 'Undo':
      return handleUnfollow(body as AP.Undo, db);
    default:
      console.error(new Error(`Not Implemented: ${body.type}`));
      return new Response('Ok');
  }
  // } catch (e) {
  //   return new Response('Bad Request', { status: 400 });
  // }
};

export const prerender = false;
export const ALL: APIRoute = () =>
  new Response('Method Not Allowed', {
    status: 405,
    headers: { Allow: 'POST' },
  });
