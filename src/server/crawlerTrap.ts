import type { D1Database } from '@cloudflare/workers-types';

/** Disallowed in robots.txt. Requests here come from robots.txt readers. */
export const trapPrefix = '/internal';
/** Linked only from a hidden footer link and never listed in robots.txt. */
export const trapLinkPath = `${trapPrefix}/n7q2/`;
export const wallPath = '/wall-of-shame/';
/** Turnstile `action` rendered on trap pages and required by siteverify. */
export const turnstileAction = 'trap';

export type TrapVia = 'robots' | 'link';
export type TrapStep = 'js' | 'ts_pass' | 'ts_fail';

export interface TrapVisitor {
  ip: string;
  ua: string;
  asn: number | null;
  asOrg: string | null;
  country: string | null;
}

export interface TrapRow {
  ip: string;
  ua: string;
  via: TrapVia;
  asn: number | null;
  as_org: string | null;
  country: string | null;
  first_seen: number;
  last_seen: number;
  hit_count: number;
  /** Visits whose page ran the beacon script. */
  js_count: number;
  /** Visits that passed Turnstile. */
  pass_count: number;
  /** Visits that failed Turnstile and never passed. */
  fail_count: number;
}

/** Turnstile funnel over GET visits recorded since the widget was added. */
export interface TrapFunnel {
  via: TrapVia;
  visits: number;
  js: number;
  passed: number;
  failed: number;
}

export interface TrapWall {
  rows: TrapRow[];
  funnel: TrapFunnel[];
  generatedAt: number;
}

const maxUaLength = 2048;
/** Beacons for a visit are accepted for this long after its hit. */
const beaconWindow = 30 * 60_000;
/** Seconds the aggregated wall is reused before it is rebuilt. */
export const wallTtl = 3600;

export const isVisit = (value: string) => /^rt-[0-9a-f-]{36}$/.test(value);

export function trapVia(pathname: string): TrapVia {
  return pathname.replace(/\/?$/, '/') === trapLinkPath ? 'link' : 'robots';
}

export function trapVisitor(
  request: Request & { cf?: Record<string, unknown> },
  clientAddress: string | undefined,
): TrapVisitor | null {
  if (!clientAddress) return null;
  const cf = request.cf ?? {};
  return {
    ip: clientAddress,
    ua: (request.headers.get('User-Agent') ?? '').slice(0, maxUaLength),
    asn: typeof cf.asn === 'number' ? cf.asn : null,
    asOrg: typeof cf.asOrganization === 'string' ? cf.asOrganization : null,
    country: typeof cf.country === 'string' ? cf.country : null,
  };
}

/**
 * Appends one hit and returns its visit id, which doubles as the revoke
 * token and the Turnstile cData.
 */
export async function recordTrapHit(
  db: D1Database,
  visitor: TrapVisitor,
  via: TrapVia,
  method: string,
  now = Date.now(),
): Promise<string> {
  const visit = `rt-${crypto.randomUUID()}`;
  await db.batch([
    db
      .prepare(
        'INSERT OR IGNORE INTO crawler_trap_visitor (ip, ua, via) VALUES (?1, ?2, ?3)',
      )
      .bind(visitor.ip, visitor.ua, via),
    db
      .prepare(
        `INSERT INTO crawler_trap_event
          (ts, visitor_id, visit, kind, asn, as_org, country, detail)
        SELECT ?4, id, ?5, 'hit', ?6, ?7, ?8, ?9 FROM crawler_trap_visitor
        WHERE ip = ?1 AND ua = ?2 AND via = ?3`,
      )
      .bind(
        visitor.ip,
        visitor.ua,
        via,
        now,
        visit,
        visitor.asn,
        visitor.asOrg,
        visitor.country,
        method === 'GET' ? null : JSON.stringify({ method }),
      ),
  ]);
  return visit;
}

// A visit is open for beacons while it is recent and not revoked.
const openVisit = `
  FROM crawler_trap_event h
  WHERE h.visit = ?1 AND h.kind = 'hit' AND h.ts >= ?2
    AND NOT EXISTS (
      SELECT 1 FROM crawler_trap_event r
      WHERE r.visitor_id = h.visitor_id AND r.kind = 'revoke' AND r.id > h.id
    )`;

export async function isOpenVisit(
  db: D1Database,
  visit: string,
  now = Date.now(),
): Promise<boolean> {
  if (!isVisit(visit)) return false;
  const row = await db
    .prepare(`SELECT 1 AS open ${openVisit}`)
    .bind(visit, now - beaconWindow)
    .first();
  return row !== null;
}

/** Appends a beacon step once per visit. Returns false when ignored. */
export async function recordTrapStep(
  db: D1Database,
  visit: string,
  step: TrapStep,
  detail: Record<string, unknown> | null = null,
  now = Date.now(),
): Promise<boolean> {
  if (!isVisit(visit)) return false;
  const result = await db
    .prepare(
      `INSERT OR IGNORE INTO crawler_trap_event
        (ts, visitor_id, visit, kind, detail)
      SELECT ?3, h.visitor_id, h.visit, ?4, ?5 ${openVisit}`,
    )
    .bind(
      visit,
      now - beaconWindow,
      now,
      step,
      detail ? JSON.stringify(detail) : null,
    )
    .run();
  return result.meta.changes > 0;
}

