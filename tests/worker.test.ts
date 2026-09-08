import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { test } from 'node:test';
import { convertV4MiniflareOptions, Miniflare } from 'miniflare';

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
const privateKey = Buffer.from(
  await crypto.subtle.exportKey('pkcs8', keys.privateKey),
).toString('base64');
const publicKey = `-----BEGIN PUBLIC KEY-----\n${Buffer.from(await crypto.subtle.exportKey('spki', keys.publicKey)).toString('base64')}\n-----END PUBLIC KEY-----`;

async function environment(
  t,
  { realAssets = false, deliveryToken = 'local-test-token' } = {},
) {
  const env = {
    PUBLIC_KEY: JSON.stringify(publicKey),
    PRIV_KEY: JSON.stringify(privateKey),
    remoteFetch: async () =>
      new Response('Unexpected remote request', { status: 502 }),
  };
  const runtime = new Miniflare(
    convertV4MiniflareOptions({
      modules: [
        {
          type: 'ESModule',
          path: resolve('dist/server/test-entry.mjs'),
          // Miniflare's localhost transport rewrites Host even through getWorker().
          // Restore the HTTP invariant at the test boundary, before Astro/Fedify.
          contents: `import app from './entry.mjs';
          export default { ...app, fetch(request, env, ctx) {
            const headers = new Headers(request.headers);
            headers.set('Host', new URL(request.url).host);
            return app.fetch(new Request(request, { headers }), env, ctx);
          } };`,
        },
        ...(await Promise.all(
          [
            'entry.mjs',
            ...(
              await readdir('dist/server', { recursive: true })
            ).filter(
              (path) =>
                path.endsWith('.mjs') &&
                path !== 'entry.mjs' &&
                !path.startsWith('.'),
            ),
          ].map(async (path) => ({
            type: 'ESModule',
            path: resolve('dist/server', path),
            contents: await readFile(resolve('dist/server', path), 'utf8'),
          })),
        )),
      ],
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
              ASSETS: async () => {
                return new Response('Not Found', { status: 404 });
              },
            },
          }),
    }),
  );
  t.after(() => runtime.dispose());
  const database = await runtime.getD1Database('ap');
  const schema = await readFile(
    new URL('../setup.sql', import.meta.url),
    'utf8',
  );
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
    const document = await response.json();
    assert.equal(document.subject, 'acct:BeiyanYunyi@blog.yunyi.beiyan.us');
    assert.ok(document.aliases.includes('https://blog.yunyi.beiyan.us'));
    assert.ok(document.aliases.includes('https://stblog.penclub.club'));
  }
  assert.equal(
    (await worker.fetch(request('/.well-known/webfinger'), env)).status,
    400,
  );
  assert.equal(
    (
      await worker.fetch(
        request('/.well-known/webfinger?resource=acct:someone@else.test'),
        env,
      )
    ).status,
    404,
  );
  const actor = await worker.fetch(request('/api/activitypub/actor'), env);
  assert.equal(actor.headers.get('Content-Type'), 'application/activity+json');
  const profile = await actor.json();
  assert.equal(profile.id, actorId);
  assert.equal(profile.publicKey.id, `${actorId}#main-key`);
  assert.equal(profile.publicKey.owner, actorId);
  assert.equal(
    profile.publicKey.publicKeyPem.replace(/\s/g, ''),
    publicKey.replace(/\s/g, ''),
  );
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
    assert.equal(
      (await response.json()).id,
      `${origin}/api/activitypub/note/CornerOfTheWorld`,
    );
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
  assert.equal(
    redirect.headers.get('Location'),
    '/posts/CornerOfTheWorld?from=fedi',
  );
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
        request('/posts/missing', {
          headers: { Accept: 'application/activity+json' },
        }),
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
    assert.equal(
      (await worker.fetch(request(path, { method }), env)).status,
      405,
    );
  }
  assert.equal(
    (await worker.fetch(request('/api/sendToInbox', { method: 'POST' }), env))
      .status,
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
  const head = await worker.fetch(
    request('/api/activitypub/actor', { method: 'HEAD' }),
    env,
  );
  assert.equal(head.status, 200);
  assert.equal(await head.text(), '');
});

