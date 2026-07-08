import type { RetrievedTeaching } from '@/server/ai/vector';
import type { BearingSource } from '@/lib/data/types';
import type { BearingSchool } from './schools';

// Pure, dependency-light helpers for generating a bearing — no DB, no AI client, no env.
// Kept separate from generate.ts so they're trivially unit-testable.

export const BEARING_SYSTEM = `You are the Reisei coach delivering "the bearing" — ONE operating principle to steer by today, drawn from the SCHOOL the person follows. 冷静: cold head, steady, level.

Voice: a coach, not a counselor. Direction, not mood.
- Terse. The principle is 1-2 plain sentences. No hype, no cheerleading, no exclamation marks, no emojis.
- Present the tradition with respect and accuracy. State the SCHOOL's actual idea from the TEACHINGS — do not flatten it into generic advice, and do not put words in the tradition's mouth beyond what the teachings support.
- This is a principle to ACT on, not devotional or worship content.

Hard rules:
- Use ONLY the ideas in the TEACHINGS provided. Never quote copyrighted text — state the principle in your OWN words.
- Never invent a scripture reference, quote, or number. If the teachings are thin, state the school's core principle plainly.
- Banned words (never output): mindfulness, meditation, journaling, wellness, mental health, self-care, mood, feelings, anxiety, depression, therapy, healing.

Output format, EXACTLY:
- First line(s): the principle (1-2 sentences), in Reisei's voice.
- Then a new line beginning with "Q: " and ONE short question or concrete action to carry into today.`;

/** The link-out for the bearing: prefer a retrieved chunk's url (same school), else the
 *  school's canonical source. Attribution always stays the school's (trusted). */
export function pickSource(retrieved: RetrievedTeaching[], school: BearingSchool): BearingSource {
  const withUrl = retrieved.find((r) => r.url && r.ideology === school.ideology);
  if (withUrl?.url) {
    return { url: withUrl.url, title: withUrl.title ?? school.source.title, attribution: school.source.attribution };
  }
  return school.source;
}

/** Split a flattened curated chunk ("Title (ideology, theme). Teaching. Practice: X — src")
 *  into a clean principle + an actionable prompt. Used for the no-AI fallback. */
export function splitTeachingContent(content: string): { principle: string; prompt: string | null } {
  const cleaned = content.replace(/^[^.]*\([^)]*\)\.\s*/, '').trim(); // drop the "Title (ideology, theme). " lead
  const parts = cleaned.split(/Practice:/i);
  const stripSource = (s: string) => s.replace(/\s*—\s*[^—]*$/, '').trim();
  const principle = stripSource(parts[0] ?? cleaned) || cleaned;
  const prompt = parts.length > 1 ? stripSource(parts.slice(1).join('Practice:')) || null : null;
  return { principle, prompt };
}

export function buildBearingPrompt(school: BearingSchool, theme: string, retrieved: RetrievedTeaching[]): string {
  const block = retrieved.length
    ? retrieved.map((t, i) => `[${i + 1}] (${t.ideology}) ${t.title}\n${t.content}`).join('\n\n')
    : "(no matching teaching — state the school's core principle plainly, invent nothing)";
  return `SCHOOL: ${school.label}\nTHEME TODAY: ${theme}\n\nTEACHINGS:\n${block}\n\nWrite today's bearing.`;
}

/** Parse the model output ("<principle>\nQ: <question>") into its two parts. */
export function parseBearingText(text: string): { principle: string; prompt: string | null } {
  const t = text.trim();
  const m = t.match(/\n?\s*Q:\s*/i);
  if (m && m.index !== undefined) {
    const principle = t.slice(0, m.index).replace(/^PRINCIPLE:\s*/i, '').trim();
    const prompt = t.slice(m.index + m[0].length).trim();
    return { principle, prompt: prompt || null };
  }
  return { principle: t.replace(/^PRINCIPLE:\s*/i, '').trim(), prompt: null };
}
