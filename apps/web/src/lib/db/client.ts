import { Pool, types } from 'pg';
import 'server-only';

// Return BIGINT (OID 20) as string, never a lossy JS number. Callers use BigInt(...) / strings.
types.setTypeParser(20, (v) => v);
// NUMERIC (OID 1700) as string too.
types.setTypeParser(1700, (v) => v);

declare global {
  // eslint-disable-next-line no-var
  var __tokenboardPool: Pool | undefined;
}

/**
 * Lazily create the pool. DATABASE_URL is only required when a query actually runs — NOT at
 * import time — so `next build` can evaluate route modules without a live database.
 */
export function getPool(): Pool {
  if (global.__tokenboardPool) return global.__tokenboardPool;
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL is not set');
  }
  const pool = new Pool({ connectionString, max: 10 });
  global.__tokenboardPool = pool;
  return pool;
}

export async function query<T = Record<string, unknown>>(
  text: string,
  params?: unknown[],
): Promise<T[]> {
  const res = await getPool().query(text, params as never[]);
  return res.rows as T[];
}
