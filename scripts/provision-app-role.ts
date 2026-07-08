import { config } from 'dotenv';
config({ path: '.env.local' });
config({ path: '.env' });
import { randomBytes } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { directPool } from '../src/server/db';

// Provisions a RESTRICTED application role (reisei_app: LOGIN, NOBYPASSRLS) so RLS
// actually enforces at request time — the owner role has BYPASSRLS and would skip
// every policy. Idempotent: re-running rotates the password. Writes APP_DATABASE_URL
// into .env.local WITHOUT printing the secret.
const APP_ROLE = 'reisei_app';

async function main() {
  const conn = process.env.DIRECT_DATABASE_URL || process.env.DATABASE_URL;
  if (!conn) {
    console.error('DIRECT_DATABASE_URL (or DATABASE_URL) is not set. Add it to .env.local first.');
    process.exit(1);
  }
  const password = randomBytes(24).toString('hex');
  const p = directPool();

  await p.query(`do $$ begin
    if not exists (select 1 from pg_roles where rolname = '${APP_ROLE}') then
      create role ${APP_ROLE} login nosuperuser nocreatedb nocreaterole nobypassrls;
    end if;
  end $$;`);
  await p.query(`alter role ${APP_ROLE} with login password '${password}'`);

  await p.query(`grant usage on schema public to ${APP_ROLE}`);
  await p.query(`grant select, insert, update, delete on all tables in schema public to ${APP_ROLE}`);
  await p.query(`grant usage, select on all sequences in schema public to ${APP_ROLE}`);
  await p.query(`grant execute on all functions in schema public to ${APP_ROLE}`);
  await p.query(`alter default privileges in schema public grant select, insert, update, delete on tables to ${APP_ROLE}`);
  await p.query(`alter default privileges in schema public grant execute on functions to ${APP_ROLE}`);

  const u = new URL(conn);
  u.username = APP_ROLE;
  u.password = password;
  const appUrl = u.toString();

  const envPath = '.env.local';
  let env = existsSync(envPath) ? readFileSync(envPath, 'utf8') : '';
  if (/^APP_DATABASE_URL=/m.test(env)) {
    env = env.replace(/^APP_DATABASE_URL=.*$/m, `APP_DATABASE_URL=${appUrl}`);
  } else {
    env = `${env.replace(/\n?$/, '')}\n\nAPP_DATABASE_URL=${appUrl}\n`;
  }
  writeFileSync(envPath, env);

  await p.end();
  console.log(`✓ Provisioned role "${APP_ROLE}" (LOGIN, NOBYPASSRLS) + grants.`);
  console.log(`✓ Wrote APP_DATABASE_URL to ${envPath} (value hidden, DIRECT host — right for local dev).`);
  console.log(`  For Vercel, use the same URL but with the "-pooler" host (runtime is serverless).`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
