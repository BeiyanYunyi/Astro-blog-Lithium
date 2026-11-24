import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import { DatabaseSync } from 'node:sqlite';
import { test } from 'node:test';
import {
  Create,
  Delete,
  Note,
  Person,
  PUBLIC_COLLECTION,
  Update,
} from '@fedify/vocab';
import { Temporal } from 'temporal-polyfill';

// Exercise the actual registered handlers and SQL, without an Astro build or
// network. Sanitization is a controllable async boundary, not under test here.
let sanitize = async (value: string) => value;
const sanitizerKey = Symbol.for('blog.commentVisibility.test.sanitize');
(globalThis as any)[sanitizerKey] = (value: string) => sanitize(value);
const directory = new URL('../src/server/activitypub/', import.meta.url).href;
const hooks = registerHooks({
  resolve(specifier, context, nextResolve) {
    const stubs: Record<string, string> = {
      'astro:content':
        "export const getCollection = async () => [{ filePath: 'post' }];",
      '@utils/idToSlug': 'export const filePathToSlug = value => value;',
      './sanitize':
        "export const sanitizeCommentContent = value => globalThis[Symbol.for('blog.commentVisibility.test.sanitize')](value);",
    };
    if (context.parentURL?.startsWith(directory)) {
      if (specifier in stubs) {
        return {
          shortCircuit: true,
          url: `data:text/javascript,${encodeURIComponent(stubs[specifier])}`,
        };
      }
      if (specifier.startsWith('./')) specifier += '.ts';
    }
    return nextResolve(specifier, context);
  },
});
const { registerCommentListeners } =
  await import('../src/server/activitypub/comments.ts');
const { registerCommentRefresh, readComments } =
  await import('../src/server/activitypub/commentRefresh.ts');
hooks.deregister();

// D1's prepared-statement API backed by real SQLite. raw() preserves Drizzle's
// selected column order; numbered parameters support the production KV SQL.
function d1(sqlite: DatabaseSync) {
  function prepare(query: string, values: any[] = []) {
    function statement() {
      const parameters: any[] = [];
      let index = 0;
      const sql = query.replace(/\?(\d+)?/g, (_, number) => {
        parameters.push(values[number ? Number(number) - 1 : index++]);
        return '?';
      });
      return { stmt: sqlite.prepare(sql), parameters };
    }
    return {
      bind(...bound: any[]) {
        return prepare(query, bound);
      },
      async first() {
        const { stmt, parameters } = statement();
        return stmt.get(...parameters) ?? null;
      },
      async all() {
        const { stmt, parameters } = statement();
        return { results: stmt.all(...parameters), success: true };
      },
      async raw() {
        const { stmt, parameters } = statement();
        stmt.setReturnArrays(true);
        return stmt.all(...parameters);
      },
      async run() {
        const { stmt, parameters } = statement();
        return {
          meta: { changes: Number(stmt.run(...parameters).changes) },
          success: true,
        };
      },
    };
  }
  return {
    prepare,
    async batch(statements: ReturnType<typeof prepare>[]) {
      sqlite.exec('BEGIN');
      try {
        const results = [];
        for (const statement of statements) results.push(await statement.run());
        sqlite.exec('COMMIT');
        return results;
      } catch (error) {
        sqlite.exec('ROLLBACK');
        throw error;
      }
    },
  };
}

