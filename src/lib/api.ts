import { Platform } from 'react-native';
import { getToken } from '@/lib/auth/token';

// Base URL resolution shared by every client fetcher.
//   • Web  → ALWAYS same-origin (empty base). The API routes are served by the same
//            host as the web app, and the session rides an httpOnly cookie.
//   • Native → the deployed origin (Bearer token), from EXPO_PUBLIC_API_URL. For
//            local native dev set it to your Metro LAN URL (e.g. http://192.168.x.x:8081).
const REMOTE = (process.env.EXPO_PUBLIC_API_URL || process.env.EXPO_PUBLIC_APP_URL || '').replace(/\/$/, '');
const BASE = Platform.OS === 'web' ? '' : REMOTE;

export function apiUrl(path: string): string {
  return `${BASE}${path}`;
}

export interface ApiResult<T> {
  ok: boolean;
  status: number;
  data: T;
}

export async function api<T>(path: string, init?: RequestInit): Promise<ApiResult<T>> {
  const token = await getToken().catch(() => null);
  try {
    const res = await fetch(apiUrl(path), {
      ...init,
      credentials: 'include',
      headers: {
        ...(init?.body ? { 'content-type': 'application/json' } : {}),
        ...(token ? { authorization: `Bearer ${token}` } : {}),
        ...(init?.headers ?? {}),
      },
    });
    const data = (await res.json().catch(() => ({}))) as T;
    return { ok: res.ok, status: res.status, data };
  } catch {
    return { ok: false, status: 0, data: {} as T };
  }
}
