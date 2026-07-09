import { api } from '@/lib/api';
import type { Tier } from '@/lib/data/types';

export type Interval = 'monthly' | 'annual';

export interface BillingStatus {
  enabled: boolean;
  tier: Tier;
  proIntervals: Interval[];
  seatIntervals: Interval[];
  orgIntervals: Interval[];
  canUpgrade: boolean;
  portalAvailable: boolean;
}

export const billingApi = {
  status: () => api<BillingStatus>('/api/billing/status'),
  // Web rail. Mobile Pro goes through RevenueCat (see lib/billing/iap.ts); per-seat
  // plans (Corner 2–8, Organization 9+) are always web.
  checkout: (plan: 'pro' | 'seat' | 'org', interval: Interval, seats?: number, orgId?: string) =>
    api<{ url?: string; error?: string }>('/api/billing/checkout', {
      method: 'POST',
      body: JSON.stringify({ plan, interval, seats, orgId }),
    }),
  portal: () => api<{ url?: string; error?: string }>('/api/billing/portal', { method: 'POST' }),
};
