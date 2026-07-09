import { useCallback, useState } from 'react';
import { router, useFocusEffect } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Body, Button, Caption, Card, CrisisCard, Eyebrow, Input, Mono, Screen, Title } from '@/components';
import { fetchJournal, logJournal } from '@/lib/data/client';
import type { JournalFeed } from '@/lib/data/types';
import { color, space } from '@/theme';

// The log — put words to it, private. Free-form entries no one else sees. Each entry quietly
// tunes what the Bearing brings you the next time something's actually up (never shown here).
// If an entry reads like a genuinely hard place, we step back and point to a real resource
// instead of coaching it (docs/VOICE.md duty of care) — the CrisisCard, standing at the bottom
// and raised (alert) right after a heavy entry.

export default function Log() {
  const [feed, setFeed] = useState<JournalFeed | null>(null);
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [offramp, setOfframp] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => setFeed(await fetchJournal()), []);
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  async function onLog() {
    const text = body.trim();
    if (!text) return;
    setBusy(true);
    const res = await logJournal(text);
    setBusy(false);
    if (res) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setError(null);
      setBody('');
      setOfframp(res.offramp);
      await load();
    } else {
      setError('Could not save. Try again.');
    }
  }

  return (
    <Screen>
      <Title>The log</Title>
      <Caption>Put words to it. Private. No one sees this but you.</Caption>

      <Card>
        <Input
          inCard
          multiline
          placeholder="What's actually going on? Say the real version."
          value={body}
          onChangeText={(t) => {
            setBody(t);
            setError(null);
          }}
          maxLength={2000}
        />
        {error && <Body color={color.actionText}>{error}</Body>}
        <Button label="Log it" onPress={onLog} loading={busy} disabled={!body.trim()} />
      </Card>

      {offramp && <CrisisCard alert />}

      <View style={styles.list}>
        {feed?.entries.length ? (
          feed.entries.map((e) => (
            <Card key={e.id}>
              <Mono>{e.date}</Mono>
              <Body color={color.textPrimary}>{e.body}</Body>
            </Card>
          ))
        ) : (
          <Caption>Nothing logged yet. Write one honest line above. It stays here, with you.</Caption>
        )}

        {feed?.upsell && (
          <Card>
            <Eyebrow>Pro</Eyebrow>
            <Caption>You have entries older than 30 days. Go Pro to keep the full log.</Caption>
            <Button label="Go Pro" onPress={() => router.push('/paywall')} />
          </Card>
        )}
      </View>

      {!offramp && <CrisisCard />}
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { gap: space.lg },
});
