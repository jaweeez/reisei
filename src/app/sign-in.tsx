import * as Haptics from 'expo-haptics';
import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Body, Button, Eyebrow, Hero, Input, Mono, Screen, VialMark } from '@/components';
import { useAuth } from '@/lib/auth/AuthProvider';
import { color, space } from '@/theme';

const BACK_SLOP = { top: 14, bottom: 14, left: 12, right: 12 };

export default function SignIn() {
  const { status, register, login } = useAuth();
  const params = useLocalSearchParams<{ mode?: string }>();
  const [mode, setMode] = useState<'login' | 'register'>(params.mode === 'login' ? 'login' : 'register');
  const [username, setUsername] = useState('');
  const [pin, setPin] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (status === 'authed') return <Redirect href="/" />;

  async function submit() {
    setBusy(true);
    setError(null);
    const err = mode === 'register' ? await register(username, pin, name, email) : await login(username, pin);
    setBusy(false);
    if (err) setError(err);
    else void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }

  return (
    <Screen>
      <Pressable
        style={styles.back}
        hitSlop={BACK_SLOP}
        accessibilityRole="button"
        onPress={() => (router.canGoBack() ? router.back() : router.push('/landing'))}
      >
        <Mono>← Back</Mono>
      </Pressable>

      <View style={styles.head}>
        <VialMark width={180} />
        <Hero style={{ marginTop: space.xl }}>Reisei</Hero>
        <Eyebrow style={{ marginTop: space.sm }}>{mode === 'register' ? 'Create your account' : 'Log in'}</Eyebrow>
      </View>

      <View style={styles.form}>
        {mode === 'register' && (
          <>
            <View style={styles.field}>
              <Eyebrow>Name</Eyebrow>
              <Input placeholder="e.g. Mike" value={name} onChangeText={setName} autoCapitalize="words" />
            </View>
            <View style={styles.field}>
              <Eyebrow>Email · optional, for recovery</Eyebrow>
              <Input placeholder="you@example.com" value={email} onChangeText={setEmail} autoCapitalize="none" autoCorrect={false} keyboardType="email-address" />
            </View>
          </>
        )}
        <View style={styles.field}>
          <Eyebrow>Username</Eyebrow>
          <Input placeholder="e.g. mike" value={username} onChangeText={setUsername} autoCapitalize="none" autoCorrect={false} />
        </View>
        <View style={styles.field}>
          <Eyebrow>PIN · 4 to 8 digits</Eyebrow>
          <Input placeholder="4 to 8 digits" value={pin} onChangeText={setPin} keyboardType="number-pad" secureTextEntry maxLength={8} />
        </View>

        {error && <Body color={color.actionText}>{error}</Body>}

        <Button
          label={mode === 'register' ? 'Create account' : 'Log in'}
          onPress={submit}
          loading={busy}
          disabled={!username.trim() || pin.length < 4 || (mode === 'register' && !name.trim())}
        />
        <Button
          label={mode === 'register' ? 'I already have an account' : 'Create an account'}
          variant="ghost"
          onPress={() => {
            setMode(mode === 'register' ? 'login' : 'register');
            setError(null);
          }}
        />
        {mode === 'login' && <Button label="Forgot PIN?" variant="ghost" onPress={() => router.push('/forgot-pin')} />}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  back: { alignSelf: 'flex-start' },
  head: { alignItems: 'center', marginTop: space.section },
  form: { gap: space.md, marginTop: space.section },
  field: { gap: space.xs },
});
