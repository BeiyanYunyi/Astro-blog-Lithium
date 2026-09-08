import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { DatabaseSync } from 'node:sqlite';
import { test } from 'node:test';
import worker from '../.wrangler/dry-run/index.js';

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

async function environment() {
  const database = new DatabaseSync(':memory:');
  database.exec(await readFile(new URL('../setup.sql', import.meta.url), 'utf8'));
  return {
    database,
    PUBLIC_KEY: JSON.stringify(publicKey),
    PRIV_KEY: JSON.stringify(privateKey),
    DELIVERY_TOKEN: 'local-test-token',
    ap: {
      prepare(sql) {
        return {
          bind: (...params) => ({
            async all() {
              const statement = database.prepare(sql);
              if (/^select/i.test(sql))
                return { results: statement.all(...params), meta: { changes: 0 } };
              const result = statement.run(...params);
              return {
                results: [],
                meta: {
                  changes: Number(result.changes),
                  last_row_id: Number(result.lastInsertRowid),
                },
              };
            },
          }),
        };
      },
    },
    ASSETS: {
      async fetch(input) {
        const request = input instanceof Request ? input : new Request(input);
        const path = new URL(request.url).pathname;
        if (path === '/api/activitypub/outbox')
          return Response.json({ orderedItems: [{ id: 'new' }, { id: 'old' }] });
        if (path.includes('missing')) return new Response('Not Found', { status: 404 });
        if (path.startsWith('/api/activitypub/note/'))
          return Response.json(
            { id: `${origin}${path}`, type: 'Note' },
            { headers: { 'Content-Type': 'application/activity+json' } },
          );
        return new Response('<html>blog</html>', {
          headers: { 'Content-Type': 'text/html', Vary: 'Accept-Encoding' },
        });
      },
    },
  };
}
const request = (path, init) => new Request(`${origin}${path}`, init);

test('WebFinger validates resources and retains the existing identity', async () => {
  const env = await environment();
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

test('content negotiation preserves slugs, quality values, HEAD and cache isolation', async () => {
  const env = await environment();
  for (const accept of [
    'application/activity+json',
    'application/ld+json; profile="https://www.w3.org/ns/activitystreams"',
    'application/json',
  ]) {
    const response = await worker.fetch(
      request('/posts/an_under_score', { headers: { Accept: accept } }),
      env,
    );
    assert.equal((await response.json()).id, `${origin}/api/activitypub/note/an_under_score`);
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
      request('/posts/an_under_score', { headers: { Accept: accept } }),
      env,
    );
    assert.match(response.headers.get('Content-Type'), /text\/html/);
    assert.equal(response.headers.get('Vary'), 'Accept-Encoding, Accept');
  }
  const redirect = await worker.fetch(
    request('/api/activitypub/note/an_under_score?from=fedi'),
    env,
  );
  assert.equal(redirect.status, 302);
  assert.equal(redirect.headers.get('Location'), '/posts/an_under_score?from=fedi');
  const head = await worker.fetch(
    request('/posts/test', { method: 'HEAD', headers: { Accept: 'application/activity+json' } }),
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

test('dynamic endpoints reject wrong methods and delivery requires its own token', async () => {
  const env = await environment();
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
      await worker.fetch(request('/api/sendToInbox', { method: 'POST' }), {
        ...env,
        DELIVERY_TOKEN: undefined,
      })
    ).status,
    503,
  );
  const head = await worker.fetch(request('/api/activitypub/actor', { method: 'HEAD' }), env);
  assert.equal(head.status, 200);
  assert.equal(await head.text(), '');
});

test('Follow, Accept, follower listing, Undo and delivery retain D1 behavior', async (t) => {
  const env = await environment();
  const remote = 'https://remote.test/users/alice';
  const deliveries = [];
  t.mock.method(globalThis, 'fetch', async (input) => {
    if (typeof input === 'string')
      return Response.json({ id: remote, inbox: 'https://remote.test/inbox' });
    deliveries.push({ body: await input.clone().json(), headers: input.headers });
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
  env.database.exec(
    "INSERT INTO follower(actorId, inbox) VALUES ('https://second.test/actor', 'https://second.test/inbox')",
  );
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
  assert.equal(
    (await worker.fetch(post({ type: 'Undo', actor: remote, object: follow }), env)).status,
    200,
  );
  assert.equal(env.database.prepare('SELECT count(*) AS count FROM follower').get().count, 1);
});

test('key generation returns a usable key pair without changing actor secrets', async () => {
  const env = await environment();
  const response = await worker.fetch(request('/api/genKeyPair/local-test'), env);
  assert.equal(response.status, 200);
  const result = await response.json();
  assert.equal(result.priv, result.priv2);
  assert.match(result.pub, /BEGIN PUBLIC KEY/);
  assert.ok(result.salt);
  assert.equal(env.PUBLIC_KEY, JSON.stringify(publicKey));
});

test('manual delivery handles empty followers and reports remote failures', async (t) => {
  const env = await environment();
  const send = () =>
    worker.fetch(
      request('/api/sendToInbox', {
        method: 'POST',
        headers: { Authorization: 'Bearer local-test-token' },
      }),
      env,
    );
  const remoteFetch = t.mock.method(
    globalThis,
    'fetch',
    async () => new Response('Failed', { status: 503 }),
  );
  assert.equal((await send()).status, 200);
  assert.equal(remoteFetch.mock.callCount(), 0);
  env.database.exec(
    "INSERT INTO follower(actorId, inbox) VALUES ('https://remote.test/actor', 'https://remote.test/inbox')",
  );
  assert.equal((await send()).status, 502);
  assert.equal(remoteFetch.mock.callCount(), 1);
});
