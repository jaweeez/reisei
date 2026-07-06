import { api } from '@/lib/api';
import type { Tier } from '@/lib/data/types';

export type Interval = 'monthly' | 'annual';

export interface BillingStatus {
  enabled: boolean;
  tier: Tier;
  proIntervals: Interval[];
  seatIntervals: Interval[];
  canUpgrade: boolean;
  portalAvailable: boolean;
}

export const billingApi = {
  status: () => api<BillingStatus>('/api/billing/status'),
  // Web rail. Mobile Pro goes through RevenueCat (see lib/billing/iap.ts).
  checkout: (plan: 'pro' | 'seat', interval: Interval, seats?: number) =>
    api<{ url?: string; error?: string }>('/api/billing/checkout', {
      method: 'POST',
      body: JSON.stringify({ plan, interval, seats }),
    }),
  portal: () => api<{ url?: string; error?: string }>('/api/billing/portal', { method: 'POST' }),
};