// Public literal IPs avoid DNS in Fedify's SSRF checks; outboundService intercepts all HTTP.
const remote = 'https://1.1.1.1/users/alice';
const remoteInbox = 'https://1.1.1.1/inbox';
const remoteKeys = await crypto.subtle.generateKey(
  {
    name: 'RSASSA-PKCS1-v1_5',
    modulusLength: 2048,
    publicExponent: new Uint8Array([1, 0, 1]),
    hash: 'SHA-256',
  },
  true,
  ['sign', 'verify'],
);
const remotePublicKey = `-----BEGIN PUBLIC KEY-----\n${Buffer.from(await crypto.subtle.exportKey('spki', remoteKeys.publicKey)).toString('base64')}\n-----END PUBLIC KEY-----`;

function mockRemote(t, env) {
  const deliveries = [];
  t.mock.method(env, 'remoteFetch', async (input) => {
    if (input.method === 'GET')
      return Response.json(
        {
          '@context': [
            'https://www.w3.org/ns/activitystreams',
            'https://w3id.org/security/v1',
          ],
          type: 'Person',
          id: remote,
          inbox: remoteInbox,
          publicKey: {
            id: `${remote}#main-key`,
            owner: remote,
            publicKeyPem: remotePublicKey,
          },
        },
        { headers: { 'Content-Type': 'application/activity+json' } },
      );
    deliveries.push({
      url: input.url,
      body: await input.clone().json(),
      headers: input.headers,
    });
    return new Response('Accepted', { status: 202 });
  });
  return deliveries;
}

// Construct a Cavage signature independently of Fedify's signing implementation.
async function signedActivity(
  body,
  {
    signer = remote,
    signingKey = remoteKeys.privateKey,
    path = '/api/activitypub/inbox',
    date = new Date().toUTCString(),
  } = {},
) {
  const json = JSON.stringify({
    '@context': 'https://www.w3.org/ns/activitystreams',
    ...body,
  });
  const digest = `SHA-256=${Buffer.from(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(json))).toString('base64')}`;
  const target = new URL(path, origin);
  const signed = `(request-target): post ${target.pathname}${target.search}\nhost: ${target.host}\ndate: ${date}\ndigest: ${digest}`;
  const signature = Buffer.from(
    await crypto.subtle.sign(
      'RSASSA-PKCS1-v1_5',
      signingKey,
      new TextEncoder().encode(signed),
    ),
  ).toString('base64');
  return request(path, {
    method: 'POST',
    body: json,
    headers: {
      Host: target.host,
      Date: date,
      Digest: digest,
      Signature: `keyId="${signer}#main-key",algorithm="rsa-sha256",headers="(request-target) host date digest",signature="${signature}"`,
    },
  });
}

const followActivity = (suffix = 'follow') => ({
  id: `${remote}/${suffix}`,
  type: 'Follow',
  actor: remote,
  object: actorId,
});

test('signed Follow, Accept, persistent deduplication, follower storage and Undo', async (t) => {
  const env = await environment(t);
  const deliveries = mockRemote(t, env);
  await env.database
    .prepare('INSERT INTO follower(actorId, inbox) VALUES (?, ?)')
    .bind(remote, 'https://1.1.1.1/old-inbox')
    .run();
  const original = await env.database.prepare('SELECT * FROM follower').first();
  const follow = followActivity();
  const response = await worker.fetch(await signedActivity(follow), env);
  assert.equal(response.status, 202, await response.text());
  assert.equal(deliveries[0].body.type, 'Accept');
  assert.equal(deliveries[0].body.object.id, follow.id);
  assert.equal(deliveries[0].body.actor, actorId);
  assert.ok(deliveries[0].headers.get('Signature'));
  assert.ok(
    deliveries[0].headers.get('Content-Digest') ??
      deliveries[0].headers.get('Digest'),
  );
  assert.deepEqual(
    await env.database.prepare('SELECT * FROM follower').first(),
    { ...original, inbox: remoteInbox },
  );
  const followers = await (
    await worker.fetch(request('/api/activitypub/followers'), env)
  ).json();
  assert.deepEqual(followers.orderedItems, [remote]);
  assert.equal(followers.totalItems, 1);
  assert.equal(
    (await worker.fetch(await signedActivity(follow), env)).status,
    202,
  );
  assert.equal(
    deliveries.length,
    1,
    'a repeated activity is not accepted twice',
  );
  assert.ok(
    (
      await env.database
        .prepare('SELECT count(*) AS count FROM fedify_kv')
        .first()
    ).count > 0,
  );
  const undo = {
    id: `${remote}/undo`,
    type: 'Undo',
    actor: remote,
    object: follow,
  };
  assert.equal(
    (await worker.fetch(await signedActivity(undo), env)).status,
    202,
  );
  assert.equal(
    await env.database.prepare('SELECT * FROM follower').first(),
    null,
  );
});