/**
 * Appends a revoke for the visitor behind this visit. Only the visitor's
 * newest hit can be revoked, so an older page's token stops working once the
 * same source visits again.
 */
export async function revokeTrapHit(
  db: D1Database,
  visit: string,
  now = Date.now(),
): Promise<boolean> {
  if (!isVisit(visit)) return false;
  const result = await db
    .prepare(
      `INSERT OR IGNORE INTO crawler_trap_event (ts, visitor_id, visit, kind)
      SELECT ?2, h.visitor_id, h.visit, 'revoke' FROM crawler_trap_event h
      WHERE h.visit = ?1 AND h.kind = 'hit'
        AND h.id = (
          SELECT max(id) FROM crawler_trap_event
          WHERE visitor_id = h.visitor_id AND kind = 'hit'
        )
        AND NOT EXISTS (
          SELECT 1 FROM crawler_trap_event r
          WHERE r.visitor_id = h.visitor_id AND r.kind = 'revoke'
            AND r.id > h.id
        )`,
    )
    .bind(visit, now)
    .run();
  return result.meta.changes > 0;
}

// Events after each visitor's latest revoke, folded into one row per visit.
const liveVisits = `
  WITH cut AS (
    SELECT visitor_id, max(id) AS id FROM crawler_trap_event
    WHERE kind = 'revoke' GROUP BY visitor_id
  ),
  visits AS (
    SELECT e.visitor_id, e.visit,
      max(e.kind = 'hit') AS hit,
      max(e.kind = 'hit' AND e.detail IS NULL) AS fresh,
      max(e.kind = 'js') AS js,
      max(e.kind = 'ts_pass') AS passed,
      max(e.kind = 'ts_fail') AND NOT max(e.kind = 'ts_pass') AS failed
    FROM crawler_trap_event e LEFT JOIN cut ON cut.visitor_id = e.visitor_id
    WHERE e.id > coalesce(cut.id, 0)
    GROUP BY e.visitor_id, e.visit
  )`;

/** Builds the wall from the event log. Prefer the cached `readTrapWall`. */
export async function loadTrapWall(
  db: D1Database,
  now = Date.now(),
  limit = 500,
): Promise<TrapWall> {
  const [rows, funnel] = await db.batch([
    db
      .prepare(
        `${liveVisits},
        hits AS (
          SELECT e.visitor_id, min(e.ts) AS first_seen, max(e.ts) AS last_seen,
            count(*) AS hit_count, max(e.id) AS latest
          FROM crawler_trap_event e
          LEFT JOIN cut ON cut.visitor_id = e.visitor_id
          WHERE e.kind = 'hit' AND e.id > coalesce(cut.id, 0)
          GROUP BY e.visitor_id
        ),
        steps AS (
          SELECT visitor_id, sum(js) AS js_count, sum(passed) AS pass_count,
            sum(failed) AS fail_count
          FROM visits GROUP BY visitor_id
        )
        SELECT v.ip, v.ua, v.via, l.asn, l.as_org, l.country,
          h.first_seen, h.last_seen, h.hit_count,
          s.js_count, s.pass_count, s.fail_count
        FROM hits h
        JOIN crawler_trap_visitor v ON v.id = h.visitor_id
        JOIN crawler_trap_event l ON l.id = h.latest
        JOIN steps s ON s.visitor_id = h.visitor_id
        ORDER BY h.last_seen DESC LIMIT ?1`,
      )
      .bind(limit),
    db.prepare(
      `${liveVisits}
      SELECT v.via, count(*) AS visits, sum(js) AS js,
        sum(passed) AS passed, sum(failed) AS failed
      FROM visits JOIN crawler_trap_visitor v ON v.id = visits.visitor_id
      WHERE fresh GROUP BY v.via`,
    ),
  ]);
  return {
    rows: rows.results as unknown as TrapRow[],
    funnel: funnel.results as unknown as TrapFunnel[],
    generatedAt: now,
  };
}

const wallCacheKey = (origin: string) =>
  new Request(`${origin}/api/crawler-trap/__wall`);

const wallCache = () =>
  typeof caches === 'undefined'
    ? undefined
    : (caches as unknown as { default: Cache }).default;

/**
 * Reads the wall through the Cache API for `wallTtl` seconds. `fresh`
 * rebuilds it from D1 and refreshes the cached copy.
 */
export async function readTrapWall(
  db: D1Database,
  origin: string,
  { fresh = false, now = Date.now() } = {},
): Promise<TrapWall> {
  const cache = wallCache();
  const key = wallCacheKey(origin);
  if (cache && !fresh) {
    const cached = await cache.match(key);
    if (cached) return cached.json();
  }
  const wall = await loadTrapWall(db, now);
  await cache?.put(
    key,
    new Response(JSON.stringify(wall), {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': `max-age=${wallTtl}`,
      },
    }),
  );
  return wall;
}

