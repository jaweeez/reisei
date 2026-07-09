import { Linking, Pressable, StyleSheet, View } from 'react-native';
import { Body, Caption, Mono } from './Text';
import { color, radius, space } from '@/theme';

// Standing crisis resources, in Reisei's voice (docs/VOICE.md duty of care). Shown quietly where
// the content touches real feelings (the log, Settings), and prominently (`alert`) when an entry
// reads like a genuinely dark place. Tappable to call/text; the numbers stay legible on web too.
// US resources. Swap/extend when Reisei ships outside the US.

const RESOURCES: { label: string; sub: string; url: string }[] = [
  { label: 'Call or text 988', sub: 'Suicide & Crisis Lifeline. Free, 24/7.', url: 'tel:988' },
  { label: 'Text HOME to 741741', sub: 'Crisis Text Line.', url: 'sms:741741' },
  { label: 'Call 911', sub: 'If you or someone else is in danger right now.', url: 'tel:911' },
];

export function CrisisCard({ alert = false }: { alert?: boolean }) {
  return (
    <View style={[styles.card, alert && styles.alert]}>
      <Mono color={color.actionText}>{alert ? 'Read that back' : 'If you are in a real hole'}</Mono>
      <Body color={color.textPrimary}>
        {alert
          ? 'That sounded heavy. If it is bigger than today, this is not the tool for it right now. Reach a real person tonight. That is triage, not weakness.'
          : 'Some things are bigger than a log. If you are not okay, reach a person, not an app.'}
      </Body>
      <View style={styles.lines}>
        {RESOURCES.map((r) => (
          <Pressable
            key={r.label}
            style={styles.line}
            onPress={() => void Linking.openURL(r.url)}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={`${r.label}. ${r.sub}`}
          >
            <View style={styles.lineText}>
              <Body color={color.textPrimary}>{r.label}</Body>
              <Caption>{r.sub}</Caption>
            </View>
            <Mono color={color.actionText}>{'→'}</Mono>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: space.sm, padding: space.lg, borderRadius: radius.md, borderWidth: 1, borderColor: color.rule, backgroundColor: color.card },
  alert: { borderWidth: 0, borderLeftWidth: 3, borderLeftColor: color.action, backgroundColor: color.actionSoft },
  lines: { gap: space.sm, marginTop: space.xs },
  line: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.md },
  lineText: { flex: 1, gap: 2 },
});
