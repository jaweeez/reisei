import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Body, Button, Caption, Card, Eyebrow, Heading, Mono, PostureDot, Screen, ScreenHeader } from '@/components';
import { getLedger, type Ledger } from '@/lib/ledger';
import { color, space } from '@/theme';

const DOT = 22;

/** Local YYYY-MM-DD, matching the API's local_date keys. */
function dateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** The last 63 dates ending today, padded to whole weeks (null = placeholder cell). */
function calendarWeeks(): (string | null)[][] {
  const start = new Date();
  start.setDate(start.getDate() - 62);
  const cells: (string | null)[] = [];
  for (let i = 0; i < start.getDay(); i++) cells.push(null);
  for (let i = 0; i < 63; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    cells.push(dateKey(d));
  }
  while (cells.length % 7 !== 0) cells.push(null);
  const weeks: (string | null)[][] = [];
  for (let w = 0; w < cells.length; w += 7) weeks.push(cells.slice(w, w + 7));
  return weeks;
}

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

  if (!loaded) {
    return (
      <Screen>
        <ScreenHeader title="The Ledger" />
        <Caption>Loading…</Caption>
      </Screen>
    );
  }

  if (upsell || !ledger) {
    return (
      <Screen>
        <ScreenHeader title="The Ledger" />
        <Card>
          <Eyebrow>Pro</Eyebrow>
          <Body>The Ledger is the shape of your composure: your hold calendar, your hold-rate, where the hard days land, and every line you've retired. It's a Pro feature.</Body>
          <Button label="Go Pro" onPress={() => router.push('/paywall')} />
        </Card>
      </Screen>
    );
  }

  const { stats, calendar, retiredLines, fieldReports } = ledger;
  const verdictByDate = new Map(calendar.map((d) => [d.date, d.verdict]));
  const weeks = calendarWeeks();

  return (
    <Screen>
      <ScreenHeader title="The Ledger" />

      <Card>
        <Eyebrow>Line stats</Eyebrow>
        <Mono>{`HOLD-RATE ${stats.holdRate ?? '-'}% · LONGEST ${stats.longest} · INTEGRITY ${stats.integrity}`}</Mono>
        <Mono>{`HELD ${stats.held} · BROKE ${stats.broke} · RESETS ${stats.resets}`}</Mono>
        {stats.worstDay && <Caption>{`The hard days cluster on ${stats.worstDay}. Worth planning for.`}</Caption>}
      </Card>

      <Card>
        <Eyebrow>Hold calendar</Eyebrow>
        <View style={styles.grid}>
          {weeks.map((week, wi) => (
            <View key={wi} style={styles.week}>
              {week.map((date, di) =>
                date ? (
                  <PostureDot key={date} size={DOT} posture={verdictByDate.get(date) ?? 'dark'} />
                ) : (
                  <View key={`pad-${wi}-${di}`} style={styles.pad} />
                ),
              )}
            </View>
          ))}
        </View>
        <Caption>Filled = held · light ring = honest break · dim ring = a quiet day.</Caption>
      </Card>

      {retiredLines.length > 0 && (
        <Card>
          <Eyebrow>Retired lines</Eyebrow>
          {retiredLines.map((l, i) => (
            <View key={i} style={styles.retired}>
              <Heading>{l.statement}</Heading>
              <Mono>{`${l.start} → ${l.retired ?? '-'}`}</Mono>
            </View>
          ))}
        </Card>
      )}

      {fieldReports.length > 0 && (
        <Card>
          <Eyebrow>Reports</Eyebrow>
          {fieldReports.slice(0, 30).map((r, i) => (
            <View key={i} style={styles.report}>
              <Mono color={r.verdict === 'broke' ? color.actionText : color.presenceLight}>{`${r.date} · ${r.verdict.toUpperCase()}`}</Mono>
              <Body>{r.note}</Body>
            </View>
          ))}
        </Card>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  grid: { gap: space.xs },
  week: { flexDirection: 'row', gap: space.xs },
  pad: { width: DOT, height: DOT },
  retired: { paddingVertical: space.xs, gap: 2 },
  report: { paddingVertical: space.sm, gap: 2 },
});
