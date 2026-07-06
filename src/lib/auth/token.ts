import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

// Session token storage. Native holds the Bearer token in the secure keystore;
// web relies on the server's httpOnly cookie (JS neither can nor should read it),
// so these are no-ops on web.
const KEY = 'reisei.session.token';

export async function getToken(): Promise<string | null> {
  if (Platform.OS === 'web') return null;
  try {
    return await SecureStore.getItemAsync(KEY);
  } catch {
    return null;
  }
}

export async function setToken(token: string): Promise<void> {
  if (Platform.OS === 'web') return;
  try {
    await SecureStore.setItemAsync(KEY, token);
  } catch {
    /* best-effort */
  }
}

export async function clearToken(): Promise<void> {
  if (Platform.OS === 'web') return;
  try {
    await SecureStore.deleteItemAsync(KEY);
  } catch {
    /* best-effort */
  }
}
