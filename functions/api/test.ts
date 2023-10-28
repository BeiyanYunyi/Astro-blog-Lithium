/* eslint-disable import/prefer-default-export */
import { Kysely } from 'kysely';
import { D1Dialect } from 'kysely-d1';
import { Database, Env } from '../src/types';
import AppRequest from '../src/utils/AppRequest';

export const onRequestGet: PagesFunction<Env> = async (ctx) => {
  const db = new Kysely<Database>({ dialect: new D1Dialect({ database: ctx.env.ap }) });
  const follower = await db
    .selectFrom('follower')
    .select('inbox')
    .orderBy('actorId desc')
    .executeTakeFirst();
  const res = await ctx.env.ASSETS.fetch('https://blog.yunyi.beiyan.us/api/activitypub/outbox');
  const json: { orderedItems: unknown[] } = await res.json();
  const reqs = json.orderedItems.map(
    (item) => new AppRequest(follower.inbox, { body: JSON.stringify(item) }),
  );
  for await (const req of reqs) {
    await req.digestAndSign(ctx.env);
    const es = await fetch(req);
    console.log(await es.json());
  }
  return new Response(JSON.stringify(json.orderedItems), {
    headers: { 'Content-Type': 'application/activity+json' },
  });
};
