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

## Cloudflare Workers and Fedify

Use Node >=26 and pnpm. Astro's Cloudflare adapter owns page and API routing.
`src/server/activitypub/federation.ts` defines Fedify actor/object/collection
dispatchers and inbox listeners; the dynamic Astro endpoints forward requests to
`Federation.fetch()`. `src/middleware.ts` retains article HTML/ActivityPub content
negotiation, including quality values, `Vary: Accept` and `Cache-Control: no-store`.
Home, tags and RSS remain prerendered. Article URLs remain in the sitemap.
The build produces `dist/client/` and `dist/server/`; deployment uses the
adapter-generated Wrangler configuration.

```sh
pnpm install
pnpm worker:check
pnpm build
pnpm test:worker
pnpm check
pnpm worker:dry-run
pnpm worker:dev
```

`pnpm dev` and `worker:dev` use Astro's Cloudflare runtime; `pnpm preview` previews
the production build. Worker regression tests run the built application in
Miniflare with local D1 and mocked remote federation servers. They cover signed
Follow/Accept/Undo, invalid signatures, inbox replay suppression, existing follower
rows, delivery, WebFinger, article negotiation and static pages.

### Migrate an existing federation deployment

1. Keep the `ap` binding and database ID in `wrangler.jsonc`. Keep the existing
   `follower` table and all rows. Apply only the additive Fedify migration:

   ```sh
   pnpm exec wrangler d1 execute ap --remote --file migrations/0001_fedify_kv.sql
   ```

   This creates `fedify_kv` for protocol caching and inbox deduplication; it does
   not alter followers or keys. For a fresh local database, use
   `pnpm exec wrangler d1 execute ap --local --file setup.sql`. For an existing
   local database apply only the migration with `--local`. Do **not** rerun
   `setup.sql` against an existing production database.
2. Reuse the existing `PUBLIC_KEY` and `PRIV_KEY` Worker secrets without changing
   their JSON-string encoding: a PEM public key and a base64 PKCS#8 private key,
   respectively. Fedify imports this RSA pair and retains the `#main-key` ID.
   Moving from Pages still requires copying these secrets with
   `pnpm exec wrangler secret put PUBLIC_KEY` and
   `pnpm exec wrangler secret put PRIV_KEY`. Local bindings belong in ignored
   `.dev.vars`. Never regenerate keys during this migration.
3. Retain `blog.yunyi.beiyan.us` for federation and `stblog.penclub.club` as the
   site URL/lookup alias. The actor URL, `BeiyanYunyi` handle, inbox, followers,
   outbox and every Note/Create ID stay the same. Existing followers do not need
   to follow again. Posts retain their existing Note summary representation.
4. Keep a separate `DELIVERY_TOKEN` secret for manual publication:

   ```sh
   curl -X POST https://blog.yunyi.beiyan.us/api/sendToInbox \
     -H "Authorization: Bearer $DELIVERY_TOKEN" \
     -H 'Content-Type: application/json'
   ```

   Fedify sends the current content collection oldest first to distinct follower
   inboxes, signing requests with the existing RSA key. Each invocation resends
   the complete outbox with stable activity IDs. Missing token configuration
   returns 503, bad authorization 401, and remote delivery failures 502.
5. After applying the database migration, run `pnpm deploy`. If using Workers
   Builds, use build command `pnpm build` and deploy command
   `pnpm exec wrangler deploy`. Validate a real remote Follow/Undo, actor lookup,
   delivery, article HTML/JSON, tags and RSS after deployment.

### Federation behavior

Fedify handles JSON-LD, actor/object serialization, WebFinger responses, inbound
HTTP signature verification and outbound signing. Incoming Follow must target
this actor; Undo must embed/reference a Follow by the same actor for this blog.
Repeated successful activities are suppressed using persistent D1 storage.
Unsigned, forged, tampered or stale signed requests cannot change followers.
A failed Accept is not marked processed, allowing the remote server to retry.

Delivery is deliberately awaited inside the request, with no in-process message
queue that could be lost when a Worker stops. There is no background retry queue
or incremental publication tracking: retry a failed manual delivery explicitly.
A large outbox/follower list is still subject to Worker request limits. This
migration does not add tutorial features such as replies, likes, automatic
Create/Update/Delete synchronization, or replace the existing comment system.

Astro's default Origin protection remains enabled. Federation requests must use
`application/activity+json` or JSON Content-Type; headerless/form-like cross-origin
POST requests return 403. WebFinger accepts only the existing supported resources,
including `acct:BeiyanYunyi@blog.yunyi.beiyan.us` and its site-domain alias.
The legacy `/api/genKeyPair/:key` utility remains available and does not modify
configured secrets or database rows.

Local tests use mock remote servers; deployment and live federation must be
verified separately. The cache migration is additive, so the previous Worker
can be restored without deleting the new table or modifying follower data.

References: [Fedify Astro blog tutorial](https://fedify.dev/tutorial/astro-blog),
[Fedify deployment guidance](https://fedify.dev/manual/deploy),
[Cloudflare Worker routing](https://developers.cloudflare.com/workers/static-assets/routing/worker-script/).
