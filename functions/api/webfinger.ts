import type { WorkerHandler } from '../src/types';

export const webfinger: WorkerHandler = ({ request }) => {
  const resource = new URL(request.url).searchParams.get('resource');
  const resources = new Set([
    'acct:BeiyanYunyi@blog.yunyi.beiyan.us',
    'acct:BeiyanYunyi@stblog.penclub.club',
    'https://blog.yunyi.beiyan.us/api/activitypub/actor',
    'https://blog.yunyi.beiyan.us',
    'https://stblog.penclub.club',
  ]);
  if (!resource) return new Response('Missing resource', { status: 400 });
  if (!resources.has(resource)) return new Response('Not Found', { status: 404 });
  return new Response(
    JSON.stringify({
      subject: 'acct:BeiyanYunyi@blog.yunyi.beiyan.us',
      aliases: ['https://blog.yunyi.beiyan.us', 'https://stblog.penclub.club'],
      links: [
        {
          rel: 'http://webfinger.net/rel/profile-page',
          type: 'text/html',
          href: 'https://blog.yunyi.beiyan.us/intro',
        },
        {
          rel: 'self',
          type: 'application/activity+json',
          href: 'https://blog.yunyi.beiyan.us/api/activitypub/actor',
        },
        // {
        //   rel: 'http://ostatus.org/schema/1.0/subscribe',
        //   template: '',
        // },
        {
          rel: 'http://webfinger.net/rel/avatar',
          type: 'image/png',
          href: 'https://blog.yunyi.beiyan.us/头像方.png',
        },
      ],
    }),
    { headers: { 'Content-Type': 'application/jrd+json' } },
  );
};
