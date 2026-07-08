import { api } from '@/lib/api';
import type { AdminOverview, AdminUser } from '@/lib/data/types';

// Admin dashboard client. Every call hits an /api/admin/* route that is admin-gated on the
// server (403 otherwise), so these are safe to expose — the button just won't work for a
// non-admin session.

export async function adminOverview(): Promise<AdminOverview | null> {
  const res = await api<AdminOverview>('/api/admin/overview');
  return res.ok ? res.data : null;
}

export async function adminUsers(q = ''): Promise<AdminUser[]> {
  const res = await api<{ users: AdminUser[] }>(`/api/admin/users?q=${encodeURIComponent(q)}`);
  return res.ok ? (res.data.users ?? []) : [];
}

/** Grant or revoke Pro on any user. Returns true on success. */
export async function adminGrant(userId: string, plan: 'free' | 'pro'): Promise<boolean> {
  const res = await api('/api/admin/grant', { method: 'POST', body: JSON.stringify({ userId, plan }) });
  return res.ok;
}
