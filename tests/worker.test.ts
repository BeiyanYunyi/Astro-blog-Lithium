import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { test } from 'node:test';
import { resolve } from 'node:path';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';

const worker = {
  fetch(request, env) {
    return env.runtime.dispatchFetch(request.url, {
      method: request.method,
      headers: request.headers,
      body: request.body,
      duplex: 'half',
      redirect: 'manual',
    });
  },
};

const origin = 'https://blog.yunyi.beiyan.us';
const actorId = `${origin}/api/activitypub/actor`;
const keys = await crypto.subtle.generateKey(
  {
    name: 'RSASSA-PKCS1-v1_5',
    modulusLength: 2048,
    publicExponent: new Uint8Array([1, 0, 1]),
    hash: 'SHA-256',
  },
  true,
  ['sign', 'verify'],
);
const privateKey = Buffer.from(await crypto.subtle.exportKey('pkcs8', keys.privateKey)).toString(
  'base64',
);
const publicKey = `-----BEGIN PUBLIC KEY-----\n${Buffer.from(await crypto.subtle.exportKey('spki', keys.publicKey)).toString('base64')}\n-----END PUBLIC KEY-----`;

async function environment(t, { realAssets = false, deliveryToken = 'local-test-token' } = {}) {
  const env = {
    PUBLIC_KEY: JSON.stringify(publicKey),
    PRIV_KEY: JSON.stringify(privateKey),
    remoteFetch: async () => new Response('Unexpected remote request', { status: 502 }),
  };
  const runtime = new Miniflare(
    convertV4MiniflareOptions({
      modules: await Promise.all(
        [
          'entry.mjs',
          ...(await readdir('dist/server', { recursive: true })).filter(
            (path) => path.endsWith('.mjs') && path !== 'entry.mjs' && !path.startsWith('.'),
          ),
        ].map(async (path) => ({
          type: 'ESModule',
          path: resolve('dist/server', path),
          contents: await readFile(resolve('dist/server', path), 'utf8'),
        })),
      ),
      modulesRoot: resolve('dist/server'),
      compatibilityDate: '2026-08-27',
      compatibilityFlags: ['nodejs_compat'],
      bindings: {
        PUBLIC_KEY: env.PUBLIC_KEY,
        PRIV_KEY: env.PRIV_KEY,
        ...(deliveryToken ? { DELIVERY_TOKEN: deliveryToken } : {}),
      },
      d1Databases: ['ap'],
      outboundService: (request) => env.remoteFetch(request),
      ...(realAssets
        ? {
            assets: {
              directory: resolve('dist/client'),
              binding: 'ASSETS',
              routerConfig: { has_user_worker: true },
              run_worker_first: [
                '/.well-known/webfinger',
                '/.well-known/webfinger/',
                '/api/*',
                '/posts/*',
              ],
              assetConfig: { not_found_handling: '404-page' },
            },
          }
        : {
            serviceBindings: {
              ASSETS: async (request) => {
                const path = new URL(request.url).pathname;
                if (path === '/api/activitypub/outbox')
                  return Response.json({ orderedItems: [{ id: 'new' }, { id: 'old' }] });
                return new Response('Not Found', { status: 404 });
              },
            },
          }),
    }),
  );
  t.after(() => runtime.dispose());
  const database = await runtime.getD1Database('ap');
  const schema = await readFile(new URL('../setup.sql', import.meta.url), 'utf8');
  for (const sql of schema.split(';').filter((sql) => sql.trim()))
    await database.prepare(sql).run();
  return Object.assign(env, { runtime, database });
}
const request = (path, init = {}) => {
  const headers = new Headers(init.headers);
  if (init.method === 'POST' && !headers.has('Content-Type'))
    headers.set('Content-Type', 'application/activity+json');
  return new Request(`${origin}${path}`, { ...init, headers });
};

test('WebFinger validates resources and retains the existing identity', async (t) => {
  const env = await environment(t);
  for (const domain of ['blog.yunyi.beiyan.us', 'stblog.penclub.club']) {
    const response = await worker.fetch(
      request(`/.well-known/webfinger?resource=acct:BeiyanYunyi@${domain}`),
      env,
    );
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('Content-Type'), 'application/jrd+json');
    assert.equal((await response.json()).subject, 'acct:BeiyanYunyi@blog.yunyi.beiyan.us');
  }
  assert.equal((await worker.fetch(request('/.well-known/webfinger'), env)).status, 400);
  assert.equal(
    (await worker.fetch(request('/.well-known/webfinger?resource=acct:someone@else.test'), env))
      .status,
    404,
  );
  const actor = await worker.fetch(request('/api/activitypub/actor'), env);
  assert.equal(actor.headers.get('Content-Type'), 'application/activity+json');
  assert.equal((await actor.json()).publicKey.publicKeyPem, publicKey);
});

