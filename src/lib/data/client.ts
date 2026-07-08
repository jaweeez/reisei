import { api } from '@/lib/api';
import type {
  AckKind,
  BearingHistory,
  BearingResponse,
  HomeState,
  JournalFeed,
  JournalLogged,
  LineKind,
  LineView,
  SchoolView,
  StreakView,
  Verdict,
} from '@/lib/data/types';

// The Today + Crew + Lines data client. Same base resolution + auth as the other clients.

export async function fetchState(): Promise<HomeState | null> {
  const res = await api<HomeState>('/api/state');
  return res.ok ? res.data : null;
}

export interface CheckInResult {
  alreadyCheckedIn: boolean;
  todayVerdict: Verdict | null;
  localDate: string;
  streak: StreakView;
}

/** Log today's verdict against the active line. `held` advances the streak; `broke`
 *  is an honest break (zeroes the hold streak, keeps integrity). */
export async function checkIn(verdict: Verdict = 'held', note?: string): Promise<CheckInResult | null> {
  const res = await api<CheckInResult>('/api/checkin', { method: 'POST', body: JSON.stringify({ verdict, note }) });
  return res.ok ? res.data : null;
}

export async function createLine(statement: string, kind: LineKind = 'abstain'): Promise<{ line?: LineView; error?: string }> {
  const res = await api<{ line?: LineView; error?: string }>('/api/lines', {
    method: 'POST',
    body: JSON.stringify({ statement, kind }),
  });
  return res.data;
}

export async function retireLine(id: string): Promise<boolean> {
  const res = await api(`/api/lines?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
  return res.ok;
}

// --- Crew ---
export async function createCrew(name: string): Promise<{ id?: string; error?: string; upsell?: boolean }> {
  const res = await api<{ id?: string; error?: string; upsell?: boolean }>('/api/crew', {
    method: 'POST',
    body: JSON.stringify({ name }),
  });
  return res.data;
}

export async function joinCrew(code: string): Promise<{ crewId?: string; error?: string }> {
  const res = await api<{ crewId?: string; error?: string }>('/api/crew/join', { method: 'POST', body: JSON.stringify({ code }) });
  return res.data;
}

export async function createInvite(crewId: string): Promise<{ code?: string; error?: string }> {
  const res = await api<{ code?: string; error?: string }>('/api/crew/invite', { method: 'POST', body: JSON.stringify({ crewId }) });
  return res.data;
}

/** One-tap crew ack: SEEN (held) / RESPECT (broke) / STAND UP (dark). */
export async function ackMember(crewId: string, toUserId: string, kind: AckKind): Promise<boolean> {
  const res = await api<{ ok?: boolean }>('/api/crew/ack', { method: 'POST', body: JSON.stringify({ crewId, toUserId, kind }) });
  return res.ok;
}

/** Set the local HH:MM the coach's evening "post" nudge fires. */
export async function setHoldTime(holdTime: string): Promise<boolean> {
  const res = await api('/api/prefs', { method: 'POST', body: JSON.stringify({ holdTime }) });
  return res.ok;
}

/** Log a completed Reset (box-breathing + grounding). Private composure practice. */
export async function logReset(note?: string): Promise<boolean> {
  const res = await api('/api/reset', { method: 'POST', body: JSON.stringify({ note }) });
  return res.ok;
}

// --- The Bearing: a daily principle from a chosen school ---

/** Today's bearing for each followed school + the full school picker. */
export async function fetchBearing(): Promise<BearingResponse | null> {
  const res = await api<BearingResponse>('/api/bearing');
  return res.ok ? res.data : null;
}

/** Replace the set of schools the user follows. Returns the updated list, or `upsell` at the free cap. */
export async function setSchools(
  ideologies: string[],
): Promise<{ schools?: SchoolView[]; error?: string; upsell?: boolean }> {
  const res = await api<{ schools?: SchoolView[]; error?: string; upsell?: boolean }>('/api/bearing/schools', {
    method: 'PUT',
    body: JSON.stringify({ ideologies }),
  });
  return { ...res.data, upsell: res.status === 402 || res.data.upsell };
}

/** Log a private response to today's bearing (never shown to the crew). */
export async function logBearing(bearingId: string, note: string): Promise<boolean> {
  const res = await api('/api/bearing', { method: 'POST', body: JSON.stringify({ bearingId, note }) });
  return res.ok;
}

/** The user's private log archive (free = last 30 days; Pro = everything). */
export async function fetchBearingHistory(): Promise<BearingHistory | null> {
  const res = await api<BearingHistory>('/api/bearing/history');
  return res.ok ? res.data : null;
}

// --- The log: a private, free-form journal ---

/** The user's private log feed (free = last 30 days; Pro = everything). */
export async function fetchJournal(): Promise<JournalFeed | null> {
  const res = await api<JournalFeed>('/api/journal');
  return res.ok ? res.data : null;
}

/** Append a private log entry. Returns the saved entry and whether to surface an off-ramp. */
export async function logJournal(body: string): Promise<JournalLogged | null> {
  const res = await api<JournalLogged>('/api/journal', { method: 'POST', body: JSON.stringify({ body }) });
  return res.ok ? res.data : null;
}
