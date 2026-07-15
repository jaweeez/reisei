import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

// Session token storage. Native holds the Bearer token in the secure keystore;
// web relies on the server's httpOnly cookie (JS neither can nor should read it),
// so these are no-ops on web.
const KEY = 'reisei.session.token';
let sessionToken: string | null = null;

export async function getToken(): Promise<string | null> {
  if (Platform.OS === 'web') return null;
  if (sessionToken) return sessionToken;
  try {
    return await SecureStore.getItemAsync(KEY);
  } catch {
    return null;
  }
}

export async function setToken(token: string, remember = true): Promise<void> {
  if (Platform.OS === 'web') return;
  sessionToken = token;
  try {
    if (remember) await SecureStore.setItemAsync(KEY, token);
    else await SecureStore.deleteItemAsync(KEY);
  } catch {
    /* best-effort */
  }
}

export async function clearToken(): Promise<void> {
  if (Platform.OS === 'web') return;
  sessionToken = null;
  try {
    await SecureStore.deleteItemAsync(KEY);
  } catch {
    /* best-effort */
  }
}
