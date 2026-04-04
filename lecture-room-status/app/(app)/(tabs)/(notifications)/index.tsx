import { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  SectionList,
  Pressable,
  StyleSheet,
  RefreshControl,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import Animated from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { apiFetch } from '@/src/api/client';
import { isApiConfigured } from '@/src/api/config';
import { formatDateTime } from '@/src/lib/time';
import { EmptyState } from '@/src/components/ui/EmptyState';
import { enterFromBottom } from '@/src/theme/motion';
import { colors, radius, space, type, shadows } from '@/src/theme/tokens';

type Row = {
  id: string;
  type: string;
  title: string;
  message: string;
  scheduled_time: string | null;
  is_read: boolean;
  created_at: string;
};

type Section = { title: string; data: Row[] };

function typeIcon(t: string): keyof typeof Ionicons.glyphMap {
  switch (t) {
    case 'cutoff_warning': return 'warning-outline';
    case 'class_start': return 'school-outline';
    case 'cancelled': return 'close-circle-outline';
    case 'advance': return 'time-outline';
    default: return 'notifications-outline';
  }
}

function groupByDate(items: Row[]): Section[] {
  const now = new Date();
  const today = now.toDateString();
  const yesterday = new Date(now.getTime() - 86400000).toDateString();

  const groups = new Map<string, Row[]>();
  for (const item of items) {
    const d = new Date(item.created_at).toDateString();
    let label = d;
    if (d === today) label = 'Today';
    else if (d === yesterday) label = 'Yesterday';
    const existing = groups.get(label) ?? [];
    existing.push(item);
    groups.set(label, existing);
  }
  return Array.from(groups.entries()).map(([title, data]) => ({ title, data }));
}

export default function NotificationsScreen() {
  const [rows, setRows] = useState<Row[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!isApiConfigured()) return;
    const data = await apiFetch<{ notifications: Row[] }>('/notifications');
    setRows(data.notifications);
  }, []);

  useFocusEffect(useCallback(() => { load().catch(() => setRows([])); }, [load]));

  async function onRefresh() { setRefreshing(true); try { await load(); } finally { setRefreshing(false); } }

  async function markRead(id: string) {
    try {
      await apiFetch(`/notifications/${id}/read`, { method: 'PATCH' });
      setRows((prev) => prev.map((r) => (r.id === id ? { ...r, is_read: true } : r)));
    } catch {}
  }

  async function markAllRead() {
    try {
      await apiFetch('/notifications/read-all', { method: 'POST', json: {} });
      setRows((prev) => prev.map((r) => ({ ...r, is_read: true })));
    } catch {}
  }

  const sections = useMemo(() => groupByDate(rows), [rows]);
  const unread = rows.filter((r) => !r.is_read).length;

  if (!isApiConfigured()) {
    return <EmptyState icon="cloud-offline-outline" title="API not configured" />;
  }

  return (
    <View style={styles.wrap}>
      {unread > 0 && (
        <Pressable onPress={markAllRead} style={styles.markAll}>
          <Ionicons name="checkmark-done" size={16} color={colors.accent} />
          <Text style={styles.markAllText}>Mark all read ({unread})</Text>
        </Pressable>
      )}
      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.campus} />}
        stickySectionHeadersEnabled={false}
        renderSectionHeader={({ section }) => (
          <Text style={styles.sectionTitle}>{section.title}</Text>
        )}
        renderItem={({ item, index }) => (
          <Animated.View entering={enterFromBottom(index)}>
            <Pressable
              onPress={() => !item.is_read && markRead(item.id)}
              style={[styles.card, !item.is_read && styles.cardUnread]}
            >
              <View style={styles.cardRow}>
                <View style={[styles.iconCircle, !item.is_read && styles.iconCircleActive]}>
                  <Ionicons name={typeIcon(item.type)} size={18} color={!item.is_read ? colors.accent : colors.tertiaryLabel} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardTitle}>{item.title}</Text>
                  <Text style={styles.cardBody} numberOfLines={2}>{item.message}</Text>
                  <Text style={styles.cardTime}>
                    {item.scheduled_time ? formatDateTime(item.scheduled_time) : formatDateTime(item.created_at)}
                  </Text>
                </View>
                {!item.is_read && <View style={styles.unreadDot} />}
              </View>
            </Pressable>
          </Animated.View>
        )}
        ListEmptyComponent={
          <EmptyState icon="notifications-off-outline" title="No notifications" subtitle="Booking and class reminders appear here." />
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.groupedBackground },
  listContent: { padding: space.lg, paddingBottom: space.xxl },
  markAll: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-end',
    gap: 4,
    marginRight: space.lg,
    marginTop: space.sm,
    marginBottom: space.xs,
  },
  markAllText: { ...type.subhead, color: colors.accent, fontWeight: '600' },
  sectionTitle: {
    ...type.caption1,
    color: colors.tertiaryLabel,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: space.xs,
    marginTop: space.md,
    marginLeft: space.xs,
  },
  card: {
    backgroundColor: colors.systemBackground,
    borderRadius: radius.lg,
    padding: space.lg,
    marginBottom: space.sm,
    ...shadows.card,
  },
  cardUnread: { borderLeftWidth: 4, borderLeftColor: colors.accent },
  cardRow: { flexDirection: 'row', gap: space.md },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.fill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconCircleActive: { backgroundColor: colors.accentMuted },
  cardTitle: { ...type.headline, color: colors.label },
  cardBody: { ...type.subhead, color: colors.secondaryLabel, marginTop: 3 },
  cardTime: { ...type.caption2, color: colors.tertiaryLabel, marginTop: space.xs },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.accent,
    alignSelf: 'flex-start',
    marginTop: 4,
  },
});
