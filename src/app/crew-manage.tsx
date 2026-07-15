import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Platform, Share } from 'react-native';
import {
  Body,
  Button,
  Caption,
  Chip,
  HeroPanel,
  ListRow,
  Mono,
  Screen,
  ScreenHeader,
  Section,
} from '@/components';
import { confirm, notify } from '@/lib/alerts';
import { createInvite, fetchCrewSeatPool, fetchState, setCrewSeat } from '@/lib/data/client';
import type { CrewMemberView, CrewView, HomeState } from '@/lib/data/types';
import { color } from '@/theme';

type CoveragePool = NonNullable<Awaited<ReturnType<typeof fetchCrewSeatPool>>>;

export default function CrewManageScreen() {
  const [state, setState] = useState<HomeState | null>(null);
  const [pool, setPool] = useState<CoveragePool | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [nextState, nextPool] = await Promise.all([fetchState(), fetchCrewSeatPool()]);
    setState(nextState);
    setPool(nextPool);
  }, []);
  useFocusEffect(useCallback(() => void load(), [load]));

  const crew = state?.crews.find((candidate) => candidate.isCaptain) ?? null;

  async function invite() {
    if (!crew) return;
    setBusy('invite');
    const res = await createInvite(crew.id);
    setBusy(null);
    if (!res.code) return notify(res.error ?? 'Could not create an invite.');
    if (Platform.OS === 'web') notify(`Invite code: ${res.code}`, 'Share this with your Crew');
    else await Share.share({ message: `Join my Crew on Reisei. Code: ${res.code}` });
  }

  async function toggleCoverage(member: CrewMemberView) {
    if (!crew || !pool || member.role === 'captain') return;
    const covered = pool.seatedUserIds.includes(member.id);
    if (covered) {
      const ok = await confirm(
        'Remove coverage?',
        `${member.name} will lose this plan's Pro access. If they have no other paid access, they will also leave the Crew.`,
        'Remove',
      );
      if (!ok) return;
    }
    setBusy(member.id);
    const res = await setCrewSeat(crew.id, member.id, covered ? 'release' : 'assign');
    setBusy(null);
    if (res.data.upsell) return router.push('/paywall');
    if (res.data.error) notify(res.data.error);
    await load();
  }

  if (!state) return <Screen><ScreenHeader title="Manage Crew" /><Caption>Loading…</Caption></Screen>;
  if (!crew) {
    return (
      <Screen>
        <ScreenHeader title="Manage Crew" />
        <HeroPanel><Body>You do not lead a Crew.</Body><Button label="Back to Crew" onPress={() => router.replace('/crew')} /></HeroPanel>
      </Screen>
    );
  }

  return (
    <Screen>
      <ScreenHeader title="Manage Crew" />
      <HeroPanel>
        <Mono>{pool?.kind === 'pro' ? 'PRO COVERAGE' : pool?.kind === 'crew' ? 'CREW PLAN' : 'NO COVERAGE'}</Mono>
        <Body color={color.textPrimary}>{crew.name}</Body>
        <Caption>
          {pool
            ? `${pool.used} of ${pool.total} people covered. Every covered person receives full member access.`
            : 'Upgrade to cover invited people in this Crew.'}
        </Caption>
        {pool ? <Button label="Invite someone" onPress={invite} loading={busy === 'invite'} /> : <Button label="View plans" onPress={() => router.push('/paywall')} />}
      </HeroPanel>

      <Section label="People">
        {crew.members.map((member) => (
          <CoverageRow
            key={member.id}
            crew={crew}
            member={member}
            pool={pool}
            busy={busy === member.id}
            onToggle={() => toggleCoverage(member)}
          />
        ))}
      </Section>

      <Section label="Privacy">
        <Caption>
          {'You can manage membership and coverage. You cannot see anyone\'s private Log, notes, Bearings, recovery details, or Line Review answers.'}
        </Caption>
      </Section>
    </Screen>
  );
}

function CoverageRow({
  crew: _crew,
  member,
  pool,
  busy,
  onToggle,
}: {
  crew: CrewView;
  member: CrewMemberView;
  pool: CoveragePool | null;
  busy: boolean;
  onToggle: () => void;
}) {
  const covered = !!pool?.seatedUserIds.includes(member.id);
  return (
    <ListRow
      title={member.name}
      detail={member.role === 'captain' ? 'Captain and plan owner' : covered ? 'Covered by this plan' : 'Uses separate access'}
      trailing={
        member.role === 'captain' || !pool ? <Mono>{member.role === 'captain' ? 'OWNER' : 'SEPARATE'}</Mono> : (
          <Chip label={covered ? 'Covered' : 'Cover'} active={covered} onPress={onToggle} disabled={busy} />
        )
      }
    />
  );
}
