import corpusJson from './teachings.json';
import type { Corpus } from './types';

// The canonical coach corpus (curated teachings + web sources to scrape).
export const corpus = corpusJson as unknown as Corpus;

export * from './types';
