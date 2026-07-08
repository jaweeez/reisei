import { IDEOLOGY_BLURB, IDEOLOGY_LABEL, type Ideology } from '@/data/corpus/types';
import type { BearingSource } from '@/lib/data/types';

// The selectable schools for The Bearing — the on-brand analog to Enso's `practices.ts`
// pathways. Each is a source of a daily OPERATING PRINCIPLE to steer by (not devotional
// content). Copyright posture: Reisei generates its own wording; `source` is the
// public-domain / authoritative link-out shown with the card (Enso's officialUrl pattern).
// `themes` rotate by day-of-year to seed the daily retrieval query → deterministic variety.
//
// `mindfulness` is intentionally absent (the word is banned in the UI — see docs/VOICE.md);
// it stays a corpus ideology for the coach only.

export interface BearingSchool {
  ideology: Ideology;
  label: string;
  blurb: string;
  /** Canonical link-out + attribution — used when a retrieved chunk carries no url. */
  source: BearingSource;
  /** A subtle affiliation / copyright note shown under the card. */
  copyright: string;
  /** Rotating themes → the day's retrieval query. */
  themes: string[];
}

const OWN = "The principle is Reisei's own wording; the link opens the source.";
const NOT_AFFILIATED = 'Reisei is not affiliated with this tradition.';

function school(ideology: Ideology, source: BearingSource, copyright: string, themes: string[]): BearingSchool {
  return { ideology, label: IDEOLOGY_LABEL[ideology], blurb: IDEOLOGY_BLURB[ideology], source, copyright, themes };
}

export const SCHOOLS: BearingSchool[] = [
  school(
    'stoicism',
    { url: 'https://classics.mit.edu/Antoninus/meditations.html', title: 'Meditations — Marcus Aurelius', attribution: 'Marcus Aurelius, Meditations (trans. Long, public domain)' },
    `Public-domain classical texts. ${OWN}`,
    ['control', 'adversity', 'discipline', 'impermanence', 'present', 'duty'],
  ),
  school(
    'modern-stoicism',
    { url: 'https://modernstoicism.com/', title: 'Modern Stoicism', attribution: 'Modern Stoicism (modernstoicism.com)' },
    `Grounded in public-domain Stoic texts, applied for now. ${OWN}`,
    ['control', 'habits', 'reframing', 'adversity', 'values', 'present'],
  ),
  school(
    'cbt',
    { url: 'https://www.nhs.uk/mental-health/talking-therapies-medicine-treatments/talking-therapies-and-counselling/cognitive-behavioural-therapy-cbt/', title: 'Cognitive behavioural therapy (CBT) — NHS', attribution: 'NHS — Cognitive behavioural therapy (CBT)' },
    `Reisei's own summaries of CBT skills; the link opens a clinical explainer.`,
    ['reframing', 'distortions', 'evidence', 'action', 'exposure', 'thoughts'],
  ),
  school(
    'act',
    { url: 'https://contextualscience.org/act', title: 'Acceptance & Commitment Therapy — ACBS', attribution: 'Association for Contextual Behavioral Science (ACBS)' },
    `Reisei's own summaries of ACT processes; the link opens the ACBS resource.`,
    ['defusion', 'acceptance', 'values', 'action', 'present', 'self'],
  ),
  school(
    'buddhism',
    { url: 'https://suttacentral.net/dhp', title: 'The Dhammapada — SuttaCentral', attribution: 'Dhammapada, trans. Bhikkhu Sujato (CC0 / public domain)' },
    `Public-domain (CC0) translations via SuttaCentral. ${OWN} ${NOT_AFFILIATED}`,
    ['impermanence', 'attachment', 'intention', 'equanimity', 'present', 'compassion'],
  ),
  school(
    'daoism',
    { url: 'https://ctext.org/dao-de-jing', title: 'Tao Te Ching — trans. James Legge', attribution: 'Laozi, Tao Te Ching (trans. Legge, 1891, public domain)' },
    `Public-domain 1891 translation. ${OWN} ${NOT_AFFILIATED}`,
    ['wu wei', 'simplicity', 'yielding', 'balance', 'humility', 'present'],
  ),
  school(
    'hinduism',
    { url: 'https://sacred-texts.com/hin/gita/', title: 'Bhagavad Gita — sacred-texts.com', attribution: 'Bhagavad Gita (public-domain translation, sacred-texts.com)' },
    `Public-domain translation. ${OWN} ${NOT_AFFILIATED}`,
    ['duty', 'detachment', 'discipline', 'equanimity', 'action', 'self-mastery'],
  ),
  school(
    'christianity',
    { url: 'https://ebible.org/web/', title: 'World English Bible', attribution: 'World English Bible (public domain)' },
    `Public-domain translation (WEB). ${OWN} ${NOT_AFFILIATED}`,
    ['perseverance', 'humility', 'forgiveness', 'gratitude', 'service', 'faith'],
  ),
  school(
    'islam',
    { url: 'https://quran.com/', title: "The Qur'an — Quran.com", attribution: "The Qur'an (Quran.com)" },
    `Reisei's own wording of shared ethical principles; the link opens the source text. ${NOT_AFFILIATED}`,
    ['patience', 'gratitude', 'reliance', 'excellence', 'intention', 'discipline'],
  ),
  school(
    'epicureanism',
    { url: 'https://epicurus.net/en/principal.html', title: 'Principal Doctrines — Epicurus', attribution: 'Epicurus, Principal Doctrines (public domain)' },
    `Public-domain classical texts. ${OWN}`,
    ['desire', 'tranquility', 'friendship', 'fear', 'simplicity', 'present'],
  ),
  school(
    'existentialism',
    { url: 'https://plato.stanford.edu/entries/existentialism/', title: 'Existentialism — Stanford Encyclopedia of Philosophy', attribution: 'Stanford Encyclopedia of Philosophy' },
    `Grounded in public-domain primary texts; the link opens a scholarly overview. ${OWN}`,
    ['freedom', 'responsibility', 'authenticity', 'meaning', 'choice', 'absurdity'],
  ),
];

