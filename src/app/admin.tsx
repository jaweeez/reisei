import { Redirect, router, useFocusEffect } from 'expo-router';
import { ActivityIndicator, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { useCallback, useState } from 'react';
import { Body, Button, Caption, Card, Eyebrow, Mono, Screen, Text, Title } from '@/components';
import { useAuth } from '@/lib/auth/AuthProvider';
import { adminGrant, adminOverview, adminUsers } from '@/lib/data/admin';
import type { AdminOverview, AdminUser } from '@/lib/data/types';
import { color, radius, space } from '@/theme';

export default function Admin() {
  const { entitlement } = useAuth();
  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [q, setQ] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  const loadUsers = useCallback(async (query: string) => setUsers(await adminUsers(query)), []);
  const load = useCallback(async () => {
    const [ov] = await Promise.all([adminOverview(), loadUsers(q)]);
    setOverview(ov);
    setLoaded(true);
  }, [loadUsers, q]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  // Client-side gate (the server admin-gates every /api/admin/* route too).
  if (entitlement && !entitlement.isAdmin) return <Redirect href="/" />;

  async function toggle(u: AdminUser) {
    setBusyId(u.id);
    const next = u.plan === 'pro' ? 'free' : 'pro';
    const ok = await adminGrant(u.id, next);
    if (ok) {
      setUsers((prev) => prev.map((x) => (x.id === u.id ? { ...x, plan: next } : x)));
      void adminOverview().then(setOverview);
    }
    setBusyId(null);
  }

  return (
    <Screen>
      <Title>Admin</Title>

      <Card>
        <Eyebrow>Platform</Eyebrow>
        {overview ? (
          <>
            <Mono>{`USERS ${overview.users}  ·  PRO ${overview.pro}  ·  ADMINS ${overview.admins}  ·  CORNERS ${overview.crews}`}</Mono>
            <Mono>{`ACTIVE 7d ${overview.active7d}  ·  NEW 7d ${overview.signups7d}  ·  CHECK-INS TODAY ${overview.checkinsToday}`}</Mono>
          </>
        ) : (
          <Caption>{loaded ? 'Overview unavailable.' : 'Loading…'}</Caption>
        )}
      </Card>

      <Card>
        <Eyebrow>Users</Eyebrow>
        <View style={styles.searchRow}>
          <TextInput
            placeholder="Search username or name"
            placeholderTextColor={color.textSecondary}
            value={q}
            onChangeText={setQ}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
            onSubmitEditing={() => void loadUsers(q)}
            style={styles.input}
          />
          <Button label="Search" variant="secondary" onPress={() => void loadUsers(q)} />
        </View>

        {users.length === 0 && <Caption>{loaded ? 'No users match.' : 'Loading…'}</Caption>}

        {users.map((u) => (
          <View key={u.id} style={styles.row}>
            <View style={styles.rowMain}>
              <Body color={color.textPrimary}>
                {u.name}
                {u.isAdmin ? '  ·  ADMIN' : ''}
              </Body>
              <Mono>{`@${u.username} · ${u.plan.toUpperCase()} · ${u.crewCount} corners · ${u.createdAt}`}</Mono>
            </View>
            <Pressable
              onPress={() => toggle(u)}
              disabled={busyId === u.id}
              style={[styles.chip, u.plan === 'pro' ? styles.chipRevoke : styles.chipGrant, busyId === u.id && styles.chipBusy]}
            >
              {busyId === u.id ? (
                <ActivityIndicator color={color.action} />
              ) : (
                <Text variant="mono" color={u.plan === 'pro' ? color.textBody : color.bg}>
                  {u.plan === 'pro' ? 'REVOKE' : 'GRANT PRO'}
                </Text>
              )}
            </Pressable>
          </View>
        ))}
      </Card>

      <Button label="Back" variant="ghost" onPress={() => router.back()} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  searchRow: { flexDirection: 'row', gap: space.sm, alignItems: 'center' },
  input: {
    flex: 1,
    minHeight: 52,
    backgroundColor: color.bg,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: color.rule,
    paddingHorizontal: space.lg,
    color: color.textPrimary,
    fontFamily: 'IBMPlexSans_400Regular',
    fontSize: 16,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.md,
    paddingVertical: space.sm,
    borderTopWidth: 1,
    borderTopColor: color.rule,
  },
  rowMain: { flex: 1, gap: 2 },
  chip: {
    minHeight: 40,
    minWidth: 96,
    paddingHorizontal: space.md,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
  },
  chipGrant: { backgroundColor: color.action, borderColor: color.action },
  chipRevoke: { backgroundColor: 'transparent', borderColor: color.rule },
  chipBusy: { opacity: 0.6 },
});
