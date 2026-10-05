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

Use Node >=26 and pnpm. `src/server/worker.ts` delegates HTTP requests to Astro's
Cloudflare adapter and implements Cloudflare `scheduled()` and `queue()` handlers.
`src/server/activitypub/federation.ts` registers dispatchers and listeners once
with `createFederationBuilder<Env>()`, then builds a federation per invocation
with `D1KvStore` and `@fedify/cfworkers`'s `WorkersMessageQueue`. No Workers KV
namespace is required. `manuallyStartQueue: true` disables polling; the consumer
unwraps each message with `processMessage()` before `processQueuedTask()`.

`src/middleware.ts` retains article HTML/ActivityPub content negotiation,
including quality values, `Vary: Accept` and `Cache-Control: no-store`. Home,
tags and RSS remain prerendered. Article URLs remain in the sitemap. The build
produces Cloudflare Build Output in `.cloudflare/output/v0/`, with the Worker
bundle and static assets under `workers/default/`. `cloudflare.config.ts` defines
the Worker, bindings, and triggers. The project-local `cf` CLI is installed by
`pnpm install`; no global CLI installation is needed. Run other Cloudflare
commands with `pnpm exec cf` and authenticate with `pnpm exec cf auth login`
or `CLOUDFLARE_API_TOKEN`.

This migration uses pinned beta versions of cf, Astro 7.4, and the Cloudflare 15
adapter, which supports the new configuration and Build Output format.

```sh
pnpm install
pnpm worker:check
pnpm build
pnpm test:worker
pnpm check
pnpm worker:dry-run
```

`pnpm dev` and `worker:dev` use Astro's Cloudflare runtime. `pnpm preview` previews
the production build. Worker tests use the built application, real Miniflare D1
and queue producers, and mocked remote HTTP servers. A test capture handler lets
tests drive the production consumer and inspect acknowledgements/retries without
waiting for production backoff intervals.

### Upgrade an existing deployment

1. Keep the existing `ap` binding/database, `follower` rows, and `PUBLIC_KEY` and
   `PRIV_KEY` secrets. Keys retain their JSON-string encoding: PEM public key and
   base64 PKCS#8 private key. The public `#main-key` ID stays unchanged. Apply the
   additive migrations (the first is only needed if not already applied):

   ```sh
   pnpm exec cf d1 raw 007ff8f3-681b-47e1-9f6e-e9ded6295b43 --sql @migrations/0001_fedify_kv.sql
   pnpm exec cf d1 raw 007ff8f3-681b-47e1-9f6e-e9ded6295b43 --sql @migrations/0002_comments_publications.sql
   pnpm exec cf d1 raw 007ff8f3-681b-47e1-9f6e-e9ded6295b43 --sql @migrations/0003_inbox_credit.sql
   ```

   These commands target the remote database by default; cf requires its UUID.
   For a fresh local database use `pnpm exec cf d1 raw
   007ff8f3-681b-47e1-9f6e-e9ded6295b43 --local --sql @setup.sql`.
   For an existing local database use the migrations with `--local`.
   cf's local resource commands use `~/.config/cloudflare/state` by default;
   use `--persist-to` to select another state directory. This state is separate
   from the Astro dev server's state. Do not rerun `setup.sql` against an
   existing database.
2. Create the main queue and dead-letter queue before deploying the consumer:

   ```sh
   pnpm exec cf queues create --queue-name blog-federation
   pnpm exec cf queues create --queue-name blog-federation-dlq
   ```

   `cloudflare.config.ts` binds `FEDERATION_QUEUE`, connects the same Worker as consumer,
   and configures a cron every five minutes. Queue messages are processed one at
   a time (`maxBatchSize: 1`, `maxConcurrency: 1`). Keep concurrency at one:
   publication cursor advancement assumes a single consumer. Failed tasks request
   exponential delays from 30 seconds to one hour, with 12 retries before the
   dead-letter queue. Inspect the main queue, dead-letter queue and Worker logs
   in Cloudflare when diagnosing failures. After fixing a failed task, replay it
   from the dead-letter queue; replaying a completed publication task is a no-op.
3. Run `pnpm deploy`. With Workers Builds use build command `pnpm build` and deploy
   command `pnpm exec cf deploy --prebuilt`. `pnpm worker:dry-run` checks the same
   prebuilt output without uploading it. The first scan atomically registers all
   currently published articles as `baseline`, so historical articles are not
   broadcast. Confirm `ap_publication_state` contains its initialization row
   before deploying the first new article you want broadcast. Posts dated in the
   future are discovered after their publication date.
4. An optional `DELIVERY_TOKEN` secret permits an immediate scan:

   ```sh
   curl -X POST https://blog.yunyi.beiyan.us/api/sendToInbox \
     -H "Authorization: Bearer $DELIVERY_TOKEN" \
     -H 'Content-Type: application/json'
   ```

   This endpoint now returns HTTP 202 with `{ "queued": N }`, where N is the
   number of pending publication tasks enqueued (at most five). It uses the same
   discovery and repair logic as cron and no longer resends the entire archive.
   Missing token configuration returns 503; bad authorization returns 401. Cron
   does not require this token.
5. Validate a real remote Follow/Undo, a reply/edit/delete, actor lookup, article
   HTML/JSON, tags and RSS after deployment. Local tests do not contact real
   federation servers or provision remote resources.

### Automatic publication

Every scan inserts previously unseen published post slugs into `ap_publication`
with status `pending`. It enqueues at most five pending articles per scan. Each
publication task pages at most 25 distinct follower inboxes using an indexed D1
cursor and asks Fedify to enqueue their signed Create deliveries. A continuation
handles the next page. The cursor advances only after the page is durably queued;
cron also re-enqueues pending publications, recovering a lost continuation.

