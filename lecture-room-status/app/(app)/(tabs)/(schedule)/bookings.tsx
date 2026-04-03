import { useCallback, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  Pressable,
  StyleSheet,
  RefreshControl,
  Alert,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import Animated from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/src/context/AuthContext';
import { apiFetch } from '@/src/api/client';
import { isApiConfigured } from '@/src/api/config';
import { formatDateTime } from '@/src/lib/time';
import { EmptyState } from '@/src/components/ui/EmptyState';
import { enterFromBottom } from '@/src/theme/motion';
import { colors, radius, space, type, shadows } from '@/src/theme/tokens';

type Bk = {
  id: string;
  room_number: string;
  building_name: string;
  course_name: string;
  event_type?: string;
  start_time: string;
  end_time: string;
  next_booking_preference?: boolean;
};

const EVENT_LABELS: Record<string, string> = {
  lecture: 'Lecture', exam: 'Exam', tutor: 'Tutor', defense: 'Defense', lab: 'LAB', presentation: 'Presentation',
};

export default function MyBookingsScreen() {
  const { user } = useAuth();
  const [rows, setRows] = useState<Bk[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!isApiConfigured() || !user) return;
    const data = await apiFetch<{ bookings: Bk[] }>('/bookings/mine');
    setRows(data.bookings);
  }, [user]);

  useFocusEffect(useCallback(() => { load().catch(() => setRows([])); }, [load]));
  async function onRefresh() { setRefreshing(true); try { await load(); } finally { setRefreshing(false); } }

  async function cancelBooking(id: string) {
    Alert.alert('Cancel booking?', 'The room will free up for others.', [
      { text: 'No', style: 'cancel' },
      { text: 'Cancel booking', style: 'destructive', onPress: async () => {
        try { await apiFetch(`/bookings/${id}`, { method: 'DELETE' }); await load(); } catch (e) { Alert.alert('Error', String(e)); }
      }},
    ]);
  }

  if (!isApiConfigured()) {
    return <EmptyState icon="cloud-offline-outline" title="API not configured" />;
  }

  return (
    <FlatList
      style={styles.list}
      contentContainerStyle={styles.listContent}
      data={rows}
      keyExtractor={(item) => item.id}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.campus} />}
      renderItem={({ item, index }) => (
        <Animated.View entering={enterFromBottom(index)}>
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={styles.iconWrap}>
                <Ionicons name="calendar" size={18} color={colors.accent} />
              </View>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.xs }}>
                  <Text style={styles.course}>{item.course_name}</Text>
                  {item.event_type && (
                    <View style={styles.evTag}>
                      <Text style={styles.evTagText}>{EVENT_LABELS[item.event_type] ?? item.event_type}</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.room}>{item.building_name} · {item.room_number}</Text>
              </View>
            </View>
            <Text style={styles.time}>{formatDateTime(item.start_time)} → {formatDateTime(item.end_time)}</Text>
            {item.next_booking_preference && <Text style={styles.pref}>Same room next slot preferred</Text>}
            <Pressable onPress={() => cancelBooking(item.id)} style={styles.cancelBtn}>
              <Text style={styles.cancelTxt}>Cancel booking</Text>
            </Pressable>
          </View>
        </Animated.View>
      )}
      ListEmptyComponent={
        <EmptyState icon="calendar-outline" title="No bookings" subtitle="Book rooms from the Explore tab." />
      }
    />
  );
}

const styles = StyleSheet.create({
  list: { flex: 1, backgroundColor: colors.groupedBackground },
  listContent: { padding: space.lg, paddingBottom: space.xxl, flexGrow: 1 },
  card: {
    backgroundColor: colors.systemBackground,
    borderRadius: radius.lg,
    padding: space.lg,
    marginBottom: space.md,
    ...shadows.card,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  iconWrap: { width: 36, height: 36, borderRadius: 10, backgroundColor: colors.accentMuted, alignItems: 'center', justifyContent: 'center' },
  course: { ...type.headline, color: colors.label },
  room: { ...type.subhead, color: colors.secondaryLabel, marginTop: 2 },
  time: { ...type.footnote, color: colors.secondaryLabel, marginTop: space.sm },
  pref: { ...type.caption2, color: colors.tertiaryLabel, marginTop: space.xs, fontStyle: 'italic' },
  evTag: { backgroundColor: colors.accentMuted, paddingHorizontal: 6, paddingVertical: 2, borderRadius: radius.sm },
  evTagText: { ...type.caption2, color: colors.accent, fontWeight: '600' },
  cancelBtn: { alignSelf: 'flex-start', marginTop: space.md, paddingVertical: space.xs },
  cancelTxt: { ...type.subhead, color: colors.destructive, fontWeight: '600' },
});
