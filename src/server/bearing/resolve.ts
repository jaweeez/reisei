import { vectorEnabled, withUser } from '@/server/db';
import type { BearingSource } from '@/lib/data/types';
import { getEntitlement } from '@/server/entitlement';
import { struggleVector } from '@/server/profile/profile';
import { generateEmbedding, toVectorLiteral } from '@/server/ai/voyage';
import { chatEnabled } from '@/server/ai/anthropic';
import { getOrCreateBearing } from './store';
import { generateBearing } from './generate';
import { getSchool, quoteForToday, schoolQuotes, stateForToday, type BearingQuote } from './schools';
import { bestState, quoteSims } from './vectors';
import { chooseQuoteRef, selectUnusedQuoteRef } from './select';
import { chooseMostNovel, NOVELTY_WINDOW } from './novelty';

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
// Per-family freshness dial (docs/RECOVERY_EXPANSION.md): recovery leans harder on a fresh log,
// so a live craving/slip moves the day. The state overrides more readily and the pull is stronger.
const RECOVERY_STATE_FLOOR = 0.3;
const RECOVERY_STRENGTH_GAIN = 1.2;
const RECOVERY_STRENGTH_CAP = 0.95;

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

/** Quote refs already displayed to this reader for this school. The shared date cache cannot
 * enforce this because a live profile match is resolved per user. */
async function readUsedQuoteRefs(userId: string, ideology: string, localDate: string): Promise<Set<string>> {
  return withUser(userId, async (c) => {
    const rows = (
      await c.query(
        `select quote_ref
           from user_bearings
          where user_id = current_app_user() and ideology = $1 and local_date < $2 and quote_ref is not null
          order by local_date asc`,
        [ideology, localDate],
      )
    ).rows as { quote_ref: string }[];
    return new Set(rows.map((row) => row.quote_ref));
  });
}

/** The reader's chosen voice register (how generated copy addresses them). Defaults to 'default'. */
async function readAddressRegister(userId: string): Promise<string> {
  return withUser(userId, async (c) => {
    const r = (await c.query(`select address_register from users where id = current_app_user()`)).rows[0] as
      | { address_register?: string }
      | undefined;
    return r?.address_register ?? 'default';
  });
}

/** Parse a pgvector value (returned as a JSON-ish string, or an array) into a number[]. */
function parseVector(v: unknown): number[] | null {
  if (Array.isArray(v)) return v as number[];
  if (typeof v === 'string') {
    try {
      const a = JSON.parse(v);
      return Array.isArray(a) ? (a as number[]) : null;
    } catch {
      return null;
    }
  }
  return null;
}

/** The reader's recent shown-read embeddings, across ALL their schools, newest first. The window
 *  the no-repeat check runs against (docs/RECOVERY_EXPANSION.md, hard requirement). */
async function readRecentPrincipleVecs(userId: string, limit: number): Promise<number[][]> {
  return withUser(userId, async (c) => {
    const rows = (
      await c.query(
        `select principle_vec from user_bearings
          where user_id = current_app_user() and principle_vec is not null
          order by local_date desc, created_at desc
          limit $1`,
        [limit],
      )
    ).rows as { principle_vec: unknown }[];
    return rows.map((r) => parseVector(r.principle_vec)).filter((v): v is number[] => v !== null);
  });
}

