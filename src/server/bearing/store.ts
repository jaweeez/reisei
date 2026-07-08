import { adminPool } from '@/server/db';
import type { BearingSource } from '@/lib/data/types';
import { generateBearing } from './generate';

// The daily bearing cache: ONE row per (school, local_date), shared across users. Read +
// written via the OWNER role (adminPool) — `bearings` has no RLS (shared, non-sensitive,
// like teaching_chunks). getOrCreateBearing is idempotent under concurrency via the
// unique(ideology, local_date) constraint (mirrors the `nudges` on-conflict dedupe).

export interface StoredBearing {
  id: string;
  ideology: string;
  localDate: string;
  principle: string;
  prompt: string | null;
  source: BearingSource;
  /** The day's anchoring quote (text + citation), or null. */
  quote: { text: string; ref: string } | null;
  model: string | null;
}

const COLS = `id, ideology, to_char(local_date, 'YYYY-MM-DD') as local_date,
              principle, prompt, source_url, source_title, source_attribution, quote_text, quote_ref, model`;

function mapRow(r: {
  id: string; ideology: string; local_date: string; principle: string; prompt: string | null;
  source_url: string; source_title: string; source_attribution: string;
  quote_text: string | null; quote_ref: string | null; model: string | null;
}): StoredBearing {
  return {
    id: r.id,
    ideology: r.ideology,
    localDate: r.local_date,
    principle: r.principle,
    prompt: r.prompt,
    source: { url: r.source_url, title: r.source_title, attribution: r.source_attribution },
    quote: r.quote_text ? { text: r.quote_text, ref: r.quote_ref ?? '' } : null,
    model: r.model ?? null,
  };
}

export async function getCachedBearing(ideology: string, localDate: string): Promise<StoredBearing | null> {
  const { rows } = await adminPool().query(`select ${COLS} from bearings where ideology = $1 and local_date = $2`, [ideology, localDate]);
  return rows[0] ? mapRow(rows[0]) : null;
}

/** Return today's bearing for a school, generating + caching it on first request. */
export async function getOrCreateBearing(ideology: string, localDate: string): Promise<StoredBearing> {
  const cached = await getCachedBearing(ideology, localDate);
  if (cached) return cached;

  const gen = await generateBearing(ideology, localDate);
  const { rows } = await adminPool().query(
    `insert into bearings (ideology, local_date, principle, prompt, source_url, source_title, source_attribution, quote_text, quote_ref, grounding, model)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb, $11)
     on conflict (ideology, local_date) do nothing
     returning ${COLS}`,
    [ideology, localDate, gen.principle, gen.prompt, gen.source.url, gen.source.title, gen.source.attribution, gen.quote?.text ?? null, gen.quote?.ref ?? null, JSON.stringify(gen.grounding), gen.model],
  );
  if (rows[0]) return mapRow(rows[0]);

  // Lost the insert race — another request generated it first. Re-read.
  const again = await getCachedBearing(ideology, localDate);
  if (!again) throw new Error('bearing upsert race failed');
  return again;
}
