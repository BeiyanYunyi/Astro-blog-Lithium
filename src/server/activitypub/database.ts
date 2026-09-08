import type { D1Database } from '@cloudflare/workers-types';
import { drizzle } from 'drizzle-orm/d1';

const createDatabase = (database: D1Database) => drizzle(database);

export type Database = ReturnType<typeof createDatabase>;
export default createDatabase;