test('inbox rejects unsigned, forged, tampered and stale signatures', async (t) => {
  const env = await environment(t);
  const deliveries = mockRemote(t, env);
  const follow = followActivity();
  const unsigned = request('/api/activitypub/inbox', {
    method: 'POST',
    body: JSON.stringify(follow),
  });
  const forged = await signedActivity(follow, { signingKey: keys.privateKey });
  const original = await signedActivity(follow);
  const tampered = new Request(original, {
    body: JSON.stringify({ ...follow, id: `${remote}/tampered` }),
  });
  const stale = await signedActivity(follow, {
    date: 'Sat, 01 Jan 2000 00:00:00 GMT',
  });
  const impersonated = await signedActivity({
    ...follow,
    actor: 'https://9.9.9.9/actor',
  });
  for (const input of [unsigned, forged, tampered, stale, impersonated]) {
    const response = await worker.fetch(input, env);
    assert.ok(
      response.status >= 400 && response.status < 500,
      `${response.status}: ${await response.text()}`,
    );
  }
  assert.equal(
    await env.database.prepare('SELECT * FROM follower').first(),
    null,
  );
  assert.equal(deliveries.length, 0);
});

test('verified activities cannot follow another target or undo another actor follow', async (t) => {
  const env = await environment(t);
  const deliveries = mockRemote(t, env);
  await env.database
    .prepare('INSERT INTO follower(actorId, inbox) VALUES (?, ?)')
    .bind(remote, remoteInbox)
    .run();
  await worker.fetch(
    await signedActivity({
      ...followActivity('wrong-target'),
      object: 'https://9.9.9.9/actor',
    }),
    env,
  );
  await worker.fetch(
    await signedActivity({
      id: `${remote}/bad-undo`,
      type: 'Undo',
      actor: remote,
      object: { ...followActivity(), actor: 'https://9.9.9.9/actor' },
    }),
    env,
  );
  assert.equal(
    (
      await env.database
        .prepare('SELECT count(*) AS count FROM follower')
        .first()
    ).count,
    1,
  );
  assert.equal(deliveries.length, 0);
});

test('failed Accept can be retried and does not persist a follower prematurely', async (t) => {
  const env = await environment(t);
  const deliveries = mockRemote(t, env);
  const remoteFetch = env.remoteFetch;
  let fail = true;
  t.mock.method(env, 'remoteFetch', (input) =>
    fail && input.method === 'POST'
      ? new Response('Unavailable', { status: 503 })
      : remoteFetch(input),
  );
  const follow = followActivity();
  const failure = await worker.fetch(await signedActivity(follow), env);
  assert.equal(failure.status, 500, await failure.text());
  assert.equal(
    await env.database.prepare('SELECT * FROM follower').first(),
    null,
  );
  fail = false;
  const retry = await worker.fetch(await signedActivity(follow), env);
  assert.equal(retry.status, 202, await retry.text());
  assert.equal(deliveries.length, 1);
  assert.equal(
    (await env.database.prepare('SELECT * FROM follower').first()).actorId,
    remote,
  );
});

