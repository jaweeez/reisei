// Shared client<->server contract for the home surface. Kept in one place so the
// +api.ts routes and the client fetchers agree on shape.

export interface Me {
  id: string;
  name: string;
  username: string;
  tz: string;
  plan: 'free' | 'pro';
  /** Local HH:MM the coach's "post" nudge fires. */
  holdTime?: string;
  /** Recovery email (normalized lowercase), if set. */
  email?: string;
  /** Whether the email has been verified. */
  emailVerified?: boolean;
  /** True for accounts created under the required-email regime (walled until verified). */
  emailRequired?: boolean;
}

export type Tier = 'free' | 'pro' | 'team' | 'org';

/** Hard cap on Corner membership. Keep in sync with the check in crew_join
 *  (db/migrations/0019_orgs.sql). */
export const CORNER_MAX = 8;

export interface Entitlement {
  tier: Tier;
  premium: boolean;
  canCreateCrew: boolean;
  isCaptain: boolean;
  /** True platform admin (superuser). Gates the Settings → Admin dashboard. */
  isAdmin: boolean;
  /** Owns an org row (any subscription status) — keeps the org dashboard reachable after a lapse. */
  ownsOrg?: boolean;
}

// --- Admin dashboard ---
export interface AdminOverview {
  users: number;
  admins: number;
  pro: number;
  crews: number;
  checkinsToday: number;
  signups7d: number;
  active7d: number;
}

export interface AdminUser {
  id: string;
  username: string;
  name: string;
  plan: 'free' | 'pro';
  isAdmin: boolean;
  createdAt: string;
  crewCount: number;
}

export type Verdict = 'held' | 'broke';
export type LineKind = 'abstain' | 'hold';

/** The common places a line gets loose. Kept finite so the next move can be useful. */
export const RECOVERY_FRICTIONS = ['time', 'energy', 'conflict', 'avoidance'] as const;
export type RecoveryFriction = (typeof RECOVERY_FRICTIONS)[number];

export const RECOVERY_FRICTION_LABEL: Record<RecoveryFriction, string> = {
  time: 'Time got away',
  energy: 'Low energy',
  conflict: 'Conflict hit',
  avoidance: 'I avoided it',
};

export const RECOVERY_MOVES = [
  'Set the cue earlier',
  'Make the first step smaller',
  'Clear one obstacle tonight',
  'Tell your Corner',
] as const;

/** A private adjustment made after an honest break, carried into the next day. */
export interface RecoveryPlan {
  sourceDate: string;
  friction: RecoveryFriction;
  move: string;
}

/** The one standard the user holds. */
export interface LineView {
  id: string;
  statement: string;
  kind: LineKind;
  startLocalDate: string;
}

export interface StreakView {
  /** Consecutive held days — the hold streak. */
  current: number;
  longest: number;
  lastLocalDate: string | null;
  lastVerdict: Verdict | null;
  breaks: number;
  resets: number;
  integrity: number;
}

export type AckKind = 'seen' | 'respect' | 'stand_up';
export type Posture = 'held' | 'broke' | 'dark';

export interface CrewMemberView {
  id: string;
  name: string;
  role: 'member' | 'captain';
  /** Today's posture: 'held' | 'broke' | 'dark' (logged nothing yet). */
  posture: Posture;
  /** The crewmate's line statement, if they have an active one (the witness). */
  line: string | null;
  /** Acks this member received today (from anyone). */
  acksReceived: number;
  /** Whether the viewer has already acked this member today (any kind). */
  ackedByMe: boolean;
}

export interface CrewView {
  id: string;
  name: string;
  isCaptain: boolean;
  memberCount: number;
  heldCount: number;
  brokeCount: number;
  members: CrewMemberView[];
}

