import { Redirect, router } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { Body, Button, Caption, Card, Display, Eyebrow, Hero, Mono, Screen, Text, VialMark } from '@/components';
import { useAuth } from '@/lib/auth/AuthProvider';
import { color, radius, space } from '@/theme';

// The guest entry point: a landing page, not a login form. The hero plus the mechanics,
// then two doors: Get started (register) and Log in. Straight off the brand kit:
// ink field, brass tagline, the vial mark, the "Day 4" check-in card motif.

const FEATURES: { label: string; body: string }[] = [
  { label: 'The Line', body: `A daily check-in. An honest read on where you're actually at, not where you think you should be.` },
  { label: 'Your Corner', body: `A few people who actually know how you're doing. No performing.` },
  { label: 'The Bearing', body: 'A daily principle to steer by, from a tradition you pick. Perspective when your head gets loud.' },
  { label: 'Reset', body: 'Sixty seconds to get out of your head and back in your body when something spikes.' },
];

const DOTS = [true, true, true, true, false, false, false, false];

export default function Landing() {
  const { status } = useAuth();
  if (status === 'loading') return null;
  if (status === 'authed') return <Redirect href="/" />;

  return (
    <Screen>
      {/* Hero */}
      <View style={styles.hero}>
        <VialMark width={200} />
        <Text style={styles.kanji}>冷 静</Text>
        <Hero style={styles.wordmark}>Reisei</Hero>
        <Mono style={styles.tagline}>Stay level.</Mono>
        <Caption style={styles.sub}>Composed</Caption>
      </View>

      {/* What it is */}
      <View style={styles.block}>
        <Eyebrow>What Reisei is</Eyebrow>
        <Body color={color.textPrimary} style={styles.lede}>
          {`Most guys run two settings: shut it down, or blow up. Reisei is the training in between: noticing what you're actually feeling, staying in your body when it hits, and working it through instead of burying it. It just happens to look like a training log.`}
        </Body>
        <Body>{`A coach, not a counselor. For the guy who'd never sign up for one.`}</Body>
      </View>

      {/* The check-in card motif from the brand kit */}
      <Card>
        <Mono>STREAK</Mono>
        <Display>Day 4</Display>
        <Body>4-day streak. Keep it going.</Body>
        <View style={styles.dots}>
          {DOTS.map((filled, i) => (
            <View key={i} style={[styles.dot, filled && styles.dotFilled]} />
          ))}
        </View>
      </Card>

      {/* The mechanics */}
      <View style={styles.features}>
        {FEATURES.map((f) => (
          <View key={f.label} style={styles.feature}>
            <Mono>{f.label}</Mono>
            <Caption>{f.body}</Caption>
          </View>
        ))}
      </View>

      {/* Two doors */}
      <View style={styles.cta}>
        <Button label="Get started" onPress={() => router.push({ pathname: '/sign-in', params: { mode: 'register' } })} />
        <Button label="Log in" variant="secondary" onPress={() => router.push({ pathname: '/sign-in', params: { mode: 'login' } })} />
      </View>

      {/* Footer */}
      <View style={styles.footer}>
        <Mono style={styles.footTag}>STAY LEVEL · reiseiapp.com</Mono>
        <Caption>Mu Works LLC</Caption>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: 'center', marginTop: space.section, gap: space.sm },
  kanji: { fontSize: 20, letterSpacing: 8, color: color.textBody, marginTop: space.md },
  wordmark: { marginTop: space.xs },
  tagline: { marginTop: space.xs },
  sub: { marginTop: space.sm, letterSpacing: 1, textAlign: 'center' },
  block: { gap: space.md },
  lede: { fontSize: 18, lineHeight: 26 },
  dots: { flexDirection: 'row', gap: space.sm, marginTop: space.xs },
  dot: { width: 20, height: 20, borderRadius: radius.pill, borderWidth: 2, borderColor: color.rule },
  dotFilled: { backgroundColor: color.presence, borderColor: color.presence },
  features: { gap: space.lg },
  feature: { gap: space.xs, borderLeftWidth: 2, borderLeftColor: color.rule, paddingLeft: space.lg },
  cta: { gap: space.md },
  footer: { alignItems: 'center', gap: space.xs, marginTop: space.lg },
  footTag: { letterSpacing: 1 },
});
