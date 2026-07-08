import { config } from 'dotenv';
// Expo/Metro auto-loads .env.local; standalone tsx scripts do not.
config({ path: '.env.local' });
config({ path: '.env' });
import { readdirSync, readFileSync } from 'node:fs';
import { directPool as pool } from '../src/server/db';

// Applies db/migrations/*.sql in order, tracked in a _migrations table so it's
// idempotent. Uses the DIRECT owner connection — migrations run DDL and hold advisory
// locks, which Neon's PgBouncer pooler doesn't support. NEVER point this at a -pooler host.
async function main() {
  if (!process.env.DIRECT_DATABASE_URL && !process.env.DATABASE_URL) {
    console.error('DIRECT_DATABASE_URL (or DATABASE_URL) is not set. Add it to .env.local first.');
    process.exit(1);
  }
  const p = pool();
  await p.query(
    `create table if not exists _migrations (name text primary key, applied_at timestamptz not null default now())`,
  );

  const dir = new URL('../db/migrations/', import.meta.url);
  const files = readdirSync(dir)
    .filter((f) => f.endsWith('.sql'))
    .sort();
  const applied = new Set<string>((await p.query('select name from _migrations')).rows.map((r) => r.name as string));

  for (const f of files) {
    if (applied.has(f)) {
      console.log(`= ${f} (already applied)`);
      continue;
    }
    console.log(`+ applying ${f} …`);
    try {
      await p.query(readFileSync(new URL(f, dir), 'utf8'));
      await p.query('insert into _migrations (name) values ($1)', [f]);
      console.log(`  ✓ ${f}`);
    } catch (e) {
      console.error(`  ✗ ${f}:`, e instanceof Error ? e.message : e);
      process.exit(1);
    }
  }
  await p.end();
  console.log('migrations up to date.');
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
