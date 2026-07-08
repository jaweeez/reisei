import { config } from 'dotenv';
config({ path: '.env.local' });
config({ path: '.env' });
import { randomInt } from 'node:crypto';
import { directPool } from '../src/server/db';
import { hashSecret, normalizeUsername, validateCredentials } from '../src/server/auth/credential';

// Creates (or elevates) a true platform admin: users.is_admin = true (the /api/admin/*
// guard) plus plan = pro so premium is unlocked. Idempotent on username: if it already
// exists, promotes it in place (PIN unchanged). Owner/direct connection (CLI).
//
//   npm run create:admin -- --username jalil --name "Jalil" [--pin 481920] [--plan pro]
//
// If --pin is omitted, a random 6-digit PIN is generated and printed once.

function arg(name: string, fallback?: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

async function main() {
  const username = normalizeUsername(arg('username', 'admin')!);
  const name = arg('name', 'Admin')!;
  const plan = arg('plan', 'pro')!;
  const pin = arg('pin') ?? String(randomInt(0, 1_000_000)).padStart(6, '0');

  if (plan !== 'free' && plan !== 'pro') {
    console.error(`plan must be 'free' or 'pro' (users.plan check constraint). Got: ${plan}`);
    process.exit(1);
  }
  const invalid = validateCredentials(username, pin);
  if (invalid) {
    console.error(invalid);
    process.exit(1);
  }

  const p = directPool();
  const pinHash = await hashSecret(pin);

  // Register; auth_register_user returns null if the username is taken.
  const reg = await p.query<{ id: string | null }>(`select auth_register_user($1, $2, $3) as id`, [
    username,
    name,
    pinHash,
  ]);
  let userId = reg.rows[0]?.id ?? null;
  let created = true;

  if (!userId) {
    created = false;
    const existing = await p.query<{ id: string }>(`select id from users where username = $1`, [username]);
    userId = existing.rows[0]?.id ?? null;
    if (!userId) {
      console.error(`Username "${username}" is taken but no row found — aborting.`);
      process.exit(1);
    }
    console.log(`• "${username}" already exists — elevating to ${plan} (PIN left unchanged).`);
  }

  await p.query(`update users set plan = $2, is_admin = true where id = $1`, [userId, plan]);
  await p.end();

  console.log('\n─────────────  ADMIN ACCOUNT  ─────────────');
  console.log(`  username : ${username}`);
  if (created) console.log(`  PIN      : ${pin}   ← ${arg('pin') ? 'as provided' : 'generated — save this'}`);
  console.log(`  name     : ${name}`);
  console.log(`  plan     : ${plan}  ·  is_admin: true  (god-mode + dashboard)`);
  console.log(`  user id  : ${userId}`);
  console.log('───────────────────────────────────────────');
  console.log(created ? '✓ Created.' : '✓ Elevated existing account to admin.');
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
