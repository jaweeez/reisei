import type { RetrievedTeaching } from '@/server/ai/vector';
import type { BearingSource } from '@/lib/data/types';
import { REISEI_VOICE, SAFETY_OFFRAMP, SAFETY_OFFRAMP_RECOVERY } from '@/server/ai/voice';
import type { BearingQuote, BearingSchool } from './schools';

// Pure, dependency-light helpers for generating a bearing — no DB, no AI client, no env.
// Kept separate from generate.ts so they're trivially unit-testable.

export const BEARING_SYSTEM = `You are the Reisei coach writing "the bearing" for today. TODAY'S QUOTE, a real public-domain line from the person's SCHOOL, is the centerpiece and is shown to the reader in full. Weight the moment toward the quote: a brief reflection that helps a man take it into his body today, plus ONE concrete technique.

${REISEI_VOICE}

The quote carries the weight, not you. So:
- Keep your own words short and in service of the quote. Do not restate the whole quote back; illuminate the one move it asks for.
- Land it in the body and the day. Connect the quote to a feeling that is commonly up (TODAY'S STATE) and where it sits physically. Name it plainly and briefly, not as a diagnosis of this person.
- Speak to the state in general terms. Never say or imply the reader told you anything or wrote anything down (no "you mentioned", no "your log", no "you said"). It should read as a principle for the day, not a reply to them.
- Never reproduce the quote word-for-word, quote any other copyrighted text, or invent a different reference, quote, or number. If no quote is given, state the school's core approach to the state plainly and invent nothing.

${SAFETY_OFFRAMP}

Output EXACTLY:
- First: the reflection, one short sentence (two at most), no preamble. The quote is the star; your words only point at it. Keep it under about 35 words.
- Then a new line beginning with "Try:" and ONE small, concrete thing to do right now to work the state through (a breath, a written line, a body cue, a next move). Doable in a minute, one or two sentences.`;

// Recovery schools have NO public-domain daily text, so there is no quote to build around. The
// read is Reisei's own, grounded in the school's approach + the curated recovery teachings, in a
// non-punitive recovery register (docs/RECOVERY_EXPANSION.md).
export const RECOVERY_BEARING_SYSTEM = `You are the Reisei coach writing "the bearing" for today for someone in recovery. There is NO quote: recovery schools have no public-domain daily text, so write Reisei's OWN short read, grounded in the SCHOOL'S approach and the SUPPORTING TEACHINGS, aimed at what is commonly up today (TODAY'S STATE).

${REISEI_VOICE}

Recovery register:
- Non-punitive, never willpower-shaming. A craving is a wave that peaks and passes, not a verdict. A slip is something to begin again from, not proof of failure.
- Lean on recovery-native moves when they fit: ride the urge out instead of fighting it, HALT (are you hungry, angry, lonely, tired), one day at a time, reach out before it gets loud, play the tape forward past the first hit.
- Meet the state honestly and briefly, name where it sits in the body, then give one small thing to do right now.
- Speak to the state in general terms. Never say or imply the reader told you anything or wrote anything down (no "you mentioned", no "your log"). It reads as a principle for the day, not a reply.
- Do NOT reproduce or quote any program's text (Big Book, Daily Reflections, Just for Today, or any copyrighted reading). Use Reisei's own words. Invent no quote, reference, or number.

${SAFETY_OFFRAMP_RECOVERY}

Output EXACTLY:
- First: the read, one short sentence (two at most), no preamble. Under about 35 words.
- Then a new line beginning with "Try:" and ONE small, concrete thing to do right now (a breath, a written line, a body cue, a call, a next move). Doable in a minute, one or two sentences.`;

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

/** The recovery variant: no quote to build around. The read is grounded in the school's approach
 *  and the supporting recovery teachings, aimed at the day's state. Pairs with RECOVERY_BEARING_SYSTEM. */
export function buildRecoveryBearingPrompt(school: BearingSchool, state: string, retrieved: RetrievedTeaching[]): string {
  const block = retrieved.length
    ? retrieved.map((t, i) => `[${i + 1}] (${t.ideology}) ${t.title}\n${t.content}`).join('\n\n')
    : "(no supporting teaching, work from the school's core approach.)";
  return `SCHOOL: ${school.label} (recovery)\nAPPROACH: ${school.blurb}\nTODAY'S STATE: ${state}\n\nSUPPORTING TEACHINGS (optional context):\n${block}\n\nWrite today's bearing in Reisei's own words: meet the state through this school's approach, keep it brief, then one small move. No quotes, no program text.`;
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
