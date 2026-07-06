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
  register: (username: string, pin: string, name?: string) =>
    api<AuthPayload>('/api/auth/register', { method: 'POST', body: JSON.stringify({ username, pin, name }) }).then(persist),
  login: (username: string, pin: string) =>
    api<AuthPayload>('/api/auth/login', { method: 'POST', body: JSON.stringify({ username, pin }) }).then(persist),
  me: () => api<{ user: Me; entitlement: Entitlement }>('/api/auth/me'),
  logout: async () => {
    await api('/api/auth/logout', { method: 'POST' });
    await clearToken();
  },
};
