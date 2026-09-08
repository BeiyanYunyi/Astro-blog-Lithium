/* eslint-disable import/prefer-default-export */
import { Kysely } from 'kysely';
import { D1Dialect } from 'kysely-d1';
import type { Database, WorkerHandler } from '../src/types';
import AppRequest from '../src/utils/AppRequest';

export const onRequestPost: WorkerHandler = async (ctx) => {
  if (!ctx.env.DELIVERY_TOKEN) return new Response('Delivery is not configured', { status: 503 });
  if (ctx.request.headers.get('Authorization') !== `Bearer ${ctx.env.DELIVERY_TOKEN}`)
    return new Response('Unauthorized', { status: 401 });
  const db = new Kysely<Database>({ dialect: new D1Dialect({ database: ctx.env.ap }) });
  const followers = await db
    .selectFrom('follower')
    .select('inbox')
    .orderBy('actorId desc')
    .execute();
  const outbox = new URL('/api/activitypub/outbox', ctx.request.url);
  const res = await ctx.env.ASSETS.fetch(outbox.toString());
  if (!res.ok) return new Response('Outbox unavailable', { status: 502 });
  const json: { orderedItems: unknown[] } = await res.json();
  for (const inbox of new Set(followers.map(follower => follower.inbox))) {
    for (const item of [...json.orderedItems].reverse()) {
      const req = new AppRequest(inbox, { body: JSON.stringify(item) });
      await req.digestAndSign(ctx.env);
      const delivery = await fetch(req);
      if (!delivery.ok) return new Response('Delivery failed', { status: 502 });
    }
  }
  return new Response(JSON.stringify(json.orderedItems), {
    headers: { 'Content-Type': 'application/activity+json' },
  });
};
