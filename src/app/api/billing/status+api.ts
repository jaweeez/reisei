import { currentUser } from '@/server/auth/session';
import { adminPool } from '@/server/db';
import { getEntitlement } from '@/server/entitlement';
import { billingEnabled, orgIntervals, proIntervals, seatIntervals } from '@/server/billing/stripe';

// GET /api/billing/status → what billing options the signed-in user should see.
export async function GET(req: Request) {
  const userId = await currentUser(req);
  if (!userId) return Response.json({ error: 'unauthenticated' }, { status: 401 });

  const [ent, cust] = await Promise.all([
    getEntitlement(userId),
    adminPool().query<{ stripe_customer_id: string | null }>(`select stripe_customer_id from users where id = $1`, [userId]),
  ]);
  const enabled = billingEnabled();
  const hasCustomer = Boolean(cust.rows[0]?.stripe_customer_id);

  return Response.json({
    enabled,
    tier: ent.tier,
    proIntervals: proIntervals(),
    seatIntervals: seatIntervals(),
    orgIntervals: orgIntervals(),
    canUpgrade: enabled && ent.tier === 'free' && proIntervals().length > 0,
    portalAvailable: enabled && hasCustomer,
  });
}
