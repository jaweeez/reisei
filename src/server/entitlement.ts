import { adminPool } from './db';

// What a user is entitled to. ONE row is the source of truth — the app only ever
// asks "what tier is this user?", never "where did they buy?". Two rails feed it:
//   • users.plan ∈ {free,pro}  — the individual Pro sub (Stripe web OR RevenueCat IAP)
//   • an active team SEAT       — sponsored by someone else's Stripe subscription
// A seated member is 'team' (Pro-level features + a comped seat) regardless of their
// personal plan. See the monetization spec in memory [[reisei-app]].

export type Tier = 'free' | 'pro' | 'team';

export interface Entitlement {
  tier: Tier;
  /** Pro-level features (create/captain crews, history, streak insurance, widgets). */
  premium: boolean;
  /** May this user create & captain a crew? (Pro or Team.) */
  canCreateCrew: boolean;
  /** Captains at least one crew today. */
  isCaptain: boolean;
  /** True platform admin (superuser). Orthogonal to tier; implies premium. */
  isAdmin: boolean;
}

export async function getEntitlement(userId: string): Promise<Entitlement> {
  const { rows } = await adminPool().query<{
    user_plan: string;
    has_seat: boolean;
    is_captain: boolean;
    is_admin: boolean;
  }>(
    `select
        coalesce(u.plan, 'free') as user_plan,
        coalesce(u.is_admin, false) as is_admin,
        exists(
          select 1 from seat_assignments sa
            join subscriptions s on s.id = sa.subscription_id
           where sa.user_id = u.id and s.status in ('active', 'trialing')
        ) as has_seat,
        exists(
          select 1 from crew_members cm
           where cm.user_id = u.id and cm.role = 'captain'
        ) as is_captain
      from users u
     where u.id = $1`,
    [userId],
  );
  const r = rows[0];
  const tier: Tier = r?.has_seat ? 'team' : ((r?.user_plan as Tier) ?? 'free');
  const isAdmin = !!r?.is_admin;
  const premium = isAdmin || tier !== 'free';
  return { tier, premium, canCreateCrew: premium, isCaptain: !!r?.is_captain, isAdmin };
}
