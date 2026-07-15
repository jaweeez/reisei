import { adminPool } from './db';

// What a user is entitled to. ONE row is the source of truth — the app only ever
// asks "what tier is this user?", never "where did they buy?". Three rails feed it:
//   • users.plan ∈ {free,pro}  — the individual Pro sub (Stripe web OR RevenueCat IAP)
//   • an active SEAT            — a Corner seat or an org seat, sponsored by someone
//     else's Stripe subscription (seat_assignments ⋈ subscriptions)
//   • owning an ORG             — the sponsor of an active org subscription
// A seated member is 'team' (Pro-level features on a comped seat) regardless of their
// personal plan; an org owner is 'org'. See the monetization spec in memory [[reisei-app]].

export type Tier = 'free' | 'pro' | 'team' | 'org';

export interface Entitlement {
  tier: Tier;
  /** Pro-level features (create/captain crews, history, all schools, full log). */
  premium: boolean;
  /** May this user create & captain a crew? (any paid tier) */
  canCreateCrew: boolean;
  /** Captains at least one crew today. */
  isCaptain: boolean;
  /** True platform admin (superuser). Orthogonal to tier; implies premium. */
  isAdmin: boolean;
  /** Owns an org row at ALL (any subscription status). Tier only says 'org' while the
   *  sub is live; this keeps the dashboard/renew path reachable after a lapse. */
  ownsOrg: boolean;
  /** Direct Pro coverage usage, excluding the subscriber. */
  coverage?: { used: number; total: number };
  /** True when this account's premium access comes from another direct Pro subscriber. */
  coveredByPro: boolean;
}

/** Pure tier ladder: org ownership > a sponsored seat > the personal plan. Exported for jest. */
export function deriveTier(r: { owns_org: boolean; has_seat: boolean; has_coverage?: boolean; user_plan: string }): Tier {
  if (r.owns_org) return 'org';
  if (r.has_seat || r.has_coverage) return 'team';
  return ((r.user_plan as Tier) || 'free');
}

export async function getEntitlement(userId: string): Promise<Entitlement> {
  const { rows } = await adminPool().query<{
    user_plan: string;
    has_seat: boolean;
    has_coverage: boolean;
    owns_org: boolean;
    owns_any_org: boolean;
    is_captain: boolean;
    is_admin: boolean;
    covered_count: number;
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
          select 1 from pro_covered_members pcm
            join users sponsor on sponsor.id = pcm.sponsor_id
           where pcm.user_id = u.id and sponsor.plan = 'pro'
        ) as has_coverage,
        exists(
          select 1 from orgs o
            join subscriptions s on s.org_id = o.id
           where o.owner_id = u.id and s.status in ('active', 'trialing')
        ) as owns_org,
        exists(select 1 from orgs o where o.owner_id = u.id) as owns_any_org,
        exists(
          select 1 from crew_members cm
           where cm.user_id = u.id and cm.role = 'captain'
        ) as is_captain,
        (select count(*)::int from pro_covered_members pcm where pcm.sponsor_id = u.id) as covered_count
      from users u
     where u.id = $1`,
    [userId],
  );
  const r = rows[0];
  const tier = deriveTier({
    owns_org: !!r?.owns_org,
    has_seat: !!r?.has_seat,
    has_coverage: !!r?.has_coverage,
    user_plan: r?.user_plan ?? 'free',
  });
  const isAdmin = !!r?.is_admin;
  const premium = isAdmin || tier !== 'free';
  const coveredByPro = !!r?.has_coverage;
  return {
    tier,
    premium,
    canCreateCrew: premium && !coveredByPro,
    isCaptain: !!r?.is_captain,
    isAdmin,
    ownsOrg: !!r?.owns_any_org,
    coverage: r?.user_plan === 'pro' ? { used: Number(r.covered_count ?? 0), total: 2 } : undefined,
    coveredByPro,
  };
}
