import { router, useFocusEffect } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import {
  Body,
  Button,
  Caption,
  Chip,
  EmptyState,
  HeroPanel,
  InlineNotice,
  Input,
  IntegrityAgreement,
  ListRow,
  Mono,
  PageHeader,
  PostureDot,
  Screen,
  Section,
  StatusPill,
  Text,
} from '@/components';
import { notify } from '@/lib/alerts';
import { useAuth } from '@/lib/auth/AuthProvider';
import { ackMember, createCrew, fetchState, joinCrew, orgApi, updateAccountability } from '@/lib/data/client';
import {
  REACH_OUT_LABEL,
  type AckKind,
  type CrewMemberView,
  type HomeState,
  type Posture,
  type ReachOutPreference,
} from '@/lib/data/types';
import { color, radius, space } from '@/theme';

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
  const [honestyAccepted, setHonestyAccepted] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [acking, setAcking] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const next = await fetchState();
    setState(next);
    if (next?.accountability.honestyAcknowledged) setHonestyAccepted(true);
  }, []);
  useFocusEffect(useCallback(() => void load(), [load]));

  async function onAck(crewId: string, member: CrewMemberView) {
    const { kind } = ACK_FOR[member.posture];
    setAcking(member.id);
    const ok = await ackMember(crewId, member.id, kind);
    setAcking(null);
    if (!ok) return notify('Could not send. Try again.');
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    await load();
  }

  async function onCreate() {
    if (!entitlement?.canCreateCrew) return router.push('/paywall');
    if (newName.trim().length < 2 || !honestyAccepted) return;
    setBusy('create');
    setError(null);
    const res = await createCrew(newName.trim(), honestyAccepted);
    setBusy(null);
    if (res.upsell) return router.push('/paywall');
    if (res.id) {
      setNewName('');
      await Promise.all([load(), refresh()]);
    } else setError(res.error ?? 'Could not start the Crew.');
  }

  async function onJoin() {
    if (!code.trim() || !honestyAccepted) return;
    setBusy('join');
    setError(null);
    const res = await joinCrew(code.trim(), honestyAccepted);
    if (res.crewId) {
      setCode('');
      setBusy(null);
      await Promise.all([load(), refresh()]);
      return;
    }
    if (res.status === 404) {
      const orgRes = await orgApi.join(code.trim());
      setBusy(null);
      if (orgRes.ok) {
        setCode('');
        await load();
        return;
      }
      setError(orgRes.data.error ?? 'That invite code is invalid.');
      return;
    }
    setBusy(null);
    if (res.upsell) return router.push('/paywall');
    setError(res.error ?? 'Could not join that Crew.');
  }

  async function setReachOut(preference: ReachOutPreference) {
    setBusy('preference');
    const result = await updateAccountability({ reachOutPreference: preference });
    setBusy(null);
    if (result.error) setError(result.error);
    else await load();
  }

  if (!state) return <Screen><Caption>Loading…</Caption></Screen>;
  const captain = state.crews.find((crew) => crew.isCaptain);

  return (
    <Screen>
      <PageHeader
        title="Crew"
        context={state.crews.length ? `${state.crews.length} active` : 'Private accountability'}
        action={captain ? { label: 'Manage', onPress: () => router.push('/crew-manage') } : undefined}
      />

      {state.crews.length === 0 ? (
        <>
          <EmptyState
            title="Do this with people who notice"
            body="A Crew sees your Line and daily posture. Your private Log, notes, Bearings, and recovery details stay yours."
          />
          {!state.accountability.honestyAcknowledged ? (
            <IntegrityAgreement accepted={honestyAccepted} onChange={setHonestyAccepted} />
          ) : null}
          <HeroPanel>
            <Mono>JOIN A CREW</Mono>
            <Input inCard placeholder="Invite code" autoCapitalize="characters" value={code} onChangeText={setCode} />
            <Button label="Join Crew" onPress={onJoin} loading={busy === 'join'} disabled={!code.trim() || !honestyAccepted} />
          </HeroPanel>
          <Section label="Lead">
            <Caption>Direct Pro covers you and two invited people in one private Crew.</Caption>
            <Input placeholder="Crew name" value={newName} onChangeText={setNewName} />
            <Button
              label={entitlement?.canCreateCrew ? 'Start Crew' : 'Go Pro to lead'}
              variant="secondary"
              onPress={onCreate}
              loading={busy === 'create'}
              disabled={entitlement?.canCreateCrew ? newName.trim().length < 2 || !honestyAccepted : false}
            />
          </Section>
        </>
      ) : (
        state.crews.map((crew) => (
          <View key={crew.id} style={styles.crewBlock}>
            <HeroPanel>
              <View style={styles.head}>
                <View style={styles.grow}>
                  <Body color={color.textPrimary}>{crew.name}</Body>
                  <Caption>{`${crew.memberCount} people · ${crew.heldCount} held today · ${crew.brokeCount} honest breaks`}</Caption>
                </View>
                <StatusPill label={`${crew.heldCount}/${crew.memberCount} held`} tone={crew.heldCount === crew.memberCount ? 'held' : 'quiet'} />
              </View>
              <View>
                {crew.members.map((member) => (
                  <MemberRow
                    key={member.id}
                    member={member}
                    isSelf={member.id === user?.id}
                    acking={acking === member.id}
                    onAck={() => onAck(crew.id, member)}
                  />
                ))}
              </View>
            </HeroPanel>

            <Section label="This week">
              <InlineNotice
                label="Crew Review"
                body="This is not a score. It is a read on who showed up, who told the truth, and who may need a call."
              />
              <View style={styles.weekStats}>
                <WeekStat label="Held" value={crew.week.held} />
                <WeekStat label="Breaks" value={crew.week.broke} />
                <WeekStat label="Quiet" value={crew.week.quiet} />
                <WeekStat label="Recovered" value={crew.week.recovered} />
              </View>
              {crew.members.map((member) => (
                <ListRow
                  key={`week-${member.id}`}
                  title={member.name}
                  detail={`${member.week.held} held · ${member.week.broke} breaks · ${member.week.quiet} quiet · ${member.week.recovered} recovered`}
                />
              ))}
            </Section>
          </View>
        ))
      )}

      {state.crews.length ? (
        <Section label="When I go quiet">
          <Caption>Tell your Crew what to do after a quiet day.</Caption>
          <View style={styles.chips}>
            {(Object.keys(REACH_OUT_LABEL) as ReachOutPreference[]).map((preference) => (
              <Chip
                key={preference}
                label={REACH_OUT_LABEL[preference]}
                active={state.accountability.reachOutPreference === preference}
                onPress={() => setReachOut(preference)}
                disabled={busy === 'preference'}
                style={styles.fullChip}
              />
            ))}
          </View>
        </Section>
      ) : null}

      {error ? <Body color={color.actionText}>{error}</Body> : null}
    </Screen>
  );
}

