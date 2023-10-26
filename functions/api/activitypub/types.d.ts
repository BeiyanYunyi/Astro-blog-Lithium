import type { D1Database } from '@cloudflare/workers-types';

interface FollowerTable {
  actorId: string;
  inbox: string;
}

export interface Database {
  follower: FollowerTable;
}

/* eslint-disable import/prefer-default-export */

export interface Env {
  ap: D1Database;
}
