import { generateText } from 'ai';
import { anthropic, CHAT_MODEL, chatEnabled } from '@/server/ai/anthropic';

// Crisis screen for a log entry. The Bearing gets built around what a person is carrying, so
// before an entry can steer anything we check it isn't a genuinely dark place. A `dark` entry
// is still saved (never lost), but it is kept out of the profile / struggle signal entirely,
// and the log surfaces a real off-ramp instead of coaching it (docs/VOICE.md duty of care).

export type EntryRisk = 'ok' | 'dark';

// Only unambiguous crisis language — ordinary anger, stress, shame, grief, or a bad day must
// never trip this. Used as a fast pre-check and as the fallback when the model is unavailable.
const CRISIS_PATTERNS: RegExp[] = [
  /\bkill(?:ing)?\s+my\s?self\b/i,
  /\bwant(?:ing)?\s+to\s+die\b/i,
  /\bwant\s+to\s+be\s+dead\b/i,
  /\bbetter\s+off\s+dead\b/i,
  /\bend(?:ing)?\s+(?:it\s+all|my\s+life)\b/i,
  /\bsuicid(?:e|al)\b/i,
  /\bself[-\s]?harm\b/i,
  /\b(?:hurt|cut)(?:ting)?\s+my\s?self\b/i,
  /\bno\s+(?:reason|point)\s+(?:to|in)\s+(?:living|go(?:ing)?\s+on)\b/i,
  /\bdon'?t\s+want\s+to\s+(?:be\s+here|live|exist)\b/i,
  /\bcan'?t\s+(?:do\s+this|go\s+on|keep\s+going)\s+anymore\b/i,
  // Recovery crisis: intent to overdose or use in a way meant to end things. Ordinary cravings,
  // urges, or a slip by itself must NOT trip this (they stay 'ok' and get coached).
  /\bwant(?:ing)?\s+to\s+overdose\b/i,
  /\b(?:take|use)\s+(?:the\s+)?(?:whole|entire|rest\s+of\s+the)\s+(?:bottle|batch|bag|stash|thing)\b/i,
  /\bdon'?t\s+care\s+if\s+i\s+(?:overdose|od|die|wake\s+up|come\s+back)\b/i,
  /\buse\s+until\s+i\s+(?:die|stop\s+breathing|don'?t\s+wake\s+up)\b/i,
];

function keywordRisk(text: string): EntryRisk {
  return CRISIS_PATTERNS.some((re) => re.test(text)) ? 'dark' : 'ok';
}

const SYSTEM = `You are a safety classifier for a men's composure and recovery app. Read one private log entry and decide if the writer is in genuine crisis right now: suicidal thoughts, intent to harm themselves, intent to overdose or use in a way meant to end things, wanting to disappear or not exist, or despair well beyond a hard day. Ordinary anger, stress, sadness, shame, grief, cravings or urges, a slip or relapse by itself, loneliness, or a plain bad day are NOT crisis. Answer with exactly one word: dark if it reads like genuine crisis, otherwise ok. Output nothing else.`;

/** Classify one log entry. Explicit crisis language is trusted immediately; otherwise the model
 *  is asked (it catches subtler cases). Any model failure falls back to the keyword result. */
export async function screenEntry(text: string): Promise<EntryRisk> {
  if (keywordRisk(text) === 'dark') return 'dark';
  if (!chatEnabled()) return 'ok';
  try {
    const { text: out } = await generateText({
      model: anthropic(CHAT_MODEL),
      system: SYSTEM,
      prompt: `LOG ENTRY:\n${text}\n\nOne word, dark or ok:`,
      maxTokens: 4,
      temperature: 0,
    });
    return /dark/i.test(out) ? 'dark' : 'ok';
  } catch (e) {
    console.error('safety screen error:', e instanceof Error ? e.message : e);
    return 'ok';
  }
}
