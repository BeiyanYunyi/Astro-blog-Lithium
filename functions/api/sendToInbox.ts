/* eslint-disable import/prefer-default-export */
import { Kysely } from 'kysely';
import { D1Dialect } from 'kysely-d1';
import { Database, Env } from '../src/types';
import AppRequest from '../src/utils/AppRequest';
import { getPrivateKey } from '../src/utils/getKey';

export const onRequestPost: PagesFunction<Env> = async (ctx) => {
  const body = await ctx.request.json();
  if (body !== getPrivateKey(ctx.env)) return new Response('Bad Request', { status: 400 });
  const db = new Kysely<Database>({ dialect: new D1Dialect({ database: ctx.env.ap }) });
  const follower = await db
    .selectFrom('follower')
    .select('inbox')
    .orderBy('actorId desc')
    .executeTakeFirst();
  const res = await ctx.env.ASSETS.fetch('https://blog.yunyi.beiyan.us/api/activitypub/outbox');
  const json: { orderedItems: unknown[] } = await res.json();
  const reqs = json.orderedItems
    .map((item) => new AppRequest(follower.inbox, { body: JSON.stringify(item) }))
    .reverse();
  for await (const req of reqs) {
    await req.digestAndSign(ctx.env);
    await fetch(req);
  }
  return new Response(JSON.stringify(json.orderedItems), {
    headers: { 'Content-Type': 'application/activity+json' },
  });
};
