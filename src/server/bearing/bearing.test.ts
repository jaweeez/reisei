/// <reference types="jest" />
import type { RetrievedTeaching } from '@/server/ai/vector';
import { DAILY_STATES, getSchool, isSchoolId, quoteForToday, SCHOOL_IDS, SCHOOLS, stateForToday, themeForToday } from './schools';
import { BEARING_SYSTEM, buildBearingPrompt, parseBearingText, pickSource, splitTeachingContent } from './compose';

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

describe('stateForToday', () => {
  it('is deterministic for a date and always one of DAILY_STATES', () => {
    expect(stateForToday('2026-07-08')).toBe(stateForToday('2026-07-08'));
    expect(DAILY_STATES).toContain(stateForToday('2026-07-08'));
  });

  it('rotates across the year (not a constant)', () => {
    const seen = new Set(
      Array.from({ length: 40 }, (_, i) =>
        stateForToday(`2026-${String((i % 12) + 1).padStart(2, '0')}-${String((i % 28) + 1).padStart(2, '0')}`),
      ),
    );
    expect(seen.size).toBeGreaterThan(1);
  });
});

describe('school quotes', () => {
  it('every school has a verified quote today: non-empty text + ref, and an https url', () => {
    for (const s of SCHOOLS) {
      const q = quoteForToday(s, '2026-07-08');
      expect(q).not.toBeNull();
      expect(q!.text.length).toBeGreaterThan(0);
      expect(q!.ref.length).toBeGreaterThan(0);
      expect(q!.url).toMatch(/^https:\/\//);
    }
  });

  it('quoteForToday is deterministic for a date and rotates across the year', () => {
    const sto = getSchool('stoicism')!;
    expect(quoteForToday(sto, '2026-07-08')).toEqual(quoteForToday(sto, '2026-07-08'));
    const seen = new Set(
      Array.from({ length: 40 }, (_, i) =>
        quoteForToday(sto, `2026-${String((i % 12) + 1).padStart(2, '0')}-${String((i % 28) + 1).padStart(2, '0')}`)?.ref,
      ),
    );
    expect(seen.size).toBeGreaterThan(1);
  });

  it('no quote reproduces copyrighted-translation phrasings we deliberately avoided', () => {
    const all = SCHOOLS.flatMap((s) => Array.from({ length: 12 }, (_, i) => quoteForToday(s, `2026-${String(i + 1).padStart(2, '0')}-15`)?.text ?? ''));
    const joined = all.join(' | ').toLowerCase();
    // Frankl paraphrase and the misattributed William James line were explicitly excluded.
    expect(joined).not.toContain('a why to live');
    expect(joined).not.toContain('altering his attitudes');
  });
});

describe('compose', () => {
  const sto = getSchool('stoicism')!;

  it('buildBearingPrompt embeds today\'s quote and state, and degrades cleanly with no quote', () => {
    const q = quoteForToday(sto, '2026-07-08')!;
    const withQuote = buildBearingPrompt(sto, q, 'anger flaring up', []);
    expect(withQuote).toContain(q.text);
    expect(withQuote).toContain('anger flaring up');
    const noQuote = buildBearingPrompt(sto, null, 'fear about what is coming', []);
    expect(noQuote).toContain('fear about what is coming');
    expect(noQuote).not.toContain('undefined');
    expect(noQuote).not.toContain('null');
  });

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

  it('parseBearingText splits the read from the Try: technique (and still accepts Q:)', () => {
    const t = parseBearingText('Anger is up. Feel it, do not obey it.\nTry: name it out loud, one slow breath.');
    expect(t.principle).toBe('Anger is up. Feel it, do not obey it.');
    expect(t.prompt).toBe('name it out loud, one slow breath.');

    const q = parseBearingText('Hold what is yours; let the rest go.\nQ: what is yours today?');
    expect(q.principle).toBe('Hold what is yours; let the rest go.');
    expect(q.prompt).toBe('what is yours today?');

    const none = parseBearingText('Just a read, no technique.');
    expect(none.principle).toBe('Just a read, no technique.');
    expect(none.prompt).toBeNull();
  });

  it('the generation prompt carries the reframed voice: somatic, Try: contract, no em dashes', () => {
    const lower = BEARING_SYSTEM.toLowerCase();
    expect(lower).toContain('body'); // somatic framing from REISEI_VOICE
    expect(lower).toContain('never use em dashes');
    expect(BEARING_SYSTEM).toContain('Try:'); // output contract
  });
});
