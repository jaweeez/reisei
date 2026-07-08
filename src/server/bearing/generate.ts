import { generateText } from 'ai';
import { anthropic, CHAT_MODEL, chatEnabled } from '@/server/ai/anthropic';
import { searchTeachings } from '@/server/ai/vector';
import type { BearingSource } from '@/lib/data/types';
import { getSchool, quoteForToday, stateForToday, themeForToday } from './schools';
import { BEARING_SYSTEM, buildBearingPrompt, deDash, parseBearingText, pickSource, splitTeachingContent } from './compose';

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

export async function generateBearing(ideology: string, localDate: string): Promise<GeneratedBearing> {
  const school = getSchool(ideology);
  if (!school) throw new Error(`unknown school: ${ideology}`);

  const theme = themeForToday(school, localDate);
  const state = stateForToday(localDate);
  const quote = quoteForToday(school, localDate);
  const retrieved = await searchTeachings(`${theme} ${state}`.trim() || school.label, ideology, 5);
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

  try {
    const { text } = await generateText({
      model: anthropic(CHAT_MODEL),
      system: BEARING_SYSTEM,
      prompt: buildBearingPrompt(school, quote, state, retrieved),
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
