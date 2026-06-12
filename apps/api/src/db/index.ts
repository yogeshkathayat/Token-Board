import { Kysely, PostgresDialect } from 'kysely';
import pg from 'pg';

import { config } from '../config.js';
import type { DB } from './types.js';

// Postgres returns BIGINTs as strings by default with node-postgres' BIGINT
// type OID 20. We rely on that behavior — the API serializes token columns
// as strings to avoid JS Number precision loss.
pg.types.setTypeParser(pg.types.builtins.INT8, (val) => val);

const pool = new pg.Pool({
  connectionString: config.databaseUrl,
  max: 10,
  idleTimeoutMillis: 30_000,
});

export const db = new Kysely<DB>({
  dialect: new PostgresDialect({ pool }),
  log(event) {
    // Surface slow queries (SLOW_QUERY_MS, documented in CONFIG.md). Log only
    // the parameterized SQL text and duration — never the bound parameters,
    // which can contain token hashes and other sensitive values.
    if (event.level === 'query' && event.queryDurationMillis >= config.slowQueryMs) {
      console.warn(
        JSON.stringify({
          level: 'warn',
          msg: 'slow query',
          durationMs: Math.round(event.queryDurationMillis),
          sql: event.query.sql,
        }),
      );
    }
  },
});

export async function pingDb(): Promise<boolean> {
  try {
    await db.selectFrom('tb_users' as never).select(['id' as never]).limit(0).execute();
    return true;
  } catch {
    return false;
  }
}

export async function closeDb(): Promise<void> {
  await db.destroy();
}
