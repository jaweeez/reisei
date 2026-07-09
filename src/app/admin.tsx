import { Redirect, useFocusEffect } from 'expo-router';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { useCallback, useRef, useState } from 'react';
import { Body, Button, Caption, Card, Eyebrow, Input, Mono, Screen, ScreenHeader, Text } from '@/components';
import { confirm } from '@/lib/alerts';
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

  // Latest query lives in a ref so `load` keeps a stable identity: useFocusEffect fetches
  // once per focus instead of refetching on every keystroke. Requery via Search / submit.
  const qRef = useRef(q);
  qRef.current = q;

  const loadUsers = useCallback(async (query: string) => setUsers(await adminUsers(query)), []);
  const load = useCallback(async () => {
    const [ov] = await Promise.all([adminOverview(), loadUsers(qRef.current)]);
    setOverview(ov);
    setLoaded(true);
  }, [loadUsers]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  // Client-side gate (the server admin-gates every /api/admin/* route too).
  if (entitlement && !entitlement.isAdmin) return <Redirect href="/" />;

  async function toggle(u: AdminUser) {
    const next = u.plan === 'pro' ? 'free' : 'pro';
    if (next === 'free' && !(await confirm('Revoke Pro?', `Remove Pro from @${u.username}.`, 'Revoke'))) return;
    setBusyId(u.id);
    const ok = await adminGrant(u.id, next);
    if (ok) {
      setUsers((prev) => prev.map((x) => (x.id === u.id ? { ...x, plan: next } : x)));
      void adminOverview().then(setOverview);
    }
    setBusyId(null);
  }

  return (
    <Screen>
      <ScreenHeader title="Admin" />

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
          <Input
            inCard
            placeholder="Search username or name"
            value={q}
            onChangeText={setQ}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
            onSubmitEditing={() => void loadUsers(q)}
            style={styles.searchInput}
          />
          <Button label="Search" variant="secondary" onPress={() => void loadUsers(q)} />
        </View>

        {users.length === 0 && <Caption>{loaded ? 'No users match.' : 'Loading…'}</Caption>}

        {users.map((u) => (
          <View key={u.id} style={styles.row}>
            <View style={styles.rowMain}>
              <Body color={color.textPrimary}>{u.name}</Body>
              <Mono>{`@${u.username}${u.isAdmin ? ' · ADMIN' : ''} · ${u.plan.toUpperCase()} · ${u.crewCount} corners · ${u.createdAt}`}</Mono>
            </View>
            {/* Shared <Chip> can't host the in-flight spinner (label-only), so this is the
                sanctioned minimal wrapper: Chip's visual language, minHeight 44, named a11y. */}
            <Pressable
              onPress={() => void toggle(u)}
              disabled={busyId === u.id}
              accessibilityRole="button"
              accessibilityLabel={u.plan === 'pro' ? `Revoke Pro for ${u.name}` : `Grant Pro to ${u.name}`}
              accessibilityState={{ disabled: busyId === u.id, busy: busyId === u.id }}
              style={[styles.chip, u.plan === 'pro' ? styles.chipRevoke : styles.chipGrant, busyId === u.id && styles.chipBusy]}
            >
              {busyId === u.id ? (
                <ActivityIndicator color={u.plan === 'pro' ? color.action : color.bg} />
              ) : (
                <Text variant="mono" color={u.plan === 'pro' ? color.textBody : color.bg}>
                  {u.plan === 'pro' ? 'REVOKE' : 'GRANT PRO'}
                </Text>
              )}
            </Pressable>
          </View>
        ))}
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  searchRow: { flexDirection: 'row', gap: space.sm, alignItems: 'center' },
  searchInput: { flex: 1 },
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
    minHeight: 44,
    minWidth: 96,
    paddingVertical: space.sm,
    paddingHorizontal: space.md,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  chipGrant: { backgroundColor: color.action, borderColor: color.action },
  chipRevoke: { backgroundColor: 'transparent', borderColor: color.rule },
  chipBusy: { opacity: 0.6 },
});
