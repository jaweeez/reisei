import { Redirect } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import { Body, Button, Eyebrow, Hero, Screen, Text, VialMark } from '@/components';
import { useAuth } from '@/lib/auth/AuthProvider';
import { color, radius, space } from '@/theme';

export default function SignIn() {
  const { status, register, login } = useAuth();
  const [mode, setMode] = useState<'login' | 'register'>('register');
  const [username, setUsername] = useState('');
  const [pin, setPin] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (status === 'authed') return <Redirect href="/" />;

  async function submit() {
    setBusy(true);
    setError(null);
    const err = mode === 'register' ? await register(username, pin, name) : await login(username, pin);
    setBusy(false);
    if (err) setError(err);
  }

  return (
    <Screen>
      <View style={styles.head}>
        <VialMark width={180} />
        <Hero style={{ marginTop: space.xl }}>Reisei</Hero>
        <Eyebrow style={{ marginTop: space.sm }}>Stay level.</Eyebrow>
      </View>

      <View style={styles.form}>
        {mode === 'register' && (
          <Field placeholder="Name" value={name} onChangeText={setName} autoCapitalize="words" />
        )}
        <Field placeholder="Username" value={username} onChangeText={setUsername} autoCapitalize="none" />
        <Field placeholder="PIN (4–8 digits)" value={pin} onChangeText={setPin} keyboardType="number-pad" secureTextEntry />

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
      </View>
    </Screen>
  );
}

function Field(props: React.ComponentProps<typeof TextInput>) {
  return <TextInput placeholderTextColor={color.textSecondary} style={styles.input} {...props} />;
}

const styles = StyleSheet.create({
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
