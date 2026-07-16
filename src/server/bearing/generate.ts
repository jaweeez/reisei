import { generateText } from 'ai';
import { anthropic, CHAT_MODEL, chatEnabled } from '@/server/ai/anthropic';
import { searchTeachings } from '@/server/ai/vector';
import type { BearingSource } from '@/lib/data/types';
import { type BearingQuote, getSchool, quoteForToday, stateForToday, themeForToday } from './schools';
import { registerDirective } from '@/server/ai/voice';
import { BEARING_SYSTEM, RECOVERY_BEARING_SYSTEM, buildBearingPrompt, buildRecoveryBearingPrompt, deDash, parseBearingText, pickSource, splitTeachingContent } from './compose';

/** Optional per-user steer: build the read around a specific quote + felt-state instead of the
 *  shared date rotation. Omitted ⇒ generateBearing behaves exactly as the neutral daily path. */
export interface BearingSteer {
  quote?: BearingQuote | null;
  state?: string;
  /** The reader's live struggle embedding: biases corpus retrieval toward what is actually up. */
  queryVec?: number[];
  /** How to address the reader ('default' | 'neutral'). Appends a directive to the system prompt. */
  register?: string;
}

// Generate "the bearing" for a school on a given local date: retrieve grounding from the
// coach corpus (searchTeachings — vector when Voyage is configured, else keyword fallback),
// then Claude writes Reisei's OWN terse principle. With no ANTHROPIC key (or on any error)
// it falls back to the top curated teaching, so the feature always returns something.
// Reuses the exact retrieval + generation stack the coach (/api/coach) uses.

export interface GeneratedBearing {
  principle: string;
  prompt: string | null;
  source: BearingSource;
  /** The day's anchoring quote (text + citation), or null for an un-sourced school. */
  quote: { text: string; ref: string } | null;
  grounding: { title: string | null; ideology: string | null; theme: string | null; url: string | null }[];
  model: string;
}

export async function generateBearing(ideology: string, localDate: string, steer?: BearingSteer): Promise<GeneratedBearing> {
  const school = getSchool(ideology);
  if (!school) throw new Error(`unknown school: ${ideology}`);

  const theme = themeForToday(school, localDate);
  // A steer aims the read at the user's live struggle; absent it, the shared date rotation. The
  // state also seeds retrieval, so steering it pulls corpus teachings that speak to the struggle.
  const state = steer?.state ?? stateForToday(localDate);
  // `null` is intentional: the reader has exhausted this school's displayed quote set, so
  // generate a source-grounded Bearing without repeating one of those quotes.
  const quote = steer && 'quote' in steer ? steer.quote ?? null : quoteForToday(school, localDate);
  const retrieved = await searchTeachings(`${theme} ${state}`.trim() || school.label, ideology, 5, steer?.queryVec);
  // Prefer the day's quote as the link-out (its exact passage); else the school's canonical source.
  const source = quote ? { url: quote.url, title: quote.ref, attribution: school.source.attribution } : pickSource(retrieved, school);
  const viewQuote = quote ? { text: quote.text, ref: quote.ref } : null;
  const grounding = retrieved.map((t) => ({ title: t.title, ideology: t.ideology, theme: t.theme, url: t.url }));

  const fallback = (): GeneratedBearing => {
    const top = retrieved[0];
    const base = top ? splitTeachingContent(top.content) : { principle: school.blurb, prompt: null };
    return { principle: deDash(base.principle), prompt: base.prompt ? deDash(base.prompt) : null, source, quote: viewQuote, grounding, model: 'fallback' };
  };

  if (!chatEnabled()) return fallback();

  // Recovery schools have no quote and use a non-punitive recovery register (RECOVERY_EXPANSION.md).
  const isRecovery = school.family === 'recovery';

  try {
    const { text } = await generateText({
      model: anthropic(CHAT_MODEL),
      system: (isRecovery ? RECOVERY_BEARING_SYSTEM : BEARING_SYSTEM) + registerDirective(steer?.register),
      prompt: isRecovery ? buildRecoveryBearingPrompt(school, state, retrieved) : buildBearingPrompt(school, quote, state, retrieved),
      maxTokens: 240,
      temperature: 0.7,
    });
    const parsed = parseBearingText(text);
    if (!parsed.principle) return fallback();
    return { principle: deDash(parsed.principle), prompt: parsed.prompt ? deDash(parsed.prompt) : null, source, quote: viewQuote, grounding, model: CHAT_MODEL };
  } catch (e) {
    console.error('bearing generate error:', e instanceof Error ? e.message : e);
    return fallback();
  }
}
