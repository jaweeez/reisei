import { api } from '@/lib/api';
import type { AckKind, HomeState, LineKind, LineView, StreakView, Verdict } from '@/lib/data/types';

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
