import type { Pool } from 'pg';
import { sendCodeEmail } from '@/server/email';
import { hashSecret, verifySecret } from './credential';
import { CODE_TTL_MS, cooldownRemaining, generateCode, MAX_CODE_ATTEMPTS, underDailyCap } from './codes';

// DB I/O for the one-time codes in `auth_codes`. The table is auth-infrastructure (no RLS),
// so these run on the owner pool (adminPool). The cooldown / cap / attempt logic uses the
// pure helpers in codes.ts. Used by both logged-in (verify email) and pre-session (reset) flows.

type Purpose = 'verify_email' | 'pin_reset';

export type IssueResult = { ok: true } | { ok: false; cooldown: number } | { ok: false; capped: true };

/** Generate + email a code, enforcing the resend cooldown and the daily cap. */
export async function issueCode(p: Pool, userId: string, email: string, purpose: Purpose): Promise<IssueResult> {
  const recent = await p.query(
    `select created_at, count(*) over () as day_count
       from auth_codes
      where user_id = $1 and purpose = $2 and created_at > now() - interval '1 day'
      order by created_at desc`,
    [userId, purpose],
  );
  const lastMs = recent.rows[0] ? new Date(recent.rows[0].created_at as string).getTime() : null;
  const dayCount = Number(recent.rows[0]?.day_count ?? 0);

  const cd = cooldownRemaining(lastMs, Date.now());
  if (cd > 0) return { ok: false, cooldown: cd };
  if (!underDailyCap(dayCount)) return { ok: false, capped: true };

  const code = generateCode();
  const codeHash = await hashSecret(code);
  await p.query(
    `insert into auth_codes (user_id, purpose, code_hash, email, expires_at)
     values ($1, $2, $3, $4, now() + ($5 || ' milliseconds')::interval)`,
    [userId, purpose, codeHash, email, String(CODE_TTL_MS)],
  );
  await sendCodeEmail(email, code, purpose);
  return { ok: true };
}

/** Verify the latest code for (user, purpose). On success marks it consumed and returns its email. */
export async function checkCode(
  p: Pool,
  userId: string,
  purpose: Purpose,
  code: string,
): Promise<{ ok: true; email: string } | { ok: false }> {
  const { rows } = await p.query(
    `select id, code_hash, email, expires_at, consumed_at, attempts
       from auth_codes
      where user_id = $1 and purpose = $2
      order by created_at desc limit 1`,
    [userId, purpose],
  );
  const row = rows[0];
  if (!row || row.consumed_at || new Date(row.expires_at as string) < new Date() || Number(row.attempts) >= MAX_CODE_ATTEMPTS) {
    return { ok: false };
  }
  if (!(await verifySecret(code, row.code_hash as string))) {
    await p.query(`update auth_codes set attempts = attempts + 1 where id = $1`, [row.id]);
    return { ok: false };
  }
  await p.query(`update auth_codes set consumed_at = now() where id = $1`, [row.id]);
  return { ok: true, email: row.email as string };
}
