// Shared client<->server contract for the home surface. Kept in one place so the
// +api.ts routes and the client fetchers agree on shape.

export interface Me {
  id: string;
  name: string;
  username: string;
  tz: string;
  plan: 'free' | 'pro';
}

export type Tier = 'free' | 'pro' | 'team';

export interface Entitlement {
  tier: Tier;
  premium: boolean;
  canCreateCrew: boolean;
  isCaptain: boolean;
}

export type Verdict = 'held' | 'broke';
export type LineKind = 'abstain' | 'hold';

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

export interface CrewMemberView {
  id: string;
  name: string;
  role: 'member' | 'captain';
  /** Today's posture: 'held' | 'broke' | 'dark' (logged nothing yet). */
  posture: 'held' | 'broke' | 'dark';
  /** The crewmate's line statement, if they have an active one (the witness). */
  line: string | null;
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
}
