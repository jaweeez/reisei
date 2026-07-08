/** Coach corpus domain — the "schools" the coach + The Bearing ground content in.
 *  Each is a source of a daily operating principle to steer by (not devotional content).
 *  `mindfulness` stays for the coach's grounding but is NOT a user-selectable school
 *  (the word is banned in the UI — see docs/VOICE.md). */

export type Ideology =
  | 'stoicism'
  | 'modern-stoicism'
  | 'cbt'
  | 'act'
  | 'buddhism'
  | 'daoism'
  | 'hinduism'
  | 'christianity'
  | 'islam'
  | 'epicureanism'
  | 'existentialism'
  | 'mindfulness';

/** A single curated teaching — always-on (keyword fallback) and embedded for vector search. */
export interface Teaching {
  id: string;
  ideology: Ideology;
  /** e.g. 'control', 'reframing', 'impermanence', 'adversity', 'discipline'. */
  theme: string;
  title: string;
  /** The principle, stated tersely. */
  teaching: string;
  /** How to apply it today — the actionable part the coach leans on. */
  practice: string;
  /** Attribution (e.g. "Epictetus, Enchiridion §1"). */
  source?: string;
  /** A public-domain / authoritative link for the principle, if any (else the school's canonical source is used). */
  url?: string;
}

/** A web source to scrape (Tavily) + embed for depth beyond the curated teachings. */
export interface CorpusSource {
  id: string;
  ideology: Ideology;
  org: string;
  title: string;
  url: string;
  theme?: string;
  action: 'extract' | 'crawl-basic' | 'crawl-deep';
}

export interface Corpus {
  version: string;
  teachings: Teaching[];
  sources: CorpusSource[];
}

export const IDEOLOGY_LABEL: Record<Ideology, string> = {
  stoicism: 'Stoicism',
  'modern-stoicism': 'Modern Stoicism',
  cbt: 'CBT',
  act: 'ACT',
  buddhism: 'Buddhism',
  daoism: 'Daoism',
  hinduism: 'Hinduism',
  christianity: 'Christianity',
  islam: 'Islam',
  epicureanism: 'Epicureanism',
  existentialism: 'Existentialism',
  mindfulness: 'Mindfulness',
};

/** One-line description shown when a user picks their school. Terse, coach voice. */
export const IDEOLOGY_BLURB: Record<Ideology, string> = {
  stoicism: 'Control what you can. Meet the rest with a level head.',
  'modern-stoicism': 'Ancient discipline, applied to now. Test it against today.',
  cbt: 'Catch the distorted thought. Test it. Replace it.',
  act: 'Make room for the hard thought. Act on your values anyway.',
  buddhism: 'See it clearly. Loosen the grip. Act with intention.',
  daoism: 'Stop forcing. Move with the grain of things.',
  hinduism: 'Do the work in front of you; release the result.',
  christianity: 'Steady your heart. Do the next right thing, in good faith.',
  islam: 'Patience, gratitude, steady effort — then trust the outcome.',
  epicureanism: "Want less. Choose the pleasures that don't cost you tomorrow.",
  existentialism: 'No script is coming. Choose, and own the choice.',
  mindfulness: 'Return to the present. Watch the thought pass without chasing it.',
};
