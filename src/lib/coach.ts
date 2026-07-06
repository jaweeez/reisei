import { api } from '@/lib/api';

export type Ideology = 'stoicism' | 'cbt' | 'mindfulness';

export interface CoachGrounding {
  title: string;
  ideology: string | null;
  theme: string | null;
  url: string | null;
}

export interface CoachNudge {
  nudge: string;
  grounding: CoachGrounding[];
}

/** Ask the coach for a terse, grounded nudge. `situation` is optional free text
 *  (e.g. "missed yesterday, streak reset"); `ideology` scopes it to one school. */
export async function getCoachNudge(situation?: string, ideology?: Ideology): Promise<CoachNudge | null> {
  const res = await api<CoachNudge>('/api/coach', {
    method: 'POST',
    body: JSON.stringify({ situation, ideology }),
  });
  return res.ok ? res.data : null;
}
