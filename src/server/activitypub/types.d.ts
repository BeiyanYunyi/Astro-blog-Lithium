import type { D1Database } from '@cloudflare/workers-types';

export interface Env {
  ap: D1Database;
  PUBLIC_KEY: string;
  PRIV_KEY: string;
  ASSETS: Fetcher;
  DELIVERY_TOKEN?: string;
}
