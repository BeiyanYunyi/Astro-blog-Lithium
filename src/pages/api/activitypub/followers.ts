import type { APIRoute } from 'astro';
import createDatabase from '@server/activitypub/database';
import follower from '@server/activitypub/schema';
import { env } from 'cloudflare:workers';
import { desc } from 'drizzle-orm';

export const GET: APIRoute = async () => {
  const db = createDatabase(env.ap);

  // try {
  const followers = await db
    .select({ actorId: follower.actorId })
    .from(follower)
    .orderBy(desc(follower.actorId))
    .all();
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

export const prerender = false;
export const ALL: APIRoute = () =>
  new Response('Method Not Allowed', {
    status: 405,
    headers: { Allow: 'GET, HEAD' },
  });

export const HEAD = GET;