const id = new URL('https://remote.example/notes/comment');
const author = new Person({
  id: new URL('https://remote.example/users/author'),
  name: 'Author',
});
const parent = new URL('https://blog.example/posts/post');
const t0 = '2026-01-01T00:00:00Z';
const t1 = '2026-01-02T00:00:00Z';
const t2 = '2026-01-03T00:00:00Z';
const t3 = '2026-01-04T00:00:00Z';
function note(isPublic: boolean, updated: string | null, content = 'body') {
  return new Note({
    id,
    attribution: author.id,
    replyTarget: parent,
    content,
    tos: isPublic ? [PUBLIC_COLLECTION] : [author.id!],
    updated: updated ? Temporal.Instant.from(updated) : null,
  });
}
function deferred<T = void>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
function fixture(t: any) {
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec(readFileSync(new URL('../setup.sql', import.meta.url), 'utf8'));
  t.after(() => sqlite.close());
  const handlers = new Map<any, any>();
  const listeners = {
    on(type: any, handler: any) {
      handlers.set(type, handler);
      return listeners;
    },
  };
  registerCommentListeners(listeners as any);
  let refresh!: (ctx: any, id: string) => Promise<void>;
  const task = registerCommentRefresh(
    {
      defineTask(_name: string, options: any) {
        refresh = options.handler;
        return options;
      },
    } as any,
    'blog',
  );
  const ctx: any = {
    data: { ap: d1(sqlite) },
    parseUri: (uri: URL) =>
      uri.href === parent.href
        ? { type: 'object', class: Note, values: { id: 'post' } }
        : null,
    lookupObject: async () => note(true, t0),
    getDocumentLoader: async () => async () => {
      throw new Error('Unexpected network');
    },
    enqueueTask: async () => {},
  };
  const row = () => ({
    ...sqlite.prepare('SELECT * FROM ap_comment WHERE id = ?').get(id.href),
  });
  const seed = (legacy = false) => {
    sqlite
      .prepare(
        `INSERT INTO ap_comment (id, post_id, author_id, author_name, in_reply_to, content, published_at, updated_at${legacy ? '' : ', is_public, mutation_version'}) VALUES (?, ?, ?, ?, ?, ?, ?, ?${legacy ? '' : ', 1, 1'})`,
      )
      .run(
        id.href,
        'post',
        author.id!.href,
        'Author',
        parent.href,
        'original',
        t0,
        t0,
      );
  };
  return {
    sqlite,
    ctx,
    row,
    seed,
    update: (value: Note, published?: string) =>
      handlers.get(Update)(
        ctx,
        new Update({
          actor: author,
          object: value,
          published: published ? Temporal.Instant.from(published) : null,
        }),
      ),
    create: (value: Note) =>
      handlers.get(Create)(ctx, new Create({ actor: author, object: value })),
    delete: () =>
      handlers.get(Delete)(ctx, new Delete({ actor: author, object: id })),
    refresh: (value: Note) => {
      ctx.lookupObject = async () => value;
      return refresh(ctx, id.href);
    },
    runRefresh: () => refresh(ctx, id.href),
    visible: () => readComments(ctx, task, 'post'),
    clearFreshness: () => sqlite.exec('DELETE FROM fedify_kv'),
    fresh: () =>
      sqlite.prepare('SELECT count(*) AS count FROM fedify_kv').get()!.count,
  };
}

test('Create records known visibility and starts its mutation version', async (t) => {
  const f = fixture(t);
  await f.create(note(false, null));
  assert.equal(f.row().is_public, 0);
  assert.equal(f.row().mutation_version, 1);
  assert.equal(f.row().undated_revocation, 1);
  assert.deepEqual(await f.visible(), []);
});

for (const timestamp of [t0, null]) {
  test(`restricted inbox Update (${timestamp ?? 'undated'}) survives equal and older public refreshes`, async (t) => {
    const f = fixture(t);
    f.seed();
    await f.update(note(false, timestamp, 'private'));
    assert.equal(f.row().updated_at, t0);
    assert.equal(f.row().mutation_version, 2);
    for (const old of ['2025-12-31T00:00:00Z', t0]) {
      await f.refresh(note(true, old, 'stale public'));
      assert.equal(f.row().is_public, 0);
      assert.equal(f.row().content, 'original');
      assert.deepEqual(await f.visible(), []);
      f.clearFreshness();
    }
  });
}

test('undated withdrawal blocks later fetch until a newer signed public Update', async (t) => {
  const f = fixture(t);
  f.seed();
  await f.update(note(false, null));
  await f.refresh(note(true, t2, 'newer fetch'));
  assert.equal(f.row().is_public, 0);
  assert.equal(f.row().undated_revocation, 1);
  await f.update(note(true, t0, 'equal signed update'));
  assert.equal(f.row().is_public, 0);
  await f.update(note(true, t3, 'authorized republication'));
  assert.equal(f.row().is_public, 1);
  assert.equal(f.row().undated_revocation, 0);
  assert.equal(f.row().content, 'authorized republication');
  assert.equal((await f.visible()).length, 1);
});

test('dated revocation retains its high-watermark and requires strictly newer hydration', async (t) => {
  const f = fixture(t);
  f.seed();
  await f.update(note(false, t2, 'private version'));
  await f.update(note(false, t1, 'older private version'));
  assert.equal(f.row().updated_at, t2);
  assert.equal(f.row().content, 'private version');
  await f.refresh(note(true, t2));
  assert.equal(f.row().is_public, 0);
  f.clearFreshness();
  await f.refresh(note(true, t3, 'republished'));
  assert.equal(f.row().is_public, 1);
  assert.equal(f.row().content, 'republished');
});

test('activity published timestamp versions a restricted Update', async (t) => {
  const f = fixture(t);
  f.seed();
  await f.update(note(false, null), t1);
  assert.equal(f.row().undated_revocation, 0);
  assert.equal(f.row().updated_at, t1);
  await f.refresh(note(true, t2));
  assert.equal(f.row().is_public, 1);
});

test('true legacy default revision zero permits equal-time hydration', async (t) => {
  const f = fixture(t);
  f.seed(true);
  assert.equal(f.row().mutation_version, 0);
  assert.equal(f.row().is_public, 0);
  await f.refresh(note(true, t0, 'verified legacy'));
  assert.equal(f.row().is_public, 1);
  assert.equal(f.row().mutation_version, 1);
  assert.equal(f.row().content, 'verified legacy');
});

