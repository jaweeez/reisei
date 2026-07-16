import { useEffect, useState } from 'react';
import { Linking, Pressable, StyleSheet, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import {
  Body,
  Button,
  Caption,
  Card,
  Chip,
  CrisisCard,
  Display,
  Eyebrow,
  InlineNotice,
  Input,
  Mono,
  Screen,
  ScreenHeader,
  Section,
} from '@/components';
import { fetchRecoveryMode, updateRecoveryMode } from '@/lib/data/client';
import type { RecoveryModeSnapshot } from '@/lib/data/types';
import { color, space } from '@/theme';

// Meeting + treatment finders (link-out only). Independent of any tradition.
const MEETINGS: { label: string; url: string }[] = [
  { label: 'Find an AA meeting', url: 'https://www.aa.org/find-aa' },
  { label: 'Find an NA meeting', url: 'https://www.na.org/meetingsearch/' },
  { label: 'Find a SMART meeting', url: 'https://meetings.smartrecovery.org/' },
  { label: 'SAMHSA treatment finder', url: 'https://findtreatment.gov/' },
];

// Opt-in Recovery mode: sober/clean time in chapters, not a shame streak (RECOVERY_EXPANSION.md).
// "Begin again" starts a new chapter, prior chapters stay. Independent of following a Recovery
// school. Owner-private. The daily action stays the held/slipped Line check-in.

export default function RecoveryMode() {
  const [snap, setSnap] = useState<RecoveryModeSnapshot | null>(null);
  const [busy, setBusy] = useState(false);

  // Intake state.
  const [mode, setMode] = useState<'chapter' | 'practice'>('chapter');
  const [startedOn, setStartedOn] = useState('');
  const [whatFrom, setWhatFrom] = useState('');
  const [hasSponsor, setHasSponsor] = useState(false);
  const [sponsorName, setSponsorName] = useState('');
  const [sponsorContact, setSponsorContact] = useState('');

  useEffect(() => {
    let active = true;
    void fetchRecoveryMode().then((next) => {
      if (!active) return;
      setSnap(next);
      if (next?.enabled) {
        setSponsorName((prev) => prev || next.sponsorName || '');
        setSponsorContact((prev) => prev || next.sponsorContact || '');
      } else if (next) {
        setStartedOn((prev) => prev || next.today);
      }
    });
    return () => { active = false; };
  }, []);

  async function run(body: Record<string, unknown>) {
    setBusy(true);
    const next = await updateRecoveryMode(body);
    setBusy(false);
    if (next) {
      setSnap(next);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  }

  if (!snap) {
    return (
      <Screen>
        <ScreenHeader title="Recovery mode" />
        <Caption>Loading…</Caption>
      </Screen>
    );
  }

  const notTreatment = (
    <InlineNotice
      label="Not treatment"
      body="Recovery mode is a private place to count your days and begin again honestly. It is not treatment, a sponsor, or a meeting. It sits alongside them."
    />
  );

  if (!snap.enabled) {
    return (
      <Screen>
        <ScreenHeader title="Recovery mode" />
        <Caption>A private count of your sober or clean time. A slip is not a reset to shame, it is a new chapter. Kept to yourself, never shown to your Crew.</Caption>
        {notTreatment}

        <Section label="How you want to count">
          <View style={styles.chips}>
            <Chip label="Count the days" active={mode === 'chapter'} onPress={() => setMode('chapter')} disabled={busy} />
            <Chip label="Just practice" active={mode === 'practice'} onPress={() => setMode('practice')} disabled={busy} />
          </View>
          <Caption>{mode === 'chapter' ? 'Track days since a start date, with quiet milestones.' : 'No number. A daily practice you return to, one day at a time.'}</Caption>
        </Section>

        {mode === 'chapter' && (
          <Section label="Start date">
            <Input inCard placeholder="YYYY-MM-DD" value={startedOn} onChangeText={setStartedOn} maxLength={10} />
            <Caption>Your sober or clean date. Today, or the day it began.</Caption>
          </Section>
        )}

        <Section label="Private, optional">
          <Input inCard placeholder="What you're recovering from (optional)" value={whatFrom} onChangeText={setWhatFrom} maxLength={120} />
          <View style={styles.chips}>
            <Chip label="I have a sponsor" active={hasSponsor} onPress={() => setHasSponsor((v) => !v)} disabled={busy} />
          </View>
        </Section>

        <Button
          label="Turn on Recovery mode"
          loading={busy}
          disabled={mode === 'chapter' && !/^\d{4}-\d{2}-\d{2}$/.test(startedOn)}
          onPress={() => run({ op: 'setup', mode, startedOn: mode === 'chapter' ? startedOn : undefined, whatFrom: whatFrom.trim() || undefined, hasSponsor })}
        />
        <CrisisCard recovery />
      </Screen>
    );
  }

  const counting = snap.mode === 'chapter' && snap.showCount && snap.days != null;

  return (
    <Screen>
      <ScreenHeader title="Recovery mode" />

      <Card>
        {counting ? (
          <>
            <Eyebrow>{snap.milestone ? `Milestone: ${snap.milestone}` : 'One day at a time'}</Eyebrow>
            <Display>{`${snap.days} ${snap.days === 1 ? 'day' : 'days'}`}</Display>
            {snap.isMilestoneToday ? <Body color={color.textPrimary}>You reached a milestone today. Quietly, that matters.</Body> : null}
            <Caption>Since {snap.startedOn}. This is yours, not a score.</Caption>
          </>
        ) : snap.mode === 'chapter' ? (
          <>
            <Eyebrow>Counting quietly</Eyebrow>
            <Body color={color.textPrimary}>The number is hidden. You are still holding the line, one day at a time.</Body>
          </>
        ) : (
          <>
            <Eyebrow>In practice</Eyebrow>
            <Body color={color.textPrimary}>No count. Just today, returned to again.</Body>
          </>
        )}
      </Card>

      {snap.mode === 'chapter' && (
        <Button label="Begin again" variant="ghost" loading={busy} onPress={() => run({ op: 'begin_again' })} />
      )}
      {snap.mode === 'chapter' && (
        <Caption>A slip is honest, not a failure. Beginning again starts a new chapter and keeps the ones before it.</Caption>
      )}

      <Section label="Preferences">
        <View style={styles.chips}>
          {snap.mode === 'chapter' && (
            <Chip label={snap.showCount ? 'Showing the count' : 'Count hidden'} active={!!snap.showCount} onPress={() => run({ op: 'preferences', showCount: !snap.showCount })} disabled={busy} />
          )}
          <Chip label="I have a sponsor" active={!!snap.hasSponsor} onPress={() => run({ op: 'preferences', hasSponsor: !snap.hasSponsor })} disabled={busy} />
        </View>
      </Section>

      <Section label="Your sponsor">
        <Caption>Private, just for you. Never shared with your Crew. Reisei shows this when you need it.</Caption>
        <Input inCard placeholder="Name" value={sponsorName} onChangeText={setSponsorName} maxLength={80} />
        <Input inCard placeholder="How to reach them (phone, handle)" value={sponsorContact} onChangeText={setSponsorContact} maxLength={120} />
        <Button label="Save sponsor" variant="ghost" loading={busy} onPress={() => run({ op: 'preferences', sponsorName, sponsorContact })} />
      </Section>

      <Section label="Meetings">
        {MEETINGS.map((m) => (
          <Pressable key={m.url} onPress={() => void Linking.openURL(m.url)} hitSlop={8} accessibilityRole="link" style={styles.meetingRow}>
            <Mono color={color.actionText}>{`${m.label} →`}</Mono>
          </Pressable>
        ))}
      </Section>

      {snap.chapters.length > 1 && (
        <Section label="Chapters">
          {snap.chapters.map((ch, i) => (
            <View key={`${ch.startedOn}-${i}`} style={styles.chapterRow}>
              <Mono>{ch.startedOn}</Mono>
              <Caption>{ch.endedOn ? `to ${ch.endedOn}` : 'current'}</Caption>
            </View>
          ))}
        </Section>
      )}

      <CrisisCard recovery />
      <Button label="Turn off Recovery mode" variant="ghost" loading={busy} onPress={() => run({ op: 'disable' })} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  chapterRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  meetingRow: { paddingVertical: space.xs },
});
