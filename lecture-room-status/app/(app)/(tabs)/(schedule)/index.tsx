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
import { useFocusEffect, useRouter } from 'expo-router';
import Animated from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/src/context/AuthContext';
import { apiFetch } from '@/src/api/client';
import { isApiConfigured } from '@/src/api/config';
import { formatDateTime } from '@/src/lib/time';
import { EmptyState } from '@/src/components/ui/EmptyState';
import { GroupedCard } from '@/src/components/ui/GroupedCard';
import { SectionHeader } from '@/src/components/ui/SectionHeader';
import { enterFromBottom, PRESS_SCALE } from '@/src/theme/motion';
import { colors, radius, space, type, shadows } from '@/src/theme/tokens';

type CourseRow = { course_name: string; teacher_name: string; department: string; year: number; class_section: string };
type BookingRow = { id: string; room_number: string; building_name: string; course_name: string; start_time: string; end_time: string; next_booking_preference?: boolean };

export default function ScheduleScreen() {
  const { user } = useAuth();

  if (!isApiConfigured()) {
    return <EmptyState icon="cloud-offline-outline" title="API not configured" subtitle="Set EXPO_PUBLIC_API_URL in your environment." />;
  }

  if (user?.role === 'student') return <StudentSchedule />;
  return <BookingsList />;
}

function StudentSchedule() {
  const { user } = useAuth();
  const router = useRouter();
  const [rows, setRows] = useState<CourseRow[]>([]);
  const [isCr, setIsCr] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!user || user.role !== 'student') return;
    try { const d = await apiFetch<{ courses: CourseRow[] }>('/courses/my-classes'); setRows(d.courses); } catch { setRows([]); }
    try { await apiFetch('/courses/cr-list'); setIsCr(true); } catch { setIsCr(false); }
  }, [user]);

  useFocusEffect(useCallback(() => { load().catch(() => {}); }, [load]));
  async function onRefresh() { setRefreshing(true); try { await load(); } finally { setRefreshing(false); } }

  return (
    <FlatList
      style={styles.flat}
      contentContainerStyle={styles.list}
      data={rows}
      keyExtractor={(_, i) => String(i)}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.campus} />}
      ListHeaderComponent={
        <View>
          {isCr && (
            <>
              <SectionHeader title="Class rep" style={{ marginTop: 0 }} />
              <GroupedCard style={{ marginBottom: space.lg }}>
                <Pressable
                  style={styles.groupedRow}
                  onPress={() => router.push('/(app)/(tabs)/(schedule)/cr-setup')}
                >
                  <Ionicons name="school-outline" size={20} color={colors.campus} />
                  <Text style={styles.groupedRowLabel}>Manage courses</Text>
                  <Ionicons name="chevron-forward" size={18} color={colors.tertiaryLabel} />
                </Pressable>
                <View style={styles.divider} />
                <Pressable
                  style={styles.groupedRow}
                  onPress={() => router.push('/(app)/(tabs)/(schedule)/bookings')}
                >
                  <Ionicons name="calendar-outline" size={20} color={colors.campus} />
                  <Text style={styles.groupedRowLabel}>My bookings</Text>
                  <Ionicons name="chevron-forward" size={18} color={colors.tertiaryLabel} />
                </Pressable>
              </GroupedCard>
            </>
          )}
          <SectionHeader title="My courses" style={isCr ? {} : { marginTop: 0 }} />
        </View>
      }
      renderItem={({ item, index }) => (
        <Animated.View entering={enterFromBottom(index)}>
          <View style={styles.card}>
            <View style={styles.courseHeader}>
              <View style={styles.courseIcon}>
                <Ionicons name="book" size={18} color={colors.campus} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.courseTitle}>{item.course_name}</Text>
                <Text style={styles.teacher}>{item.teacher_name}</Text>
              </View>
            </View>
            <View style={styles.tagRow}>
              <View style={styles.tag}>
                <Text style={styles.tagText}>{item.department}</Text>
              </View>
              <View style={styles.tag}>
                <Text style={styles.tagText}>Year {item.year}</Text>
              </View>
              <View style={styles.tag}>
                <Text style={styles.tagText}>{item.class_section}</Text>
              </View>
            </View>
          </View>
        </Animated.View>
      )}
      ListEmptyComponent={
        <EmptyState icon="book-outline" title="No courses yet" subtitle="Your class rep may still be adding courses for this semester." />
      }
    />
  );
}

