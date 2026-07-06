import { api } from '@/lib/api';
import type { HomeState, StreakView } from '@/lib/data/types';

// The Today + Crew data client. Same base resolution + auth as the other clients.

export async function fetchState(): Promise<HomeState | null> {
  const res = await api<HomeState>('/api/state');
  return res.ok ? res.data : null;
}

export interface CheckInResult {
  alreadyCheckedIn: boolean;
  localDate: string;
  streak: StreakView;
}

export async function checkIn(note?: string, crewId?: string): Promise<CheckInResult | null> {
  const res = await api<CheckInResult>('/api/checkin', { method: 'POST', body: JSON.stringify({ note, crewId }) });
  return res.ok ? res.data : null;
}

export async function createCrew(name: string): Promise<{ id?: string; error?: string; upsell?: boolean }> {
  const res = await api<{ id?: string; error?: string; upsell?: boolean }>('/api/crew', {
    method: 'POST',
    body: JSON.stringify({ name }),
  });
  return res.data;
}

export async function joinCrew(code: string): Promise<{ crewId?: string; error?: string }> {
  const res = await api<{ crewId?: string; error?: string }>('/api/crew/join', {
    method: 'POST',
    body: JSON.stringify({ code }),
  });
  return res.data;
}

export async function createInvite(crewId: string): Promise<{ code?: string; error?: string }> {
  const res = await api<{ code?: string; error?: string }>('/api/crew/invite', {
    method: 'POST',
    body: JSON.stringify({ crewId }),
  });
  return res.data;
}