test('content negotiation preserves slugs, quality values, HEAD and cache isolation', async (t) => {
  const env = await environment(t, { realAssets: true });
  for (const accept of [
    'application/activity+json',
    'application/ld+json; profile="https://www.w3.org/ns/activitystreams"',
    'application/json',
  ]) {
    const response = await worker.fetch(
      request('/posts/CornerOfTheWorld', { headers: { Accept: accept } }),
      env,
    );
    assert.equal(response.status, 200, await response.clone().text());
    assert.equal((await response.json()).id, `${origin}/api/activitypub/note/CornerOfTheWorld`);
    assert.equal(response.headers.get('Vary'), 'Accept');
    assert.equal(response.headers.get('Cache-Control'), 'no-store');
  }
  for (const accept of [
    'text/html',
    '*/*',
    'application/activity+json;q=0',
    'text/html, application/activity+json;q=0.5',
  ]) {
    const response = await worker.fetch(
      request('/posts/CornerOfTheWorld', { headers: { Accept: accept } }),
      env,
    );
    assert.match(response.headers.get('Content-Type'), /text\/html/);
    assert.equal(response.headers.get('Vary'), 'Accept');
  }
  const redirect = await worker.fetch(
    request('/api/activitypub/note/CornerOfTheWorld?from=fedi'),
    env,
  );
  assert.equal(redirect.status, 302);
  assert.equal(redirect.headers.get('Location'), '/posts/CornerOfTheWorld?from=fedi');
  const head = await worker.fetch(
    request('/posts/CornerOfTheWorld', {
      method: 'HEAD',
      headers: { Accept: 'application/activity+json' },
    }),
    env,
  );
  assert.equal(await head.text(), '');
  assert.equal(head.headers.get('Content-Type'), 'application/activity+json');
  assert.equal(
    (
      await worker.fetch(
        request('/posts/missing', { headers: { Accept: 'application/activity+json' } }),
        env,
      )
    ).status,
    404,
  );
});

test('dynamic endpoints reject wrong methods and delivery requires its own token', async (t) => {
  const env = await environment(t);
  for (const [path, method] of [
    ['/api/activitypub/inbox', 'GET'],
    ['/api/activitypub/actor', 'POST'],
    ['/api/sendToInbox', 'GET'],
    ['/api/genKeyPair/test', 'POST'],
  ]) {
    assert.equal((await worker.fetch(request(path, { method }), env)).status, 405);
  }
  assert.equal(
    (await worker.fetch(request('/api/sendToInbox', { method: 'POST' }), env)).status,
    401,
  );
  assert.equal(
    (
      await worker.fetch(
        request('/api/sendToInbox', { method: 'POST' }),
        await environment(t, { deliveryToken: null }),
      )
    ).status,
    503,
  );
  const head = await worker.fetch(request('/api/activitypub/actor', { method: 'HEAD' }), env);
  assert.equal(head.status, 200);
  assert.equal(await head.text(), '');
});

test('Follow, Accept, follower listing, Undo and delivery retain D1 behavior', async (t) => {
  const env = await environment(t);
  const remote = 'https://remote.test/users/alice';
  let remoteInbox = 'https://remote.test/inbox';
  const deliveries = [];
  t.mock.method(env, 'remoteFetch', async (input) => {
    if (input.method === 'GET') return Response.json({ id: remote, inbox: remoteInbox });
    deliveries.push({ url: input.url, body: await input.clone().json(), headers: input.headers });
    return new Response('Accepted', { status: 202 });
  });
  const follow = { id: `${remote}/follow`, type: 'Follow', actor: remote, object: actorId };
  const post = (body) =>
    request('/api/activitypub/inbox', { method: 'POST', body: JSON.stringify(body) });
  assert.equal((await worker.fetch(post(follow), env)).status, 200);
  assert.equal(deliveries[0].body.type, 'Accept');
  assert.ok(deliveries[0].headers.get('Signature'));
  assert.ok(deliveries[0].headers.get('Digest'));
  const followers = await (await worker.fetch(request('/api/activitypub/followers'), env)).json();
  assert.deepEqual(followers.orderedItems, [remote]);
  const originalFollower = await env.database.prepare('SELECT * FROM follower').first();
  remoteInbox = 'https://remote.test/updated-inbox';
  assert.equal((await worker.fetch(post(follow), env)).status, 200);
  assert.deepEqual(
    await env.database
      .prepare('SELECT * FROM follower')
      .all()
      .then((r) => r.results),
    [{ ...originalFollower, inbox: remoteInbox }],
  );
  await env.database.exec(
    "INSERT INTO follower(actorId, inbox) VALUES ('https://second.test/actor', 'https://second.test/inbox')",
  );
  await env.database
    .prepare('INSERT INTO follower(actorId, inbox) VALUES (?, ?)')
    .bind('https://remote.test/users/bob', remoteInbox)
    .run();
  const updatedFollowers = await (
    await worker.fetch(request('/api/activitypub/followers'), env)
  ).json();
  assert.equal(updatedFollowers.totalItems, 3);
  assert.deepEqual(updatedFollowers.orderedItems, [
    'https://second.test/actor',
    'https://remote.test/users/bob',
    remote,
  ]);
  deliveries.length = 0;
  const sent = await worker.fetch(
    request('/api/sendToInbox', {
      method: 'POST',
      headers: { Authorization: 'Bearer local-test-token' },
    }),
    env,
  );
  assert.equal(sent.status, 200);
  assert.deepEqual(
    deliveries.map((item) => item.body.id),
    ['old', 'new', 'old', 'new'],
  );
  assert.deepEqual(
    deliveries.map((item) => item.url),
    ['https://second.test/inbox', 'https://second.test/inbox', remoteInbox, remoteInbox],
  );
  assert.equal(
    (await worker.fetch(post({ type: 'Undo', actor: remote, object: follow }), env)).status,
    200,
  );
  assert.equal(
    (await env.database.prepare('SELECT count(*) AS count FROM follower').first()).count,
    2,
  );
  assert.equal(
    await env.database.prepare('SELECT * FROM follower WHERE actorId = ?').bind(remote).first(),
    null,
  );
});

