import { currentUser } from '@/server/auth/session';
import { withUser } from '@/server/db';
import type { ReachOutPreference } from '@/lib/data/types';

const REACH_OUT = new Set<ReachOutPreference>(['reisei_nudge', 'text', 'call', 'next_meeting', 'one_day']);

export async function POST(req: Request) {
  const userId = await currentUser(req);
  if (!userId) return Response.json({ error: 'unauthenticated' }, { status: 401 });

  let b: { honestyAccepted?: unknown; reachOutPreference?: unknown; recoveryTermsAccepted?: unknown };
  try {
    b = await req.json();
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const accepts = b.honestyAccepted === true;
  const recoveryAccepts = b.recoveryTermsAccepted === true;
  const preference = REACH_OUT.has(b.reachOutPreference as ReachOutPreference)
    ? (b.reachOutPreference as ReachOutPreference)
    : null;
  if (!accepts && !preference && !recoveryAccepts) return Response.json({ error: 'Nothing to update.' }, { status: 400 });

  const profile = await withUser(userId, async (c) =>
    (
      await c.query(
        `insert into accountability_profiles (user_id, honesty_acknowledged_at, reach_out_preference, recovery_terms_acknowledged_at, updated_at)
         values (current_app_user(), case when $1 then now() else null end, $2, case when $3 then now() else null end, now())
         on conflict (user_id) do update set
           honesty_acknowledged_at = case when $1 then coalesce(accountability_profiles.honesty_acknowledged_at, now()) else accountability_profiles.honesty_acknowledged_at end,
           reach_out_preference = coalesce($2, accountability_profiles.reach_out_preference),
           recovery_terms_acknowledged_at = case when $3 then coalesce(accountability_profiles.recovery_terms_acknowledged_at, now()) else accountability_profiles.recovery_terms_acknowledged_at end,
           updated_at = now()
         returning honesty_acknowledged_at is not null as "honestyAcknowledged",
                   reach_out_preference as "reachOutPreference",
                   recovery_terms_acknowledged_at is not null as "recoveryTermsAcknowledged"`,
        [accepts, preference, recoveryAccepts],
      )
    ).rows[0],
  );
  return Response.json(profile);
}
