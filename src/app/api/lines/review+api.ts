import { currentUser } from '@/server/auth/session';
import { withUser } from '@/server/db';
import { localDateFor } from '@/server/streak';
import type { EarlyChangeReason, LineKind, LineReviewAction } from '@/lib/data/types';

const ACTIONS = new Set<LineReviewAction>(['keep', 'refine', 'raise', 'replace', 'retire']);
const EARLY_REASONS = new Set<EarlyChangeReason>(['unclear', 'unrealistic', 'circumstances', 'unsafe', 'other']);

export async function POST(req: Request) {
  const userId = await currentUser(req);
  if (!userId) return Response.json({ error: 'unauthenticated' }, { status: 401 });

  let b: {
    action?: unknown;
    statement?: unknown;
    kind?: unknown;
    easier?: unknown;
    friction?: unknown;
    nextStandard?: unknown;
    earlyReason?: unknown;
  };
  try {
    b = await req.json();
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const action = b.action as LineReviewAction;
  if (!ACTIONS.has(action)) return Response.json({ error: 'Choose what comes next.' }, { status: 400 });
  const kind: LineKind = b.kind === 'hold' ? 'hold' : 'abstain';
  const statement = typeof b.statement === 'string' ? b.statement.trim() : '';
  if (['refine', 'raise', 'replace'].includes(action) && (statement.length < 2 || statement.length > 80)) {
    return Response.json({ error: 'Your next Line must be 2 to 80 characters.' }, { status: 400 });
  }

  try {
    const result = await withUser(userId, async (c) => {
      const tz = (await c.query(`select tz from users where id = current_app_user()`)).rows[0]?.tz ?? 'UTC';
      const today = localDateFor(tz);
      const active = (
        await c.query(
          `select l.id as line_id, l.statement, l.kind, lc.id as cycle_id,
                  to_char(lc.review_local_date, 'YYYY-MM-DD') as review_local_date
             from lines l join line_cycles lc on lc.line_id = l.id and lc.outcome = 'active'
            where l.user_id = current_app_user() and l.status = 'active'
            limit 1`,
        )
      ).rows[0] as { line_id: string; statement: string; kind: LineKind; cycle_id: string; review_local_date: string } | undefined;
      if (!active) return { error: 'No active Line to review.', status: 404 };

      const early = today < active.review_local_date;
      const earlyReason = EARLY_REASONS.has(b.earlyReason as EarlyChangeReason) ? (b.earlyReason as EarlyChangeReason) : null;
      if (early && !earlyReason) return { error: 'Name why you are changing the Line early.', status: 400 };
      if (early && action === 'keep') return { error: 'Keep the Line through the review date, or choose how it needs to change.', status: 400 };

      const checkedIn = (await c.query(`select 1 from check_ins where user_id = current_app_user() and local_date = $1`, [today])).rowCount;
      if (checkedIn) return { error: 'Today is already logged. Make this change tomorrow before checking in.', status: 409 };

      const cycleOutcome = early
        ? 'changed_early'
        : action === 'keep'
          ? 'kept'
          : action === 'refine'
            ? 'refined'
            : action === 'raise'
              ? 'raised'
              : action === 'replace'
                ? 'replaced'
                : 'retired';

      await c.query(
        `update line_cycles set outcome = $2, end_local_date = ($3::date - 1)
          where id = $1 and outcome = 'active'`,
        [active.cycle_id, cycleOutcome, today],
      );
      await c.query(
        `insert into line_reviews (cycle_id, user_id, action, easier, friction, next_standard, early_reason)
         values ($1, current_app_user(), $2, $3, $4, $5, $6)`,
        [
          active.cycle_id,
          action,
          typeof b.easier === 'string' ? b.easier.trim().slice(0, 500) || null : null,
          typeof b.friction === 'string' ? b.friction.trim().slice(0, 500) || null : null,
          typeof b.nextStandard === 'string' ? b.nextStandard.trim().slice(0, 500) || null : null,
          earlyReason,
        ],
      );

      if (action === 'keep') {
        const cycle = (
          await c.query(
            `insert into line_cycles (user_id, line_id, start_local_date, review_local_date)
             values (current_app_user(), $1, $2, ($2::date + 14))
             returning id, to_char(start_local_date,'YYYY-MM-DD') as "startLocalDate",
                       to_char(review_local_date,'YYYY-MM-DD') as "reviewLocalDate"`,
            [active.line_id, today],
          )
        ).rows[0];
        return { ok: true, lineId: active.line_id, cycle };
      }

      await c.query(
        `update lines set status = 'retired', retired_local_date = ($2::date - 1)
          where id = $1 and user_id = current_app_user()`,
        [active.line_id, today],
      );
      if (action === 'retire') return { ok: true, lineId: null };

      const next = (
        await c.query(
          `insert into lines (user_id, statement, kind, start_local_date)
           values (current_app_user(), $1, $2, $3)
           returning id, statement, kind, to_char(start_local_date,'YYYY-MM-DD') as "startLocalDate"`,
          [statement, kind, today],
        )
      ).rows[0];
      const cycle = (
        await c.query(
          `insert into line_cycles (user_id, line_id, start_local_date, review_local_date)
           values (current_app_user(), $1, $2, ($2::date + 14))
           returning id, to_char(start_local_date,'YYYY-MM-DD') as "startLocalDate",
                     to_char(review_local_date,'YYYY-MM-DD') as "reviewLocalDate"`,
          [next.id, today],
        )
      ).rows[0];
      return { ok: true, line: next, cycle };
    });
    if ('error' in result) return Response.json({ error: result.error }, { status: result.status });
    return Response.json(result);
  } catch (e) {
    if ((e as { code?: string }).code === '23505') {
      return Response.json({ error: 'That Line changed elsewhere. Refresh and try again.' }, { status: 409 });
    }
    throw e;
  }
}
