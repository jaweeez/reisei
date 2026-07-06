import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { Body, Button, Caption, Card, Eyebrow, Mono, Screen, Text, Title } from '@/components';
import { useAuth } from '@/lib/auth/AuthProvider';
import { ackMember, createCrew, createInvite, fetchState, joinCrew } from '@/lib/data/client';
import type { AckKind, CrewMemberView, CrewView, HomeState, Posture } from '@/lib/data/types';
import { color, palette, radius, space } from '@/theme';

// Posture → the single contextual ack a crewmate can send.
const ACK_FOR: Record<Posture, { kind: AckKind; label: string }> = {
  held: { kind: 'seen', label: 'Seen' },
  broke: { kind: 'respect', label: 'Respect' },
  dark: { kind: 'stand_up', label: 'Stand up' },
};

export default function Crew() {
  const { user, entitlement, refresh } = useAuth();
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

  async function onAck(crewId: string, member: CrewMemberView) {
    const { kind } = ACK_FOR[member.posture];
    await ackMember(crewId, member.id, kind);
    await load();
  }

  async function onCreate() {
    if (!entitlement?.canCreateCrew) return router.push('/paywall');
    if (newName.trim().length < 2) return;
    setBusy(true);
    const res = await createCrew(newName.trim());
    setBusy(false);
    if (res.upsell) return router.push('/paywall');
    if (res.id) {
      setNewName('');
      await Promise.all([load(), refresh()]);
    } else if (res.error) notify(res.error);
  }

  async function onJoin() {
    if (!code.trim()) return;
    setBusy(true);
    const res = await joinCrew(code.trim());
    setBusy(false);
    if (res.crewId) {
      setCode('');
      await load();
    } else if (res.error) notify(res.error);
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
          {crew.members.map((m) => (
            <MemberRow key={m.id} crew={crew} member={m} isSelf={m.id === user?.id} onAck={() => onAck(crew.id, m)} />
          ))}
          {crew.isCaptain && <Button label="Invite to crew" variant="secondary" onPress={() => onInvite(crew.id)} />}
        </Card>
      ))}

      <Card>
        <Eyebrow>Join a crew</Eyebrow>
        <TextInput placeholder="Invite code" placeholderTextColor={color.textSecondary} autoCapitalize="characters" value={code} onChangeText={setCode} style={styles.input} />
        <Button label="Join" variant="secondary" onPress={onJoin} loading={busy} />
      </Card>

      <Card>
        <Eyebrow>Start a crew</Eyebrow>
        <Caption>Pay to lead — creating a crew is Pro. Members you invite join free and hold their line in front of the crew.</Caption>
        <TextInput placeholder="Crew name" placeholderTextColor={color.textSecondary} value={newName} onChangeText={setNewName} style={styles.input} />
        <Button label={entitlement?.canCreateCrew ? 'Create crew' : 'Go Pro to lead'} onPress={onCreate} loading={busy} />
      </Card>
    </Screen>
  );
}

function MemberRow({ crew, member, isSelf, onAck }: { crew: CrewView; member: CrewMemberView; isSelf: boolean; onAck: () => void }) {
  const ack = ACK_FOR[member.posture];
  return (
    <View style={styles.member}>
      <View style={[styles.dot, member.posture === 'held' && styles.held, member.posture === 'broke' && styles.broke, member.posture === 'dark' && styles.dark]} />
      <View style={styles.memberBody}>
        <Text variant="bodyStrong" numberOfLines={1}>
          {member.name}
          {member.role === 'captain' ? '  ·  captain' : ''}
        </Text>
        <Caption numberOfLines={1}>{member.line ?? 'No line drawn'}</Caption>
      </View>
      {!isSelf &&
        (member.ackedByMe ? (
          <Mono color={color.presenceLight}>SENT</Mono>
        ) : (
          <Pressable onPress={onAck} style={styles.ackBtn}>
            <Text variant="mono" color={color.bg}>
              {ack.label}
            </Text>
          </Pressable>
        ))}
      {isSelf && member.acksReceived > 0 && <Mono color={color.presenceLight}>{`+${member.acksReceived}`}</Mono>}
    </View>
  );
}

function notify(message: string, title = 'Reisei') {
  if (Platform.OS === 'web') window.alert(`${title}\n\n${message}`);
  else Alert.alert(title, message);
}

const styles = StyleSheet.create({
  crewHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: space.xs },
  member: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.sm },
  memberBody: { flex: 1 },
  dot: { width: 16, height: 16, borderRadius: 8, borderWidth: 2 },
  held: { backgroundColor: palette.bubble, borderColor: palette.bubble },
  broke: { backgroundColor: 'transparent', borderColor: palette.brass },
  dark: { backgroundColor: 'transparent', borderColor: color.ruleStrong },
  ackBtn: { backgroundColor: color.action, borderRadius: radius.sm, paddingHorizontal: space.md, paddingVertical: space.sm },
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