async function storeUserBearing(
  userId: string,
  ideology: string,
  localDate: string,
  content: Content,
  personalized: boolean,
  principleVec: number[] | null,
): Promise<ResolvedBearing> {
  return withUser(userId, async (c) => {
    const args = [
      ideology, localDate, content.principle, content.prompt,
      content.quote?.text ?? null, content.quote?.ref ?? null,
      content.source.url, content.source.title, content.source.attribution, personalized,
      principleVec ? toVectorLiteral(principleVec) : null,
    ];
    const ins = (
      await c.query(
        `insert into user_bearings
           (user_id, ideology, local_date, principle, prompt, quote_text, quote_ref, source_url, source_title, source_attribution, personalized, principle_vec)
         values (current_app_user(), $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::vector)
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
  const { premium } = await getEntitlement(userId);
  const register = await readAddressRegister(userId);

  // Free tier gets the neutral, shared, date-rotated Bearing. Personalization (a read steered by
  // the live log, the freshness dial, and the cross-school no-repeat) is a Pro benefit
  // (docs/RECOVERY_EXPANSION.md, monetization). A non-default voice register is NOT paid, so it is
  // still honored with a per-user generation; otherwise free users copy the cheap shared bearing.
  if (!premium) {
    if (register === 'default') {
      const neutral = await getOrCreateBearing(ideology, localDate);
      return storeUserBearing(
        userId, ideology, localDate,
        { principle: neutral.principle, prompt: neutral.prompt, quote: neutral.quote, source: neutral.source },
        false, null,
      );
    }
    const rq = school ? quoteForToday(school, localDate) : null;
    const gen = await generateBearing(ideology, localDate, { quote: rq, state: stateForToday(localDate), register });
    return storeUserBearing(
      userId, ideology, localDate,
      { principle: gen.principle, prompt: gen.prompt, quote: gen.quote, source: gen.source },
      false, null,
    );
  }

  const rotationQuote = school ? quoteForToday(school, localDate) : null;
  const rotationState = stateForToday(localDate);
  const quotes = school ? schoolQuotes(ideology) : [];
  const usedQuoteRefs = await readUsedQuoteRefs(userId, ideology, localDate);
  let chosenQuote = rotationQuote;
  let chosenState = rotationState;

  // Let a live struggle move the anchor quote and the felt-state (only when we have a signal).
  // Recovery schools lean harder on a fresh log (the per-family dial).
  const isRecovery = school?.family === 'recovery';
  const signal = school ? await struggleVector(userId) : null;
  if (signal && school) {
    const strength = isRecovery ? Math.min(RECOVERY_STRENGTH_CAP, signal.strength * RECOVERY_STRENGTH_GAIN) : signal.strength;
    const stateFloor = isRecovery ? RECOVERY_STATE_FLOOR : STATE_FLOOR;
    if (quotes.length) {
      const simByRef = new Map((await quoteSims(ideology, signal.vec)).map((s) => [s.ref, s.sim]));
      const candidates = quotes.map((q) => ({ ref: q.ref, sim: simByRef.get(q.ref) ?? 0 }));
      const rotationRef = rotationQuote?.ref ?? quotes[0]!.ref;
      const chosenRef = chooseQuoteRef({ rotationRef, candidates, strength });
      chosenQuote = quotes.find((q) => q.ref === chosenRef) ?? rotationQuote;
    }
    if (strength >= stateFloor) {
      const bs = await bestState(signal.vec);
      if (bs) chosenState = bs;
    }
  }

  if (chosenQuote && quotes.length) {
    const safeRef = selectUnusedQuoteRef(
      chosenQuote.ref,
      rotationQuote?.ref ?? quotes[0]!.ref,
      quotes.map((quote) => ({ ref: quote.ref, sim: 0 })),
      usedQuoteRefs,
    );
    chosenQuote = safeRef ? quotes.find((quote) => quote.ref === safeRef) ?? null : null;
  }

  let personalized =
    (chosenQuote?.ref ?? null) !== (rotationQuote?.ref ?? null) || chosenState !== rotationState;

  const queryVec = signal?.vec;
  // A generated read steered by the day's quote + state (and the live struggle vector for retrieval).
  const build = async (steerQuote: BearingQuote | null, steerState: string): Promise<Content> => {
    const gen = await generateBearing(ideology, localDate, { quote: steerQuote, state: steerState, queryVec, register });
    return { principle: gen.principle, prompt: gen.prompt, quote: gen.quote, source: gen.source };
  };

  let content: Content;
  if (!personalized) {
    const neutral = await getOrCreateBearing(ideology, localDate);
    content = { principle: neutral.principle, prompt: neutral.prompt, quote: neutral.quote, source: neutral.source };
  } else {
    content = await build(chosenQuote, chosenState);
  }

  // No-repeat (hard requirement): reject a read that is too similar to the reader's recent reads
  // across ALL their schools, and re-roll a fresh one. Requires Voyage; degrades to accepting the
  // base read otherwise. Re-rolling only helps when the model is on (a fallback read is fixed).
  let principleVec: number[] | null = null;
  if (vectorEnabled()) {
    const embed = async (text: string): Promise<number[] | null> => {
      try {
        return await generateEmbedding(text, 'document');
      } catch {
        return null;
      }
    };
    const recent = await readRecentPrincipleVecs(userId, NOVELTY_WINDOW);
    const baseVec = await embed(content.principle);
    if (baseVec && recent.length) {
      const candidates: { content: Content; vec: number[]; personalized: boolean }[] = [
        { content, vec: baseVec, personalized },
      ];
      const maxRerolls = chatEnabled() ? 2 : 0;
      for (let r = 0; r < maxRerolls && !chooseMostNovel(candidates.map((x) => x.vec), recent).novel; r += 1) {
        const alt = await build(chosenQuote ?? rotationQuote, chosenState);
        const altVec = await embed(alt.principle);
        if (!altVec) break;
        candidates.push({ content: alt, vec: altVec, personalized: true });
      }
      const pick = chooseMostNovel(candidates.map((x) => x.vec), recent);
      const chosen = candidates[pick.index >= 0 ? pick.index : 0]!;
      content = chosen.content;
      personalized = chosen.personalized;
      principleVec = chosen.vec;
    } else {
      // Nothing to collide with yet (or embedding failed): still store the vector so this read
      // seeds future novelty checks.
      principleVec = baseVec;
    }
  }

  return storeUserBearing(userId, ideology, localDate, content, personalized, principleVec);
}