`complete` means every inbox page has been queued, not that every remote server
has acknowledged delivery. Individual HTTP delivery retries are independent of
the publication cursor. Transient delivery failures use Cloudflare retries;
Fedify classifies permanent HTTP failures itself. Stable Create IDs are retained.
Delivery is at least once: a crash between enqueueing and saving the cursor can
repeat a page, so remote servers may see the same activity ID again. Inbox
membership is read per page; newly following accounts do not receive an automatic
archive replay.

Subsequent scans do not resend baseline or completed posts. This implements
publication of new slugs; edits and deletions of local blog posts do not produce
outgoing Update/Delete activities. Reusing an already recorded slug does not
trigger a new Create. A queued publication whose source post was removed by a
later deployment is marked `cancelled`, allowing other pending posts to progress.

### Incoming instance blocklist

Edit `blockedInstanceDomains` in `src/server/activitypub/blocklist.ts` and redeploy.
The list currently includes `qoto.org` and `cleverlibre.org`; entries are bare hostnames.
Each entry also blocks subdomains. Matching ignores case, ports and a trailing dot.

Federation routes reject blocked HTTP signature key IDs (Cavage or RFC 9421) and
incoming activity actor IDs with HTTP 403 and `{"error":"Instance blocked"}`.
The blocklist checks do not fetch keys, write D1 state or enqueue activities.
The inbox credit admission check described below runs before the blocklist.
Unblocked requests still undergo normal Fedify signature verification. Existing
inbox queue messages are checked against the current list and acknowledged when
blocked; listeners also check parsed actor IDs before resolving objects or writing
state, including actors expressed through custom JSON-LD aliases.

This is an inbound filter: it does not purge existing followers/comments or stop
outgoing publication to existing followers. Anonymous reads cannot reliably be
attributed to a remote instance and remain public. Host, Origin and User-Agent
headers are not treated as proof of a caller's instance.

The 403 response follows [Mastodon's signature-domain rejection](https://github.com/mastodon/mastodon/blob/main/app/controllers/concerns/signature_verification.rb),
not the full account/content cleanup performed by Mastodon's domain suspension.

### Inbox instance credit

Apply `migrations/0003_inbox_credit.sql` before deploying this version. The
`ap_inbox_credit` table is separate from Fedify's cache; existing databases must
use the additive migration, not `setup.sql`.

`POST /api/activitypub/inbox` groups requests by the unverified signature key ID's
normalized hostname (including the trailing-slash route). Subdomains remain
separate. RFC 9421 `Signature-Input` takes precedence over Cavage `Signature`.
Missing, unparseable or ambiguous multi-instance key IDs are not assigned a bucket.

Fedify's final `invalidSignature` result and `keyFetchError` with an HTTP
4xx/5xx response add credit, once per request: zero becomes 1; positive credit
doubles up to 120. Key-fetch exceptions without an HTTP error response (including
network and parsing errors), missing signatures, malformed activities that cannot
reach the callback and internal errors are not scored. Key-fetch callback logs
include the HTTP status or exception name and whether the failure is eligible
for credit. Successful requests do not reset credit. Every full minute
subtracts 1 down to zero, preserving partial minutes; after reaching zero, a new
failure starts a fresh minute. Decay is computed on reads and atomically on writes.

Above 60, the route returns HTTP 429 with `Retry-After` and `Cache-Control:
no-store` before parsing the body or fetching/verifying a key. Rejected requests
do not write or extend the restriction. Admission is best effort: requests already
in verification can still fail and add credit concurrently, with atomic D1 updates
preventing lost increments. The claimed hostname can be forged; these scores do
not establish which instance sent an attack.

`/activitypub/credits/` is retained for future use without a site navigation link.
It shows a non-cached snapshot of all positive effective scores, restrictions,
estimated recovery and last failure times.
Times are UTC; refresh for a new snapshot. The existing scheduled handler deletes
fully decayed records. No new binding, queue or cron schedule is required.

### Comments and inbox handling

Incoming activities are signature-verified by Fedify before being durably queued.
Queue consumers run the inbox listeners. A Follow must target this blog; its
Accept is queued before the follower is stored. Undo must refer to a Follow by
the same actor for this blog. D1 retains protocol cache and successful-activity
deduplication across Worker invocations.

`ap_comment` stores direct replies to existing local Note IDs: remote object ID,
local post slug, author ID/name, reply target, HTML content and timestamps.
Create requires attribution to match the activity actor and the Note ID to share
that actor's HTTPS origin. Duplicate object IDs do not overwrite existing rows.
Update requires the stored author and a newer `updated` timestamp (or the
activity's `published` timestamp). Delete requires the stored author, clears
content/name and retains a tombstone so a late duplicate Create or Update cannot
resurrect a deleted stored comment. Replies to other servers, missing posts and
replies to comments are ignored.

This adds storage only. It does not change the existing Sodesu UI. Remote HTML
remains untrusted and must be sanitized before any future rendering.

The canonical identity remains `blog.yunyi.beiyan.us` with `BeiyanYunyi` as handle
and `stblog.penclub.club` as site/lookup alias. Actor, Note and Create URLs remain
unchanged. Astro's default Origin protection remains enabled: federation POSTs
must use ActivityPub/JSON Content-Type. The legacy `/api/genKeyPair/:key` utility
does not modify configured secrets or database rows.

References: [Fedify Astro blog tutorial](https://fedify.dev/tutorial/astro-blog),
[Fedify deployment guidance](https://fedify.dev/manual/deploy),
[Cloudflare Worker routing](https://developers.cloudflare.com/workers/static-assets/routing/worker-script/).