function MemberRow({ member, isSelf, acking, onAck }: { member: CrewMemberView; isSelf: boolean; acking: boolean; onAck: () => void }) {
  const ack = ACK_FOR[member.posture];
  const reachOut = member.posture === 'dark' && member.reachOutPreference ? REACH_OUT_LABEL[member.reachOutPreference] : null;
  return (
    <View style={styles.member}>
      <PostureDot posture={member.posture} size={18} />
      <View style={styles.grow}>
        <View style={styles.nameRow}>
          <Text variant="bodyStrong" numberOfLines={1} style={styles.grow}>{member.name}</Text>
          {member.role === 'captain' ? <Mono color={color.textSecondary}>CAPTAIN</Mono> : null}
        </View>
        <Caption numberOfLines={2}>{member.line ?? 'No Line drawn'}</Caption>
        {reachOut ? <Caption>{`If quiet: ${reachOut}`}</Caption> : null}
      </View>
      {!isSelf ? (
        member.ackedByMe ? <Mono>SENT</Mono> : (
          <Pressable
            onPress={onAck}
            disabled={acking}
            accessibilityRole="button"
            accessibilityLabel={`${ack.label}, ${member.name}`}
            style={({ pressed }) => [styles.ack, pressed && styles.pressed, acking && styles.disabled]}
          >
            <Mono color={color.bg}>{ack.label}</Mono>
          </Pressable>
        )
      ) : member.acksReceived > 0 ? <Mono>{`+${member.acksReceived}`}</Mono> : null}
    </View>
  );
}

function WeekStat({ label, value }: { label: string; value: number }) {
  return <View style={styles.weekStat}><Mono>{value}</Mono><Caption>{label}</Caption></View>;
}

const styles = StyleSheet.create({
  crewBlock: { gap: space.xl },
  head: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  grow: { flex: 1 },
  member: { minHeight: 68, flexDirection: 'row', alignItems: 'center', gap: space.md, borderTopWidth: 1, borderTopColor: color.rule, paddingVertical: space.sm },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  ack: { minHeight: 44, justifyContent: 'center', backgroundColor: color.action, borderRadius: radius.sm, paddingHorizontal: space.sm },
  pressed: { opacity: 0.78 },
  disabled: { opacity: 0.5 },
  weekStats: { flexDirection: 'row', gap: space.sm },
  weekStat: { flex: 1, borderWidth: 1, borderColor: color.rule, borderRadius: radius.md, padding: space.sm, alignItems: 'center' },
  chips: { gap: space.sm },
  fullChip: { width: '100%', alignItems: 'flex-start' },
});
