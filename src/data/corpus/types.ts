/** Coach corpus domain — mental-health ideologies the coach grounds nudges in. */

export type Ideology = 'stoicism' | 'cbt' | 'mindfulness';

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
  cbt: 'Cognitive Behavioral Therapy',
  mindfulness: 'Mindfulness',
};

/** One-line description shown when a user picks their school. */
export const IDEOLOGY_BLURB: Record<Ideology, string> = {
  stoicism: 'Control what you can. Meet the rest with a level head.',
  cbt: 'Catch the distorted thought. Test it. Replace it.',
  mindfulness: 'Return to the present. Watch the thought pass without chasing it.',
};
