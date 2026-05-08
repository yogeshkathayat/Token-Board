/**
 * Minimal SQL migration runner. Reads `apps/api/migrations/*.sql` in
 * lexicographic order and applies them inside a transaction. Tracks applied
 * versions in `tb_schema_migrations`.
 *
 *   node --import tsx src/db/migrate.ts up      # apply pending
 *   node --import tsx src/db/migrate.ts down    # roll back the latest one
 *
 * Migrations may contain a `-- DOWN` marker on its own line; everything below
 * that marker runs only on `down`.
 */
import { readdir, readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

import { config } from '../config.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = join(__dirname, '..', '..', 'migrations');

const TABLE_DDL = `
  create table if not exists tb_schema_migrations (
    version text primary key,
    applied_at timestamptz not null default now()
  )
`;

interface Migration {
  version: string;
  up: string;
  down: string;
}

async function loadMigrations(): Promise<Migration[]> {
  const files = (await readdir(MIGRATIONS_DIR))
    .filter((f) => f.endsWith('.sql'))
    .sort();
  const out: Migration[] = [];
  for (const file of files) {
    const body = await readFile(join(MIGRATIONS_DIR, file), 'utf8');
    const idx = body.indexOf('-- DOWN');
    const up = idx >= 0 ? body.slice(0, idx) : body;
    const down = idx >= 0 ? body.slice(idx + '-- DOWN'.length) : '';
    out.push({ version: file.replace(/\.sql$/, ''), up, down });
  }
  return out;
}

async function getApplied(client: pg.PoolClient): Promise<Set<string>> {
  const res = await client.query<{ version: string }>(
    'select version from tb_schema_migrations order by version asc',
  );
  return new Set(res.rows.map((r) => r.version));
}

async function up(): Promise<void> {
  const pool = new pg.Pool({ connectionString: config.databaseUrl });
  const client = await pool.connect();
  try {
    await client.query(TABLE_DDL);
    const applied = await getApplied(client);
    const migrations = await loadMigrations();
    let count = 0;
    for (const m of migrations) {
      if (applied.has(m.version)) continue;
      console.log(`▶  ${m.version}`);
      await client.query('begin');
      try {
        await client.query(m.up);
        await client.query('insert into tb_schema_migrations(version) values($1)', [m.version]);
        await client.query('commit');
        count += 1;
      } catch (e) {
        await client.query('rollback');
        throw e;
      }
    }
    console.log(count === 0 ? 'No pending migrations.' : `Applied ${count} migration(s).`);
  } finally {
    client.release();
    await pool.end();
  }
}

async function down(): Promise<void> {
  const pool = new pg.Pool({ connectionString: config.databaseUrl });
  const client = await pool.connect();
  try {
    await client.query(TABLE_DDL);
    const applied = await getApplied(client);
    if (applied.size === 0) {
      console.log('Nothing to roll back.');
      return;
    }
    const last = [...applied].sort().pop()!;
    const migrations = await loadMigrations();
    const m = migrations.find((x) => x.version === last);
    if (!m) throw new Error(`Migration file for ${last} not found`);
    if (!m.down.trim()) throw new Error(`Migration ${last} has no -- DOWN section`);

    console.log(`◀  ${m.version}`);
    await client.query('begin');
    try {
      await client.query(m.down);
      await client.query('delete from tb_schema_migrations where version = $1', [m.version]);
      await client.query('commit');
    } catch (e) {
      await client.query('rollback');
      throw e;
    }
  } finally {
    client.release();
    await pool.end();
  }
}

const cmd = process.argv[2] ?? 'up';
try {
  if (cmd === 'up') await up();
  else if (cmd === 'down') await down();
  else throw new Error(`Unknown migrate command: ${cmd}. Use 'up' or 'down'.`);
} catch (err) {
  console.error(err);
  process.exit(1);
}
