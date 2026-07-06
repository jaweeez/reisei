import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Linking, Platform, StyleSheet, View } from 'react-native';
import { Body, Button, Caption, Card, Eyebrow, Mono, Screen, Title } from '@/components';
import { useAuth } from '@/lib/auth/AuthProvider';
import { billingApi } from '@/lib/billing/client';
import { iapEnabled, restore } from '@/lib/billing/iap';
import { color } from '@/theme';

const TIER_LABEL: Record<string, string> = { free: 'Free', pro: 'Reisei Pro', team: 'Crew · Team seat' };

export default function Settings() {
  const { user, entitlement, logout } = useAuth();
  const [portalAvailable, setPortalAvailable] = useState(false);

  useEffect(() => {
    void billingApi.status().then((r) => setPortalAvailable(Boolean(r.data.portalAvailable)));
  }, []);

  async function openPortal() {
    const res = await billingApi.portal();
    if (res.data.url) void Linking.openURL(res.data.url);
  }

  return (
    <Screen>
      <Title>You</Title>

      <Card>
        <Eyebrow>Account</Eyebrow>
        <Body color={color.textPrimary}>{user?.name}</Body>
        <Mono>{`@${user?.username ?? ''} · ${user?.tz ?? 'UTC'}`}</Mono>
      </Card>

      <Card>
        <Eyebrow>Plan</Eyebrow>
        <Body color={color.textPrimary}>{TIER_LABEL[entitlement?.tier ?? 'free']}</Body>
        {entitlement?.tier === 'free' ? (
          <Button label="Go Pro" onPress={() => router.push('/paywall')} />
        ) : (
          <View style={styles.stack}>
            {portalAvailable && <Button label="Manage billing" variant="secondary" onPress={openPortal} />}
            {iapEnabled() && (
              <Button
                label="Restore purchases"
                variant="ghost"
                onPress={() => restore()}
              />
            )}
          </View>
        )}
      </Card>

      <Card>
        <Eyebrow>Session</Eyebrow>
        <Button label="Log out" variant="secondary" onPress={logout} />
      </Card>

      <Caption>{`Reisei · Mu Works LLC${Platform.OS !== 'web' ? ' · IAP via RevenueCat' : ''}`}</Caption>
    </Screen>
  );
}

const styles = StyleSheet.create({
  stack: { gap: 12 },
});