test('key generation returns a usable key pair without changing actor secrets', async (t) => {
  const env = await environment(t);
  const response = await worker.fetch(request('/api/genKeyPair/local-test'), env);
  assert.equal(response.status, 200);
  const result = await response.json();
  assert.equal(result.priv, result.priv2);
  assert.match(result.pub, /BEGIN PUBLIC KEY/);
  assert.ok(result.salt);
  assert.equal(env.PUBLIC_KEY, JSON.stringify(publicKey));
});

test('manual delivery handles empty followers and reports remote failures', async (t) => {
  const env = await environment(t);
  const send = () =>
    worker.fetch(
      request('/api/sendToInbox', {
        method: 'POST',
        headers: { Authorization: 'Bearer local-test-token' },
      }),
      env,
    );
  const remoteFetch = t.mock.method(
    env,
    'remoteFetch',
    async () => new Response('Failed', { status: 503 }),
  );
  assert.equal((await send()).status, 200);
  assert.equal(remoteFetch.mock.callCount(), 0);
  await env.database.exec(
    "INSERT INTO follower(actorId, inbox) VALUES ('https://remote.test/actor', 'https://remote.test/inbox')",
  );
  assert.equal((await send()).status, 502);
  assert.equal(remoteFetch.mock.callCount(), 1);
});

test('static pages, RSS, sitemap, OG images and Markdown/MDX remain available', async (t) => {
  const env = await environment(t, { realAssets: true });
  for (const path of [
    '/',
    '/tags/',
    '/tags/杂谈/',
    '/posts/CornerOfTheWorld',
    '/posts/removeHexo',
  ]) {
    const response = await worker.fetch(request(path), env);
    assert.equal(response.status, 200, path);
    const html = await response.text();
    assert.match(html, /<html/);
    if (path.startsWith('/posts/')) {
      assert.match(html, /<article/);
      assert.ok(html.includes(path), 'article keeps its public URL');
    }
  }
  const rss = await worker.fetch(request('/rss.xml'), env);
  assert.equal(rss.status, 200);
  assert.match(await rss.text(), /<rss/);
  const sitemap = await worker.fetch(request('/sitemap-0.xml'), env);
  assert.equal(sitemap.status, 200);
  assert.match(await sitemap.text(), /https:\/\/stblog.penclub.club\/posts\/CornerOfTheWorld\//);
  const ogImage = (await readdir('dist/client/og-image')).find((path) =>
    path.startsWith('CornerOfTheWorld.'),
  );
  const image = await worker.fetch(request(`/og-image/${ogImage}`), env);
  assert.equal(image.status, 200);
  assert.equal(image.headers.get('Content-Type'), 'image/png');
  const outbox = await worker.fetch(request('/api/activitypub/outbox'), env);
  assert.equal(outbox.headers.get('Content-Type'), 'application/activity+json');
  assert.ok((await outbox.json()).orderedItems.length > 0);
  const create = await worker.fetch(request('/api/activitypub/create/CornerOfTheWorld'), env);
  assert.equal((await create.json()).type, 'Create');
  const missing = await worker.fetch(request('/posts/missing_under_score'), env);
  assert.equal(missing.status, 404);
  const encoded = await worker.fetch(
    request('/posts/%43ornerOfTheWorld/', {
      headers: { Accept: 'application/activity+json' },
    }),
    env,
  );
  assert.equal((await encoded.json()).id, `${origin}/api/activitypub/note/CornerOfTheWorld`);
});

test('Astro retains Origin protection for form-like and headerless POST requests', async (t) => {
  const env = await environment(t);
  for (const headers of [{}, { 'Content-Type': 'text/plain' }]) {
    const response = await worker.fetch(
      new Request(`${origin}/api/sendToInbox`, {
        method: 'POST',
        headers: { ...headers, Authorization: 'Bearer local-test-token' },
      }),
      env,
    );
    assert.equal(response.status, 403);
  }
});
