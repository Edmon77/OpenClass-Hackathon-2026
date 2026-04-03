import { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  Alert,
  Modal,
  Platform,
  Switch,
} from 'react-native';
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { useLocalSearchParams, useRouter, useFocusEffect, Stack } from 'expo-router';
import Animated from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/src/context/AuthContext';
import { usePolicy } from '@/src/context/PolicyContext';
import { scheduleRoomNeededAlert } from '@/src/lib/localNotifications';
import { apiFetch } from '@/src/api/client';
import { isApiConfigured } from '@/src/api/config';
import {
  getRoomUiState,
  getNextBooking,
  getCurrentBooking,
  getTemporaryUseCutoffIso,
  type BookingRow,
} from '@/src/domain/roomState';
import { formatDateTime } from '@/src/lib/time';
import { buildRoomQrPayload } from '@/src/constants/qr';
import { useRoomAlertSubscription } from '@/src/hooks/useRoomAlertSubscription';
import { ScheduleStrip } from '@/src/components/ui/ScheduleStrip';
import { PrimaryButton } from '@/src/components/ui/PrimaryButton';
import { SecondaryButton } from '@/src/components/ui/SecondaryButton';
import { SectionHeader } from '@/src/components/ui/SectionHeader';
import { EmptyState } from '@/src/components/ui/EmptyState';
import { enterFade, PRESS_SCALE } from '@/src/theme/motion';
import { colors, radius, space, shadows, type } from '@/src/theme/tokens';

type CourseOpt = { id: string; course_name: string; department: string; year: number; class_section: string };
type Bk = BookingRow & { course_name?: string; course_id?: string; event_type?: string };

const ALL_EVENT_TYPES = ['lecture', 'exam', 'tutor', 'defense', 'lab', 'presentation'] as const;
type EvType = (typeof ALL_EVENT_TYPES)[number];
const TEACHER_EVENTS: EvType[] = ['lecture', 'tutor', 'exam', 'lab', 'presentation'];
const CR_EVENTS: EvType[] = ['lecture', 'presentation', 'lab'];

const EVENT_LABELS: Record<EvType, string> = {
  lecture: 'Lecture',
  exam: 'Exam',
  tutor: 'Tutor',
  defense: 'Defense',
  lab: 'LAB',
  presentation: 'Presentation',
};

function getAllowedEventTypes(role?: string): EvType[] {
  if (role === 'admin') return [...ALL_EVENT_TYPES];
  if (role === 'teacher') return TEACHER_EVENTS;
  return CR_EVENTS;
}

function heroConfig(ui: 'green' | 'yellow' | 'red') {
  if (ui === 'green') return { accent: colors.statusFree, title: 'Available', sub: 'Open for use', icon: 'checkmark-circle' as const };
  if (ui === 'yellow') return { accent: colors.statusSoon, title: 'Class soon', sub: 'Temporary use until cutoff', icon: 'time' as const };
  return { accent: colors.statusBusy, title: 'In session', sub: 'Reserved for class', icon: 'lock-closed' as const };
}

