import { api } from '@/lib/api';
import type { Verdict } from '@/lib/data/types';

export interface LedgerStats {
  held: number;
  broke: number;
  holdRate: number | null;
  longest: number;
  resets: number;
  integrity: number;
  worstDay: string | null;
  breaksByWeekday: number[];
}

export interface Ledger {
  calendar: { date: string; verdict: Verdict }[];
  stats: LedgerStats;
  retiredLines: { statement: string; start: string; retired: string | null }[];
  fieldReports: { date: string; verdict: Verdict; note: string }[];
}

/** Fetch the Pro Ledger. `upsell` true (with no ledger) means the user is on Free. */
export async function getLedger(): Promise<{ ledger?: Ledger; upsell?: boolean }> {
  const res = await api<Ledger & { upsell?: boolean }>('/api/ledger');
  if (res.status === 402) return { upsell: true };
  if (!res.ok) return {};
  return { ledger: res.data };
}
