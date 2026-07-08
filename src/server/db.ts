import { Pool, type PoolClient } from 'pg';
import { Pool as NeonPool, neonConfig } from '@neondatabase/serverless';

// pg Pools — the same driver the shared MuWorks/Hayway backend uses. Neon-friendly
// ssl + timeouts (Neon autosuspends idle compute; the first query after a cold start
// can take a few seconds). Only ever imported by API routes (*+api.ts) and CLI
// scripts, so it never reaches the native/client bundle.
//
// Two roles × two pooling lanes, on purpose:
//   • pool()       — RESTRICTED app role (APP_DATABASE_URL, NOBYPASSRLS). Every
//                    request-time query uses it, so RLS enforces crew scope. POOLED.
//   • adminPool()  — OWNER role (DATABASE_URL) at RUNTIME: auth reads, entitlement
//                    checks, billing, webhooks, cron. BYPASSRLS. Also POOLED in prod.
//   • directPool() — OWNER role (DIRECT_DATABASE_URL), CLI only: migrations, role
//                    provisioning, batch ingest. DDL-in-a-transaction and the session
//                    advisory locks a migration runner needs DON'T work through Neon's
//                    PgBouncer pooler, so this must hit the DIRECT (non-`-pooler`) host.
let _pool: Pool | null = null;
let _adminPool: Pool | null = null;
let _directPool: Pool | null = null;
let _warnedOwnerFallback = false;

// Escape hatch for networks that block the Postgres wire protocol on :5432 (some
// corporate/work firewalls pass the TCP handshake but drop the TLS negotiation) while
// still allowing HTTPS. Neon also speaks its protocol over a WebSocket on :443, and
// @neondatabase/serverless's Pool is API-compatible with pg's. Opt in with
// DB_TRANSPORT=neon-ws — CLI/dev only; Vercel/prod stays on plain pg over :5432.
function makeNeonWsPool(connStr: string): Pool {
  neonConfig.webSocketConstructor = globalThis.WebSocket; // Node 22+/24 built-in; no `ws` dep
  // The WS transport is always TLS on :443, so libpq-only params just confuse the parser.
  const connectionString = connStr.replace(/[?&](sslmode|channel_binding)=[^&]*/g, '').replace(/\?$/, '');
  const p = new NeonPool({ connectionString, connectionTimeoutMillis: 30000, max: 5 });
  p.on('error', () => {});
  return p as unknown as Pool;
}

function makePool(connStr: string): Pool {
  const connectionString = connStr.replace('sslmode=require', '');
  const local = /localhost|127\.0\.0\.1/.test(connectionString);
  if (!local && process.env.DB_TRANSPORT === 'neon-ws') return makeNeonWsPool(connStr);
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

/**
 * The ADMIN (owner) pool — the BYPASSRLS owner role at RUNTIME: auth reads, entitlement
 * checks, billing, webhook writes, and the coach cron. Pooled in prod (it's called
 * per-request). NOT for migrations/DDL — use directPool() so it never rides the pooler.
 */
export function adminPool(): Pool {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not set');
  if (!_adminPool) _adminPool = makePool(process.env.DATABASE_URL);
  return _adminPool;
}

/**
 * The DIRECT (unpooled) owner pool — CLI only: migrations, role provisioning, batch
 * ingest. Neon's transaction pooler (PgBouncer) can't run DDL inside a transaction or
 * hold the session-level advisory locks a migration runner relies on, so these MUST use
 * the direct (`.neon.tech`, no `-pooler`) host. Falls back to DATABASE_URL when
 * DIRECT_DATABASE_URL is unset — e.g. local dev, where DATABASE_URL is already direct.
 * The serverless runtime never calls this.
 */
export function directPool(): Pool {
  const conn = process.env.DIRECT_DATABASE_URL || process.env.DATABASE_URL;
  if (!conn) throw new Error('DIRECT_DATABASE_URL / DATABASE_URL is not set');
  if (!_directPool) _directPool = makePool(conn);
  return _directPool;
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
export const hasVoyage = () => Boolean(process.env.VOYAGE_API_KEY || process.env.VOYAGE_AI_API_KEY);
/** Full vector retrieval requires both a DB and Voyage embeddings; else the coach
 *  falls back to keyword search over the curated corpus. */
export const vectorEnabled = () => hasDb() && hasVoyage();
