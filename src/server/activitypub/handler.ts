import { env } from 'cloudflare:workers';
import type { APIRoute } from 'astro';
import { createBlogFederation, webFingerResources } from './federation';

export const handleFederation: APIRoute = async ({ request }) => {
  const url = new URL(request.url);
  const webFinger =
    url.pathname.replace(/\/$/, '') === '/.well-known/webfinger';
  if (webFinger) {
    const resource = url.searchParams.get('resource');
    if (!resource) return new Response('Missing resource', { status: 400 });
    if (!webFingerResources.has(resource))
      return new Response('Not Found', { status: 404 });
    // Fedify validates acct hosts before alias mapping. Canonicalize our explicit aliases.
    url.searchParams.set('resource', 'acct:BeiyanYunyi@blog.yunyi.beiyan.us');
  }
  // Normalize only read requests; incoming signatures cover the original URL.
  const headers = new Headers(request.headers);
  if (request.method !== 'POST')
    headers.set('Accept', 'application/activity+json');
  if (request.method !== 'POST') url.pathname = url.pathname.replace(/\/$/, '');
  const response = await createBlogFederation(env).fetch(
    new Request(url, {
      method: request.method === 'HEAD' ? 'GET' : request.method,
      headers,
      body: request.body,
    }),
    {
      contextData: env,
      onNotFound: () => new Response('Not Found', { status: 404 }),
    },
  );
  if (webFinger && response.ok) {
    const document = (await response.json()) as { aliases?: string[] };
    document.aliases = [
      ...new Set([
        ...(document.aliases ?? []),
        'https://blog.yunyi.beiyan.us',
        'https://stblog.penclub.club',
      ]),
    ];
    return new Response(
      request.method === 'HEAD' ? null : JSON.stringify(document),
      {
        status: response.status,
        headers: {
          ...Object.fromEntries(response.headers),
          'Cache-Control': 'no-store',
        },
      },
    );
  }
  const result = new Response(
    request.method === 'HEAD' ? null : response.body,
    response,
  );
  result.headers.set('Cache-Control', 'no-store');
  return result;
};

export const readOnly: APIRoute = () =>
  new Response('Method Not Allowed', {
    status: 405,
    headers: { Allow: 'GET, HEAD' },
  });
