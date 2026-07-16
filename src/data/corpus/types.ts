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
  // Recovery family (docs/RECOVERY_EXPANSION.md). No public-domain daily text: Reisei uses its
  // own wording and links out to the official source. AA and NA are separate schools.
  | 'smart-recovery'
  | 'recovery-dharma'
  | 'aa'
  | 'na'
  | 'secular-recovery'
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
  'smart-recovery': 'SMART Recovery',
  'recovery-dharma': 'Recovery Dharma',
  aa: 'AA',
  na: 'NA',
  'secular-recovery': 'Secular Recovery',
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
  'smart-recovery': 'Motivation, urges, thoughts, balance. Practical tools, no higher power required.',
  'recovery-dharma': 'Meet the craving with attention. Investigate it, do not obey it.',
  aa: 'One day at a time. Honesty and humility, and help you do not carry alone.',
  na: 'Just for today, stay clean. You are not the only one, and not on your own.',
  'secular-recovery': 'Name the urge, ride it out, tell the truth. Your own reasons, your own plan.',
  mindfulness: 'Return to the present. Watch the thought pass without chasing it.',
};

/** The families the selectable schools group under in the Bearing picker (docs/RECOVERY_EXPANSION.md).
 *  Derived statically from the school id, never stored per user. CBT and ACT live under Recovery. */
export type SchoolFamily = 'philosophy' | 'spirituality' | 'recovery';

/** Family header shown above each group of schools in the picker. */
export const FAMILY_LABEL: Record<SchoolFamily, string> = {
  philosophy: 'Philosophy',
  spirituality: 'Religion & Spirituality',
  recovery: 'Recovery',
};

/** Display order of the families in the picker (Recovery last for the discipline-first default). */
export const FAMILY_ORDER: SchoolFamily[] = ['philosophy', 'spirituality', 'recovery'];
