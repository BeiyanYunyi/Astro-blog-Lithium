import { env } from 'cloudflare:workers';
import {
  createBlogFederation,
  getPosts,
  identifier,
  origin,
} from '@server/activitypub/federation';
import postToCreate from '@utils/noteToCreate';
import type { APIRoute } from 'astro';

export const POST: APIRoute = async ({ request }) => {
  if (!env.DELIVERY_TOKEN)
    return new Response('Delivery is not configured', { status: 503 });
  if (request.headers.get('Authorization') !== `Bearer ${env.DELIVERY_TOKEN}`)
    return new Response('Unauthorized', { status: 401 });
  const ctx = createBlogFederation(env).createContext(new URL(origin), env);
  const activities = (await getPosts()).map(postToCreate);
  try {
    for (const activity of [...activities].reverse()) {
      await ctx.sendActivity({ identifier }, 'followers', activity, {
        immediate: true,
      });
    }
  } catch {
    return new Response('Delivery failed', { status: 502 });
  }
  return Response.json(
    await Promise.all(activities.map((activity) => activity.toJsonLd())),
    {
      headers: { 'Content-Type': 'application/activity+json' },
    },
  );
};

export const prerender = false;
export const ALL: APIRoute = () =>
  new Response('Method Not Allowed', {
    status: 405,
    headers: { Allow: 'POST' },
  });
