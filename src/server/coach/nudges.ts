// The coach's rule engine — pure + unit-tested. Given a user's current state, decide
// which single nudge (if any) to send right now, with verbatim in-voice copy.
// "A coach, not a counselor. Direction, not mood." A held day generates ZERO nudges —
// silence is the reward. Never: "you've got this", "how are you feeling", guilt, or an
// exclamation mark outside a hard milestone.

export type NudgeKind = 'post' | 'at_risk' | 'after_break' | 'after_miss' | 'stand_up' | 'milestone';

export interface TickContext {
  name: string;
  /** 0–23, the user's LOCAL hour. */
  localHour: number;
  /** Hour parsed from users.hold_time (default 20). */
  holdHour: number;
  loggedToday: boolean;
  /** Consecutive held days (the hold streak). */
  current: number;
  /** Logged a break yesterday. */
  brokeYesterday: boolean;
  /** Went dark yesterday (line existed, no log). */
  missedYesterday: boolean;
  /** A crewmate fired STAND UP at them today. */
  hasStandUp: boolean;
}

const MORNING_START = 6;
const MORNING_END = 10;
const AT_RISK_HOUR = 22;
const MILESTONES = new Set([7, 30, 100]);

const first = (name: string) => name?.split(' ')[0] || 'you';

/** The verbatim string table. One place so the voice is enforced once. */
export const NUDGE_COPY: Record<NudgeKind, (c: TickContext) => string> = {
  stand_up: (c) => `${first(c.name)}, you got flagged. Line's still open. Log today.`,
  after_break: () => `Line broke yesterday. Today it holds or it doesn't. Log.`,
  after_miss: () => `Missed yesterday. The line reset. Stand it back up today.`,
  at_risk: (c) => `${c.current}-day line. Two hours left. Don't let it go dark.`,
  post: () => `Line's still open. Log today.`,
  milestone: (c) => `${c.current} days. The line held. Keep standing it.`,
};

/**
 * Pick the one nudge to fire now, or null. Priority: a STAND UP flag, then the
 * morning after-break/after-miss, then the evening post/at-risk, then a milestone.
 */
export function pickNudge(c: TickContext): { kind: NudgeKind; body: string } | null {
  const make = (kind: NudgeKind) => ({ kind, body: NUDGE_COPY[kind](c) });

  if (c.hasStandUp && !c.loggedToday) return make('stand_up');

  const morning = c.localHour >= MORNING_START && c.localHour < MORNING_END;
  if (morning && !c.loggedToday) {
    if (c.brokeYesterday) return make('after_break');
    if (c.missedYesterday) return make('after_miss');
  }

  if (!c.loggedToday) {
    if (c.localHour === AT_RISK_HOUR && c.current >= 3) return make('at_risk');
    if (c.localHour === c.holdHour) return make('post');
  }

  if (c.loggedToday && MILESTONES.has(c.current)) return make('milestone');

  return null;
}

/** Parse an "HH:MM" hold_time to its hour (0–23), default 20. */
export function holdHourOf(holdTime: string | null | undefined): number {
  const part = String(holdTime ?? '').split(':')[0];
  const h = Number(part);
  return part !== '' && Number.isInteger(h) && h >= 0 && h <= 23 ? h : 20;
}
