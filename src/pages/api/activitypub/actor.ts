/* eslint-disable import/prefer-default-export */

export const GET = () =>
  new Response(
    JSON.stringify({
      '@context': ['https://www.w3.org/ns/activitystreams', 'https://w3id.org/security/v1'],
      id: 'https://blog.yunyi.beiyan.us/api/activitypub/actor',
      type: 'Person',
      name: 'Beiyan Yunyi',
      preferredUsername: 'BeiyanYunyi',
      summary: 'Blog',
      inbox: 'https://blog.yunyi.beiyan.us/api/activitypub/inbox',
      outbox: 'https://blog.yunyi.beiyan.us/api/activitypub/outbox',
      followers: 'https://blog.yunyi.beiyan.us/api/activitypub/followers',
      icon: ['https://blog.yunyi.beiyan.us/头像圆.png'],
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
