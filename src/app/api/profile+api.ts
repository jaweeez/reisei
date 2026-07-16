import { currentUser } from '@/server/auth/session';
import { withUser } from '@/server/db';

// GET  /api/profile → the user's editable voice preferences.
// POST /api/profile { addressRegister } → set the voice register ('default' | 'neutral').
// The register is honored by GENERATED copy (the Bearing / coach); see src/server/ai/voice.ts.

const REGISTERS = new Set(['default', 'neutral']);

export async function GET(req: Request) {
  const userId = await currentUser(req);
  if (!userId) return Response.json({ error: 'unauthenticated' }, { status: 401 });
  const row = await withUser(userId, async (c) =>
    (await c.query(`select address_register as "addressRegister" from users where id = current_app_user()`)).rows[0],
  );
  return Response.json(row ?? { addressRegister: 'default' });
}

export async function POST(req: Request) {
  const userId = await currentUser(req);
  if (!userId) return Response.json({ error: 'unauthenticated' }, { status: 401 });

  let b: { addressRegister?: unknown };
  try {
    b = await req.json();
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const register = REGISTERS.has(b.addressRegister as string) ? (b.addressRegister as string) : null;
  if (!register) return Response.json({ error: 'Choose a valid register.' }, { status: 400 });

  const row = await withUser(userId, async (c) =>
    (
      await c.query(
        `update users set address_register = $1 where id = current_app_user()
         returning address_register as "addressRegister"`,
        [register],
      )
    ).rows[0],
  );
  return Response.json(row);
}
