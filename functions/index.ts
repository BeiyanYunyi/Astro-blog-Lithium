import type { Env, WorkerHandler } from './src/types';
import { onRequestGet as actor } from './api/activitypub/actor';
import { onRequestGet as followers } from './api/activitypub/followers';
import { onRequestPost as inbox } from './api/activitypub/inbox';
import { onRequestGet as generateKey } from './api/genKeyPair/[key]';
import { onRequestPost as sendToInbox } from './api/sendToInbox';
import { webfinger } from './api/webfinger';

// Only explicit JSON representations opt in; ordinary browser requests stay HTML.
function wantsActivity(request: Request): boolean {
  const accepted = (request.headers.get('Accept') ?? '').split(',').map((entry) => {
    const [type, ...parameters] = entry.trim().toLowerCase().split(';');
    const quality = parameters.find((parameter) => parameter.trim().startsWith('q='));
    return { type, quality: quality ? Number(quality.trim().slice(2)) : 1 };
  });
  const json = Math.max(
    0,
    ...accepted
      .filter((entry) =>
        ['application/activity+json', 'application/ld+json', 'application/json'].includes(
          entry.type,
        ),
      )
      .map((entry) => entry.quality),
  );
  const html = Math.max(
    0,
    ...accepted.filter((entry) => entry.type === 'text/html').map((entry) => entry.quality),
  );
  return json > 0 && json >= html;
}

function varyAccept(response: Response): Response {
  const result = new Response(response.body, response);
  const vary = result.headers.get('Vary');
  if (!vary?.split(',').some((value) => value.trim().toLowerCase() === 'accept'))
    result.headers.set('Vary', vary ? `${vary}, Accept` : 'Accept');
  // Cloudflare's default cache key does not distinguish Accept representations.
  result.headers.set('Cache-Control', 'no-store');
  return result;
}

async function route(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname.replace(/\/$/, '');
  let handler: WorkerHandler | undefined;
  let method = 'GET';
  const params: Record<string, string> = {};
  switch (path) {
    case '/.well-known/webfinger':
      handler = webfinger;
      break;
    case '/api/activitypub/actor':
      handler = actor;
      break;
    case '/api/activitypub/followers':
      handler = followers;
      break;
    case '/api/activitypub/inbox':
      handler = inbox;
      method = 'POST';
      break;
    case '/api/sendToInbox':
      handler = sendToInbox;
      method = 'POST';
      break;
    default: {
      const key = path.match(/^\/api\/genKeyPair\/([^/]+)$/);
      if (key) {
        try {
          params.key = decodeURIComponent(key[1]);
        } catch {
          return new Response('Bad Request', { status: 400 });
        }
        handler = generateKey;
      }
    }
  }
  if (handler) {
    if (request.method !== method && !(method === 'GET' && request.method === 'HEAD'))
      return new Response('Method Not Allowed', {
        status: 405,
        headers: { Allow: method === 'GET' ? 'GET, HEAD' : method },
      });
    return handler({ request, env, params });
  }

  const post = path.match(/^\/posts\/(.+)$/);
  const note = path.match(/^\/api\/activitypub\/note\/(.+)$/);
  if ((post || note) && ['GET', 'HEAD'].includes(request.method)) {
    // Slugs are generated from file basenames; underscores are literal characters.
    const target = new URL(url);
    if (post && wantsActivity(request)) {
      target.pathname = `/api/activitypub/note/${post[1]}`;
      const asset = await env.ASSETS.fetch(new Request(target, request));
      const response = varyAccept(asset);
      if (response.ok) response.headers.set('Content-Type', 'application/activity+json');
      return response;
    }
    if (note && !wantsActivity(request)) {
      target.pathname = `/posts/${note[1]}`;
      return varyAccept(
        new Response(null, {
          status: 302,
          headers: { Location: target.pathname + target.search },
        }),
      );
    }
    return varyAccept(await env.ASSETS.fetch(request));
  }
  return env.ASSETS.fetch(request);
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    try {
      const response = await route(request, env);
      return request.method === 'HEAD' ? new Response(null, response) : response;
    } catch (error) {
      // Do not expose request bodies, keys, or remote actor documents in errors.
      console.error('Worker request failed', error instanceof Error ? error.name : 'UnknownError');
      return new Response('Internal Server Error', { status: 500 });
    }
  },
} satisfies ExportedHandler<Env>;
