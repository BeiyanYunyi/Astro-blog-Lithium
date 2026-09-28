import type { D1Database } from '@cloudflare/workers-types';

const minute = 60_000;
const threshold = 60;

interface CreditRow {
  hostname: string;
  credit: number;
  decayed_at: number;
  last_failure_at: number;
}

export function instanceHostname(keyId: string | URL): string | null {
  try {
    const url = new URL(keyId);
    if (!['http:', 'https:'].includes(url.protocol)) return null;
    return url.hostname.toLowerCase().replace(/\.$/, '') || null;
  } catch {
    return null;
  }
}

/** Unverified identity hint, never proof of the request's origin. */
export function requestInstance(request: Request): string | null {
  // Match Fedify's RFC 9421 preference when both formats are present.
  const header =
    request.headers.get(
      request.headers.has('Signature-Input') ? 'Signature-Input' : 'Signature',
    ) ?? '';
  const domains = new Set<string>();
  for (const match of header.matchAll(
    /(?:^|[,;])\s*keyid\s*=\s*"((?:[^"\\]|\\.)*)"/gi,
  )) {
    const hostname = instanceHostname(match[1].replace(/\\(.)/g, '$1'));
    if (!hostname) return null;
    domains.add(hostname);
  }
  // Ambiguous multi-instance signatures cannot safely be assigned to one bucket.
  return domains.size === 1 ? [...domains][0] : null;
}

function currentState(row: CreditRow, now: number) {
  const elapsed = Math.max(0, Math.floor((now - row.decayed_at) / minute));
  const credit = Math.max(0, row.credit - elapsed);
  const limited = credit > threshold;
  const retryAt = limited
    ? row.decayed_at + (row.credit - threshold) * minute
    : null;
  return {
    hostname: row.hostname,
    credit,
    limited,
    retryAt,
    retryAfter:
      retryAt === null ? 0 : Math.max(1, Math.ceil((retryAt - now) / 1000)),
    lastFailureAt: row.last_failure_at,
  };
}

export async function getInstanceCredit(
  database: D1Database,
  hostname: string,
  now = Date.now(),
) {
  const row = await database
    .prepare('SELECT * FROM ap_inbox_credit WHERE hostname = ?')
    .bind(hostname)
    .first<CreditRow>();
  return row ? currentState(row, now) : null;
}

/** Apply decay and a failure in one statement, including concurrent in-flight failures. */
export async function recordInvalidSignature(
  database: D1Database,
  hostname: string,
  now = Date.now(),
) {
  // Preserve partial minutes while credit is positive. Once it reaches zero,
  // this failure starts a fresh decay period, just like a missing record.
  await database
    .prepare(`
    INSERT INTO ap_inbox_credit (hostname, credit, decayed_at, last_failure_at)
    VALUES (?1, 1, ?2, ?2)
    ON CONFLICT(hostname) DO UPDATE SET
      credit = min(120, max(1, 2 * (
        credit - max(0, CAST((?2 - decayed_at) / 60000 AS INTEGER))
      ))),
      decayed_at = CASE
        WHEN credit <= max(0, CAST((?2 - decayed_at) / 60000 AS INTEGER)) THEN ?2
        ELSE decayed_at + max(0, CAST((?2 - decayed_at) / 60000 AS INTEGER)) * 60000
      END,
      last_failure_at = max(last_failure_at, ?2)
  `)
    .bind(hostname, now)
    .run();
}

export async function listInstanceCredits(
  database: D1Database,
  now = Date.now(),
) {
  const { results } = await database
    .prepare(
      'SELECT * FROM ap_inbox_credit WHERE decayed_at + credit * 60000 > ?',
    )
    .bind(now)
    .all<CreditRow>();
  return results
    .map((row) => currentState(row, now))
    .sort(
      (a, b) => b.credit - a.credit || a.hostname.localeCompare(b.hostname),
    );
}

export async function cleanExpiredCredits(
  database: D1Database,
  now = Date.now(),
) {
  await database
    .prepare(
      'DELETE FROM ap_inbox_credit WHERE decayed_at + credit * 60000 <= ?',
    )
    .bind(now)
    .run();
}