for (const mutation of ['restricted Update', 'public Update', 'Delete']) {
  for (const fetchedPublic of [false, true]) {
    test(`delayed ${fetchedPublic ? 'public' : 'restricted'} refresh cannot overwrite ${mutation} or mark freshness`, async (t) => {
      const f = fixture(t);
      f.seed();
      const entered = deferred();
      const fetched = deferred<Note>();
      f.ctx.lookupObject = async () => {
        entered.resolve();
        return fetched.promise;
      };
      const pending = f.runRefresh();
      await entered.promise;
      if (mutation === 'Delete') await f.delete();
      else
        await f.update(note(mutation === 'public Update', t1, 'inbox winner'));
      const winner = f.row();
      fetched.resolve(note(fetchedPublic, t3, 'delayed fetch'));
      await assert.rejects(pending, /Comment changed during revalidation/);
      assert.deepEqual(f.row(), winner);
      assert.equal(f.fresh(), 0);
    });
  }
}

test('public inbox Update delayed in sanitizer cannot undo a restricted Update', async (t) => {
  const f = fixture(t);
  f.seed();
  const entered = deferred();
  const release = deferred();
  sanitize = async (value) => {
    if (value === 'delayed public') {
      entered.resolve();
      await release.promise;
    }
    return value;
  };
  t.after(() => {
    sanitize = async (value) => value;
  });
  const pending = f.update(note(true, t3, 'delayed public'));
  await entered.promise;
  await f.update(note(false, t1, 'private winner'));
  const winner = f.row();
  release.resolve();
  await pending;
  assert.deepEqual(f.row(), winner);
  assert.equal(f.row().is_public, 0);
});

test('ordered upgrade migrations latch preexisting hidden rows and preserve public rows', (t) => {
  const sqlite = new DatabaseSync(':memory:');
  t.after(() => sqlite.close());
  sqlite.exec(
    'CREATE TABLE follower (id INTEGER PRIMARY KEY, actorId TEXT NOT NULL, inbox TEXT NOT NULL)',
  );
  for (const name of [
    '0001_fedify_kv',
    '0002_comments_publications',
    '0003_inbox_credit',
    '0004_comment_visibility',
  ]) {
    sqlite.exec(
      readFileSync(
        new URL(`../migrations/${name}.sql`, import.meta.url),
        'utf8',
      ),
    );
  }
  for (const visible of [0, 1]) {
    sqlite
      .prepare(
        'INSERT INTO ap_comment (id, post_id, author_id, author_name, in_reply_to, content, published_at, updated_at, is_public) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      )
      .run(
        `comment-${visible}`,
        'post',
        author.id!.href,
        'Author',
        parent.href,
        'preserved',
        t0,
        t0,
        visible,
      );
  }
  sqlite.exec(
    readFileSync(
      new URL(
        '../migrations/0005_comment_mutation_version.sql',
        import.meta.url,
      ),
      'utf8',
    ),
  );
  const rows = sqlite.prepare('SELECT * FROM ap_comment ORDER BY id').all();
  assert.equal(rows[0].mutation_version, 1);
  assert.equal(rows[0].undated_revocation, 1);
  assert.equal(rows[1].mutation_version, 1);
  assert.equal(rows[1].undated_revocation, 0);
  for (const row of rows) {
    assert.equal(row.content, 'preserved');
    assert.equal(row.updated_at, t0);
  }
});

test('published-only restricted fetch latches against later stale public fetches', async (t) => {
  const f = fixture(t);
  f.seed();
  await f.refresh(
    new Note({
      id,
      attribution: author.id,
      replyTarget: parent,
      content: 'withdrawn',
      tos: [author.id!],
      published: Temporal.Instant.from(t0),
    }),
  );
  assert.equal(f.row().is_public, 0);
  assert.equal(f.row().undated_revocation, 1);
  f.clearFreshness();
  await f.refresh(note(true, t2, 'stale public fetch'));
  assert.equal(f.row().is_public, 0);
  assert.equal(f.row().content, 'original');
});

test('restricted inbox Update hides before its sanitizer finishes', async (t) => {
  const f = fixture(t);
  f.seed();
  const entered = deferred();
  const release = deferred();
  sanitize = async (value) => {
    if (value === 'slow private') {
      entered.resolve();
      await release.promise;
    }
    return value;
  };
  t.after(() => {
    sanitize = async (value) => value;
  });
  const pending = f.update(note(false, t1, 'slow private'));
  await entered.promise;
  assert.equal(f.row().is_public, 0);
  assert.equal(f.row().updated_at, t1);
  assert.deepEqual(await f.visible(), []);
  await f.update(note(true, t2, 'new public winner'));
  const winner = f.row();
  release.resolve();
  await pending;
  assert.deepEqual(f.row(), winner);
});
