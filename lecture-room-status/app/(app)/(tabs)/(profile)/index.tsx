import { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Pressable,
  Alert,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import Animated from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/src/context/AuthContext';
import { isApiConfigured } from '@/src/api/config';
import { usePolicy } from '@/src/context/PolicyContext';
import { GroupedCard } from '@/src/components/ui/GroupedCard';
import { SectionHeader } from '@/src/components/ui/SectionHeader';
import { EmptyState } from '@/src/components/ui/EmptyState';
import { enterFade, PRESS_SCALE } from '@/src/theme/motion';
import { colors, radius, space, type, shadows } from '@/src/theme/tokens';

function roleBadge(role: string) {
  switch (role) {
    case 'admin': return { label: 'Administrator', color: colors.destructive, bg: 'rgba(255,59,48,0.12)' };
    case 'teacher': return { label: 'Teacher', color: colors.accent, bg: colors.accentMuted };
    default: return { label: 'Student', color: colors.campus, bg: colors.campusMuted };
  }
}

export default function ProfileScreen() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const { policy, refresh, loading } = usePolicy();
  const [refreshing, setRefreshing] = useState(false);

  useFocusEffect(useCallback(() => { refresh().catch(() => {}); }, [refresh]));

  async function onRefresh() { setRefreshing(true); try { await refresh(); } finally { setRefreshing(false); } }

  function confirmLogout() {
    Alert.alert('Sign out', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: () => logout() },
    ]);
  }

  if (!isApiConfigured() || !user) {
    return <EmptyState icon="cloud-offline-outline" title="API not configured" subtitle="Set EXPO_PUBLIC_API_URL." />;
  }

  const badge = roleBadge(user.role);

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing || loading} onRefresh={onRefresh} tintColor={colors.campus} />}
    >
      {/* User card */}
      <Animated.View entering={enterFade(400)} style={styles.userCard}>
        <View style={styles.avatarCircle}>
          <Ionicons name="person" size={36} color={colors.campus} />
        </View>
        <Text style={styles.userName}>{user.name}</Text>
        <Text style={styles.userId}>{user.student_id}</Text>
        <View style={[styles.rolePill, { backgroundColor: badge.bg }]}>
          <Text style={[styles.roleText, { color: badge.color }]}>{badge.label}</Text>
        </View>
        {user.department && (
          <Text style={styles.userMeta}>
            {user.department}{user.year ? ` · Year ${user.year}` : ''}{user.class_section ? ` · ${user.class_section}` : ''}
          </Text>
        )}
      </Animated.View>

      {/* Account section */}
      <SectionHeader title="Account" />
      <GroupedCard>
        <Pressable
          style={({ pressed }) => [styles.groupedRow, pressed && { backgroundColor: colors.fill }]}
          onPress={() => router.push('/change-password')}
        >
          <View style={[styles.rowIcon, { backgroundColor: colors.accentMuted }]}>
            <Ionicons name="lock-closed" size={16} color={colors.accent} />
          </View>
          <Text style={styles.groupedRowLabel}>Change password</Text>
          <Ionicons name="chevron-forward" size={18} color={colors.tertiaryLabel} />
        </Pressable>
      </GroupedCard>

      {/* Policy section */}
      <SectionHeader title="Policy" />
      <GroupedCard>
        <View style={styles.groupedRow}>
          <View style={[styles.rowIcon, { backgroundColor: colors.campusMuted }]}>
            <Ionicons name="time" size={16} color={colors.campus} />
          </View>
          <Text style={styles.groupedRowLabel}>Temp use cutoff</Text>
          <Text style={styles.groupedRowValue}>{policy ? `${policy.cutoff_minutes_before_class}m` : '…'}</Text>
        </View>
        <View style={styles.divider} />
        <View style={styles.groupedRow}>
          <View style={[styles.rowIcon, { backgroundColor: colors.campusMuted }]}>
            <Ionicons name="alarm" size={16} color={colors.campus} />
          </View>
          <Text style={styles.groupedRowLabel}>Advance reminder</Text>
          <Text style={styles.groupedRowValue}>{policy ? `${policy.advance_reminder_hours}h` : '…'}</Text>
        </View>
        <View style={styles.divider} />
        <View style={styles.groupedRow}>
          <View style={[styles.rowIcon, { backgroundColor: colors.campusMuted }]}>
            <Ionicons name="globe" size={16} color={colors.campus} />
          </View>
          <Text style={styles.groupedRowLabel}>Timezone</Text>
          <Text style={styles.groupedRowValue}>{policy?.timezone_display ?? '—'}</Text>
        </View>
      </GroupedCard>

      {/* About */}
      <SectionHeader title="About" />
      <GroupedCard>
        <View style={styles.groupedRow}>
          <View style={[styles.rowIcon, { backgroundColor: colors.fill }]}>
            <Ionicons name="information-circle" size={16} color={colors.secondaryLabel} />
          </View>
          <Text style={styles.groupedRowLabel}>Version</Text>
          <Text style={styles.groupedRowValue}>1.0.0</Text>
        </View>
      </GroupedCard>

      {/* Sign out */}
      <Pressable
        style={({ pressed }) => [styles.signOutBtn, pressed && { transform: [{ scale: PRESS_SCALE }] }]}
        onPress={confirmLogout}
      >
        <Ionicons name="log-out-outline" size={20} color={colors.destructive} />
        <Text style={styles.signOutText}>Sign out</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: colors.groupedBackground },
  content: { padding: space.lg, paddingBottom: space.xxl * 2 },

  userCard: {
    backgroundColor: colors.systemBackground,
    borderRadius: radius.xl,
    padding: space.xl,
    alignItems: 'center',
    ...shadows.card,
  },
  avatarCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.campusMuted,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: space.md,
  },
  userName: { ...type.title2, color: colors.label },
  userId: { ...type.subhead, color: colors.secondaryLabel, marginTop: space.xs },
  rolePill: { paddingHorizontal: space.md, paddingVertical: 5, borderRadius: radius.pill, marginTop: space.sm },
  roleText: { ...type.caption1, fontWeight: '700' },
  userMeta: { ...type.footnote, color: colors.tertiaryLabel, marginTop: space.sm },

  groupedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: space.lg,
    gap: space.sm,
    minHeight: 44,
  },
  rowIcon: {
    width: 28,
    height: 28,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
  },
  groupedRowLabel: { ...type.body, color: colors.label, flex: 1 },
  groupedRowValue: { ...type.subhead, color: colors.secondaryLabel },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.separator, marginLeft: space.lg + 28 + space.sm },

  signOutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
    marginTop: space.xl,
    padding: space.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.systemBackground,
    ...shadows.card,
  },
  signOutText: { ...type.headline, color: colors.destructive },
});
