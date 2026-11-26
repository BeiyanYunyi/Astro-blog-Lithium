import { env } from 'cloudflare:workers';
import {
  isOpenVisit,
  recordTrapStep,
  verifyTurnstile,
} from '@server/crawlerTrap';
import type { APIRoute } from 'astro';

export const prerender = false;

const noContent = () =>
  new Response(null, { status: 204, headers: { 'Cache-Control': 'no-store' } });

/**
 * Beacons from trap pages. `step=js` means the page ran its script,
 * `step=token` carries a Turnstile token to verify, and `step=error` reports
 * a client-side Turnstile error code. Unknown or expired visits are ignored.
 */
export const POST: APIRoute = async ({ request, url, clientAddress }) => {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return new Response('Bad Request', { status: 400 });
  }
  const field = (name: string) => {
    const value = form.get(name);
    return typeof value === 'string' ? value : '';
  };
  const visit = field('visit');
  const step = field('step');
  if (!(await isOpenVisit(env.ap, visit))) return noContent();

  if (step === 'js') {
    await recordTrapStep(env.ap, visit, 'js');
  } else if (step === 'error') {
    const code =
      field('code')
        .slice(0, 32)
        .replace(/[^\w-]/g, '') || 'unknown';
    await recordTrapStep(env.ap, visit, 'ts_fail', { source: 'client', code });
  } else if (step === 'token') {
    const token = field('token');
    if (!env.TURNSTILE_SECRET_KEY || !token || token.length > 2048)
      return new Response('Bad Request', { status: 400 });
    const { passed, codes } = await verifyTurnstile(
      env.TURNSTILE_SECRET_KEY,
      token,
      visit,
      url.hostname,
      clientAddress,
    );
    await recordTrapStep(
      env.ap,
      visit,
      passed ? 'ts_pass' : 'ts_fail',
      passed ? null : { source: 'siteverify', codes },
    );
  } else {
    return new Response('Bad Request', { status: 400 });
  }
  return noContent();
};

export const ALL: APIRoute = () =>
  new Response('Method Not Allowed', {
    status: 405,
    headers: { Allow: 'POST' },
  });
