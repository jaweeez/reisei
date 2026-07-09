import { router } from 'expo-router';
import { Linking, Pressable, StyleSheet, View } from 'react-native';
import { Body, Caption, Heading, Mono, Screen, ScreenHeader } from '@/components';
import { color, space } from '@/theme';

// Public privacy policy, served at /privacy (and www.reiseiapp.com/privacy on web) — the URL the
// app stores require. No auth guard: reachable signed-out. Plain and accurate to what Reisei
// actually collects, including that what you write in the log is processed by third-party AI.

const EMAIL = 'support@reiseiapp.com';

const LINK_SLOP = { top: 14, bottom: 14, left: 12, right: 12 };

function P({ children }: { children: React.ReactNode }) {
  return <Body color={color.textBody}>{children}</Body>;
}
function S({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Heading>{title}</Heading>
      {children}
    </View>
  );
}

export default function Privacy() {
  return (
    <Screen>
      <ScreenHeader title="Privacy" onClose={() => (router.canGoBack() ? router.back() : router.push('/landing'))} />
      <Caption>Reisei, by Mu Works LLC. Last updated July 8, 2026.</Caption>

      <P>
        This explains what Reisei collects, why, and the control you have over it. Reisei is a composure-training
        app: you hold a daily standard in front of a small crew. Keep it plain: we collect what the app needs to
        work, nothing we sell.
      </P>

      <S title="What we collect">
        <P>
          Account: a username and a PIN (the PIN is stored only as a one-way hash, never in the clear). An email is
          optional, for account recovery. What you create in the app: your line, your daily check-ins and any notes,
          your private log entries, your responses to the Bearing, and completed Resets. Your Corner (the small crew
          you check in with): which Corners you join and the acknowledgements you send and receive. If you enable
          notifications, a device push token. Basic technical data needed to run the service (for example, timezone
          and app version).
        </P>
      </S>

      <S title="How we use it">
        <P>
          To run the app: record your check-ins and streak, show your Corner that you showed up, and keep you signed
          in. To personalize the Bearing to what you have recently written. To send you a verification or
          PIN-reset code if you add an email, and to send notifications you turn on. We do not use your data for
          advertising, and we do not sell it.
        </P>
      </S>

      <S title="What you write, and AI">
        <P>
          To personalize the Bearing and read themes in your log, the text of your log entries and check-in notes is
          sent to third-party AI providers, Anthropic (the Claude API) and Voyage AI (an embeddings provider, part of
          MongoDB), which turn it into a short numerical representation (an embedding) and a brief written reflection.
          We use these providers under their commercial API terms, under which your text is not used to train their
          models by default. They may retain it briefly to monitor for abuse or safety, which is not model training.
          Your log is private and is never shown to your Corner.
        </P>
      </S>

      <S title="Who we share it with">
        <P>
          Your Corner sees your daily posture (held, broke, or nothing yet) and your line. That is the point of a
          Corner. Beyond that, we share data only with the service providers that run Reisei on our behalf: hosting
          (Vercel), the database (Neon), email delivery (Amazon SES), AI processing (Anthropic and Voyage AI,
          above), push notifications (Expo), and, if you buy Pro, payment processing (Stripe and RevenueCat). They
          may use it only to provide their service to us.
        </P>
      </S>

      <S title="Keeping and deleting your data">
        <P>
          We keep your data while your account is active. You can delete your account at any time in Settings, under
          Danger zone: this permanently removes your account and its data (your line, check-ins, streak, log,
          profile, and Corner standing) and cannot be undone. If you captain a Corner, deleting your account removes
          that Corner. Residual copies may persist in encrypted backups for a short time before they cycle out, and
          our providers may keep limited records where the law requires.
        </P>
      </S>

      <S title="Security">
        <P>
          PINs are hashed with bcrypt (we never store the PIN itself). Data is encrypted in transit, and encrypted
          at rest by our database provider. Access is scoped per user at the database level (row-level security). No
          system is perfectly secure, but we work to protect your data and limit who can reach it.
        </P>
      </S>

      <S title="Not a medical or crisis service">
        <P>
          Reisei is not therapy, medical care, or a crisis service, and it is not a substitute for a professional.
          If you are in genuine distress, contact a real person or a crisis line. In the US, call or text 988 (the
          Suicide and Crisis Lifeline), or call 911 in an emergency.
        </P>
      </S>

      <S title="Age">
        <P>Reisei is intended for adults. Do not use it if you are under 17.</P>
      </S>

      <S title="Changes">
        <P>
          If we change this policy we will update the date above and, for material changes, note it in the app.
        </P>
      </S>

      <S title="Contact">
        <Pressable onPress={() => void Linking.openURL(`mailto:${EMAIL}`)} hitSlop={LINK_SLOP} accessibilityRole="link">
          <Mono color={color.actionText}>{EMAIL}</Mono>
        </Pressable>
        <Caption>Mu Works LLC</Caption>
      </S>
    </Screen>
  );
}

const styles = StyleSheet.create({
  section: { gap: space.sm, marginTop: space.xl },
});
