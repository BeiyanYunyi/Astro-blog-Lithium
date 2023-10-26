/* eslint-disable import/no-extraneous-dependencies */
/* eslint-disable import/prefer-default-export */
import { Kysely } from 'kysely';
import { D1Dialect } from 'kysely-d1';
import { Database, Env } from './types';

export const onRequestGet: PagesFunction<Env> = async (ctx) => {
  const db = new Kysely<Database>({ dialect: new D1Dialect({ database: ctx.env.ap }) });
  // await db.insertInto('follower').values({ actorId: '114514', inbox: '1919810' }).execute();

  // try {
  const followers = await db.selectFrom('follower').select('actorId').execute();
  const followersArray = followers.map((follower) => follower.actorId);
  return new Response(
    JSON.stringify({
      '@context': 'https://www.w3.org/ns/activitystreams',
      id: 'https://blog.yunyi.beiyan.us/api/activitypub/followers',
      type: 'OrderedCollection',
      totalItems: followersArray.length,
      orderedItems: followersArray,
    }),
    { headers: { 'Content-Type': 'application/activity+json' } },
  );
  // } catch (e) {
  //   return new Response('Bad Request', { status: 400 });
  // }
};
