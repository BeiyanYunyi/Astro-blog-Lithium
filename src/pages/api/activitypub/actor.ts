import { env } from 'cloudflare:workers';

import actorURL from '@server/activitypub/actorURL';
import type { APIRoute } from 'astro';

export const GET: APIRoute = () =>
  new Response(
    JSON.stringify({
      '@context': [
        'https://www.w3.org/ns/activitystreams',
        'https://w3id.org/security/v1',
      ],
      id: actorURL,
      type: 'Person',
      name: '北雁云依',
      preferredUsername: 'BeiyanYunyi',
      summary:
        '<p>北雁云依的博客<br />拿去吧，你可以假戏真做<br />君子协定：内容默认可自由转发，特别注明除外</p>',
      inbox: 'https://blog.yunyi.beiyan.us/api/activitypub/inbox',
      outbox: 'https://blog.yunyi.beiyan.us/api/activitypub/outbox',
      followers: 'https://blog.yunyi.beiyan.us/api/activitypub/followers',
      attachment: [
        { type: 'PropertyValue', name: '立场', value: '泛左翼缝合' },
        {
          type: 'PropertyValue',
          name: '爱好',
          value: '百科知识。人文社科自然科学计算机科学',
        },
        {
          type: 'PropertyValue',
          name: '博客',
          value:
            '\u003ca href="https://blog.yunyi.beiyan.us" target="_blank" rel="nofollow noopener noreferrer me" translate="no"\u003e\u003cspan class="invisible"\u003ehttps://\u003c/span\u003e\u003cspan class=""\u003eblog.yunyi.beiyan.us\u003c/span\u003e\u003cspan class="invisible"\u003e\u003c/span\u003e\u003c/a\u003e',
        },
      ],
      icon: [
        {
          type: 'Image',
          mediaType: 'image/png',
          url: 'https://blog.yunyi.beiyan.us/头像方.png',
        },
      ],
      manuallyApprovesFollowers: false,
      discoverable: true,
      indexable: true,
      published: '2018-05-31T00:00:00Z',
      publicKey: {
        id: `${actorURL}#main-key`,
        owner: actorURL,
        publicKeyPem: JSON.parse(env.PUBLIC_KEY),
      },
    }),
    { headers: { 'Content-Type': 'application/activity+json' } },
  );

export const prerender = false;
export const ALL: APIRoute = () =>
  new Response('Method Not Allowed', {
    status: 405,
    headers: { Allow: 'GET, HEAD' },
  });

export const HEAD = GET;
