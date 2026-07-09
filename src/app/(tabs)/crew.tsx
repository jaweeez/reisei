import { router, useFocusEffect } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useCallback, useState } from 'react';
import { Platform, Pressable, Share, StyleSheet, View } from 'react-native';
import { Body, Button, Caption, Card, Eyebrow, Input, Mono, PostureDot, Screen, Text, Title } from '@/components';
import { notify } from '@/lib/alerts';
import { useAuth } from '@/lib/auth/AuthProvider';
import { ackMember, createCrew, createInvite, fetchState, joinCrew } from '@/lib/data/client';
import type { AckKind, CrewMemberView, CrewView, HomeState, Posture } from '@/lib/data/types';
import { color, hitSlop, radius, space } from '@/theme';

// Posture → the single contextual ack a crewmate can send.
const ACK_FOR: Record<Posture, { kind: AckKind; label: string }> = {
  held: { kind: 'seen', label: 'Seen' },
  broke: { kind: 'respect', label: 'Respect' },
  dark: { kind: 'stand_up', label: 'Reach out' },
};

export default function Crew() {
  const { user, entitlement, refresh } = useAuth();
  const [state, setState] = useState<HomeState | null>(null);
  const [newName, setNewName] = useState('');
  const [code, setCode] = useState('');
  const [joinBusy, setJoinBusy] = useState(false);
  const [createBusy, setCreateBusy] = useState(false);
  const [inviteBusy, setInviteBusy] = useState(false);
  const [acking, setAcking] = useState<string | null>(null);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);

  const load = useCallback(async () => setState(await fetchState()), []);
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  async function onAck(crewId: string, member: CrewMemberView) {
    const { kind } = ACK_FOR[member.posture];
    setAcking(member.id);
    const ok = await ackMember(crewId, member.id, kind);
    setAcking(null);
    if (ok) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await load();
    } else {
      notify('Could not send. Try again.');
    }
  }

  async function onCreate() {
    if (!entitlement?.canCreateCrew) return router.push('/paywall');
    if (newName.trim().length < 2) return;
    setCreateError(null);
    setCreateBusy(true);
    const res = await createCrew(newName.trim());
    setCreateBusy(false);
    if (res.upsell) return router.push('/paywall');
    if (res.id) {
      setNewName('');
      await Promise.all([load(), refresh()]);
    } else if (res.error) setCreateError(res.error);
  }

  async function onJoin() {
    if (!code.trim()) return;
    setJoinError(null);
    setJoinBusy(true);
    const res = await joinCrew(code.trim());
    setJoinBusy(false);
    if (res.crewId) {
      setCode('');
      await load();
    } else if (res.error) setJoinError(res.error);
  }

  async function onInvite(crewId: string) {
    setInviteBusy(true);
    const res = await createInvite(crewId);
    setInviteBusy(false);
    if (res.code) {
      if (Platform.OS === 'web') notify(`Invite code: ${res.code}`, 'Share this with your Corner');
      else await Share.share({ message: `Join my Corner on Reisei. Code: ${res.code}` });
    } else if (res.error) notify(res.error);
  }

  return (
    <Screen>
      <Title>Corner</Title>
      {state && state.crews.length === 0 && (
        <Caption>Your Corner sees your check-ins and keeps you honest. Join with a code, or start your own.</Caption>
      )}

      {state?.crews.map((crew) => (
        <Card key={crew.id}>
          <View style={styles.crewHead}>
            <Body color={color.textPrimary} numberOfLines={1} style={styles.flexName}>
              {crew.name}
            </Body>
            <Mono>{`HELD ${crew.heldCount}/${crew.memberCount}${crew.brokeCount ? ` · ${crew.brokeCount} BROKE` : ''}`}</Mono>
          </View>
          <View>
            {crew.members.map((m) => (
              <MemberRow
                key={m.id}
                crew={crew}
                member={m}
                isSelf={m.id === user?.id}
                acking={acking === m.id}
                onAck={() => onAck(crew.id, m)}
              />
            ))}
          </View>
          {crew.isCaptain && (
            <Button label="Invite to Corner" variant="secondary" onPress={() => onInvite(crew.id)} loading={inviteBusy} />
          )}
        </Card>
      ))}

      <Card>
        <Eyebrow>Join a Corner</Eyebrow>
        <Input inCard placeholder="Invite code" autoCapitalize="characters" value={code} onChangeText={setCode} />
        {joinError && <Body color={color.actionText}>{joinError}</Body>}
        <Button label="Join" variant="secondary" onPress={onJoin} loading={joinBusy} disabled={!code.trim()} />
      </Card>

      <Card>
        <Eyebrow>Start a Corner</Eyebrow>
        <Caption>Leading a Corner is Pro. People you invite join free and check in alongside you.</Caption>
        <Input inCard placeholder="Corner name" value={newName} onChangeText={setNewName} />
        {createError && <Body color={color.actionText}>{createError}</Body>}
        <Button
          label={entitlement?.canCreateCrew ? 'Create Corner' : 'Go Pro to lead'}
          onPress={onCreate}
          loading={createBusy}
          // Gate on the name only when the button actually creates; the Go Pro CTA stays live.
          disabled={entitlement?.canCreateCrew ? newName.trim().length < 2 : false}
        />
      </Card>
    </Screen>
  );
}

function MemberRow({
  crew: _crew,
  member,
  isSelf,
  acking,
  onAck,
}: {
  crew: CrewView;
  member: CrewMemberView;
  isSelf: boolean;
  acking: boolean;
  onAck: () => void;
}) {
  const ack = ACK_FOR[member.posture];
  return (
    <View style={styles.member}>
      <PostureDot posture={member.posture} size={16} />
      <View style={styles.memberBody}>
        <View style={styles.nameRow}>
          <Text variant="bodyStrong" numberOfLines={1} style={styles.flexName}>
            {member.name}
          </Text>
          {member.role === 'captain' && <Mono color={color.textSecondary}>CAPTAIN</Mono>}
        </View>
        <Caption numberOfLines={1}>{member.line ?? 'No line drawn'}</Caption>
      </View>
      {!isSelf &&
        (member.ackedByMe ? (
          <Mono>SENT</Mono>
        ) : (
          <Pressable
            onPress={onAck}
            disabled={acking}
            hitSlop={hitSlop}
            accessibilityRole="button"
            accessibilityLabel={`${ack.label}, ${member.name}`}
            style={styles.ackBtn}
          >
            <Text variant="mono" color={color.bg}>
              {ack.label}
            </Text>
          </Pressable>
        ))}
      {isSelf && member.acksReceived > 0 && <Mono>{`+${member.acksReceived}`}</Mono>}
    </View>
  );
}

const styles = StyleSheet.create({
  crewHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: space.sm },
  member: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.sm },
  memberBody: { flex: 1 },
  nameRow: { flexDirection: 'row', alignItems: 'baseline', gap: space.sm },
  flexName: { flex: 1 },
  ackBtn: {
    backgroundColor: color.action,
    borderRadius: radius.sm,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    minHeight: 44,
    justifyContent: 'center',
  },
});
