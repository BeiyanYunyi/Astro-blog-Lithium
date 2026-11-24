import type { D1Database } from '@cloudflare/workers-types';

/** Disallowed in robots.txt. Requests here come from robots.txt readers. */
export const trapPrefix = '/internal';
/** Linked only from a hidden footer link and never listed in robots.txt. */
export const trapLinkPath = `${trapPrefix}/n7q2/`;
export const wallPath = '/wall-of-shame/';

export type TrapVia = 'robots' | 'link';

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
}

const maxUaLength = 2048;

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

/** Records one visit and returns the revoke token issued for it. */
export async function recordTrapHit(
  db: D1Database,
  visitor: TrapVisitor,
  via: TrapVia,
  now = Date.now(),
): Promise<string> {
  const token = `rt-${crypto.randomUUID()}`;
  // Deduplicate only live rows. A revoked row stays as history and a later
  // visit from the same ip + ua starts a fresh record.
  await db
    .prepare(
      `INSERT INTO crawler_trap_hit
        (ip, ua, via, asn, as_org, country, first_seen, last_seen, token)
      VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?7, ?8)
      ON CONFLICT (ip, ua, via) WHERE revoked_at IS NULL DO UPDATE SET
        asn = excluded.asn,
        as_org = excluded.as_org,
        country = excluded.country,
        last_seen = excluded.last_seen,
        hit_count = hit_count + 1,
        token = excluded.token`,
    )
    .bind(
      visitor.ip,
      visitor.ua,
      via,
      visitor.asn,
      visitor.asOrg,
      visitor.country,
      now,
      token,
    )
    .run();
  return token;
}

/** Soft-deletes the live record holding this token. */
export async function revokeTrapHit(
  db: D1Database,
  token: string,
  now = Date.now(),
): Promise<boolean> {
  if (!/^rt-[0-9a-f-]{36}$/.test(token)) return false;
  const result = await db
    .prepare(
      'UPDATE crawler_trap_hit SET revoked_at = ? WHERE token = ? AND revoked_at IS NULL',
    )
    .bind(now, token)
    .run();
  return result.meta.changes > 0;
}

export async function listTrapHits(
  db: D1Database,
  limit = 500,
): Promise<TrapRow[]> {
  const { results } = await db
    .prepare(
      `SELECT ip, ua, via, asn, as_org, country, first_seen, last_seen, hit_count
      FROM crawler_trap_hit WHERE revoked_at IS NULL
      ORDER BY last_seen DESC LIMIT ?`,
    )
    .bind(limit)
    .all<TrapRow>();
  return results;
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
