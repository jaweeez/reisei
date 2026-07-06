import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Body, Button, Caption, Card, Eyebrow, Mono, Screen, Title } from '@/components';
import { getLedger, type Ledger } from '@/lib/ledger';
import { color, palette, radius, space } from '@/theme';

export default function LedgerScreen() {
  const [ledger, setLedger] = useState<Ledger | null>(null);
  const [upsell, setUpsell] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    void getLedger().then((r) => {
      setLedger(r.ledger ?? null);
      setUpsell(Boolean(r.upsell));
      setLoaded(true);
    });
  }, []);

  if (!loaded) return <Screen><Caption>Loading…</Caption></Screen>;

  if (upsell || !ledger) {
    return (
      <Screen>
        <Title>The Ledger</Title>
        <Card>
          <Eyebrow>Pro</Eyebrow>
          <Body>The Ledger is the shape of your composure — hold calendar, hold-rate, where your breaks cluster, and every line you've retired. It's a Pro feature.</Body>
          <Button label="Go Pro" onPress={() => router.replace('/paywall')} />
          <Button label="Back" variant="ghost" onPress={() => router.back()} />
        </Card>
      </Screen>
    );
  }

  const { stats, calendar, retiredLines, fieldReports } = ledger;
  // calendar arrives most-recent-first; show chronological.
  const days = [...calendar].reverse().slice(-63);

  return (
    <Screen>
      <Title>The Ledger</Title>

      <Card>
        <Eyebrow>Line stats</Eyebrow>
        <Mono>{`HOLD-RATE ${stats.holdRate ?? '—'}%  ·  LONGEST ${stats.longest}  ·  INTEGRITY ${stats.integrity}`}</Mono>
        <Mono>{`HELD ${stats.held}  ·  BROKE ${stats.broke}  ·  RESETS ${stats.resets}`}</Mono>
        {stats.worstDay && <Caption>{`Breaks cluster on ${stats.worstDay}. Plan for it.`}</Caption>}
      </Card>

      <Card>
        <Eyebrow>Hold calendar</Eyebrow>
        <View style={styles.grid}>
          {days.map((d) => (
            <View key={d.date} style={[styles.cell, d.verdict === 'held' ? styles.held : styles.broke]} />
          ))}
        </View>
        <Caption>Filled = held · brass ring = honest break. Gaps are the days you went dark.</Caption>
      </Card>

      {retiredLines.length > 0 && (
        <Card>
          <Eyebrow>Retired lines</Eyebrow>
          {retiredLines.map((l, i) => (
            <View key={i} style={styles.retired}>
              <Body color={color.textPrimary}>{l.statement}</Body>
              <Mono>{`${l.start} → ${l.retired ?? '—'}`}</Mono>
            </View>
          ))}
        </Card>
      )}

      {fieldReports.length > 0 && (
        <Card>
          <Eyebrow>Field reports</Eyebrow>
          {fieldReports.slice(0, 30).map((r, i) => (
            <View key={i} style={styles.report}>
              <Mono color={r.verdict === 'broke' ? color.actionText : color.presenceLight}>{`${r.date} · ${r.verdict.toUpperCase()}`}</Mono>
              <Body>{r.note}</Body>
            </View>
          ))}
        </Card>
      )}

      <Button label="Back" variant="ghost" onPress={() => router.back()} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 5 },
  cell: { width: 22, height: 22, borderRadius: 4, borderWidth: 2 },
  held: { backgroundColor: palette.bubble, borderColor: palette.bubble },
  broke: { backgroundColor: 'transparent', borderColor: palette.brass },
  retired: { paddingVertical: space.xs, gap: 2 },
  report: { paddingVertical: space.sm, gap: 2 },
});
