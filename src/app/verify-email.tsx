import * as Haptics from 'expo-haptics';
import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Body, Button, Caption, Input, Screen, ScreenHeader, Title } from '@/components';
import { authApi } from '@/lib/auth/client';
import { useAuth } from '@/lib/auth/AuthProvider';
import { color } from '@/theme';

// The verify-email wall (new signups) and the add/change-email flow (existing users, from
// Settings with ?change=1). Add an email, then enter the 6-digit code we send.
export default function VerifyEmail() {
  const { status, user, refresh } = useAuth();
  const params = useLocalSearchParams<{ change?: string }>();
  const changing = params.change === '1';
  const [step, setStep] = useState<'email' | 'code'>(changing || !user?.email ? 'email' : 'code');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [resending, setResending] = useState(false);

  if (status === 'loading') return null;
  if (status === 'guest') return <Redirect href="/landing" />;
  if (user?.emailVerified && !changing) return <Redirect href="/" />;

  async function sendEmail() {
    setBusy(true);
    setError(null);
    setNote(null);
    const res = await authApi.addEmail(email.trim());
    setBusy(false);
    if (res.ok) {
      await refresh();
      setStep('code');
      setNote('Code sent. Check your email.');
    } else {
      setError(res.data.error ?? 'Could not send the code.');
    }
  }

  async function verify() {
    setBusy(true);
    setError(null);
    const res = await authApi.verifyEmailCode(code.trim());
    setBusy(false);
    if (res.ok) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await refresh();
      router.replace('/');
    } else {
      setError(res.data.error ?? 'That code is wrong or expired.');
    }
  }

  async function resend() {
    setResending(true);
    setError(null);
    setNote(null);
    const res = await authApi.resendCode();
    setResending(false);
    if (res.ok) setNote('New code sent.');
    else setError(res.data.error ?? 'Try again in a moment.');
  }

  return (
    <Screen>
      {router.canGoBack() ? <ScreenHeader title="Verify your email" /> : <Title>Verify your email</Title>}
      {step === 'email' ? (
        <>
          <Body>Add an email so you can recover your account if you forget your PIN.</Body>
          <Input
            placeholder="Email"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
          />
          {error && <Body color={color.actionText}>{error}</Body>}
          <Button label="Send code" onPress={sendEmail} loading={busy} disabled={!email.trim()} />
        </>
      ) : (
        <>
          <Body>{`Enter the 6-digit code we sent to ${user?.email ?? 'your email'}.`}</Body>
          <Input
            placeholder="6-digit code"
            value={code}
            onChangeText={setCode}
            keyboardType="number-pad"
            maxLength={6}
          />
          {note && <Caption>{note}</Caption>}
          {error && <Body color={color.actionText}>{error}</Body>}
          <Button label="Verify" onPress={verify} loading={busy} disabled={code.trim().length !== 6} />
          <Button label="Resend code" variant="ghost" onPress={resend} loading={resending} />
          <Button
            label="Change email"
            variant="ghost"
            onPress={() => {
              setStep('email');
              setError(null);
              setNote(null);
            }}
          />
        </>
      )}
    </Screen>
  );
}
