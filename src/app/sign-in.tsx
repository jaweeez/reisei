import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { Body, Button, Eyebrow, Hero, Mono, Screen, Text, VialMark } from '@/components';
import { useAuth } from '@/lib/auth/AuthProvider';
import { color, radius, space } from '@/theme';

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
  }

  return (
    <Screen>
      <Pressable
        style={styles.back}
        hitSlop={12}
        onPress={() => (router.canGoBack() ? router.back() : router.push('/landing'))}
      >
        <Mono>← Back</Mono>
      </Pressable>

      <View style={styles.head}>
        <VialMark width={180} />
        <Hero style={{ marginTop: space.xl }}>Reisei</Hero>
        <Eyebrow style={{ marginTop: space.sm }}>Stay level.</Eyebrow>
      </View>

      <View style={styles.form}>
        {mode === 'register' && (
          <>
            <Field placeholder="Name" value={name} onChangeText={setName} autoCapitalize="words" />
            <Field placeholder="Email" value={email} onChangeText={setEmail} autoCapitalize="none" autoCorrect={false} keyboardType="email-address" />
          </>
        )}
        <Field placeholder="Username" value={username} onChangeText={setUsername} autoCapitalize="none" />
        <Field placeholder="PIN (4 to 8 digits)" value={pin} onChangeText={setPin} keyboardType="number-pad" secureTextEntry />

        {error && <Body color={color.actionText}>{error}</Body>}

        <Button label={mode === 'register' ? 'Create account' : 'Log in'} onPress={submit} loading={busy} />
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

function Field(props: React.ComponentProps<typeof TextInput>) {
  return <TextInput placeholderTextColor={color.textSecondary} style={styles.input} {...props} />;
}

const styles = StyleSheet.create({
  back: { alignSelf: 'flex-start' },
  head: { alignItems: 'center', marginTop: space.section },
  form: { gap: space.md, marginTop: space.section },
  input: {
    minHeight: 52,
    backgroundColor: color.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: color.rule,
    paddingHorizontal: space.lg,
    color: color.textPrimary,
    fontFamily: 'IBMPlexSans_400Regular',
    fontSize: 16,
  },
});
