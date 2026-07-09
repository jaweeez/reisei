import { api } from '@/lib/api';
import { clearToken, setToken } from '@/lib/auth/token';
import type { Entitlement, Me } from '@/lib/data/types';

export interface AuthPayload {
  token?: string;
  user?: Me;
  error?: string;
}

async function persist(res: { ok: boolean; data: AuthPayload }): Promise<AuthPayload> {
  if (res.ok && res.data.token) await setToken(res.data.token);
  return res.data;
}

export const authApi = {
  register: (username: string, pin: string, name: string, email: string) =>
    api<AuthPayload>('/api/auth/register', { method: 'POST', body: JSON.stringify({ username, pin, name, email }) }).then(persist),
  login: (username: string, pin: string) =>
    api<AuthPayload>('/api/auth/login', { method: 'POST', body: JSON.stringify({ username, pin }) }).then(persist),
  me: () => api<{ user: Me; entitlement: Entitlement }>('/api/auth/me'),
  logout: async () => {
    await api('/api/auth/logout', { method: 'POST' });
    await clearToken();
  },

  // Permanently delete the account (PIN-confirmed). Clears the local token on success.
  deleteAccount: async (pin: string) => {
    const res = await api<{ ok?: boolean; error?: string }>('/api/auth/delete', {
      method: 'POST',
      body: JSON.stringify({ pin }),
    });
    if (res.ok) await clearToken();
    return res;
  },

  // Email verification (signed in).
  addEmail: (email: string) =>
    api<{ ok?: boolean; error?: string; cooldown?: number }>('/api/auth/email', { method: 'POST', body: JSON.stringify({ email }) }),
  verifyEmailCode: (code: string) =>
    api<{ ok?: boolean; error?: string }>('/api/auth/email/verify', { method: 'POST', body: JSON.stringify({ code }) }),
  resendCode: () => api<{ ok?: boolean; error?: string; cooldown?: number }>('/api/auth/email/resend', { method: 'POST' }),

  // PIN recovery (signed out).
  requestPinReset: (email: string) =>
    api<{ ok?: boolean }>('/api/auth/pin-reset/request', { method: 'POST', body: JSON.stringify({ email }) }),
  confirmPinReset: (email: string, code: string, pin: string) =>
    api<{ ok?: boolean; error?: string }>('/api/auth/pin-reset/confirm', { method: 'POST', body: JSON.stringify({ email, code, pin }) }),
};