test('additive migration is repeatable and retains existing follower rows', async (t) => {
  const env = await environment(t);
  await env.database
    .prepare('INSERT INTO follower(actorId, inbox) VALUES (?, ?)')
    .bind(remote, remoteInbox)
    .run();
  const before = await env.database.prepare('SELECT * FROM follower').first();
  await env.database.exec('DROP TABLE fedify_kv');
  const sql = await readFile(
    new URL('../migrations/0001_fedify_kv.sql', import.meta.url),
    'utf8',
  );
  for (let pass = 0; pass < 2; pass++) {
    for (const statement of sql.split(';').filter((sql) => sql.trim()))
      await env.database.prepare(statement).run();
  }
  assert.deepEqual(
    await env.database.prepare('SELECT * FROM follower').first(),
    before,
  );
  assert.equal(
    (
      await env.database
        .prepare('SELECT count(*) AS count FROM fedify_kv')
        .first()
    ).count,
    0,
  );
});

test('manual delivery sends the real outbox oldest first and deduplicates inboxes', async (t) => {
  const env = await environment(t);
  const deliveries = mockRemote(t, env);
  for (const [actor, inbox] of [
    [remote, remoteInbox],
    ['https://1.1.1.1/users/bob', remoteInbox],
    ['https://8.8.8.8/actor', 'https://8.8.8.8/inbox'],
  ]) {
    await env.database
      .prepare('INSERT INTO follower(actorId, inbox) VALUES (?, ?)')
      .bind(actor, inbox)
      .run();
  }
  const outbox = await (
    await worker.fetch(request('/api/activitypub/outbox'), env)
  ).json();
  const sent = await worker.fetch(
    request('/api/sendToInbox', {
      method: 'POST',
      headers: { Authorization: 'Bearer local-test-token' },
    }),
    env,
  );
  assert.equal(sent.status, 200, await sent.clone().text());
  const expected = outbox.orderedItems.map((item) => item.id).reverse();
  assert.ok(expected.length > 0);
  for (const inbox of [remoteInbox, 'https://8.8.8.8/inbox']) {
    assert.deepEqual(
      deliveries
        .filter((item) => item.url === inbox)
        .map((item) => item.body.id),
      expected,
    );
  }
  assert.equal(deliveries.length, expected.length * 2);
});

test('key generation returns a usable key pair without changing actor secrets', async (t) => {
  const env = await environment(t);
  const response = await worker.fetch(
    request('/api/genKeyPair/local-test'),
    env,
  );
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
  const empty = await send();
  assert.equal(empty.status, 200);
  await empty.text();
  assert.equal(remoteFetch.mock.callCount(), 0);
  await env.database.exec(
    "INSERT INTO follower(actorId, inbox) VALUES ('https://1.1.1.1/actor', 'https://1.1.1.1/inbox')",
  );
  const failure = await send();
  assert.equal(failure.status, 502);
  await failure.text();
  // Fedify tries the alternate HTTP signature format before reporting failure.
  assert.equal(remoteFetch.mock.callCount(), 2);
  const attempts = await Promise.all(
    remoteFetch.mock.calls.map((call) => call.arguments[0].clone().json()),
  );
  assert.equal(attempts[0].id, attempts[1].id);
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
  assert.match(
    await sitemap.text(),
    /https:\/\/stblog.penclub.club\/posts\/CornerOfTheWorld\//,
  );
  const ogImage = (await readdir('dist/client/og-image')).find((path) =>
    path.startsWith('CornerOfTheWorld.'),
  );
  const image = await worker.fetch(request(`/og-image/${ogImage}`), env);
  assert.equal(image.status, 200);
  assert.equal(image.headers.get('Content-Type'), 'image/png');
  const outbox = await worker.fetch(request('/api/activitypub/outbox'), env);
  assert.equal(outbox.headers.get('Content-Type'), 'application/activity+json');
  assert.ok((await outbox.json()).orderedItems.length > 0);
  const create = await worker.fetch(
    request('/api/activitypub/create/CornerOfTheWorld'),
    env,
  );
  assert.equal((await create.json()).type, 'Create');
  const missing = await worker.fetch(
    request('/posts/missing_under_score'),
    env,
  );
  assert.equal(missing.status, 404);
  const encoded = await worker.fetch(
    request('/posts/%43ornerOfTheWorld/', {
      headers: { Accept: 'application/activity+json' },
    }),
    env,
  );
  assert.equal(
    (await encoded.json()).id,
    `${origin}/api/activitypub/note/CornerOfTheWorld`,
  );
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
