/* eslint-disable import/prefer-default-export */
import type { AP } from 'activitypub-core-types';
import { Kysely } from 'kysely';
import { D1Dialect } from 'kysely-d1';
import type { Database, Env } from './types';

const handleFollow = async (body: AP.Follow, db: Kysely<Database>) => {
  if (Array.isArray(body.actor)) throw new Error('Not Implemented');
  let aid = '';
  if (typeof body.actor === 'string') aid = body.actor;
  if (typeof body.actor === 'object') aid = (body.actor as unknown as { id: string }).id;
  const info: AP.Actor = await (
    await fetch(aid, { headers: { Accept: 'application/activity+json' } })
  ).json();
  await db
    .insertInto('follower')
    .values({ actorId: aid, inbox: info.inbox as unknown as string })
    .onConflict((oc) =>
      oc.column('actorId').doUpdateSet({ inbox: info.inbox as unknown as string }),
    )
    .execute();
  await fetch(info.inbox as unknown as string, {
    method: 'post',
    headers: { 'Content-Type': 'application/activity+json', Accept: 'application/activity+json' },
    body: JSON.stringify({
      '@context': 'https://www.w3.org/ns/activitystreams',
      id: `https://blog.yunyi.beiyan.us/api/activitypub/accepts/follows/${Math.floor(
        Math.random() * 10000,
      )}`,
      type: 'Accept',
      actor: 'https://blog.yunyi.beiyan.us/api/activitypub/actor',
      object: {
        id: body.id,
        type: 'Follow',
        actor: aid,
        object: 'https://blog.yunyi.beiyan.us/api/activitypub/actor',
      },
    }),
  });
  return new Response('Ok');
};

const handleUnfollow = async (body: AP.Undo, db: Kysely<Database>) => {
  if ((body.object as { type: string })?.type !== 'Follow') throw new Error('Not Implemented');
  let aid = '';
  if (typeof body.actor === 'string') aid = body.actor;
  if (typeof body.actor === 'object') aid = (body.actor as unknown as { id: string }).id;
  await db.deleteFrom('follower').where('actorId', '=', aid).execute();
  return new Response('Ok');
};

export const onRequestPost: PagesFunction<Env> = async (ctx) => {
  const db = new Kysely<Database>({ dialect: new D1Dialect({ database: ctx.env.ap }) });
  // await db.insertInto('follower').values({ actorId: '114514', inbox: '1919810' }).execute();

  // try {
  const body: AP.Follow | AP.Undo = await ctx.request.json();
  if (typeof body.type !== 'string') throw new Error('Not Implemented');
  if (!['Follow', 'Undo'].includes(body.type)) throw new Error('Not Implemented');
  switch (body.type) {
    case 'Follow':
      return handleFollow(body as AP.Follow, db);
    case 'Undo':
      return handleUnfollow(body as AP.Undo, db);
    default:
      throw new Error('Not Implemented');
  }
  // } catch (e) {
  //   return new Response('Bad Request', { status: 400 });
  // }
};