export async function forgetTrapWall(origin: string): Promise<void> {
  await wallCache()?.delete(wallCacheKey(origin));
}

/** True when the browser asked to revalidate, e.g. on a hard reload. */
export function wantsFreshWall(request: Request): boolean {
  const directives = (request.headers.get('Cache-Control') ?? '').toLowerCase();
  return (
    /(?:^|,)\s*(?:no-cache|no-store|max-age\s*=\s*0)\s*(?:,|$)/.test(
      directives,
    ) || /no-cache/i.test(request.headers.get('Pragma') ?? '')
  );
}

/** Remaining freshness of a wall, for the browser's Cache-Control. */
export function wallMaxAge(wall: TrapWall, now = Date.now()): number {
  return Math.max(0, wallTtl - Math.floor((now - wall.generatedAt) / 1000));
}

const siteverifyUrl =
  'https://challenges.cloudflare.com/turnstile/v0/siteverify';

/**
 * Checks a Turnstile token server side. A pass must carry this visit as
 * cData, the trap action and the requesting hostname.
 */
export async function verifyTurnstile(
  secret: string,
  token: string,
  visit: string,
  hostname: string,
  remoteip: string | undefined,
): Promise<{ passed: boolean; codes: string[] }> {
  const body = new URLSearchParams({ secret, response: token });
  if (remoteip) body.set('remoteip', remoteip);
  let outcome: {
    success?: boolean;
    'error-codes'?: string[];
    action?: string;
    cdata?: string;
    hostname?: string;
  };
  try {
    const response = await fetch(siteverifyUrl, { method: 'POST', body });
    if (!response.ok)
      return { passed: false, codes: [`http-${response.status}`] };
    outcome = await response.json();
  } catch {
    return { passed: false, codes: ['siteverify-unreachable'] };
  }
  const codes = [...(outcome['error-codes'] ?? [])];
  if (outcome.success) {
    if (outcome.cdata !== visit) codes.push('cdata-mismatch');
    if (outcome.action !== turnstileAction) codes.push('action-mismatch');
    if (outcome.hostname !== hostname) codes.push('hostname-mismatch');
  }
  return { passed: outcome.success === true && codes.length === 0, codes };
}

/** Truncates IPv4 to /24 and IPv6 to /48 for public display. */
export function truncateIp(ip: string): string {
  if (ip.includes(':')) {
    const compressed = ip.includes('::');
    const [head = '', tail = ''] = ip.split('::');
    const left = head ? head.split(':') : [];
    const right = compressed && tail ? tail.split(':') : [];
    const groups = compressed
      ? [
          ...left,
          ...Array(Math.max(0, 8 - left.length - right.length)).fill('0'),
          ...right,
        ]
      : left;
    const prefix = groups
      .slice(0, 3)
      .map((group) => group.toLowerCase().replace(/^0+(?=.)/, ''));
    return `${prefix.join(':')}::/48`;
  }
  const octets = ip.split('.');
  return octets.length === 4 ? `${octets.slice(0, 3).join('.')}.0/24` : '—';
}

// A hint only. Preview fetchers act for a person who shared the URL, so
// RFC 9309 does not bind them. They are labelled rather than hidden.
const previewAgents =
  /TelegramBot|Discordbot|Slackbot-LinkExpanding|Slack-ImgProxy|WhatsApp|facebookexternalhit|Twitterbot|LinkedInBot|SkypeUriPreview|Iframely|Embedly|redditbot|Mastodon\/|Misskey\/|Akkoma|Pleroma|GoToSocial|Sharkey|Firefish|Iceshrimp|Bluesky Cardyb|vkShare|Line\/|KakaoTalk-scrap|Pinterestbot|Valve\/Steam|matrix-media-repo|Synapse/i;

export function looksLikePreview(ua: string): boolean {
  return previewAgents.test(ua);
}

const agentKeyword = /bot|crawl|spider|scrap|fetch|agent|archiv|preview|scan/i;

/**
 * Picks a short display name from a raw UA: the self-declared crawler token
 * when there is one, otherwise the leading product token.
 */
export function uaName(raw: string): string {
  // Contact URLs often mention "crawler" or "bot" without naming the agent.
  const ua = raw.replace(/\+?https?:\/\/\S+/g, '').trim();
  const products = [...ua.matchAll(/([A-Za-z][\w.\- ]*?)\/[\w.]+/g)]
    .map((match) => match[1].trim())
    .filter((name) => name && name !== 'Mozilla');
  const compatible = ua.match(/compatible;\s*([^;/)]+)/i)?.[1]?.trim();
  const named = [compatible, ...products].find(
    (name) => name && agentKeyword.test(name),
  );
  if (named) return named;
  const bare = ua.match(/[\w.-]*(?:bot|crawler|spider)[\w.-]*/i)?.[0];
  if (bare) return bare;
  if (/^Mozilla\//.test(ua)) return '浏览器式UA';
  return products[0] ?? (ua.split(/[\s;(]/)[0] || '未知');
}
