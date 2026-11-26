import type { D1Database, Queue } from '@cloudflare/workers-types';

export interface Env {
  ap: D1Database;
  FEDERATION_QUEUE: Queue;
  PUBLIC_KEY: string;
  PRIV_KEY: string;
  ASSETS: Fetcher;
  DELIVERY_TOKEN?: string;
  /** Turnstile widget on crawler-trap pages. Both unset disables it. */
  TURNSTILE_SITE_KEY?: string;
  TURNSTILE_SECRET_KEY?: string;
}
