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

function makePool(): Pool {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL is not set');
  }
  return new Pool({ connectionString, max: 10 });
}

export const pool: Pool = global.__tokenboardPool ?? makePool();
if (process.env.NODE_ENV !== 'production') {
  global.__tokenboardPool = pool;
}

export async function query<T = Record<string, unknown>>(
  text: string,
  params?: unknown[],
): Promise<T[]> {
  const res = await pool.query(text, params as never[]);
  return res.rows as T[];
}
