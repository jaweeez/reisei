import { generateText } from 'ai';
import { anthropic, CHAT_MODEL, chatEnabled } from '@/server/ai/anthropic';
import { searchTeachings } from '@/server/ai/vector';
import { currentUser } from '@/server/auth/session';

// POST /api/coach { situation?, ideology? } → a terse, disciplined nudge GROUNDED in
// the coach corpus (Stoicism / CBT / mindfulness). "A coach, not a counselor."
// Retrieval-augmented: pulls relevant teachings, then Claude applies one to the moment.

const IDEOLOGIES = new Set(['stoicism', 'cbt', 'mindfulness']);
const MAX_SITUATION = 1000;

const SYSTEM = `You are the Reisei coach. 冷静 — cold head, steady crew, stay level.

Voice: a coach, not a counselor. Direction, not mood.
- Terse. One to three sentences. Plain words.
- Never cheerleader-y. No "you're amazing", no hype, no exclamation-point energy, no emojis.
- Disciplined and level, even when the person is not.

Grounding:
- Apply ONE principle from the TEACHINGS provided to the person's actual situation.
- If it's natural, name the tradition in a few words (e.g. "The Stoics would say…"). Do not lecture.
- If no teaching fits, give a plain disciplined nudge — never invent a source or quote.
- End with ONE concrete next action.`;

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
      : 'I want to stay disciplined and hold my line today.';
  const ideology = typeof body.ideology === 'string' && IDEOLOGIES.has(body.ideology) ? body.ideology : undefined;

  try {
    const teachings = await searchTeachings(situation, ideology, 5);
    const grounding = teachings.map((t) => ({ title: t.title, ideology: t.ideology, theme: t.theme, url: t.url }));

    const teachingBlock = teachings.length
      ? teachings.map((t, i) => `[${i + 1}] (${t.ideology}) ${t.title}\n${t.content}`).join('\n\n')
      : '(no matching teaching — give a plain disciplined nudge without a source)';

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
    return Response.json({ error: 'The coach is waking up — try again in a moment.' }, { status: 503 });
  }
}
