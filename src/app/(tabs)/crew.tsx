import { router, useFocusEffect } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useCallback, useState } from 'react';
import { Platform, Pressable, Share, StyleSheet, View } from 'react-native';
import { Body, Button, Caption, Card, Chip, Eyebrow, Input, Mono, PostureDot, Screen, Text, Title } from '@/components';
import { confirm, notify } from '@/lib/alerts';
import { useAuth } from '@/lib/auth/AuthProvider';
import {
  ackMember,
  createCrew,
  createInvite,
  fetchCrewSeatPool,
  fetchState,
  joinCrew,
  orgApi,
  setCrewSeat,
} from '@/lib/data/client';
import { CORNER_MAX, type AckKind, type CrewMemberView, type CrewView, type HomeState, type Posture } from '@/lib/data/types';
import { color, hitSlop, radius, space } from '@/theme';

// Posture → the single contextual ack a crewmate can send.
const ACK_FOR: Record<Posture, { kind: AckKind; label: string }> = {
  held: { kind: 'seen', label: 'Seen' },
  broke: { kind: 'respect', label: 'Respect' },
  dark: { kind: 'stand_up', label: 'Reach out' },
};

type SeatPool = NonNullable<Awaited<ReturnType<typeof fetchCrewSeatPool>>>;

export default function Crew() {
  const { user, entitlement, refresh } = useAuth();
  const [state, setState] = useState<HomeState | null>(null);
  // The captain's Corner-plan seat pool; null = no active Corner-seat sub.
  const [pool, setPool] = useState<SeatPool | null>(null);
  const [newName, setNewName] = useState('');
  const [code, setCode] = useState('');
  const [joinBusy, setJoinBusy] = useState(false);
  const [createBusy, setCreateBusy] = useState(false);
  const [inviteBusy, setInviteBusy] = useState(false);
  const [acking, setAcking] = useState<string | null>(null);
  const [seatBusy, setSeatBusy] = useState<string | null>(null);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [s, p] = await Promise.all([fetchState(), fetchCrewSeatPool()]);
    setState(s);
    setPool(p);
  }, []);
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

  async function onSeat(crew: CrewView, member: CrewMemberView) {
    if (!pool || seatBusy) return;
    const seated = pool.seatedUserIds.includes(member.id);
    if (seated) {
      const ok = await confirm('Release this seat?', `${member.name} loses Pro until re-seated.`, 'Release');
      if (!ok) return;
    }
    setSeatBusy(member.id);
    const res = await setCrewSeat(crew.id, member.id, seated ? 'release' : 'assign');
    setSeatBusy(null);
    if (res.data.upsell) return router.push('/paywall');
    if (res.data.error) notify(res.data.error);
    await load();
  }

  async function onJoin() {
    const trimmed = code.trim();
    if (!trimmed) return;
    setJoinError(null);
    setJoinBusy(true);
    const res = await joinCrew(trimmed);
    if (res.crewId) {
      setJoinBusy(false);
      setCode('');
      await load();
      return;
    }
    if (res.status === 402 || res.upsell) {
      setJoinBusy(false);
      return router.push('/paywall');
    }
    if (res.status === 404) {
      // Not a Corner code. It may be an organization code.
      const orgRes = await orgApi.join(trimmed);
      setJoinBusy(false);
      if (orgRes.ok) {
        setCode('');
        if (orgRes.data.cornerFull) notify("You're in. That Corner is full, the owner will place you.");
        else if (!orgRes.data.crewId) notify("You're in. The owner will place you in a Corner.");
        await load();
        return;
      }
      if (orgRes.status === 404) {
        setJoinError('That invite code is invalid.');
        return;
      }
      setJoinError(orgRes.data.error ?? 'That invite code is invalid.');
      return;
    }
    setJoinBusy(false);
    if (res.error) setJoinError(res.error);
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
            <Mono>{`HELD ${crew.heldCount}/${crew.memberCount}${crew.brokeCount ? ` · ${crew.brokeCount} BROKE` : ''} · ${crew.memberCount}/${CORNER_MAX}`}</Mono>
          </View>
          {pool !== null && crew.isCaptain && <Mono>{`SEATS ${pool.used}/${pool.total}`}</Mono>}
          <View>
            {crew.members.map((m) => (
              <MemberRow
                key={m.id}
                crew={crew}
                member={m}
                isSelf={m.id === user?.id}
                acking={acking === m.id}
                onAck={() => onAck(crew.id, m)}
                seat={
                  pool !== null && crew.isCaptain
                    ? {
                        seated: pool.seatedUserIds.includes(m.id),
                        busy: seatBusy !== null,
                        onToggle: () => void onSeat(crew, m),
                      }
                    : null
                }
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
        <Caption>Leading a Corner is Pro. Seats cover your people: everyone seated gets Pro.</Caption>
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
  seat,
}: {
  crew: CrewView;
  member: CrewMemberView;
  isSelf: boolean;
  acking: boolean;
  onAck: () => void;
  /** Captain seat control (null when the viewer has no seat pool or isn't captain). */
  seat: { seated: boolean; busy: boolean; onToggle: () => void } | null;
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
      {seat && (
        <Chip label={seat.seated ? 'Seated' : 'Seat'} active={seat.seated} disabled={seat.busy} onPress={seat.onToggle} />
      )}
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
