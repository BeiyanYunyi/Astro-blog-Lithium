import { env } from 'cloudflare:workers';
import { scanPublications } from '@server/activitypub/publications';
import type { APIRoute } from 'astro';

export const POST: APIRoute = async ({ request }) => {
  if (!env.DELIVERY_TOKEN)
    return new Response('Delivery is not configured', { status: 503 });
  if (request.headers.get('Authorization') !== `Bearer ${env.DELIVERY_TOKEN}`)
    return new Response('Unauthorized', { status: 401 });
  const result = await scanPublications(env);
  return Response.json(result, { status: 202 });
};

export const prerender = false;
export const ALL: APIRoute = () =>
  new Response('Method Not Allowed', {
    status: 405,
    headers: { Allow: 'POST' },
  });