export interface HomeState {
  localDate: string;
  /** The user's active line, or null (→ Today shows the "draw your line" empty state). */
  line: LineView | null;
  /** What was logged today for the active line, or null if not logged yet. */
  todayVerdict: Verdict | null;
  streak: StreakView;
  crews: CrewView[];
  /** The coach's nudge for today (in-app banner), or null. */
  todayNudge: string | null;
  /** Whether the user has completed a Reset today. */
  resetToday: boolean;
  /** Today's recovery plan after a break, plus yesterday's plan to carry into today. */
  recovery: { today: RecoveryPlan | null; carry: RecoveryPlan | null };
  /** The Today card for The Bearing. null → user follows no school. An empty `principle`
   *  → follows a school but today's bearing isn't generated yet (open the screen to draw it). */
  bearing: BearingToday | null;
}

// --- The Bearing: a daily operating principle from a chosen school ---

/** The link-out for a bearing: our own wording, their source. */
export interface BearingSource {
  url: string;
  title: string;
  attribution: string;
}

/** One selectable school (the analog to Enso's pathways). */
export interface SchoolView {
  ideology: string;
  label: string;
  blurb: string;
  followed: boolean;
}

/** Today's bearing for one followed school, with the user's log status. */
export interface BearingView {
  bearingId: string;
  ideology: string;
  label: string;
  principle: string;
  /** A short question / concrete action to carry into today, or null. */
  prompt: string | null;
  /** The day's anchoring quote (shown as an epigraph); `source.url` opens the exact passage. */
  quote: { text: string; ref: string } | null;
  source: BearingSource;
  /** A subtle affiliation / copyright note (Enso's copyrightNote pattern). */
  copyright: string;
  loggedToday: boolean;
}

/** The compact Today-card view of the primary followed school's bearing. */
export interface BearingToday {
  ideology: string;
  label: string;
  /** The principle text, or '' if generation was unavailable. */
  principle: string;
  /** The day's anchoring quote, kept prominent on Today. */
  quote: { text: string; ref: string } | null;
  /** One concrete move from the bearing. */
  prompt: string | null;
  loggedToday: boolean;
}

/** GET /api/bearing — the picker (all schools) + today's bearings (followed). */
export interface BearingResponse {
  localDate: string;
  schools: SchoolView[];
  today: BearingView[];
}

/** One past entry in the user's private log. */
export interface BearingLogItem {
  date: string;
  ideology: string;
  label: string;
  principle: string;
  note: string;
}

/** GET /api/bearing/history — the log archive. `upsell` when older entries are gated. */
export interface BearingHistory {
  logs: BearingLogItem[];
  upsell: boolean;
}

// --- The log: a private, free-form journal ---

/** One entry in the user's private log. */
export interface JournalEntry {
  id: string;
  /** Local calendar date (YYYY-MM-DD). */
  date: string;
  body: string;
}

/** GET /api/journal — the log feed. `upsell` when older entries are gated (free = 30 days). */
export interface JournalFeed {
  entries: JournalEntry[];
  upsell: boolean;
}

/** POST /api/journal result. `offramp` is true when the entry read like a genuinely hard
 *  place — the log surfaces a real resource instead of coaching it (see docs/VOICE.md). */
export interface JournalLogged {
  entry: JournalEntry;
  offramp: boolean;
}

// --- Organizations: 9+ seats, multiple Corners under one owner ---

export interface OrgMemberView {
  id: string;
  name: string;
  username: string;
  seated: boolean;
  /** The org Corner this member sits in, or null if not placed yet. */
  cornerName: string | null;
}

export interface OrgCornerView {
  id: string;
  name: string;
  memberCount: number;
}

export interface OrgInviteView {
  code: string;
  crewId: string | null;
  cornerName: string | null;
  createdAt: string;
}

/** GET /api/org — the owner dashboard. */
export interface OrgView {
  id: string;
  name: string;
  /** 'active' | 'trialing' | 'paused' | 'canceled' | 'none' (no plan yet). */
  status: string;
  seats: { total: number; used: number };
  members: OrgMemberView[];
  corners: OrgCornerView[];
  invites: OrgInviteView[];
}

/** POST /api/org/join result. `cornerFull` → seated but not placed (owner will place). */
export interface OrgJoined {
  orgId: string;
  crewId: string | null;
  seated: boolean;
  cornerFull: boolean;
}
