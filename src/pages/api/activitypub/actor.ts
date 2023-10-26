/* eslint-disable import/prefer-default-export */

export const GET = () =>
  new Response(
    JSON.stringify({
      '@context': ['https://www.w3.org/ns/activitystreams', 'https://w3id.org/security/v1'],
      id: 'https://blog.yunyi.beiyan.us/api/activitypub/actor',
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
        { type: 'Image', mediaType: 'image/png', url: 'https://blog.yunyi.beiyan.us/头像方.png' },
      ],
      discoverable: true,
      indexable: true,
      published: '2018-05-31T00:00:00Z',
      publicKey: {
        id: 'https://blog.yunyi.beiyan.us/api/activitypub/actor#main-key',
        owner: 'https://blog.yunyi.beiyan.us/api/activitypub/actor',
        publicKeyPem: `-----BEGIN PUBLIC KEY-----
        MCowBQYDK2VwAyEAK32mZ6NHWvErlVDNipED0uv0WoxpHvcL2OWCQ/mCLBw=
        -----END PUBLIC KEY-----`,
      },
    }),
    { headers: { 'Content-Type': 'application/activity+json' } },
  );
