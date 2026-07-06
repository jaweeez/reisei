// Expo push send path (P8). The coach cron dispatches through here; the register path
// (device_tokens) already exists. Best-effort — never throws into the caller.
const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

export interface PushMessage {
  to: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

/** Send a batch of push messages to Expo. Silently no-ops on error (delivery is best-effort). */
export async function sendExpoPush(messages: PushMessage[]): Promise<number> {
  const valid = messages.filter((m) => m.to?.startsWith('ExponentPushToken') || m.to?.startsWith('ExpoPushToken'));
  if (!valid.length) return 0;
  const accessToken = process.env.EXPO_ACCESS_TOKEN;
  try {
    await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        accept: 'application/json',
        ...(accessToken ? { authorization: `Bearer ${accessToken}` } : {}),
      },
      body: JSON.stringify(valid),
    });
    return valid.length;
  } catch {
    return 0;
  }
}