function BookingsList() {
  const { user } = useAuth();
  const [rows, setRows] = useState<BookingRow[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    try { const d = await apiFetch<{ bookings: BookingRow[] }>('/bookings/mine'); setRows(d.bookings); } catch { setRows([]); }
  }, [user]);

  useFocusEffect(useCallback(() => { load().catch(() => {}); }, [load]));
  async function onRefresh() { setRefreshing(true); try { await load(); } finally { setRefreshing(false); } }

  async function cancelBooking(id: string) {
    Alert.alert('Cancel booking?', 'The room will free up for others.', [
      { text: 'No', style: 'cancel' },
      { text: 'Cancel booking', style: 'destructive', onPress: async () => {
        try { await apiFetch(`/bookings/${id}`, { method: 'DELETE' }); await load(); } catch (e) { Alert.alert('Error', String(e)); }
      }},
    ]);
  }

  return (
    <FlatList
      style={styles.flat}
      contentContainerStyle={styles.list}
      data={rows}
      keyExtractor={(item) => item.id}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.campus} />}
      ListHeaderComponent={<SectionHeader title="My bookings" style={{ marginTop: 0 }} />}
      renderItem={({ item, index }) => (
        <Animated.View entering={enterFromBottom(index)}>
          <View style={styles.card}>
            <View style={styles.courseHeader}>
              <View style={[styles.courseIcon, { backgroundColor: colors.accentMuted }]}>
                <Ionicons name="calendar" size={18} color={colors.accent} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.courseTitle}>{item.course_name}</Text>
                <Text style={styles.teacher}>{item.building_name} · {item.room_number}</Text>
              </View>
            </View>
            <Text style={styles.bookTime}>{formatDateTime(item.start_time)} → {formatDateTime(item.end_time)}</Text>
            {item.next_booking_preference && (
              <Text style={styles.pref}>Same room next slot preferred</Text>
            )}
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
  flat: { flex: 1, backgroundColor: colors.groupedBackground },
  list: { padding: space.lg, paddingBottom: space.xxl, flexGrow: 1 },
  card: {
    backgroundColor: colors.systemBackground,
    padding: space.lg,
    borderRadius: radius.lg,
    marginBottom: space.md,
    ...shadows.card,
  },
  courseHeader: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  courseIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.campusMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  courseTitle: { ...type.headline, color: colors.label },
  teacher: { ...type.subhead, color: colors.secondaryLabel, marginTop: 2 },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs, marginTop: space.sm },
  tag: { backgroundColor: colors.fill, paddingHorizontal: space.sm, paddingVertical: 3, borderRadius: radius.pill },
  tagText: { ...type.caption2, color: colors.secondaryLabel, fontWeight: '500' },
  bookTime: { ...type.footnote, color: colors.secondaryLabel, marginTop: space.sm },
  pref: { ...type.caption2, color: colors.tertiaryLabel, marginTop: space.xs, fontStyle: 'italic' },
  cancelBtn: { alignSelf: 'flex-start', marginTop: space.md, paddingVertical: space.xs },
  cancelTxt: { ...type.subhead, color: colors.destructive, fontWeight: '600' },
  groupedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: space.lg,
    gap: space.sm,
    minHeight: 44,
  },
  groupedRowLabel: { ...type.body, color: colors.label, flex: 1 },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.separator, marginLeft: space.lg + 20 + space.sm },
});
