import type { RetrievedTeaching } from '@/server/ai/vector';
import type { BearingSource } from '@/lib/data/types';
import { REISEI_VOICE, SAFETY_OFFRAMP } from '@/server/ai/voice';
import type { BearingQuote, BearingSchool } from './schools';

// Pure, dependency-light helpers for generating a bearing — no DB, no AI client, no env.
// Kept separate from generate.ts so they're trivially unit-testable.

export const BEARING_SYSTEM = `You are the Reisei coach writing "the bearing" for today. TODAY'S QUOTE, a real public-domain line from the person's SCHOOL, is the centerpiece and is shown to the reader in full. Weight the moment toward the quote: a brief reflection that helps a man take it into his body today, plus ONE concrete technique.

${REISEI_VOICE}

The quote carries the weight, not you. So:
- Keep your own words short and in service of the quote. Do not restate the whole quote back; illuminate the one move it asks for.
- Land it in the body and the day. Connect the quote to a feeling that is commonly up (TODAY'S STATE) and where it sits physically. Name it plainly and briefly, not as a diagnosis of this person.
- Never reproduce the quote word-for-word, quote any other copyrighted text, or invent a different reference, quote, or number. If no quote is given, state the school's core approach to the state plainly and invent nothing.

${SAFETY_OFFRAMP}

Output EXACTLY:
- First: the reflection, one short sentence (two at most), no preamble. The quote is the star; your words only point at it. Keep it under about 35 words.
- Then a new line beginning with "Try:" and ONE small, concrete thing to do right now to work the state through (a breath, a written line, a body cue, a next move). Doable in a minute, one or two sentences.`;

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

export function buildBearingPrompt(school: BearingSchool, quote: BearingQuote | null, state: string, retrieved: RetrievedTeaching[]): string {
  const block = retrieved.length
    ? retrieved.map((t, i) => `[${i + 1}] (${t.ideology}) ${t.title}\n${t.content}`).join('\n\n')
    : "(no supporting teaching — work from the quote and the school's core approach.)";
  const quoteLine = quote
    ? `TODAY'S QUOTE (public domain, from this school): "${quote.text}" — ${quote.ref}`
    : "(no quote today — state the school's core approach to the state plainly.)";
  return `SCHOOL: ${school.label}\n${quoteLine}\nTODAY'S STATE: ${state}\n\nSUPPORTING TEACHINGS (optional context):\n${block}\n\nWrite today's bearing: let the quote lead and carry the weight, keep your reflection brief and in service of it, then one small technique.`;
}

/** Parse the model output ("<read>\nTry: <technique>") into its two parts. Accepts the
 *  older "Q:" marker too, and strips a leading READ:/PRINCIPLE: label if present. */
export function parseBearingText(text: string): { principle: string; prompt: string | null } {
  const t = text.trim();
  const m = t.match(/\n?\s*(?:Try|Q):\s*/i);
  if (m && m.index !== undefined) {
    const principle = t.slice(0, m.index).replace(/^(?:READ|PRINCIPLE):\s*/i, '').trim();
    const prompt = t.slice(m.index + m[0].length).trim();
    return { principle, prompt: prompt || null };
  }
  return { principle: t.replace(/^(?:READ|PRINCIPLE):\s*/i, '').trim(), prompt: null };
}

/** House style bans em dashes, but the model still emits them now and then. Strip em/en
 *  dashes from generated copy at the source: a dash between clauses becomes a comma. */
export function deDash(s: string): string {
  return s
    .replace(/\s*[—–]\s*/g, ', ')
    .replace(/,\s*,/g, ',')
    .replace(/\s+([,.;:!?])/g, '$1')
    .trim();
}
