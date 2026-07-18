// Plain-Node migration runner (no tsx/TypeScript) so it works inside the Next.js
// `output: 'standalone'` runner image, whose pruned node_modules keeps `pg` but not tsx.
// Applies migrations/*.sql in order, tracked in tb_schema_migrations. Idempotent.
//
// Resolves the migrations dir from MIGRATIONS_DIR, else ./migrations relative to cwd,
// else ../migrations relative to this file.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import pg from 'pg';

function resolveMigrationsDir() {
  const candidates = [
    process.env.MIGRATIONS_DIR,
    join(process.cwd(), 'migrations'),
    join(dirname(fileURLToPath(import.meta.url)), '..', 'migrations'),
  ].filter(Boolean);
  for (const c of candidates) {
    if (existsSync(c)) return c;
  }
  throw new Error(`migrations dir not found (tried: ${candidates.join(', ')})`);
}

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error('DATABASE_URL is not set');
  const dir = resolveMigrationsDir();
  const pool = new pg.Pool({ connectionString });

  try {
    await pool.query(
      `CREATE TABLE IF NOT EXISTS tb_schema_migrations (
         version text PRIMARY KEY,
         applied_at timestamptz NOT NULL DEFAULT now()
       )`,
    );
    const applied = new Set(
      (await pool.query('SELECT version FROM tb_schema_migrations')).rows.map((r) => r.version),
    );
    const files = readdirSync(dir)
      .filter((f) => f.endsWith('.sql'))
      .sort();

    for (const file of files) {
      if (applied.has(file)) {
        console.log(`skip  ${file}`);
        continue;
      }
      const sql = readFileSync(join(dir, file), 'utf8');
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
