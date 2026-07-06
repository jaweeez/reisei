import { Pool, type PoolClient } from 'pg';

// pg Pools — the same driver the shared MuWorks/Hayway backend uses. Neon-friendly
// ssl + timeouts (Neon autosuspends idle compute; the first query after a cold start
// can take a few seconds). Only ever imported by API routes (*+api.ts) and CLI
// scripts, so it never reaches the native/client bundle.
//
// TWO roles, on purpose:
//   • pool()      — the RESTRICTED app role (APP_DATABASE_URL, NOBYPASSRLS). All
//                   request-time queries use it, so RLS actually enforces crew scope.
//   • adminPool() — the OWNER role (DATABASE_URL). DDL, migrations, seeding, webhooks.
let _pool: Pool | null = null;
let _adminPool: Pool | null = null;
let _warnedOwnerFallback = false;

function makePool(connStr: string): Pool {
  const connectionString = connStr.replace('sslmode=require', '');
  const local = /localhost|127\.0\.0\.1/.test(connectionString);
  const p = new Pool({
    connectionString,
    ssl: local ? undefined : { rejectUnauthorized: true },
    connectionTimeoutMillis: 15000,
    keepAlive: true,
    max: 5,
  });
  p.on('error', () => {});
  return p;
}

/**
 * The APPLICATION pool — connects as the restricted, NOBYPASSRLS app role so the
 * RLS policies in 0002_rls.sql actually enforce. Falls back to the owner role in
 * dev with a loud warning; refuses that fallback in production. Run
 * `npm run db:provision` to create the app role + write APP_DATABASE_URL.
 */
export function pool(): Pool {
  const conn = process.env.APP_DATABASE_URL || process.env.DATABASE_URL;
  if (!conn) throw new Error('APP_DATABASE_URL / DATABASE_URL is not set');
  if (!process.env.APP_DATABASE_URL) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error(
        'APP_DATABASE_URL is not set — refusing the RLS-bypassing owner role in production. Run `npm run db:provision`.',
      );
    }
    if (!_warnedOwnerFallback) {
      _warnedOwnerFallback = true;
      console.warn('⚠ APP_DATABASE_URL not set — using the owner role, which BYPASSES RLS. Run `npm run db:provision`.');
    }
  }
  if (!_pool) _pool = makePool(conn);
  return _pool;
}

/** The ADMIN (owner) pool — for migrations, DDL, seeding, and webhook writes only. */
export function adminPool(): Pool {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not set');
  if (!_adminPool) _adminPool = makePool(process.env.DATABASE_URL);
  return _adminPool;
}

/**
 * Run `fn` inside a transaction with the RLS actor set to `userId`, per the
 * `app.current_user_id` contract in db/migrations/0002_rls.sql. Uses
 * `set_config(..., true)` (transaction-scoped) so the value can never leak across
 * pooled clients. Use this for ALL user-facing data access.
 */
export async function withUser<T>(userId: string, fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool().connect();
  try {
    await client.query('begin');
    await client.query(`select set_config('app.current_user_id', $1, true)`, [userId]);
    const result = await fn(client);
    await client.query('commit');
    return result;
  } catch (e) {
    try {
      await client.query('rollback');
    } catch {
      /* ignore rollback failure */
    }
    throw e;
  } finally {
    client.release();
  }
}

export const hasDb = () => Boolean(process.env.DATABASE_URL);
