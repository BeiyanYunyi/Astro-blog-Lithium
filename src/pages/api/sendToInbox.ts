import type { APIRoute } from 'astro';
import AppRequest from '@server/activitypub/AppRequest';
import createDatabase from '@server/activitypub/database';
import follower from '@server/activitypub/schema';
import { env } from 'cloudflare:workers';
import { desc } from 'drizzle-orm';

export const POST: APIRoute = async (ctx) => {
  if (!env.DELIVERY_TOKEN)
    return new Response('Delivery is not configured', { status: 503 });
  if (
    ctx.request.headers.get('Authorization') !== `Bearer ${env.DELIVERY_TOKEN}`
  )
    return new Response('Unauthorized', { status: 401 });
  const db = createDatabase(env.ap);
  const followers = await db
    .select({ inbox: follower.inbox })
    .from(follower)
    .orderBy(desc(follower.actorId))
    .all();
  const outbox = new URL('/api/activitypub/outbox', ctx.request.url);
  const res = await env.ASSETS.fetch(outbox.toString());
  if (!res.ok) return new Response('Outbox unavailable', { status: 502 });
  const json: { orderedItems: unknown[] } = await res.json();
  for (const inbox of new Set(followers.map((follower) => follower.inbox))) {
    for (const item of [...json.orderedItems].reverse()) {
      const req = new AppRequest(inbox, { body: JSON.stringify(item) });
      await req.digestAndSign(env);
      const delivery = await fetch(req);
      if (!delivery.ok) return new Response('Delivery failed', { status: 502 });
    }
  }
  return new Response(JSON.stringify(json.orderedItems), {
    headers: { 'Content-Type': 'application/activity+json' },
  });
};

export const prerender = false;
export const ALL: APIRoute = () =>
  new Response('Method Not Allowed', {
    status: 405,
    headers: { Allow: 'POST' },
  });
