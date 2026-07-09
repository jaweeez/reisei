import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useState } from 'react';
import { Body, Button, Caption, Input, Screen, Title } from '@/components';
import { authApi } from '@/lib/auth/client';
import { color } from '@/theme';

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
    if (res.ok) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace({ pathname: '/sign-in', params: { mode: 'login' } });
    } else setError(res.data.error ?? 'That code is wrong or expired.');
  }

  return (
    <Screen>
      <Title>Forgot PIN</Title>
      {step === 'email' ? (
        <>
          <Body>Enter the email on your account. If it is verified, we will send a 6-digit code.</Body>
          <Input
            placeholder="Email"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
          />
          {error && <Body color={color.actionText}>{error}</Body>}
          <Button label="Send code" onPress={request} loading={busy} disabled={!email.trim()} />
        </>
      ) : (
        <>
          <Body>Enter the code and a new PIN.</Body>
          <Caption>If that email is on a verified account, a code is on its way.</Caption>
          <Input
            placeholder="6-digit code"
            value={code}
            onChangeText={setCode}
            keyboardType="number-pad"
            maxLength={6}
          />
          <Input
            placeholder="New PIN (4 to 8 digits)"
            value={pin}
            onChangeText={setPin}
            keyboardType="number-pad"
            secureTextEntry
          />
          {error && <Body color={color.actionText}>{error}</Body>}
          <Button
            label="Set new PIN"
            onPress={confirm}
            loading={busy}
            disabled={code.trim().length !== 6 || pin.trim().length < 4}
          />
          <Button label="Change email" variant="ghost" onPress={() => setStep('email')} />
        </>
      )}
      <Button label="Back to sign in" variant="ghost" onPress={() => router.replace({ pathname: '/sign-in', params: { mode: 'login' } })} />
    </Screen>
  );
}
