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
  cycleReports: {
    id: string;
    statement: string;
    start: string;
    end: string;
    outcome: string;
    held: number;
    broke: number;
    quiet: number;
    holdRate: number | null;
    recoveryRate: number | null;
    averageRecoveryDays: number | null;
    review: {
      action: string;
      easier: string | null;
      friction: string | null;
      nextStandard: string | null;
      earlyReason: string | null;
    } | null;
  }[];
}

/** Fetch the Pro Ledger. `upsell` true (with no ledger) means the user is on Free. */
export async function getLedger(): Promise<{ ledger?: Ledger; upsell?: boolean }> {
  const res = await api<Ledger & { upsell?: boolean }>('/api/ledger');
  if (res.status === 402) return { upsell: true };
  if (!res.ok) return {};
  return { ledger: res.data };
}
