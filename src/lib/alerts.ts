import { Alert, Platform } from 'react-native';

// The one web/native alert bridge (three screens had hand-rolled copies of this shim).
// Web gets window.confirm/alert; native gets Alert.alert. SSR (no window) resolves false —
// never destructive by default.

/** Ask before something irreversible. Resolves true only on explicit confirmation. */
export function confirm(title: string, message: string, confirmLabel = 'Confirm', destructive = true): Promise<boolean> {
  if (Platform.OS === 'web') {
    if (typeof window === 'undefined') return Promise.resolve(false);
    return Promise.resolve(window.confirm(`${title}\n\n${message}`));
  }
  return new Promise((res) =>
    Alert.alert(title, message, [
      { text: 'Cancel', style: 'cancel', onPress: () => res(false) },
      { text: confirmLabel, style: destructive ? 'destructive' : 'default', onPress: () => res(true) },
    ]),
  );
}

/** Tell the user something short. Fire-and-forget. */
export function notify(message: string, title = 'Reisei'): void {
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined') window.alert(message);
    return;
  }
  Alert.alert(title, message);
}
