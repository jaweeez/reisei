import { currentUser } from '@/server/auth/session';
import { adminPool } from '@/server/db';
import { appOrigin, billingEnabled, billingNotConfigured, stripe } from '@/server/billing/stripe';

// POST /api/billing/portal → a Stripe Customer Portal URL for managing/cancelling.
export async function POST(req: Request) {
  if (!billingEnabled()) return billingNotConfigured();
  const userId = await currentUser(req);
  if (!userId) return Response.json({ error: 'unauthenticated' }, { status: 401 });

  const customerId = (await adminPool().query<{ stripe_customer_id: string | null }>(
    `select stripe_customer_id from users where id = $1`,
    [userId],
  )).rows[0]?.stripe_customer_id;
  if (!customerId) return Response.json({ error: 'No billing account yet.' }, { status: 400 });

  const session = await stripe().billingPortal.sessions.create({
    customer: customerId,
    return_url: `${appOrigin(req)}/settings`,
  });
  return Response.json({ url: session.url });
}
