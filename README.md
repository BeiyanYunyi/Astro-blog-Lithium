# Astro-blog-Lithium

[preview](https://stblog.penclub.club/)

You can write markdown and MDX in `pages/posts` folder.

Currently, there's no i18n support, but since there's few text, you can easily translate it.

## Features

- Style like [hexo-theme-icarus](https://github.com/ppoffice/hexo-theme-icarus)
- Pagination
- UnoCSS
- Tags
- Default layout for Markdown and MDX -- no need to write layout frontmatter for each post.
- Fast -- ~20kB Gzipped for home page
- Solid.js support, or you can replace it with React, Vue, Svelte, etc.
- Table of contents(TOC)
- Dark mode and switcher
- [Sodesu](https://github.com/BeiyanYunyi/Sodesu) -- a simple comment system

## Cloudflare Workers deployment

Use Node >=25 and pnpm. Astro continues to generate the whole site, including
ActivityPub Note, Create and Outbox documents, into `dist/`. `functions/index.ts`
is the Worker entrypoint; the files in `functions/api/` are explicitly imported
handlers, not filesystem routes. No Astro SSR adapter is needed.

```sh
pnpm install
pnpm build
pnpm worker:check
pnpm test:worker
pnpm worker:dev
```

`worker:dev` rebuilds the site before starting Wrangler. Rebuild after editing blog
content; `pnpm dev` remains useful for Astro UI work but does not run the Worker.
`public/_headers` supplies MIME types for static ActivityPub documents. Dynamic
Actor, Followers and WebFinger responses supply their own headers. `/posts/*`
and `/api/*` run through the Worker before assets so content negotiation works
with existing static files. Negotiated responses use `Vary: Accept` and
`Cache-Control: no-store` to keep HTML and ActivityPub JSON separate. The
compatibility date matches the runtime bundled with the locked Wrangler version.

### Move an existing Pages deployment

1. Keep the `ap` D1 database binding and database ID in `wrangler.toml`. The
   existing `follower` table is reused without a schema migration. Do **not** run
   `setup.sql` against an already initialized production database. For a new
   local database only, run `pnpm exec wrangler d1 execute ap --local --file setup.sql`.
2. Copy the existing Pages `PUBLIC_KEY` and `PRIV_KEY` secrets into the Worker
   using `pnpm exec wrangler secret put PUBLIC_KEY` and
   `pnpm exec wrangler secret put PRIV_KEY`. Preserve their existing JSON-string
   encoding: `PUBLIC_KEY` decodes to a PEM public key; `PRIV_KEY` decodes to a
   base64 PKCS#8 private key. Reuse the same key pair; generating a replacement
   would change the identity trusted by existing followers. For local previews,
   put the same variable names in an ignored `.dev.vars` file.
3. If manual delivery is needed, set a separate `DELIVERY_TOKEN` Worker secret.
   `POST /api/sendToInbox` now requires `Authorization: Bearer <DELIVERY_TOKEN>`
   instead of the old, nonfunctional private-key body comparison. It sends the
   entire built outbox, oldest first, to each distinct follower inbox. Each call
   republishes all entries; do not wire it to recurring deployment hooks without
   adding delivery tracking. Missing configuration returns 503, invalid
   authorization returns 401, and a failed remote delivery returns 502.
4. Run `pnpm deploy`, or configure Workers Builds with build command `pnpm build`
   and deploy command `pnpm exec wrangler deploy`. This deploys both the Worker
   and `dist/`. Pages deployments and Pages secrets do not transfer automatically.
5. Check the new Worker before moving the existing domains from Pages to Workers
   Custom Domains. Retain `blog.yunyi.beiyan.us` for federation and
   `stblog.penclub.club` for the existing site URL. Actor IDs, published object
   IDs, aliases and `astro.config.ts`'s site URL intentionally remain unchanged.
   After cutover, verify WebFinger, Actor, Followers, a Follow/Undo from a remote
   instance, article HTML/JSON negotiation, tags and RSS before retiring Pages.

WebFinger is now served by the Worker and requires a supported `resource` query,
for example `/.well-known/webfinger?resource=acct:BeiyanYunyi@blog.yunyi.beiyan.us`.
Unknown accounts return 404 instead of advertising this blog's actor for everyone.
The legacy `/api/genKeyPair/:key` utility remains available for compatibility; it
does not modify the configured actor keys or database.

This migration retains the existing ActivityPub protocol implementation. Inbox
HTTP signature verification, durable delivery retries and delivery deduplication
are not implemented by this change; local regression tests use mocked remote
instances and do not certify live federation. [Fedify](https://github.com/fedify-dev/fedify)
is a suitable follow-up for those protocol features, with explicit migration of
existing actor/object IDs, keys and follower storage. Its introduction is separate
from switching the hosting runtime.

References: [Cloudflare Pages migration guide](https://developers.cloudflare.com/workers/static-assets/migration-guides/migrate-from-pages/),
[selective Worker routing](https://developers.cloudflare.com/workers/static-assets/routing/worker-script/),
and [static asset headers](https://developers.cloudflare.com/workers/static-assets/headers/).
