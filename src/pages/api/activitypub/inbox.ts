import type { APIRoute } from 'astro';

export { handleFederation as POST } from '@server/activitypub/handler';
export const prerender = false;
export const ALL: APIRoute = () =>
  new Response('Method Not Allowed', {
    status: 405,
    headers: { Allow: 'POST' },
  });
