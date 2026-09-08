import {
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
  ],
);

export default follower;
