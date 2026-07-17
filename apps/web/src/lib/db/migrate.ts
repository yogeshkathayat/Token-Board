/**
 * Idempotent migration runner. Applies every migrations/*.sql in lexical order,
 * tracking applied files in tb_schema_migrations. Safe to run on every startup.
 *
 * Usage: tsx src/lib/db/migrate.ts   (or `npm run migrate`)
 */
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { Pool } from 'pg';

const migrationsDir = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', 'migrations');

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error('DATABASE_URL is not set');
  const pool = new Pool({ connectionString });

  try {
    await pool.query(
      `CREATE TABLE IF NOT EXISTS tb_schema_migrations (
         version text PRIMARY KEY,
         applied_at timestamptz NOT NULL DEFAULT now()
       )`,
    );
    const applied = new Set(
      (await pool.query<{ version: string }>('SELECT version FROM tb_schema_migrations')).rows.map(
        (r) => r.version,
      ),
    );
    const files = readdirSync(migrationsDir)
      .filter((f) => f.endsWith('.sql'))
      .sort();

    for (const file of files) {
      if (applied.has(file)) {
        console.log(`skip  ${file}`);
        continue;
      }
      const sql = readFileSync(join(migrationsDir, file), 'utf8');
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await client.query(sql);
        await client.query('INSERT INTO tb_schema_migrations (version) VALUES ($1)', [file]);
        await client.query('COMMIT');
        console.log(`apply ${file}`);
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }
    }
    console.log('migrations complete');
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
