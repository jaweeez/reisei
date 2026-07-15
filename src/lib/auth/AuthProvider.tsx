import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { authApi } from '@/lib/auth/client';
import { configureIap, logOutIap, onCustomerInfoUpdated } from '@/lib/billing/iap';
import type { Entitlement, Me } from '@/lib/data/types';

type Status = 'loading' | 'authed' | 'guest';

interface AuthValue {
  status: Status;
  user: Me | null;
  entitlement: Entitlement | null;
  refresh: () => Promise<void>;
  register: (username: string, pin: string, name: string, email: string) => Promise<string | null>;
  login: (username: string, pin: string, remember?: boolean) => Promise<string | null>;
  logout: () => Promise<void>;
  deleteAccount: (pin: string) => Promise<string | null>;
}

const Ctx = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>('loading');
  const [user, setUser] = useState<Me | null>(null);
  const [entitlement, setEntitlement] = useState<Entitlement | null>(null);

  const refresh = useCallback(async () => {
    const res = await authApi.me();
    if (res.ok && res.data.user) {
      setUser(res.data.user);
      setEntitlement(res.data.entitlement ?? null);
      setStatus('authed');
    } else {
      setUser(null);
      setEntitlement(null);
      setStatus('guest');
    }
  }, []);

  useEffect(() => {
    let active = true;
    void authApi.me().then((res) => {
      if (!active) return;
      if (res.ok && res.data.user) {
        setUser(res.data.user);
        setEntitlement(res.data.entitlement ?? null);
        setStatus('authed');
      } else {
        setUser(null);
        setEntitlement(null);
        setStatus('guest');
      }
    });
    return () => { active = false; };
  }, []);

  // Keep RevenueCat's customer identity aligned with Reisei's authenticated
  // account. CustomerInfo changes (purchase, renewal, restore) trigger a
  // server entitlement refresh; the webhook remains the source of truth.
  useEffect(() => {
    if (!user?.id) return;
    let disposed = false;
    let unsubscribe: () => void = () => undefined;

    void configureIap(user.id).then(() => {
      if (!disposed) unsubscribe = onCustomerInfoUpdated(() => void refresh());
    });

    return () => {
      disposed = true;
      unsubscribe();
    };
  }, [user?.id, refresh]);

  const register = useCallback(
    async (username: string, pin: string, name: string, email: string) => {
      const r = await authApi.register(username, pin, name, email);
      if (r.token) {
        await refresh();
        return null;
      }
      return r.error ?? 'Could not create your account.';
    },
    [refresh],
  );

  const login = useCallback(
    async (username: string, pin: string, remember = true) => {
      const r = await authApi.login(username, pin, remember);
      if (r.token) {
        await refresh();
        return null;
      }
      return r.error ?? 'Wrong username or PIN.';
    },
    [refresh],
  );

  const logout = useCallback(async () => {
    await logOutIap();
    await authApi.logout();
    setUser(null);
    setEntitlement(null);
    setStatus('guest');
  }, []);

  const deleteAccount = useCallback(async (pin: string) => {
    const res = await authApi.deleteAccount(pin);
    if (res.ok) {
      await logOutIap();
      setUser(null);
      setEntitlement(null);
      setStatus('guest');
      return null;
    }
    return res.data?.error ?? 'Could not delete your account.';
  }, []);

  const value = useMemo<AuthValue>(
    () => ({ status, user, entitlement, refresh, register, login, logout, deleteAccount }),
    [status, user, entitlement, refresh, register, login, logout, deleteAccount],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthValue {
  const v = useContext(Ctx);
  if (!v) throw new Error('useAuth must be used within <AuthProvider>');
  return v;
}
