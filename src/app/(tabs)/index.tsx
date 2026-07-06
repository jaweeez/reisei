import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Body, Button, Caption, Card, Display, Eyebrow, Mono, Screen, Title } from '@/components';
import { useAuth } from '@/lib/auth/AuthProvider';
import { checkIn, fetchState } from '@/lib/data/client';
import type { HomeState } from '@/lib/data/types';
import { color, space } from '@/theme';

export default function Today() {
  const { user } = useAuth();
  const [state, setState] = useState<HomeState | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setState(await fetchState());
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  async function onCheckIn() {
    setBusy(true);
    const res = await checkIn();
    setBusy(false);
    if (res) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await load();
    }
  }

  const streak = state?.streak.current ?? 0;
  const checkedIn = state?.checkedInToday ?? false;
  const message = checkedIn
    ? streak > 1
      ? `Logged. ${streak}-day streak.`
      : 'Logged. Day 1 on the board.'
    : streak > 0
      ? `${streak}-day streak. Keep it going.`
      : 'Day 1 starts when you log.';

  return (
    <Screen>
      <View style={styles.header}>
        <Title>{greeting()}{user?.name ? `, ${user.name.split(' ')[0]}` : ''}</Title>
      </View>

      <Card>
        <Eyebrow>Streak</Eyebrow>
        <Display>{streak > 0 ? `Day ${streak}` : 'Day 0'}</Display>
        <Body>{message}</Body>
        <Button label={checkedIn ? 'Logged today' : 'Log today'} onPress={onCheckIn} loading={busy} disabled={checkedIn} />
        {state && (
          <Mono>
            {`LONGEST ${String(state.streak.longest).padStart(2, '0')} · ${checkedIn ? 'LOGGED TODAY' : 'NOT LOGGED'}`}
          </Mono>
        )}
      </Card>

      {state && state.crews.length > 0 ? (
        <Card>
          <Eyebrow>Your crews</Eyebrow>
          {state.crews.map((crew) => (
            <View key={crew.id} style={styles.crewRow}>
              <Body color={color.textPrimary}>{crew.name}</Body>
              <Mono>{`CREW ${crew.checkedInCount}/${crew.memberCount}`}</Mono>
            </View>
          ))}
          <Caption>Presence updates when your crew logs today.</Caption>
        </Card>
      ) : (
        <Caption>No crew yet. Join one, or go Pro to start your own.</Caption>
      )}
    </Screen>
  );
}

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Morning';
  if (h < 18) return 'Afternoon';
  return 'Evening';
}

const styles = StyleSheet.create({
  header: { marginBottom: space.xs },
  crewRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
});
