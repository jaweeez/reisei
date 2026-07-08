import { generateText } from 'ai';
import { anthropic, CHAT_MODEL, chatEnabled } from '@/server/ai/anthropic';
import { searchTeachings } from '@/server/ai/vector';
import { currentUser } from '@/server/auth/session';
import { REISEI_VOICE, SAFETY_OFFRAMP } from '@/server/ai/voice';

// POST /api/coach { situation?, ideology? } → a short, grounded reply that helps the person
// notice what's actually up and gives one small move. "A coach, not a counselor."
// Retrieval-augmented: pulls relevant teachings from the chosen school, then Claude applies one.

const IDEOLOGIES = new Set([
  'stoicism', 'modern-stoicism', 'cbt', 'act', 'buddhism', 'daoism',
  'hinduism', 'christianity', 'islam', 'epicureanism', 'existentialism', 'mindfulness',
]);
const MAX_SITUATION = 1000;

const SYSTEM = `You are the Reisei coach. Someone checks in with what's going on. You give one steady, grounded reply.

${REISEI_VOICE}

Grounding:
- Help them notice what's actually here, then give ONE small next move.
- If it fits, use ONE idea from the TEACHINGS provided, in your own words. Name the tradition in a few words if it is natural (for example, "The Stoics would say..."). Do not lecture.
- If no teaching fits, give a plain grounded reply. Never invent a source or quote.

${SAFETY_OFFRAMP}`;

export async function POST(req: Request) {
  const userId = await currentUser(req);
  if (!userId) return Response.json({ error: 'Please sign in.' }, { status: 401 });
  if (!chatEnabled()) {
    return Response.json({ error: 'Coach is not configured. Set ANTHROPIC_API_KEY on the server.' }, { status: 503 });
  }

  let body: { situation?: unknown; ideology?: unknown };
  try {
    body = await req.json();
  } catch {
    body = {};
  }
  const situation =
    typeof body.situation === 'string' && body.situation.trim()
      ? body.situation.trim().slice(0, MAX_SITUATION)
      : 'Checking in. Not sure what I am feeling today.';
  const ideology = typeof body.ideology === 'string' && IDEOLOGIES.has(body.ideology) ? body.ideology : undefined;

  try {
    const teachings = await searchTeachings(situation, ideology, 5);
    const grounding = teachings.map((t) => ({ title: t.title, ideology: t.ideology, theme: t.theme, url: t.url }));

    const teachingBlock = teachings.length
      ? teachings.map((t, i) => `[${i + 1}] (${t.ideology}) ${t.title}\n${t.content}`).join('\n\n')
      : '(no matching teaching. Give a plain grounded reply without a source.)';

    const { text } = await generateText({
      model: anthropic(CHAT_MODEL),
      system: SYSTEM,
      prompt: `SITUATION:\n${situation}\n\nTEACHINGS:\n${teachingBlock}\n\nWrite the coach's nudge.`,
      maxTokens: 220,
      temperature: 0.6,
    });

    return Response.json({ nudge: text.trim(), grounding });
  } catch (e) {
    console.error('coach error:', e instanceof Error ? e.message : e);
    return Response.json({ error: 'The coach is waking up. Try again in a moment.' }, { status: 503 });
  }
}
