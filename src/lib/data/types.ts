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

export interface StreakView {
  current: number;
  longest: number;
  lastLocalDate: string | null;
}

export interface CrewMemberView {
  id: string;
  name: string;
  role: 'member' | 'captain';
  checkedInToday: boolean;
}

export interface CrewView {
  id: string;
  name: string;
  isCaptain: boolean;
  memberCount: number;
  checkedInCount: number;
  members: CrewMemberView[];
}

export interface HomeState {
  localDate: string;
  checkedInToday: boolean;
  streak: StreakView;
  crews: CrewView[];
}