export const SCHOOL_BY_ID: Record<string, BearingSchool> = Object.fromEntries(SCHOOLS.map((s) => [s.ideology, s]));
export const SCHOOL_IDS: Ideology[] = SCHOOLS.map((s) => s.ideology);

export function isSchoolId(x: unknown): x is Ideology {
  return typeof x === 'string' && Object.prototype.hasOwnProperty.call(SCHOOL_BY_ID, x);
}
export function getSchool(id: string): BearingSchool | undefined {
  return SCHOOL_BY_ID[id];
}

/** Day-of-year (0–365) for a YYYY-MM-DD string, tz-independent + deterministic. */
function dayOfYearFromISO(iso: string): number {
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return 0;
  return Math.floor((Date.UTC(y, m - 1, d) - Date.UTC(y, 0, 0)) / 86_400_000);
}

/** The theme to ground today's bearing in. Rotates through the school's themes by date. */
export function themeForToday(school: BearingSchool, localDate: string): string {
  if (!school.themes.length) return '';
  return school.themes[dayOfYearFromISO(localDate) % school.themes.length]!;
}

// Plain-language states men actually hit. This is the daily "what's coming up" angle the
// bearing meets through the chosen tradition's lens (the emotional/somatic substance under
// the discipline costume). Kept human and non-clinical on purpose (see docs/VOICE.md).
export const DAILY_STATES: string[] = [
  'anger flaring up',
  'wired and restless',
  'flat and hard to get going',
  'resentment you keep chewing on',
  'shame after a slip',
  'grief or loss',
  'an urge or craving pulling at you',
  'overwhelmed, too much at once',
  'numb and checked out',
  'on edge, wound tight',
  'fear about what is coming',
  'lonely and disconnected',
];

/** The felt state to aim today's bearing at. Rotates by date, offset from the theme so the
 *  state and the tradition angle vary independently across the year. */
export function stateForToday(localDate: string): string {
  if (!DAILY_STATES.length) return '';
  return DAILY_STATES[(dayOfYearFromISO(localDate) + 5) % DAILY_STATES.length]!;
}
