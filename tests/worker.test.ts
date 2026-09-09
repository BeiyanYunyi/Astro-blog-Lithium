import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { test } from 'node:test';
import { convertV4MiniflareOptions, Miniflare } from 'miniflare';

const worker = {
  async fetch(request, env) {
    const response = await env.runtime.dispatchFetch(request.url, {
      method: request.method,
      headers: request.headers,
      body: request.body,
      duplex: 'half',
      redirect: 'manual',
    });
    await drain(env);
    return response;
  },
};

// Real Miniflare producers deliver to a capture handler; tests drive the built
// consumer explicitly so retries and crashes can be tested without wall-clock backoff.
async function drain(env) {
  const runtimeWorker = await env.runtime.getWorker();
  for (let i = 0; i < 200; i++) {
    await new Promise((resolve) => setTimeout(resolve, 30));
    if (!env.queued.length) return;
    const message = env.queued.shift();
    const result = await runtimeWorker.queue('test-drain', [
      { ...message, timestamp: new Date(message.timestamp) },
    ]);
    assert.equal(result.outcome, 'ok');
    assert.equal(result.retryMessages.length, 0, JSON.stringify(result));
  }
  assert.fail('Queue did not drain');
}

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
    queued: [],
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
          export default { ...app, async queue(batch, env, ctx) {
            if (batch.queue === 'blog-federation') {
              await env.QUEUE_CAPTURE.fetch('https://capture.test/', {
                method: 'POST', body: JSON.stringify(batch.messages.map(m => ({
                  id: m.id, timestamp: m.timestamp, attempts: m.attempts, body: m.body
                })))
              });
            } else { await app.queue(batch, env, ctx); }
          }, fetch(request, env, ctx) {
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
      queueProducers: { FEDERATION_QUEUE: 'blog-federation' },
      queueConsumers: {
        'blog-federation': { maxBatchSize: 1, maxBatchTimeout: 0 },
      },
      serviceBindings: {
        QUEUE_CAPTURE: async (request) => {
          env.queued.push(...(await request.json()));
          return new Response('Captured');
        },
        ...(!realAssets
          ? { ASSETS: async () => new Response('Not Found', { status: 404 }) }
          : {}),
      },
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
        : {}),
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

test('signed comments persist once, enforce ownership, apply newer edits and retain deletion tombstones', async (t) => {
  const env = await environment(t);
  mockRemote(t, env);
  const note = {
    id: `${remote}/notes/reply`,
    type: 'Note',
    attributedTo: remote,
    inReplyTo: `${origin}/api/activitypub/note/CornerOfTheWorld`,
    content: '<p>First reply</p>',
    published: '2026-09-01T00:00:00Z',
  };
  let sequence = 0;
  const receive = async (type, object) => {
    const response = await worker.fetch(
      await signedActivity({
        id: `${remote}/comments/${sequence++}`,
        type,
        actor: remote,
        object,
      }),
      env,
    );
    assert.equal(response.status, 202, await response.text());
  };
  const stored = () =>
    env.database
      .prepare('SELECT * FROM ap_comment WHERE id = ?')
      .bind(note.id)
      .first();
  await receive('Create', note);
  const original = await stored();
  assert.equal(original.post_id, 'CornerOfTheWorld');
  assert.equal(original.author_id, remote);
  assert.equal(original.content, '<p>First reply</p>');
  await receive('Create', { ...note, content: 'Duplicate must not overwrite' });
  assert.deepEqual(await stored(), original);
  for (const object of [
    {
      ...note,
      id: `${remote}/notes/unknown`,
      inReplyTo: `${origin}/api/activitypub/note/missing`,
    },
    {
      ...note,
      id: `${remote}/notes/external`,
      inReplyTo: 'https://9.9.9.9/note',
    },
    { ...note, id: 'https://9.9.9.9/forged', attributedTo: remote },
    {
      ...note,
      id: `${remote}/notes/forged`,
      attributedTo: 'https://9.9.9.9/actor',
    },
  ])
    await receive('Create', object);
  assert.equal(
    (
      await env.database
        .prepare('SELECT count(*) AS count FROM ap_comment')
        .first()
    ).count,
    1,
  );
  // A valid signature is insufficient to edit or delete a different author's stored object.
  await env.database
    .prepare('UPDATE ap_comment SET author_id = ? WHERE id = ?')
    .bind(`${remote}/bob`, note.id)
    .run();
  await receive('Update', {
    ...note,
    content: 'Forged edit',
    updated: '2026-09-03T00:00:00Z',
  });
  await receive('Delete', note.id);
  assert.equal((await stored()).content, original.content);
  assert.equal((await stored()).deleted_at, null);
  await env.database
    .prepare('UPDATE ap_comment SET author_id = ? WHERE id = ?')
    .bind(remote, note.id)
    .run();
  await receive('Update', {
    ...note,
    content: '<p>Edited</p>',
    updated: '2026-09-03T00:00:00Z',
  });
  await receive('Update', {
    ...note,
    content: 'Stale edit',
    updated: '2026-09-02T00:00:00Z',
  });
  assert.equal((await stored()).content, '<p>Edited</p>');
  await receive('Delete', { id: note.id, type: 'Tombstone' });
  assert.ok((await stored()).deleted_at);
  assert.equal((await stored()).content, '');
  await receive('Create', note);
  await receive('Update', {
    ...note,
    content: 'Resurrected',
    updated: '2026-09-04T00:00:00Z',
  });
  assert.equal((await stored()).content, '');
  assert.ok((await stored()).deleted_at);
});

test('comment Create and Update sanitize HTML before persisting in D1', async (t) => {
  const env = await environment(t);
  mockRemote(t, env);
  const cases = [
    [
      '<p>Hello &amp; 你好<br><span class="h-card mention arbitrary invisible">@user</span></p>',
      '<p>Hello &amp; 你好<br><span class="h-card mention invisible">@user</span></p>',
    ],
    [
      '<p id="x" style="color:red" onclick="alert(1)">Hi<img src=x onerror=alert(1)></p>',
      '<p>Hi</p>',
    ],
    [
      '<a href="https://example.com/?a=1&amp;b=2" target="_blank" ping="https://evil.example" rel="opener">link</a>',
      '<a href="https://example.com/?a=1&amp;b=2" rel="nofollow noopener noreferrer">link</a>',
    ],
    [
      '<a href="mailto:hello@example.com">email</a>',
      '<a href="mailto:hello@example.com" rel="nofollow noopener noreferrer">email</a>',
    ],
    [
      '<a href="JaVaScRiPt:alert(1)">bad</a><a href="jav&#x61;script:alert(1)">entity</a><a href="java\nscript:alert(1)">newline</a>',
      '<a>bad</a><a>entity</a><a>newline</a>',
    ],
    [
      '<a href="data:text/html,bad">data</a><a href="//evil.example">relative</a><a href="/local">local</a>',
      '<a>data</a><a>relative</a><a>local</a>',
    ],
    [
      '<!-- hidden --><script><img src=x onerror=alert(1)></script><style>bad</style><iframe srcdoc="bad">bad</iframe><p>safe</p>',
      '<p>safe</p>',
    ],
    [
      '<svg><a href="javascript:alert(1)">bad</a></svg><math><mtext>bad</mtext></math><template>bad</template><p>safe</p>',
      '<p>safe</p>',
    ],
    [
      '<noscript><img src=x onerror=alert(1)></noscript><xmp><img src=x onerror=alert(1)></xmp><p>safe</p>',
      '<p>safe</p>',
    ],
    ['<div><strong>Readable</strong> text</div>', 'Readable text'],
    ['', ''],
  ];
  for (const [index, [content, expected]] of cases.entries()) {
    const note = {
      id: `${remote}/notes/sanitize-${index}`,
      type: 'Note',
      attributedTo: remote,
      inReplyTo: `${origin}/api/activitypub/note/CornerOfTheWorld`,
      published: '2026-09-01T00:00:00Z',
      content,
    };
    for (const type of ['Create', 'Update']) {
      if (type === 'Update') {
        await env.database
          .prepare('UPDATE ap_comment SET content = ? WHERE id = ?')
          .bind('Before edit', note.id)
          .run();
      }
      const response = await worker.fetch(
        await signedActivity({
          id: `${remote}/sanitize/${index}/${type}`,
          type,
          actor: remote,
          object: {
            ...note,
            ...(type === 'Update' ? { updated: '2026-09-02T00:00:00Z' } : {}),
          },
        }),
        env,
      );
      assert.equal(response.status, 202, await response.text());
      const row = await env.database
        .prepare('SELECT content FROM ap_comment WHERE id = ?')
        .bind(note.id)
        .first();
      assert.equal(row?.content, expected, `${type} case ${index}`);
    }
  }
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

test('Accept is queued and a failed delivery requests retry without losing the follower', async (t) => {
  const env = await environment(t);
  const deliveries = mockRemote(t, env);
  const input = await signedActivity(followActivity());
  const response = await env.runtime.dispatchFetch(input.url, {
    method: input.method,
    headers: input.headers,
    body: input.body,
    duplex: 'half',
  });
  assert.equal(response.status, 202);
  assert.equal(
    deliveries.length,
    0,
    'HTTP inbox response does not wait for outbound delivery',
  );
  await new Promise((resolve) => setTimeout(resolve, 100));
  const runtimeWorker = await env.runtime.getWorker();
  const incoming = env.queued.shift();
  assert.ok(incoming);
  const received = await runtimeWorker.queue('test-drain', [
    { ...incoming, timestamp: new Date(incoming.timestamp) },
  ]);
  assert.equal(received.retryMessages.length, 0);
  await new Promise((resolve) => setTimeout(resolve, 100));
  const outgoing = env.queued.shift();
  assert.ok(outgoing);
  assert.equal(
    (await env.database.prepare('SELECT * FROM follower').first()).actorId,
    remote,
  );
  const remoteFetch = env.remoteFetch;
  t.mock.method(
    env,
    'remoteFetch',
    async () => new Response('Unavailable', { status: 503 }),
  );
  const failed = await runtimeWorker.queue('test-drain', [
    { ...outgoing, timestamp: new Date(outgoing.timestamp) },
  ]);
  assert.equal(failed.retryMessages.length, 1);
  assert.equal(failed.explicitAcks.length, 0);
  t.mock.method(env, 'remoteFetch', remoteFetch);
  const retried = await runtimeWorker.queue('test-drain', [
    { ...outgoing, attempts: 2, timestamp: new Date(outgoing.timestamp) },
  ]);
  assert.equal(retried.retryMessages.length, 0);
  assert.equal(deliveries.length, 1);
  assert.equal(deliveries[0].body.type, 'Accept');
});

test('additive migration is repeatable and retains existing follower rows', async (t) => {
  const env = await environment(t);
  await env.database
    .prepare('INSERT INTO follower(actorId, inbox) VALUES (?, ?)')
    .bind(remote, remoteInbox)
    .run();
  const before = await env.database.prepare('SELECT * FROM follower').first();
  await env.database.exec('DROP TABLE fedify_kv');
  const sql = (
    await Promise.all(
      ['0001_fedify_kv.sql', '0002_comments_publications.sql'].map((name) =>
        readFile(new URL(`../migrations/${name}`, import.meta.url), 'utf8'),
      ),
    )
  ).join('\n');
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

const scan = async (env) => {
  const result = await (await env.runtime.getWorker()).scheduled({
    cron: '*/5 * * * *',
  });
  assert.equal(result.outcome, 'ok');
};

test('cron baselines history, discovers new posts, pages distinct inboxes and does not resend completed posts', async (t) => {
  const env = await environment(t);
  const deliveries = mockRemote(t, env);
  await scan(env);
  await drain(env);
  const baseline = await env.database
    .prepare('SELECT * FROM ap_publication')
    .all();
  assert.ok(baseline.results.length > 25);
  assert.ok(baseline.results.every((row) => row.status === 'baseline'));
  assert.equal(deliveries.length, 0);
  // Simulate a newly deployed post by removing it from the initial snapshot.
  await env.database
    .prepare('DELETE FROM ap_publication WHERE post_id = ?')
    .bind('CornerOfTheWorld')
    .run();
  for (let i = 0; i < 28; i++) {
    await env.database
      .prepare('INSERT INTO follower(actorId, inbox) VALUES (?, ?)')
      .bind(
        `https://1.1.1.1/users/${i}`,
        `https://1.1.1.1/inbox/${String(i).padStart(2, '0')}`,
      )
      .run();
  }
  await env.database
    .prepare('INSERT INTO follower(actorId, inbox) VALUES (?, ?)')
    .bind('https://1.1.1.1/users/duplicate', 'https://1.1.1.1/inbox/00')
    .run();
  await scan(env);
  await new Promise((resolve) => setTimeout(resolve, 100));
  assert.equal(deliveries.length, 0);
  const task = env.queued.shift();
  assert.equal(task.body.type, 'blog-publish');
  const result = await (await env.runtime.getWorker()).queue('test-drain', [
    { ...task, timestamp: new Date(task.timestamp) },
  ]);
  assert.equal(result.retryMessages.length, 0);
  const partial = await env.database
    .prepare("SELECT * FROM ap_publication WHERE post_id = 'CornerOfTheWorld'")
    .first();
  assert.equal(partial.status, 'pending');
  assert.equal(partial.cursor, 'https://1.1.1.1/inbox/24');
  assert.equal(
    deliveries.length,
    0,
    'fan-out enqueues deliveries without performing HTTP requests',
  );
  await new Promise((resolve) => setTimeout(resolve, 100));
  const continuation = env.queued.find(
    (message) => message.body.type === 'blog-publish',
  );
  assert.ok(continuation);
  // Simulate losing the continuation after committing the first page's cursor.
  env.queued = env.queued.filter((message) => message !== continuation);
  await drain(env);
  assert.equal(deliveries.length, 25);
  await scan(env);
  await drain(env);
  assert.equal(deliveries.length, 28);
  assert.equal(new Set(deliveries.map((item) => item.url)).size, 28);
  assert.ok(
    deliveries.every(
      (item) =>
        item.body.id === `${origin}/api/activitypub/create/CornerOfTheWorld`,
    ),
  );
  assert.ok(deliveries.every((item) => item.headers.get('Signature')));
  assert.equal(
    (
      await env.database
        .prepare(
          "SELECT status FROM ap_publication WHERE post_id = 'CornerOfTheWorld'",
        )
        .first()
    ).status,
    'complete',
  );
  await scan(env);
  await drain(env);
  // Cloudflare can redeliver an already completed job.
  await (await env.runtime.getWorker()).queue('test-drain', [
    { ...task, timestamp: new Date(task.timestamp), attempts: 2 },
  ]);
  await drain(env);
  assert.equal(deliveries.length, 28);
});

test('scans cap publication jobs at five and removed source posts do not block later work', async (t) => {
  const env = await environment(t);
  await scan(env);
  await env.database
    .prepare(
      "UPDATE ap_publication SET status = 'pending' WHERE post_id IN (SELECT post_id FROM ap_publication LIMIT 6)",
    )
    .run();
  await env.database
    .prepare(
      "INSERT INTO ap_publication(post_id, status, created_at) VALUES ('missing-source', 'pending', '0000')",
    )
    .run();
  await scan(env);
  await new Promise((resolve) => setTimeout(resolve, 100));
  assert.equal(env.queued.length, 5);
  await drain(env);
  assert.equal(
    (
      await env.database
        .prepare(
          "SELECT status FROM ap_publication WHERE post_id = 'missing-source'",
        )
        .first()
    ).status,
    'cancelled',
  );
  assert.equal(
    (
      await env.database
        .prepare(
          "SELECT count(*) AS count FROM ap_publication WHERE status = 'pending'",
        )
        .first()
    ).count,
    2,
  );
  await scan(env);
  await drain(env);
  assert.equal(
    (
      await env.database
        .prepare(
          "SELECT count(*) AS count FROM ap_publication WHERE status = 'pending'",
        )
        .first()
    ).count,
    0,
  );
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

test('manual wake-up returns 202 and does not resend history, including with no followers', async (t) => {
  const env = await environment(t);
  const deliveries = mockRemote(t, env);
  const response = await worker.fetch(
    request('/api/sendToInbox', {
      method: 'POST',
      headers: { Authorization: 'Bearer local-test-token' },
    }),
    env,
  );
  assert.equal(response.status, 202);
  assert.deepEqual(await response.json(), { queued: 0 });
  assert.equal(deliveries.length, 0);
  await env.database
    .prepare("DELETE FROM ap_publication WHERE post_id = 'CornerOfTheWorld'")
    .run();
  await scan(env);
  await drain(env);
  assert.equal(
    (
      await env.database
        .prepare(
          "SELECT status FROM ap_publication WHERE post_id = 'CornerOfTheWorld'",
        )
        .first()
    ).status,
    'complete',
  );
  assert.equal(deliveries.length, 0);
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
