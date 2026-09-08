import { defineMiddleware } from 'astro:middleware';

// Only explicit JSON representations opt in; ordinary browser requests stay HTML.
function wantsActivity(request: Request): boolean {
  const accepted = (request.headers.get('Accept') ?? '')
    .split(',')
    .map((entry) => {
      const [type, ...parameters] = entry.trim().toLowerCase().split(';');
      const quality = parameters.find((parameter) =>
        parameter.trim().startsWith('q='),
      );
      return { type, quality: quality ? Number(quality.trim().slice(2)) : 1 };
    });
  const json = Math.max(
    0,
    ...accepted
      .filter((entry) =>
        [
          'application/activity+json',
          'application/ld+json',
          'application/json',
        ].includes(entry.type),
      )
      .map((entry) => entry.quality),
  );
  const html = Math.max(
    0,
    ...accepted
      .filter((entry) => entry.type === 'text/html')
      .map((entry) => entry.quality),
  );
  return json > 0 && json >= html;
}

function varyAccept(response: Response): Response {
  const result = new Response(response.body, response);
  const vary = result.headers.get('Vary');
  if (
    !vary?.split(',').some((value) => value.trim().toLowerCase() === 'accept')
  )
    result.headers.set('Vary', vary ? `${vary}, Accept` : 'Accept');
  // Cloudflare's default cache key does not distinguish Accept representations.
  result.headers.set('Cache-Control', 'no-store');
  return result;
}

export const onRequest = defineMiddleware(
  async ({ request, url, isPrerendered, rewrite }, next) => {
    // Build-time middleware must not negotiate or access runtime bindings.
    if (isPrerendered) return next();
    const path = url.pathname.replace(/\/$/, '');
    const post = path.match(/^\/posts\/(.+)$/);
    const note = path.match(/^\/api\/activitypub\/note\/(.+)$/);
    if (!(post || note) || !['GET', 'HEAD'].includes(request.method))
      return next();
    const target = new URL(url);
    if (post && wantsActivity(request)) {
      target.pathname = `/api/activitypub/note/${post[1]}`;
      const response = varyAccept(await rewrite(new Request(target, request)));
      if (response.ok)
        response.headers.set('Content-Type', 'application/activity+json');
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
    return varyAccept(await next());
  },
);
