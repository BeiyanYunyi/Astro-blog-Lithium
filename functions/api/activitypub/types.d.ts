import type { D1Database } from '@cloudflare/workers-types';

// https://www.w3.org/TR/activitystreams-vocabulary/#object-types
export interface APObject {
  type: string;
  // ObjectId, URL used for federation. Called `uri` in Mastodon APIs.
  // https://www.w3.org/TR/activitypub/#obj-id
  id: URL;
  // Link to the HTML representation of the object
  url: URL;
  published?: string;
  icon?: APObject;
  image?: APObject;
  summary?: string;
  name?: string;
  mediaType?: string;
  content?: string;
  inReplyTo?: string;

  // Extension
  preferredUsername?: string;
}

export interface Actor extends APObject {
  inbox: URL;
  outbox: URL;
  following: URL;
  followers: URL;

  alsoKnownAs?: string;
}

export interface Person extends Actor {
  publicKey: {
    id: string;
    owner: URL;
    publicKeyPem: string;
  };
}

export interface Link {
  type: string;
  href: URL;
  name: string;
}

export interface Note extends APObject {
  content: string;
  attributedTo?: string;
  summary?: string;
  inReplyTo?: string;
  replies?: string;
  to: Array<string>;
  attachment: Array<APObject>;
  cc: Array<string>;
  tag: Array<Link>;
  spoiler_text?: string;
}

interface FollowerTable {
  id: number;
  actorId: string;
  inbox: string;
}

export interface Database {
  follower: FollowerTable;
}

/* eslint-disable import/prefer-default-export */

export interface Env {
  ap: D1Database;
  PUBLIC_KEY: string;
  PRIV_KEY: string;
}
