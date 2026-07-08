import { withUser } from '@/server/db';
import type { BearingSource } from '@/lib/data/types';
import { struggleVector } from '@/server/profile/profile';
import { getOrCreateBearing } from './store';
import { generateBearing } from './generate';
import { getSchool, quoteForToday, schoolQuotes, stateForToday } from './schools';
import { bestState, quoteSims } from './vectors';
import { chooseQuoteRef } from './select';

// Resolve the Bearing a given user gets today, per followed school. The shared `bearings` table
// stays the NEUTRAL daily cache (one generation per school per day, reused by everyone). Here we
// decide, per user, whether their live struggle actually moves the pick:
//   • nothing fresh  → copy the neutral bearing (cheap, shared).
//   • a live struggle that changes the anchor quote or the felt-state → build one around it.
// Either way the result is stored in user_bearings (0017) as the single source of truth the app
// reads. "Match, don't mention": the reflection is built to land on what's up, never referencing
// that anything was written (enforced in the generation prompt).

// Only override the felt-state on a reasonably fresh/strong struggle (the quote blend already
// scales smoothly with strength in select.ts).
const STATE_FLOOR = 0.45;

export interface ResolvedBearing {
  id: string;
  ideology: string;
  principle: string;
  prompt: string | null;
  quote: { text: string; ref: string } | null;
  source: BearingSource;
  personalized: boolean;
}

const COLS = `id, ideology, principle, prompt, quote_text, quote_ref, source_url, source_title, source_attribution, personalized`;

function mapRow(r: {
  id: string; ideology: string; principle: string; prompt: string | null;
  quote_text: string | null; quote_ref: string | null;
  source_url: string; source_title: string; source_attribution: string; personalized: boolean;
}): ResolvedBearing {
  return {
    id: r.id,
    ideology: r.ideology,
    principle: r.principle,
    prompt: r.prompt ?? null,
    quote: r.quote_text ? { text: r.quote_text, ref: r.quote_ref ?? '' } : null,
    source: { url: r.source_url, title: r.source_title, attribution: r.source_attribution },
    personalized: !!r.personalized,
  };
}

interface Content {
  principle: string;
  prompt: string | null;
  quote: { text: string; ref: string } | null;
  source: BearingSource;
}

async function readUserBearing(userId: string, ideology: string, localDate: string): Promise<ResolvedBearing | null> {
  return withUser(userId, async (c) => {
    const r = (
      await c.query(
        `select ${COLS} from user_bearings where user_id = current_app_user() and ideology = $1 and local_date = $2`,
        [ideology, localDate],
      )
    ).rows[0];
    return r ? mapRow(r) : null;
  });
}

async function storeUserBearing(
  userId: string,
  ideology: string,
  localDate: string,
  content: Content,
  personalized: boolean,
): Promise<ResolvedBearing> {
  return withUser(userId, async (c) => {
    const args = [
      ideology, localDate, content.principle, content.prompt,
      content.quote?.text ?? null, content.quote?.ref ?? null,
      content.source.url, content.source.title, content.source.attribution, personalized,
    ];
    const ins = (
      await c.query(
        `insert into user_bearings
           (user_id, ideology, local_date, principle, prompt, quote_text, quote_ref, source_url, source_title, source_attribution, personalized)
         values (current_app_user(), $1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         on conflict (user_id, ideology, local_date) do nothing
         returning ${COLS}`,
        args,
      )
    ).rows[0];
    if (ins) return mapRow(ins);
    // Lost the insert race — another request resolved it first. Re-read.
    const again = (
      await c.query(
        `select ${COLS} from user_bearings where user_id = current_app_user() and ideology = $1 and local_date = $2`,
        [ideology, localDate],
      )
    ).rows[0];
    return mapRow(again);
  });
}

/** Today's Bearing for one user + school, resolved once per day and cached in user_bearings. */
export async function resolveUserBearing(userId: string, ideology: string, localDate: string): Promise<ResolvedBearing> {
  const existing = await readUserBearing(userId, ideology, localDate);
  if (existing) return existing;

  const school = getSchool(ideology);
  const rotationQuote = school ? quoteForToday(school, localDate) : null;
  const rotationState = stateForToday(localDate);
  let chosenQuote = rotationQuote;
  let chosenState = rotationState;

  // Let a live struggle move the anchor quote and the felt-state (only when we have a signal).
  const signal = school ? await struggleVector(userId) : null;
  if (signal && school) {
    const quotes = schoolQuotes(ideology);
    if (quotes.length) {
      const simByRef = new Map((await quoteSims(ideology, signal.vec)).map((s) => [s.ref, s.sim]));
      const candidates = quotes.map((q) => ({ ref: q.ref, sim: simByRef.get(q.ref) ?? 0 }));
      const rotationRef = rotationQuote?.ref ?? quotes[0]!.ref;
      const chosenRef = chooseQuoteRef({ rotationRef, candidates, strength: signal.strength });
      chosenQuote = quotes.find((q) => q.ref === chosenRef) ?? rotationQuote;
    }
    if (signal.strength >= STATE_FLOOR) {
      const bs = await bestState(signal.vec);
      if (bs) chosenState = bs;
    }
  }

  const personalized =
    (chosenQuote?.ref ?? null) !== (rotationQuote?.ref ?? null) || chosenState !== rotationState;

  let content: Content;
  if (!personalized) {
    const neutral = await getOrCreateBearing(ideology, localDate);
    content = { principle: neutral.principle, prompt: neutral.prompt, quote: neutral.quote, source: neutral.source };
  } else {
    const gen = await generateBearing(ideology, localDate, { quote: chosenQuote, state: chosenState });
    content = { principle: gen.principle, prompt: gen.prompt, quote: gen.quote, source: gen.source };
  }

  return storeUserBearing(userId, ideology, localDate, content, personalized);
}
