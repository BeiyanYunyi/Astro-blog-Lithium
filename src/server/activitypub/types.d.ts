import type { D1Database, Queue } from '@cloudflare/workers-types';

export interface Env {
  ap: D1Database;
  FEDERATION_QUEUE: Queue;
  PUBLIC_KEY: string;
  PRIV_KEY: string;
  ASSETS: Fetcher;
  DELIVERY_TOKEN?: string;
}
