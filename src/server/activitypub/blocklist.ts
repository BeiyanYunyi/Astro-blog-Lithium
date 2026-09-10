/** Instance hostnames, including all subdomains. Use bare domains, not URLs. */
export const blockedInstanceDomains: readonly string[] = [
  // 'blocked.example',
  'qoto.org',
  'cleverlibre.org',
];

export function isBlockedInstance(
  value: string | URL,
  domains = blockedInstanceDomains,
): boolean {
  let hostname: string;
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return false;
    hostname = url.hostname.toLowerCase().replace(/\.$/, '');
  } catch {
    return false;
  }
  return domains.some((domain) => {
    const blocked = new URL(`https://${domain}`).hostname
      .toLowerCase()
      .replace(/\.$/, '');
    return hostname === blocked || hostname.endsWith(`.${blocked}`);
  });
}

function blockedReference(value: unknown): boolean {
  if (typeof value === 'string') return isBlockedInstance(value);
  if (Array.isArray(value)) return value.some(blockedReference);
  if (value && typeof value === 'object') {
    const reference = value as Record<string, unknown>;
    return blockedReference(reference.id ?? reference['@id']);
  }
  return false;
}

/** Inspect identifiers only; never resolve a remote actor to decide whether to block it. */
export function isBlockedActivity(value: unknown): boolean {
  if (Array.isArray(value)) return value.some(isBlockedActivity);
  if (!value || typeof value !== 'object') return false;
  const activity = value as Record<string, unknown>;
  return (
    blockedReference(activity.actor) ||
    blockedReference(activity['https://www.w3.org/ns/activitystreams#actor'])
  );
}

export async function isBlockedFederationRequest(request: Request) {
  // Cavage and RFC 9421 both identify the signing key in a quoted keyId parameter.
  // These unverified hints can only reject a request, never authorize one.
  for (const name of ['Signature', 'Signature-Input']) {
    const header = request.headers.get(name) ?? '';
    for (const match of header.matchAll(
      /(?:^|[,;])\s*keyid\s*=\s*"((?:[^"\\]|\\.)*)"/gi,
    )) {
      if (isBlockedInstance(match[1].replace(/\\(.)/g, '$1'))) return true;
    }
  }
  if (request.method !== 'POST') return false;
  try {
    return isBlockedActivity(await request.clone().json());
  } catch {
    // Let Fedify retain its normal malformed-payload/signature validation.
    return false;
  }
}
