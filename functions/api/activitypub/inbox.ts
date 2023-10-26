import type { AP } from 'activitypub-core-types';
import { Kysely } from 'kysely';
import { D1Dialect } from 'kysely-d1';

interface FollowerTable {
  actorId: string;
  inbox: string;
}

interface Database {
  follower: FollowerTable;
}

/* eslint-disable import/prefer-default-export */

interface Env {
  ap: D1Database;
}

const handleFollow = async (body: AP.Follow, db: Kysely<Database>) => {
  if (Array.isArray(body.actor)) throw new Error('');
  let aid = '';
  if (typeof body.actor === 'string') aid = body.actor;
  if (typeof body.actor === 'object') aid = (body.actor as unknown as { id: string }).id;
  const info: AP.Actor = await (await fetch(aid)).json();
  await db
    .insertInto('follower')
    .values({ actorId: aid, inbox: info.inbox as unknown as string })
    .onConflict((oc) =>
      oc.column('actorId').doUpdateSet({ inbox: info.inbox as unknown as string }),
    )
    .execute();
  return new Response('Ok');
};

const handleUnfollow = async (body: AP.Undo) => {};

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
    // case 'Undo':
    //   return await handleUnfollow(body as AP.Undo);
    default:
      throw new Error('Not Implemented');
  }
  // } catch (e) {
  //   return new Response('Bad Request', { status: 400 });
  // }
};
