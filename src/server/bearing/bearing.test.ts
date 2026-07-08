/// <reference types="jest" />
import type { RetrievedTeaching } from '@/server/ai/vector';
import { getSchool, isSchoolId, SCHOOL_IDS, SCHOOLS, themeForToday } from './schools';
import { BEARING_SYSTEM, parseBearingText, pickSource, splitTeachingContent } from './compose';

const chunk = (over: Partial<RetrievedTeaching> = {}): RetrievedTeaching => ({
  ref_id: 't1', title: 'A teaching', url: null, ideology: 'stoicism', theme: 'control', content: 'x', similarity: 0, ...over,
});

const REQUESTED = [
  'stoicism', 'modern-stoicism', 'cbt', 'act', 'buddhism', 'daoism',
  'hinduism', 'christianity', 'islam', 'epicureanism', 'existentialism',
];

describe('SCHOOLS catalog', () => {
  it('has the 11 selectable schools the user asked for and excludes mindfulness', () => {
    expect(SCHOOLS).toHaveLength(11);
    expect(SCHOOL_IDS).not.toContain('mindfulness');
    for (const id of REQUESTED) {
      expect(isSchoolId(id)).toBe(true);
      expect(getSchool(id)).toBeDefined();
    }
  });

  it('every school has a label, blurb, an https source, attribution, copyright, and >=1 theme', () => {
    for (const s of SCHOOLS) {
      expect(s.label.length).toBeGreaterThan(0);
      expect(s.blurb.length).toBeGreaterThan(0);
      expect(s.source.url).toMatch(/^https:\/\//);
      expect(s.source.title.length).toBeGreaterThan(0);
      expect(s.source.attribution.length).toBeGreaterThan(0);
      expect(s.copyright.length).toBeGreaterThan(0);
      expect(s.themes.length).toBeGreaterThanOrEqual(1);
    }
  });

  it('isSchoolId rejects unknown and non-string input', () => {
    expect(isSchoolId('nonsense')).toBe(false);
    expect(isSchoolId(42)).toBe(false);
    expect(isSchoolId(undefined)).toBe(false);
  });
});

describe('themeForToday', () => {
  const sto = getSchool('stoicism')!;

  it('is deterministic for a date and always one of the school themes', () => {
    expect(themeForToday(sto, '2026-07-08')).toBe(themeForToday(sto, '2026-07-08'));
    expect(sto.themes).toContain(themeForToday(sto, '2026-07-08'));
  });

  it('rotates across the year (not a constant)', () => {
    const seen = new Set(
      Array.from({ length: 40 }, (_, i) => {
        const month = String((i % 12) + 1).padStart(2, '0');
        const day = String((i % 28) + 1).padStart(2, '0');
        return themeForToday(sto, `2026-${month}-${day}`);
      }),
    );
    expect(seen.size).toBeGreaterThan(1);
  });
});

describe('compose', () => {
  const sto = getSchool('stoicism')!;

  it('pickSource prefers a retrieved url of the same school, else the canonical source', () => {
    const withUrl = pickSource([chunk({ url: 'https://example.org/x', ideology: 'stoicism', title: 'Chunk' })], sto);
    expect(withUrl.url).toBe('https://example.org/x');
    expect(withUrl.attribution).toBe(sto.source.attribution); // attribution stays the trusted school's

    expect(pickSource([chunk({ url: null })], sto).url).toBe(sto.source.url);
    // a url from a DIFFERENT ideology is ignored
    expect(pickSource([chunk({ url: 'https://other.org', ideology: 'cbt' })], sto).url).toBe(sto.source.url);
  });

  it('splitTeachingContent separates the principle from the practice prompt (no-AI fallback)', () => {
    const { principle, prompt } = splitTeachingContent(
      'The dichotomy of control (stoicism, control). Some things are up to you. Practice: Name the one thing that is yours. — Epictetus',
    );
    expect(principle).toBe('Some things are up to you.');
    expect(prompt).toBe('Name the one thing that is yours.');
  });

  it('parseBearingText splits the principle from the Q: line', () => {
    const parsed = parseBearingText('Hold what is yours; let the rest go.\nQ: What is the one thing that is yours today?');
    expect(parsed.principle).toBe('Hold what is yours; let the rest go.');
    expect(parsed.prompt).toBe('What is the one thing that is yours today?');

    const noQ = parseBearingText('Just a principle, no question.');
    expect(noQ.principle).toBe('Just a principle, no question.');
    expect(noQ.prompt).toBeNull();
  });

  it('the generation system prompt bans the therapy/mindfulness vocabulary (VOICE.md)', () => {
    expect(BEARING_SYSTEM.toLowerCase()).toContain('banned words');
    expect(BEARING_SYSTEM.toLowerCase()).toContain('mindfulness');
  });
});
