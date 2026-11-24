import { env } from 'cloudflare:workers';
import { revokeTrapHit, wallPath } from '@server/crawlerTrap';
import type { APIRoute } from 'astro';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  let token = '';
  try {
    const value = (await request.formData()).get('token');
    if (typeof value === 'string') token = value;
  } catch {
    return new Response('Bad Request', { status: 400 });
  }
  const revoked = await revokeTrapHit(env.ap, token);
  return new Response(null, {
    status: 303,
    headers: {
      Location: `${wallPath}?revoked=${revoked ? 'ok' : 'missing'}`,
      'Cache-Control': 'no-store',
    },
  });
};

export const ALL: APIRoute = () =>
  new Response('Method Not Allowed', {
    status: 405,
    headers: { Allow: 'POST' },
  });
