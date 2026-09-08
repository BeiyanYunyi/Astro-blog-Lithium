import { sql } from 'drizzle-orm';
import {
  check,
  index,
  integer,
  sqliteTable,
  text,
  unique,
} from 'drizzle-orm/sqlite-core';

const follower = sqliteTable(
  'follower',
  {
    id: integer('id').primaryKey(),
    actorId: text('actorId').notNull(),
    inbox: text('inbox').notNull(),
  },
  (table) => [
    unique('actorId_unique').on(table.actorId),
    index('follower_inbox').on(table.actorId),
    index('follower_delivery_inbox').on(table.inbox, table.actorId),
  ],
);

export default follower;

export const fedifyKv = sqliteTable(
  'fedify_kv',
  {
    key: text('key').primaryKey().notNull(),
    value: text('value').notNull(),
    expires: integer('expires'),
  },
  (table) => [index('fedify_kv_expires').on(table.expires)],
);

export const comment = sqliteTable(
  'ap_comment',
  {
    id: text('id').primaryKey().notNull(),
    postId: text('post_id').notNull(),
    authorId: text('author_id').notNull(),
    authorName: text('author_name').notNull(),
    inReplyTo: text('in_reply_to').notNull(),
    content: text('content').notNull(),
    publishedAt: text('published_at').notNull(),
    updatedAt: text('updated_at').notNull(),
    deletedAt: text('deleted_at'),
  },
  (table) => [index('ap_comment_post').on(table.postId, table.publishedAt)],
);

export const publication = sqliteTable(
  'ap_publication',
  {
    postId: text('post_id').primaryKey().notNull(),
    status: text('status', {
      enum: ['baseline', 'pending', 'complete', 'cancelled'],
    }).notNull(),
    cursor: text('cursor').notNull().default(''),
    createdAt: text('created_at').notNull(),
  },
  (table) => [
    index('ap_publication_pending').on(table.status, table.createdAt),
    check(
      'ap_publication_status',
      sql`${table.status} IN ('baseline', 'pending', 'complete', 'cancelled')`,
    ),
  ],
);

export const publicationState = sqliteTable(
  'ap_publication_state',
  {
    id: integer('id').primaryKey(),
    initializedAt: text('initialized_at').notNull(),
  },
  (table) => [check('ap_publication_state_singleton', sql`${table.id} = 1`)],
);
