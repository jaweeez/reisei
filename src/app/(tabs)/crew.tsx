import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, Platform, StyleSheet, TextInput, View } from 'react-native';
import { Body, Button, Caption, Card, CrewDots, Eyebrow, Mono, Screen, Title } from '@/components';
import { useAuth } from '@/lib/auth/AuthProvider';
import { createCrew, createInvite, fetchState, joinCrew } from '@/lib/data/client';
import type { HomeState } from '@/lib/data/types';
import { color, radius, space } from '@/theme';

export default function Crew() {
  const { entitlement, refresh } = useAuth();
  const [state, setState] = useState<HomeState | null>(null);
  const [newName, setNewName] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => setState(await fetchState()), []);
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  async function onCreate() {
    if (!entitlement?.canCreateCrew) {
      router.push('/paywall');
      return;
    }
    if (newName.trim().length < 2) return;
    setBusy(true);
    const res = await createCrew(newName.trim());
    setBusy(false);
    if (res.upsell) return router.push('/paywall');
    if (res.id) {
      setNewName('');
      await Promise.all([load(), refresh()]);
    } else if (res.error) {
      notify(res.error);
    }
  }

  async function onJoin() {
    if (!code.trim()) return;
    setBusy(true);
    const res = await joinCrew(code.trim());
    setBusy(false);
    if (res.crewId) {
      setCode('');
      await load();
    } else if (res.error) {
      notify(res.error);
    }
  }

  async function onInvite(crewId: string) {
    const res = await createInvite(crewId);
    if (res.code) notify(`Invite code: ${res.code}`, 'Share this with your crew');
    else if (res.error) notify(res.error);
  }

  return (
    <Screen>
      <Title>Crew</Title>

      {state?.crews.map((crew) => (
        <Card key={crew.id}>
          <View style={styles.crewHead}>
            <Body color={color.textPrimary}>{crew.name}</Body>
            <Mono>{`HELD ${crew.heldCount}/${crew.memberCount}${crew.brokeCount ? ` · ${crew.brokeCount} BROKE` : ''}`}</Mono>
          </View>
          <CrewDots members={crew.members} />
          {crew.isCaptain && <Button label="Invite to crew" variant="secondary" onPress={() => onInvite(crew.id)} />}
        </Card>
      ))}

      <Card>
        <Eyebrow>Join a crew</Eyebrow>
        <TextInput
          placeholder="Invite code"
          placeholderTextColor={color.textSecondary}
          autoCapitalize="characters"
          value={code}
          onChangeText={setCode}
          style={styles.input}
        />
        <Button label="Join" variant="secondary" onPress={onJoin} loading={busy} />
      </Card>

      <Card>
        <Eyebrow>Start a crew</Eyebrow>
        <Caption>Pay to lead — creating a crew is a Pro feature. Members you invite join free.</Caption>
        <TextInput
          placeholder="Crew name"
          placeholderTextColor={color.textSecondary}
          value={newName}
          onChangeText={setNewName}
          style={styles.input}
        />
        <Button
          label={entitlement?.canCreateCrew ? 'Create crew' : 'Go Pro to lead'}
          onPress={onCreate}
          loading={busy}
        />
      </Card>
    </Screen>
  );
}

function notify(message: string, title = 'Reisei') {
  if (Platform.OS === 'web') {
    // eslint-disable-next-line no-alert
    window.alert(`${title}\n\n${message}`);
  } else {
    Alert.alert(title, message);
  }
}

const styles = StyleSheet.create({
  crewHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  input: {
    minHeight: 52,
    backgroundColor: color.bg,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: color.rule,
    paddingHorizontal: space.lg,
    color: color.textPrimary,
    fontFamily: 'IBMPlexSans_400Regular',
    fontSize: 16,
  },
});
