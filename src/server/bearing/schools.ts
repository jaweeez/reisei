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

/** A real, PUBLIC-DOMAIN line from a school's own source. One is chosen per day to anchor
 *  that day's bearing (the read relates to it), and the card links out to `url` (the exact
 *  passage). Only these quotes are verbatim; Reisei's read is always its own wording. */
export interface BearingQuote {
  /** The quote, transcribed exactly from a public-domain source/translation. */
  text: string;
  /** Precise citation, e.g. "Meditations 4.7" or "Dhammapada 223". */
  ref: string;
  /** Deep link to the exact passage on a reputable public-domain host. */
  url: string;
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

// Curated PUBLIC-DOMAIN quotes per school — the day's anchor for the bearing. Every text is
// transcribed from a public-domain source/translation (translator noted per school); the
// reflection Reisei writes around them is always its own wording. A few translators' bracketed
// editorial insertions are normalized to clean prose. A school with no entry falls back to no
// epigraph + the canonical source link.
const SCHOOL_QUOTES: Partial<Record<Ideology, BearingQuote[]>> = {
  // Marcus Aurelius, Meditations — trans. George Long (1862), public domain (Standard Ebooks, CC0).
  stoicism: [
    { text: 'Begin the morning by saying to thyself, I shall meet with the busybody, the ungrateful, arrogant, deceitful, envious, unsocial.', ref: 'Meditations 2.1', url: 'https://standardebooks.org/ebooks/marcus-aurelius/meditations/george-long/text/book-2' },
    { text: "Take away thy opinion, and then there is taken away the complaint, 'I have been harmed.'", ref: 'Meditations 4.7', url: 'https://standardebooks.org/ebooks/marcus-aurelius/meditations/george-long/text/book-4' },
    { text: 'Such as are thy habitual thoughts, such also will be the character of thy mind; for the soul is dyed by the thoughts.', ref: 'Meditations 5.16', url: 'https://standardebooks.org/ebooks/marcus-aurelius/meditations/george-long/text/book-5' },
    { text: 'If thou art pained by any external thing, it is not this thing that disturbs thee, but thy own judgement about it.', ref: 'Meditations 8.47', url: 'https://standardebooks.org/ebooks/marcus-aurelius/meditations/george-long/text/book-8' },
  ],
  // Seneca (trans. Gummere, 1917-25) + Epictetus (trans. Elizabeth Carter, 1758), both public domain.
  'modern-stoicism': [
    { text: 'We suffer more often in imagination than in reality.', ref: 'Seneca, Letters to Lucilius 13', url: 'https://en.wikisource.org/wiki/Moral_letters_to_Lucilius/Letter_13' },
    { text: 'Of Things, some are in our Power, and others not.', ref: 'Epictetus, Enchiridion 1', url: 'https://en.wikisource.org/wiki/All_the_Works_of_Epictetus,_Which_Are_Now_Extant/The_Encheiridion' },
    { text: 'Require not Things to happen as you wish; but wish them to happen as they do happen; and you will go on well.', ref: 'Epictetus, Enchiridion 8', url: 'https://en.wikisource.org/wiki/All_the_Works_of_Epictetus,_Which_Are_Now_Extant/The_Encheiridion' },
  ],
  // The cognitive-reframing root: Epictetus (trans. George Long) + Shakespeare — public domain.
  cbt: [
    { text: 'Men are disturbed not by the things which happen, but by the opinions about the things.', ref: 'Epictetus, Enchiridion 5', url: 'https://www.gutenberg.org/files/10661/10661-h/10661-h.htm' },
    { text: 'It is not he who reviles you or strikes you, who insults you, but it is your opinion about these things as being insulting.', ref: 'Epictetus, Enchiridion 20', url: 'https://www.gutenberg.org/files/10661/10661-h/10661-h.htm' },
    { text: 'There is nothing either good or bad but thinking makes it so.', ref: 'Shakespeare, Hamlet, Act 2 Scene 2', url: 'https://www.gutenberg.org/files/1524/1524-h/1524-h.htm' },
  ],
  // Acceptance / present-moment / committed action, from public-domain roots (Marcus Aurelius,
  // Zhuangzi trans. Legge, William James). These predate and inspired, but are not, ACT.
  act: [
    { text: 'Everything which happens is as familiar and well known as the rose in spring and the fruit in summer.', ref: 'Marcus Aurelius, Meditations 4.44', url: 'https://classics.mit.edu/Antoninus/meditations.4.four.html' },
    { text: 'Wipe out the imagination. Stop the pulling of the strings. Confine thyself to the present.', ref: 'Marcus Aurelius, Meditations 7.29', url: 'https://classics.mit.edu/Antoninus/meditations.7.seven.html' },
    { text: 'It conducts nothing and anticipates nothing; it responds to what is before it, but does not retain it.', ref: 'Zhuangzi, ch. 7 (the mind as a mirror)', url: 'https://ctext.org/zhuangzi/normal-course-for-rulers-and-kings' },
    { text: 'Action seems to follow feeling, but really action and feeling go together.', ref: 'William James, The Gospel of Relaxation (1899)', url: 'https://www.gutenberg.org/files/16287/16287-h/16287-h.htm' },
  ],
  // The Dhammapada — trans. Bhikkhu Sujato for SuttaCentral, released CC0 (public domain).
  buddhism: [
    { text: "For never is hatred laid to rest by hate, it's laid to rest by love: this is an ancient teaching.", ref: 'Dhammapada 5', url: 'https://suttacentral.net/dhp1-20/en/sujato' },
    { text: 'The supreme conqueror is not he who conquers a million men in battle, but he who conquers a single man: himself.', ref: 'Dhammapada 103', url: 'https://suttacentral.net/dhp100-115/en/sujato' },
    { text: 'Defeat anger with kindness, villainy with virtue, stinginess with giving, and lies with truth.', ref: 'Dhammapada 223', url: 'https://suttacentral.net/dhp221-234/en/sujato' },
    { text: 'Let go of the past, let go of the future, let go of the present, having gone beyond rebirth.', ref: 'Dhammapada 348', url: 'https://suttacentral.net/dhp334-359/en/sujato' },
  ],
  // Tao Te Ching — trans. James Legge (1891, Sacred Books of the East), public domain (Wikisource).
  daoism: [
    { text: 'The highest excellence is like that of water.', ref: 'Tao Te Ching 8 (Legge)', url: 'https://en.wikisource.org/wiki/T%C3%A2o_Teh_King#8' },
    { text: 'He who knows other men is discerning; he who knows himself is intelligent. He who overcomes others is strong; he who overcomes himself is mighty.', ref: 'Tao Te Ching 33 (Legge)', url: 'https://en.wikisource.org/wiki/T%C3%A2o_Teh_King#33' },
    { text: 'Firmness and strength are the concomitants of death; softness and weakness, the concomitants of life.', ref: 'Tao Te Ching 76 (Legge)', url: 'https://en.wikisource.org/wiki/T%C3%A2o_Teh_King#76' },
  ],
  // Bhagavad Gita — trans. K. T. Telang (1882, Sacred Books of the East), public domain (wisdomlib).
  hinduism: [
    { text: 'The contacts of the senses, which produce cold and heat, pleasure and pain, are not permanent, they are ever coming and going. Bear them.', ref: 'Bhagavad Gita 2.14 (Telang)', url: 'https://www.wisdomlib.org/hinduism/book/the-bhagavadgita/d/doc81669.html' },
    { text: 'Your business is with action alone; not by any means with fruit.', ref: 'Bhagavad Gita 2.47 (Telang)', url: 'https://www.wisdomlib.org/hinduism/book/the-bhagavadgita/d/doc81669.html' },
    { text: 'The man who ponders over objects of sense forms an attachment to them; from that attachment is produced desire; and from desire anger is produced.', ref: 'Bhagavad Gita 2.62 (Telang)', url: 'https://www.wisdomlib.org/hinduism/book/the-bhagavadgita/d/doc81669.html' },
    { text: 'A man should elevate his self by his self; he should not debase his self.', ref: 'Bhagavad Gita 6.5 (Telang)', url: 'https://www.wisdomlib.org/hinduism/book/the-bhagavadgita/d/doc81673.html' },
  ],
  // The World English Bible (WEB) — public domain (Bible Gateway).
  christianity: [
    { text: 'The peace of God, which surpasses all understanding, will guard your hearts and your thoughts in Christ Jesus.', ref: 'Philippians 4:7 (WEB)', url: 'https://www.biblegateway.com/passage/?search=Philippians+4:7&version=WEB' },
    { text: "Don't you be afraid, for I am with you. Don't be dismayed, for I am your God.", ref: 'Isaiah 41:10 (WEB)', url: 'https://www.biblegateway.com/passage/?search=Isaiah+41:10&version=WEB' },
    { text: 'Like a city that is broken down and without walls is a man whose spirit is without restraint.', ref: 'Proverbs 25:28 (WEB)', url: 'https://www.biblegateway.com/passage/?search=Proverbs+25:28&version=WEB' },
    { text: 'Be still, and know that I am God.', ref: 'Psalm 46:10 (WEB)', url: 'https://www.biblegateway.com/passage/?search=Psalm+46:10&version=WEB' },
    { text: 'Watch! Stand firm in the faith! Be courageous! Be strong!', ref: '1 Corinthians 16:13 (WEB)', url: 'https://www.biblegateway.com/passage/?search=1+Corinthians+16:13&version=WEB' },
    { text: "God didn't give us a spirit of fear, but of power, love, and self-control.", ref: '2 Timothy 1:7 (WEB)', url: 'https://www.biblegateway.com/passage/?search=2+Timothy+1:7&version=WEB' },
  ],
  // The Holy Qur'an — trans. Maulana Muhammad Ali (1917), public domain (Wikisource).
  islam: [
    { text: 'Surely with difficulty is ease, with difficulty is surely ease.', ref: "Qur'an 94:5-6 (M. Muhammad Ali, 1917)", url: 'https://en.wikisource.org/wiki/The_Holy_Qur%27an_(Maulana_Muhammad_Ali)/94._The_Expansion' },
    { text: 'O soul that art at rest, return to thy Lord, well-pleased, well-pleasing.', ref: "Qur'an 89:27-28 (M. Muhammad Ali, 1917)", url: 'https://en.wikisource.org/wiki/The_Holy_Qur%27an_(Maulana_Muhammad_Ali)/89._The_Daybreak' },
    { text: "Surely in Allah's remembrance do hearts find rest.", ref: "Qur'an 13:28 (M. Muhammad Ali, 1917)", url: 'https://en.wikisource.org/wiki/The_Holy_Qur%27an_(Maulana_Muhammad_Ali)/13._The_Thunder' },
    { text: 'Whoever trusts in Allah, He is sufficient for him.', ref: "Qur'an 65:3 (M. Muhammad Ali, 1917)", url: 'https://en.wikisource.org/wiki/The_Holy_Qur%27an_(Maulana_Muhammad_Ali)/65._Divorce' },
    { text: 'God imposes not on any soul a duty beyond its scope.', ref: "Qur'an 2:286 (M. Muhammad Ali, 1917)", url: 'https://en.wikisource.org/wiki/The_Holy_Qur%27an_(Maulana_Muhammad_Ali)/2._The_Cow' },
  ],
  // Epicurus, Principal Doctrines + Letter to Menoeceus — trans. R. D. Hicks (1925), public domain.
  epicureanism: [
    { text: 'For no age is too early or too late for the health of the soul.', ref: 'Epicurus, Letter to Menoeceus', url: 'https://en.wikisource.org/wiki/Letter_to_Menoeceus' },
    { text: 'Death is nothing to us; for the body, when it has been resolved into its elements, has no feeling, and that which has no feeling is nothing to us.', ref: 'Epicurus, Principal Doctrines II', url: 'https://en.wikisource.org/wiki/Principal_Doctrines' },
    { text: "Nature's wealth at once has its bounds and is easy to procure; but the wealth of vain fancies recedes to an infinite distance.", ref: 'Epicurus, Principal Doctrines XV', url: 'https://en.wikisource.org/wiki/Principal_Doctrines' },
    { text: 'Of all the means which are procured by wisdom to ensure happiness throughout the whole of life, by far the most important is the acquisition of friends.', ref: 'Epicurus, Principal Doctrines XXVII', url: 'https://en.wikisource.org/wiki/Principal_Doctrines' },
  ],
  // Public-domain existentialist primary sources: Nietzsche (trans. Common/Ludovici) + Dostoevsky
  // (trans. Constance Garnett), all pre-1929.
  existentialism: [
    { text: 'One must still have chaos in one, to give birth to a dancing star.', ref: 'Nietzsche, Thus Spake Zarathustra, Prologue 5', url: 'https://standardebooks.org/ebooks/friedrich-nietzsche/thus-spake-zarathustra/thomas-common/text/prologue' },
    { text: 'That which does not kill me, makes me stronger.', ref: 'Nietzsche, Twilight of the Idols, Maxims 8', url: 'https://www.gutenberg.org/files/52263/52263-h/52263-h.htm' },
    { text: "For the secret of man's being is not only to live but to have something to live for.", ref: 'Dostoevsky, The Brothers Karamazov, Book V', url: 'https://standardebooks.org/ebooks/fyodor-dostoevsky/the-brothers-karamazov/constance-garnett/text/chapter-2-5-5' },
    { text: 'What man wants is simply independent choice, whatever that independence may cost and wherever it may lead.', ref: 'Dostoevsky, Notes from Underground, Part I', url: 'https://standardebooks.org/ebooks/fyodor-dostoevsky/notes-from-underground/constance-garnett/text/chapter-1-7' },
  ],
};

/** The day's quote for a school, rotating by day-of-year (offset from the state so quote and
 *  felt-state vary independently). null when the school has no curated quotes yet. */
export function quoteForToday(school: BearingSchool, localDate: string): BearingQuote | null {
  const qs = SCHOOL_QUOTES[school.ideology];
  if (!qs || !qs.length) return null;
  return qs[dayOfYearFromISO(localDate) % qs.length] ?? null;
}

/** All curated public-domain quotes for a school (empty for an un-sourced school). Used to
 *  score the day's anchor against a user's struggle signal (src/server/bearing/vectors.ts). */
export function schoolQuotes(ideology: string): BearingQuote[] {
  return SCHOOL_QUOTES[ideology as Ideology] ?? [];
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