export default function RoomDetailScreen() {
  const rawRoomId = useLocalSearchParams<{ roomId: string | string[] }>().roomId;
  const roomId = useMemo(
    () => (Array.isArray(rawRoomId) ? rawRoomId[0] : rawRoomId) as string | undefined,
    [rawRoomId]
  );
  const router = useRouter();
  const { user } = useAuth();
  const { cutoffMinutes } = usePolicy();
  const { alert, persistAfterSubscribe, cancel, refresh } = useRoomAlertSubscription(roomId);

  const [roomNum, setRoomNum] = useState('');
  const [building, setBuilding] = useState('');
  const [floor, setFloor] = useState(0);
  const [capacity, setCapacity] = useState(0);
  const [equipment, setEquipment] = useState<string[]>([]);
  const [bookings, setBookings] = useState<Bk[]>([]);
  const [courses, setCourses] = useState<CourseOpt[]>([]);
  const [canBook, setCanBook] = useState(false);
  const [modal, setModal] = useState(false);
  const [courseId, setCourseId] = useState<string | null>(null);
  const [start, setStart] = useState(new Date());
  const [end, setEnd] = useState(new Date(Date.now() + 2 * 3600000));
  const [showStart, setShowStart] = useState(false);
  const [showEnd, setShowEnd] = useState(false);
  const [eventType, setEventType] = useState<EvType>('lecture');
  const [preferNextSlot, setPreferNextSlot] = useState(false);
  const [serverAlertId, setServerAlertId] = useState<string | null>(null);
  const [serverAlertExpires, setServerAlertExpires] = useState<number | null>(null);

  const load = useCallback(async () => {
    if (!isApiConfigured() || !roomId) return;
    const data = await apiFetch<{
      room: { room_number: string; floor_index: number; capacity: number; equipment_json: string | null; building_name: string };
      bookings: Bk[];
    }>(`/rooms/${roomId}`);

    const r = data.room;
    setRoomNum(r.room_number);
    setFloor(r.floor_index);
    setCapacity(r.capacity);
    setBuilding(r.building_name);
    try { setEquipment(r.equipment_json ? JSON.parse(r.equipment_json) : []); } catch { setEquipment([]); }
    setBookings(data.bookings);

    let list: CourseOpt[] = [];
    try {
      const cdata = await apiFetch<{ courses: CourseOpt[] }>('/courses/bookable');
      list = cdata.courses;
      setCanBook(list.length > 0 && (user?.role === 'teacher' || user?.role === 'student' || user?.role === 'admin'));
    } catch { setCanBook(false); }
    setCourses(list);
    setCourseId((prev) => {
      if (list.length === 0) return null;
      if (prev && list.some((x) => x.id === prev)) return prev;
      return list[0].id;
    });

    try {
      const sub = await apiFetch<{ subscriptions: { id: string; room_id: string; expires_at: string }[] }>('/room-alerts');
      const hit = sub.subscriptions.find((s) => s.room_id === roomId);
      setServerAlertId(hit?.id ?? null);
      setServerAlertExpires(hit ? new Date(hit.expires_at).getTime() : null);
    } catch { setServerAlertId(null); setServerAlertExpires(null); }
  }, [roomId, user?.role]);

  useFocusEffect(useCallback(() => { load().catch(() => {}); refresh(); }, [load, refresh]));

  const now = new Date();
  const mapped = bookings.map((b) => ({ id: b.id, start_time: b.start_time, end_time: b.end_time, status: b.status }));
  const ui = getRoomUiState(now, mapped);
  const next = getNextBooking(mapped);
  const current = getCurrentBooking(mapped);
  const hero = heroConfig(ui);
  const cutoffIso = next ? getTemporaryUseCutoffIso(next.start_time, cutoffMinutes) : null;
  const alertExpiresMs = alert?.expiresAt ?? serverAlertExpires ?? null;

  async function openDatePicker(field: 'start' | 'end') {
    if (Platform.OS === 'android') {
      const current = field === 'start' ? start : end;
      try {
        const { action, year, month, day } = await (DateTimePickerAndroid as any).open({ value: current, mode: 'date' });
        if (action === 'dismissedAction') return;
        const { action: ta, hours, minutes } = await (DateTimePickerAndroid as any).open({ value: current, mode: 'time', is24Hour: true });
        if (ta === 'dismissedAction') return;
        const picked = new Date(year, month, day, hours, minutes);
        if (field === 'start') setStart(picked); else setEnd(picked);
      } catch { /* user cancelled */ }
    } else {
      if (field === 'start') setShowStart(!showStart); else setShowEnd(!showEnd);
    }
  }

  async function onCreateBooking() {
    if (!user || !courseId) return;
    try {
      await apiFetch('/bookings', { method: 'POST', json: { roomId, courseId, eventType, startTime: start.toISOString(), endTime: end.toISOString(), nextBookingPreference: preferNextSlot } });
      setModal(false);
      await load();
      Alert.alert('Booked', 'Room booking saved.');
    } catch (e) { Alert.alert('Error', String(e)); }
  }

  async function onCancelBooking(bid: string) {
    try { await apiFetch(`/bookings/${bid}`, { method: 'DELETE' }); await load(); } catch (e) { Alert.alert('Error', String(e)); }
  }

  function canCancelBooking(row: Bk): boolean {
    if (!user) return false;
    if (user.role === 'admin') return true;
    if (!row.course_id) return false;
    return courses.some((c) => c.id === row.course_id);
  }

  async function subscribeRoomAlert() {
    if (!user) return;
    const cm = cutoffMinutes;
    const nextBk = bookings.filter((b) => b.status === 'booked' && new Date(b.start_time) > new Date()).sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime())[0];
    try {
      const created = await apiFetch<{ subscription: { id: string; expires_at: string } }>('/room-alerts', { method: 'POST', json: { roomId, notifyBeforeMinutes: cm } });
      setServerAlertId(created.subscription.id);
      setServerAlertExpires(new Date(created.subscription.expires_at).getTime());
      await persistAfterSubscribe();
      if (nextBk) {
        const triggerAt = new Date(new Date(nextBk.start_time));
        triggerAt.setMinutes(triggerAt.getMinutes() - cm);
        await scheduleRoomNeededAlert(roomNum, triggerAt, cm);
        Alert.alert('Alert active', 'Local reminder + server subscription (2h).');
      } else {
        Alert.alert('Alert active', 'No upcoming booking. Subscription expires in 2h.');
      }
    } catch (e) { Alert.alert('Error', String(e)); }
  }

  async function cancelRoomAlert() {
    try { if (serverAlertId) { await apiFetch(`/room-alerts/${serverAlertId}`, { method: 'DELETE' }); setServerAlertId(null); setServerAlertExpires(null); } } catch {}
    await cancel();
  }

  if (!isApiConfigured()) return <EmptyState icon="cloud-offline-outline" title="Configure API URL" />;

  return (
    <>
      <Stack.Screen options={{ title: roomNum || 'Room' }} />
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollPad}>
        {/* Hero with accent stripe */}
        <Animated.View entering={enterFade(400)} style={styles.heroCard}>
          <View style={[styles.heroStripe, { backgroundColor: hero.accent }]} />
          <View style={styles.heroBody}>
            <View style={[styles.heroIconCircle, { backgroundColor: hero.accent + '22' }]}>
              <Ionicons name={hero.icon} size={28} color={hero.accent} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.heroTitle}>{hero.title}</Text>
              <Text style={styles.heroSub}>{hero.sub}</Text>
            </View>
          </View>
          <Text style={styles.heroRoom}>{roomNum || '…'}</Text>
        </Animated.View>

        {/* Info chips */}
        <View style={styles.chipRow}>
          <View style={styles.infoChip}>
            <Ionicons name="business-outline" size={14} color={colors.secondaryLabel} />
            <Text style={styles.chipText}>{building}</Text>
          </View>
          <View style={styles.infoChip}>
            <Ionicons name="layers-outline" size={14} color={colors.secondaryLabel} />
            <Text style={styles.chipText}>Floor {floor === 0 ? 'G' : floor}</Text>
          </View>
          <View style={styles.infoChip}>
            <Ionicons name="people-outline" size={14} color={colors.secondaryLabel} />
            <Text style={styles.chipText}>{capacity} seats</Text>
          </View>
          {equipment.map((e, i) => (
            <View key={i} style={styles.infoChip}>
              <Ionicons name="construct-outline" size={14} color={colors.secondaryLabel} />
              <Text style={styles.chipText}>{e}</Text>
            </View>
          ))}
        </View>

        {/* Status callouts */}
        {next && ui === 'yellow' && cutoffIso && (
          <View style={styles.callout}>
            <Ionicons name="time-outline" size={18} color={colors.accent} />
            <View style={{ flex: 1 }}>
              <Text style={styles.calloutTitle}>Temporary use</Text>
              <Text style={styles.calloutBody}>Until {formatDateTime(cutoffIso)}</Text>
            </View>
          </View>
        )}
        {current && (
          <View style={[styles.callout, { backgroundColor: 'rgba(255,69,58,0.08)' }]}>
            <Ionicons name="lock-closed-outline" size={18} color={colors.destructive} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.calloutTitle, { color: colors.destructive }]}>In session</Text>
              <Text style={styles.calloutBody}>Until {formatDateTime(current.end_time)}</Text>
            </View>
          </View>
        )}

        {/* Alert active */}
        {(alert || serverAlertId) && (
          <View style={styles.alertBanner}>
            <Ionicons name="notifications" size={16} color={colors.campus} />
            <Text style={styles.alertText}>
              Alert active{alertExpiresMs != null ? ` · expires ${formatDateTime(new Date(alertExpiresMs).toISOString())}` : ''}
            </Text>
            <Pressable onPress={cancelRoomAlert} hitSlop={8}>
              <Text style={styles.alertCancel}>Cancel</Text>
            </Pressable>
          </View>
        )}

        {/* Actions */}
        <View style={styles.actionsRow}>
          {canBook && (
            <PrimaryButton title="Book this room" onPress={() => setModal(true)} style={{ flex: 1 }} />
          )}
          <SecondaryButton title="Notify me" onPress={subscribeRoomAlert} style={{ flex: canBook ? 1 : undefined }} />
        </View>

        {/* Schedule strip */}
        <SectionHeader title="Today's schedule" />
        <View style={styles.stripCard}>
          <ScheduleStrip
            blocks={bookings.filter((b) => b.status === 'booked').map((b) => ({ id: b.id, start_time: b.start_time, end_time: b.end_time, status: b.status, label: b.course_name }))}
          />
        </View>

        {/* Bookings list */}
        <SectionHeader title="Bookings" />
        {bookings.filter((b) => b.status === 'booked').map((b) => (
          <View key={b.id} style={styles.bookingCard}>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.xs }}>
                <Text style={styles.bookCourse}>{b.course_name ?? 'Course'}</Text>
                {b.event_type && (
                  <View style={styles.evTag}>
                    <Text style={styles.evTagText}>{EVENT_LABELS[b.event_type as EvType] ?? b.event_type}</Text>
                  </View>
                )}
              </View>
              <Text style={styles.bookTime}>{formatDateTime(b.start_time)} → {formatDateTime(b.end_time)}</Text>
            </View>
            {canCancelBooking(b) && (
              <Pressable onPress={() => onCancelBooking(b.id)} hitSlop={8}>
                <Text style={styles.cancelLink}>Cancel</Text>
              </Pressable>
            )}
          </View>
        ))}
        {bookings.filter((b) => b.status === 'booked').length === 0 && (
          <Text style={styles.emptyNote}>No bookings scheduled.</Text>
        )}

        {/* QR / Scan */}
        <SectionHeader title="Room link" />
        <View style={styles.qrCard}>
          <Text selectable style={styles.qrText}>{buildRoomQrPayload(roomId ?? '')}</Text>
        </View>
        <Pressable style={styles.ghostBtn} onPress={() => router.push('/(app)/(tabs)/(explore)/scan')}>
          <Ionicons name="qr-code-outline" size={18} color={colors.accent} />
          <Text style={styles.ghostBtnText}>Open scanner</Text>
        </Pressable>
      </ScrollView>

      {/* Booking modal (half-sheet) */}
      <Modal visible={modal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <Pressable style={styles.modalDismiss} onPress={() => setModal(false)} />
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>New booking</Text>

            <SectionHeader title="Course" style={{ marginTop: space.sm }} />
            {courses.map((c) => (
              <Pressable key={c.id} onPress={() => setCourseId(c.id)} style={[styles.courseOpt, courseId === c.id && styles.courseOptOn]}>
                <Text style={[styles.courseOptText, courseId === c.id && { color: colors.campus }]}>{c.course_name}</Text>
              </Pressable>
            ))}

            <SectionHeader title="Event type" />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: space.sm }}>
              <View style={styles.evRow}>
                {getAllowedEventTypes(user?.role).map((ev) => (
                  <Pressable key={ev} onPress={() => setEventType(ev)} style={[styles.evPill, eventType === ev && styles.evPillOn]}>
                    <Text style={[styles.evPillText, eventType === ev && styles.evPillTextOn]}>{EVENT_LABELS[ev]}</Text>
                  </Pressable>
                ))}
              </View>
            </ScrollView>

            <SectionHeader title="Start" />
            <Pressable onPress={() => openDatePicker('start')} style={styles.datePicker}>
              <Text style={styles.dateText}>{start.toLocaleString()}</Text>
            </Pressable>
            {showStart && Platform.OS === 'ios' && (
              <DateTimePicker value={start} mode="datetime" display="spinner" onChange={(_, d) => { if (d) setStart(d); }} />
            )}

            <SectionHeader title="End" />
            <Pressable onPress={() => openDatePicker('end')} style={styles.datePicker}>
              <Text style={styles.dateText}>{end.toLocaleString()}</Text>
            </Pressable>
            {showEnd && Platform.OS === 'ios' && (
              <DateTimePicker value={end} mode="datetime" display="spinner" onChange={(_, d) => { if (d) setEnd(d); }} />
            )}

            <View style={styles.switchRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.switchLabel}>Prefer same room next slot</Text>
                <Text style={styles.switchHint}>Hint only — still checks conflicts.</Text>
              </View>
              <Switch value={preferNextSlot} onValueChange={setPreferNextSlot} trackColor={{ true: colors.campus }} />
            </View>

            <View style={styles.modalActions}>
              <Pressable onPress={() => setModal(false)}>
                <Text style={styles.cancelLink}>Close</Text>
              </Pressable>
              <PrimaryButton title="Save booking" onPress={onCreateBooking} style={{ flex: 1, marginLeft: space.md }} />
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: colors.groupedBackground },
  scrollPad: { paddingBottom: 48 },

  heroCard: {
    marginHorizontal: space.lg,
    marginTop: space.md,
    backgroundColor: colors.systemBackground,
    borderRadius: radius.xl,
    padding: space.lg,
    overflow: 'hidden',
    ...shadows.card,
  },
  heroStripe: { position: 'absolute', top: 0, left: 0, right: 0, height: 5, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl },
  heroBody: { flexDirection: 'row', alignItems: 'center', gap: space.md, marginTop: space.xs },
  heroIconCircle: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  heroTitle: { ...type.title2, color: colors.label },
  heroSub: { ...type.subhead, color: colors.secondaryLabel, marginTop: 2 },
  heroRoom: { ...type.largeTitle, color: colors.label, marginTop: space.md },

  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginHorizontal: space.lg, marginTop: space.md },
  infoChip: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.fill, paddingHorizontal: space.sm, paddingVertical: 5, borderRadius: radius.pill },
  chipText: { ...type.caption1, color: colors.secondaryLabel },

  callout: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    marginHorizontal: space.lg,
    marginTop: space.md,
    padding: space.md,
    backgroundColor: colors.accentMuted,
    borderRadius: radius.md,
  },
  calloutTitle: { ...type.subhead, fontWeight: '700', color: colors.accent },
  calloutBody: { ...type.footnote, color: colors.secondaryLabel, marginTop: 2 },

  alertBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    marginHorizontal: space.lg,
    marginTop: space.md,
    padding: space.md,
    backgroundColor: colors.campusMuted,
    borderRadius: radius.md,
  },
  alertText: { ...type.caption1, color: colors.campus, flex: 1, fontWeight: '600' },
  alertCancel: { ...type.subhead, color: colors.accent, fontWeight: '600' },

  actionsRow: { flexDirection: 'row', gap: space.sm, marginHorizontal: space.lg, marginTop: space.lg },

  stripCard: {
    marginHorizontal: space.lg,
    backgroundColor: colors.systemBackground,
    borderRadius: radius.lg,
    padding: space.md,
    paddingBottom: space.xl,
    ...shadows.card,
  },

  bookingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: space.lg,
    paddingVertical: space.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.separator,
  },
  bookCourse: { ...type.headline, color: colors.label },
  bookTime: { ...type.footnote, color: colors.secondaryLabel, marginTop: 2 },
  cancelLink: { ...type.headline, color: colors.destructive },
  emptyNote: { ...type.body, color: colors.secondaryLabel, marginHorizontal: space.lg, marginTop: space.sm },

  qrCard: {
    marginHorizontal: space.lg,
    padding: space.md,
    backgroundColor: colors.systemBackground,
    borderRadius: radius.md,
    ...shadows.card,
  },
  qrText: { ...type.caption1, color: colors.secondaryLabel },
  ghostBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.xs,
    marginHorizontal: space.lg,
    marginTop: space.sm,
    padding: space.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.accent,
  },
  ghostBtnText: { ...type.headline, color: colors.accent },

  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: colors.overlay },
  modalDismiss: { flex: 1 },
  modalSheet: {
    backgroundColor: colors.systemBackground,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: space.xl,
    paddingBottom: 40,
    maxHeight: '90%',
  },
  modalHandle: { width: 40, height: 5, borderRadius: 3, backgroundColor: colors.fill, alignSelf: 'center', marginBottom: space.md },
  modalTitle: { ...type.title2, color: colors.label },
  evRow: { flexDirection: 'row', gap: space.xs },
  evPill: { paddingHorizontal: space.md, paddingVertical: space.xs, borderRadius: radius.pill, backgroundColor: colors.fill },
  evPillOn: { backgroundColor: colors.campus },
  evPillText: { ...type.subhead, color: colors.label },
  evPillTextOn: { ...type.subhead, color: '#fff', fontWeight: '600' },
  evTag: { backgroundColor: colors.accentMuted, paddingHorizontal: 6, paddingVertical: 2, borderRadius: radius.sm },
  evTagText: { ...type.caption2, color: colors.accent, fontWeight: '600' },
  courseOpt: {
    padding: space.md,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.separator,
    marginBottom: space.xs,
  },
  courseOptOn: { borderColor: colors.campus, backgroundColor: colors.campusMuted },
  courseOptText: { ...type.body, color: colors.label },
  datePicker: {
    padding: space.md,
    backgroundColor: colors.secondarySystemBackground,
    borderRadius: radius.md,
  },
  dateText: { ...type.body, color: colors.label },
  switchRow: { flexDirection: 'row', alignItems: 'center', marginTop: space.lg, gap: space.md },
  switchLabel: { ...type.subhead, color: colors.label, fontWeight: '600' },
  switchHint: { ...type.caption2, color: colors.tertiaryLabel, marginTop: 4 },
  modalActions: { flexDirection: 'row', alignItems: 'center', marginTop: space.xl },
});
