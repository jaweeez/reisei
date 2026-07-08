import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, TextInput } from 'react-native';
import { Body, Button, Caption, Screen, Title } from '@/components';
import { authApi } from '@/lib/auth/client';
import { color, radius, space } from '@/theme';

// Forgot PIN: enter the email on your account, get a 6-digit code (only if it is verified),
// then set a new PIN. Responses are generic so nothing reveals whether an account exists.
export default function ForgotPin() {
  const [step, setStep] = useState<'email' | 'reset'>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function request() {
    if (!email.trim()) return;
    setBusy(true);
    setError(null);
    await authApi.requestPinReset(email.trim()); // always a generic ok
    setBusy(false);
    setStep('reset');
  }

  async function confirm() {
    setBusy(true);
    setError(null);
    const res = await authApi.confirmPinReset(email.trim(), code.trim(), pin.trim());
    setBusy(false);
    if (res.ok) router.replace({ pathname: '/sign-in', params: { mode: 'login' } });
    else setError(res.data.error ?? 'That code is wrong or expired.');
  }

  return (
    <Screen>
      <Title>Forgot PIN</Title>
      {step === 'email' ? (
        <>
          <Body>Enter the email on your account. If it is verified, we will send a 6-digit code.</Body>
          <TextInput
            placeholder="Email"
            placeholderTextColor={color.textSecondary}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            style={styles.input}
          />
          {error && <Body color={color.actionText}>{error}</Body>}
          <Button label="Send code" onPress={request} loading={busy} disabled={!email.trim()} />
        </>
      ) : (
        <>
          <Body>Enter the code and a new PIN.</Body>
          <Caption>If that email is on a verified account, a code is on its way.</Caption>
          <TextInput
            placeholder="6-digit code"
            placeholderTextColor={color.textSecondary}
            value={code}
            onChangeText={setCode}
            keyboardType="number-pad"
            maxLength={6}
            style={styles.input}
          />
          <TextInput
            placeholder="New PIN (4 to 8 digits)"
            placeholderTextColor={color.textSecondary}
            value={pin}
            onChangeText={setPin}
            keyboardType="number-pad"
            secureTextEntry
            style={styles.input}
          />
          {error && <Body color={color.actionText}>{error}</Body>}
          <Button
            label="Set new PIN"
            onPress={confirm}
            loading={busy}
            disabled={code.trim().length !== 6 || pin.trim().length < 4}
          />
          <Button label="Back" variant="ghost" onPress={() => setStep('email')} />
        </>
      )}
      <Button label="Back to sign in" variant="ghost" onPress={() => router.replace({ pathname: '/sign-in', params: { mode: 'login' } })} />
    </Screen>
  );
}

const styles = StyleSheet.create({
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
