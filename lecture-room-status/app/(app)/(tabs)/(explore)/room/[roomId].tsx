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
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
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
import { DayPager } from '@/src/components/ui/DayPager';
import type { TimelineBlock } from '@/src/components/ui/DayTimeline';
import { PrimaryButton } from '@/src/components/ui/PrimaryButton';
import { SectionHeader } from '@/src/components/ui/SectionHeader';
import { EmptyState } from '@/src/components/ui/EmptyState';
import { enterFade } from '@/src/theme/motion';
import { colors, radius, space, shadows, type } from '@/src/theme/tokens';

type CourseOpt = { id: string; course_name: string; department: string; year: number; class_section: string };
type Bk = BookingRow & {
  course_name?: string;
  course_id?: string;
  course_offering_id?: string;
  event_type?: string;
};

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

const SLOT_STEP_MS = 15 * 60 * 1000;
const INITIAL_END_AFTER_START_MS = 30 * 60 * 1000;

function roundUpToStep(ms: number, step: number): number {
  return Math.ceil(ms / step) * step;
}

function normalizeBookedIntervals(bookedBlocks: { start_time: string; end_time: string; status: string }[]) {
  return bookedBlocks
    .filter((b) => String(b.status).toLowerCase() === 'booked')
    .map((b) => ({ s: new Date(b.start_time).getTime(), e: new Date(b.end_time).getTime() }))
    .filter((x) => Number.isFinite(x.s) && Number.isFinite(x.e))
    .sort((a, b) => a.s - b.s);
}

function suggestNextStart(bookedBlocks: { start_time: string; end_time: string; status: string }[]): Date {
  const intervals = normalizeBookedIntervals(bookedBlocks);
  let t = roundUpToStep(Date.now() + 5 * 60 * 1000, SLOT_STEP_MS);
  for (let guard = 0; guard < 5000; guard++) {
    const inside = intervals.find((iv) => t >= iv.s && t < iv.e);
    if (!inside) return new Date(t);
    t = roundUpToStep(inside.e, SLOT_STEP_MS);
  }
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(9, 0, 0, 0);
  return d;
}

function mergeDateKeepingTime(base: Date, newDate: Date): Date {
  const d = new Date(base);
  d.setFullYear(newDate.getFullYear(), newDate.getMonth(), newDate.getDate());
  return d;
}

function mergeTimeKeepingDate(base: Date, newTime: Date): Date {
  const d = new Date(base);
  d.setHours(newTime.getHours(), newTime.getMinutes(), 0, 0);
  return d;
}

function minBookingStartMs(): number {
  return roundUpToStep(Date.now() + 60 * 1000, SLOT_STEP_MS);
}

function clampStartNotInPast(d: Date): Date {
  const minMs = minBookingStartMs();
  return d.getTime() >= minMs ? d : new Date(minMs);
}

function bookingOverlapsExisting(startMs: number, endMs: number, list: { start_time: string; end_time: string; status: string }[]): boolean {
  return list.some(
    (b) =>
      String(b.status).toLowerCase() === 'booked' &&
      new Date(b.start_time).getTime() < endMs &&
      new Date(b.end_time).getTime() > startMs
  );
}

function formatBookingSummary(start: Date, end: Date): string {
  const dateStr = start.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
  const startStr = start.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  const endStr = end.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  return `${dateStr}, ${startStr} – ${endStr}`;
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
  const [courseOfferingId, setCourseOfferingId] = useState<string | null>(null);
  const [start, setStart] = useState(() => new Date(roundUpToStep(Date.now() + 5 * 60 * 1000, SLOT_STEP_MS)));
  const [end, setEnd] = useState(() => new Date(roundUpToStep(Date.now() + 5 * 60 * 1000, SLOT_STEP_MS) + INITIAL_END_AFTER_START_MS));
  const [eventType, setEventType] = useState<EvType>('lecture');
  const [preferNextSlot, setPreferNextSlot] = useState(false);
  const [serverAlertId, setServerAlertId] = useState<string | null>(null);
  const [serverAlertExpires, setServerAlertExpires] = useState<number | null>(null);

  // Android: tap-to-open pickers
  const [showStartDatePicker, setShowStartDatePicker] = useState(false);
  const [showStartTimePicker, setShowStartTimePicker] = useState(false);
  const [showEndDatePicker, setShowEndDatePicker] = useState(false);
  const [showEndTimePicker, setShowEndTimePicker] = useState(false);

  const load = useCallback(async (): Promise<Bk[] | null> => {
    if (!isApiConfigured() || !roomId) return null;
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
    setCourseOfferingId((prev) => {
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

    return data.bookings;
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

  const applyStart = useCallback((next: Date) => {
    const c = clampStartNotInPast(next);
    setStart(c);
    setEnd((e) => (e.getTime() <= c.getTime() ? new Date(c.getTime() + INITIAL_END_AFTER_START_MS) : e));
  }, []);

  const openBookingModal = useCallback(async () => {
    const fresh = await load().catch(() => null);
    const list = fresh ?? bookings;
    const booked = list.filter((b) => String(b.status).toLowerCase() === 'booked');
    const s = clampStartNotInPast(suggestNextStart(booked));
    setStart(s);
    setEnd(new Date(s.getTime() + INITIAL_END_AFTER_START_MS));
    setModal(true);
  }, [load, bookings]);

  const applyNextFreeSlot = useCallback(() => {
    const booked = bookings.filter((b) => String(b.status).toLowerCase() === 'booked');
    const s = clampStartNotInPast(suggestNextStart(booked));
    const dur = Math.max(end.getTime() - start.getTime(), INITIAL_END_AFTER_START_MS);
    setStart(s);
    setEnd(new Date(s.getTime() + dur));
  }, [bookings, end, start]);

  async function onCreateBooking() {
    if (!user || !courseOfferingId) return;
    const rid = typeof roomId === 'string' ? roomId.trim() : '';
    if (!rid) { Alert.alert('Error', 'Missing room id.'); return; }
    const sMs = start.getTime();
    const eMs = end.getTime();
    if (!Number.isFinite(sMs) || !Number.isFinite(eMs) || eMs <= sMs) {
      Alert.alert('Invalid times', 'End time must be after start time.');
      return;
    }
    if (sMs < Date.now()) {
      Alert.alert('Invalid start', 'Choose a start time in the future.');
      return;
    }
    const booked = bookings.filter((b) => String(b.status).toLowerCase() === 'booked');
    if (bookingOverlapsExisting(sMs, eMs, booked)) {
      Alert.alert('Time is taken', 'This overlaps another booking. Tap "Next free" or change your times.');
      return;
    }
    try {
      await apiFetch('/bookings', {
        method: 'POST',
        json: {
          roomId: rid,
          courseOfferingId,
          eventType,
          startTime: start.toISOString(),
          endTime: end.toISOString(),
          nextBookingPreference: preferNextSlot,
        },
      });
      setModal(false);
      await load();
      Alert.alert('Booked', 'Room booking saved.');
    } catch (e) { Alert.alert('Error', String(e)); }
  }

  async function onCancelBooking(bid: string) {
    Alert.alert('Cancel booking?', 'This will free the room for that time slot.', [
      { text: 'Keep', style: 'cancel' },
      {
        text: 'Cancel booking',
        style: 'destructive',
        onPress: async () => {
          try { await apiFetch(`/bookings/${bid}`, { method: 'DELETE' }); await load(); } catch (e) { Alert.alert('Error', String(e)); }
        },
      },
    ]);
  }

  const canCancelBooking = useCallback(
    (row: Bk | TimelineBlock): boolean => {
      if (!user) return false;
      if (user.role === 'admin') return true;
      const oid = (row as Bk).course_offering_id;
      if (!oid) return false;
      return courses.some((c) => c.id === oid);
    },
    [user, courses]
  );

  async function subscribeRoomAlert() {
    if (!user) return;
    const rid = typeof roomId === 'string' ? roomId.trim() : '';
    if (!rid) { Alert.alert('Error', 'Missing room id.'); return; }
    const cmRaw = Number(cutoffMinutes);
    const cm = Number.isFinite(cmRaw) ? Math.min(120, Math.max(1, Math.round(cmRaw))) : 10;
    const fresh = await load();
    if (!fresh) { Alert.alert('Error', 'Could not load this room\'s schedule.'); return; }
    const nowMs = Date.now();
    const nextBk = fresh
      .filter((b) => b.status === 'booked' && new Date(b.start_time).getTime() > nowMs)
      .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime())[0];
    try {
      const created = await apiFetch<{ subscription: { id: string; expires_at: string } }>('/room-alerts', {
        method: 'POST',
        json: { roomId: rid, notifyBeforeMinutes: cm },
      });
      setServerAlertId(created.subscription.id);
      setServerAlertExpires(new Date(created.subscription.expires_at).getTime());
      await persistAfterSubscribe();
      if (nextBk) {
        const triggerAt = new Date(new Date(nextBk.start_time));
        triggerAt.setMinutes(triggerAt.getMinutes() - cm);
        await scheduleRoomNeededAlert(roomNum, triggerAt, cm);
        Alert.alert('Alert active', 'Local reminder + server subscription (2h).');
      } else {
        Alert.alert('Alert active', 'Subscribed for 2h on the server.');
      }
    } catch (e) { Alert.alert('Error', String(e)); }
  }

  async function cancelRoomAlert() {
    try { if (serverAlertId) { await apiFetch(`/room-alerts/${serverAlertId}`, { method: 'DELETE' }); setServerAlertId(null); setServerAlertExpires(null); } } catch {}
    await cancel();
  }

  function askAssistantAboutRoom() {
    const hint = roomNum
      ? `Summarize this room (${roomNum}) and suggest the next best booking option for me.`
      : 'Summarize this room and suggest the next best booking option for me.';
    router.push({ pathname: '/(app)/(tabs)/(assistant)', params: { q: hint } });
  }

  const timelineBlocks: TimelineBlock[] = useMemo(
    () =>
      bookings.map((b) => ({
        id: b.id,
        start_time: b.start_time,
        end_time: b.end_time,
        status: b.status,
        label: b.course_name,
        event_type: b.event_type,
        course_offering_id: b.course_offering_id,
      })),
    [bookings]
  );

  if (!isApiConfigured()) return <EmptyState icon="cloud-offline-outline" title="Configure API URL" />;

  const evChoices = getAllowedEventTypes(user?.role);

  return (
    <>
      <Stack.Screen options={{ title: roomNum || 'Room' }} />
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollPad}>
        {/* ─── Hero Card ─── */}
        <Animated.View entering={enterFade(400)} style={styles.heroCard}>
          <View style={[styles.heroStripe, { backgroundColor: hero.accent }]} />
          <View style={styles.heroBody}>
            <View style={[styles.heroIconCircle, { backgroundColor: hero.accent + '22' }]}>
              <Ionicons name={hero.icon} size={24} color={hero.accent} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.heroTitle}>{hero.title}</Text>
              <Text style={styles.heroSub}>{hero.sub}</Text>
            </View>
          </View>
          <Text style={styles.heroRoom}>{roomNum || '…'}</Text>

          {/* Info chips merged into hero */}
          <View style={styles.chipRow}>
            <View style={styles.infoChip}>
              <Ionicons name="business-outline" size={12} color={colors.secondaryLabel} />
              <Text style={styles.chipText}>{building}</Text>
            </View>
            <View style={styles.infoChip}>
              <Ionicons name="layers-outline" size={12} color={colors.secondaryLabel} />
              <Text style={styles.chipText}>Floor {floor === 0 ? 'G' : floor}</Text>
            </View>
            <View style={styles.infoChip}>
              <Ionicons name="people-outline" size={12} color={colors.secondaryLabel} />
              <Text style={styles.chipText}>{capacity} seats</Text>
            </View>
            {equipment.map((e, i) => (
              <View key={i} style={styles.infoChip}>
                <Ionicons name="construct-outline" size={12} color={colors.secondaryLabel} />
                <Text style={styles.chipText}>{e}</Text>
              </View>
            ))}
          </View>
        </Animated.View>

        {/* ─── Status callouts ─── */}
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

        {/* ─── Alert banner ─── */}
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

        {/* ─── Action bar (icon buttons) ─── */}
        <View style={styles.actionBar}>
          {canBook && (
            <Pressable style={styles.actionBtn} onPress={openBookingModal}>
              <View style={[styles.actionIconWrap, { backgroundColor: colors.campusMuted }]}>
                <Ionicons name="add-circle-outline" size={24} color={colors.campus} />
              </View>
              <Text style={styles.actionLabel}>Book</Text>
            </Pressable>
          )}
          <Pressable style={styles.actionBtn} onPress={subscribeRoomAlert}>
            <View style={[styles.actionIconWrap, { backgroundColor: colors.accentMuted }]}>
              <Ionicons name="notifications-outline" size={22} color={colors.accent} />
            </View>
            <Text style={styles.actionLabel}>Notify</Text>
          </Pressable>
          <Pressable style={styles.actionBtn} onPress={askAssistantAboutRoom}>
            <View style={[styles.actionIconWrap, { backgroundColor: 'rgba(175, 82, 222, 0.12)' }]}>
              <Ionicons name="sparkles-outline" size={22} color="#AF52DE" />
            </View>
            <Text style={styles.actionLabel}>Ask AI</Text>
          </Pressable>
        </View>

        {/* ─── Calendar (DayPager + DayTimeline) ─── */}
        <SectionHeader title="Schedule" />
        <View style={styles.calendarWrap}>
          <DayPager
            blocks={timelineBlocks}
            onCancelBooking={onCancelBooking}
            canCancelBooking={canCancelBooking}
          />
        </View>

        {/* ─── QR / Scan ─── */}
        <SectionHeader title="Room link" />
        <View style={styles.qrCard}>
          <Text selectable style={styles.qrText}>{buildRoomQrPayload(roomId ?? '')}</Text>
        </View>
        <Pressable style={styles.ghostBtn} onPress={() => router.push('/(app)/(tabs)/(explore)/scan')}>
          <Ionicons name="qr-code-outline" size={18} color={colors.accent} />
          <Text style={styles.ghostBtnText}>Open scanner</Text>
        </Pressable>
      </ScrollView>

      {/* ─── Booking modal (half-sheet) ─── */}
      <Modal visible={modal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <Pressable style={styles.modalDismiss} onPress={() => setModal(false)} />
          <View style={styles.modalSheet}>
            <ScrollView
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.modalScrollContent}
              nestedScrollEnabled
            >
              <View style={styles.modalHandle} />
              <Text style={styles.modalTitle}>New booking</Text>

              {/* Time summary */}
              <View style={styles.timeSummaryCard}>
                <Ionicons name="calendar-outline" size={18} color={colors.campus} />
                <Text style={styles.timeSummaryText}>{formatBookingSummary(start, end)}</Text>
              </View>
              <Pressable onPress={applyNextFreeSlot} style={styles.linkChip}>
                <Text style={styles.linkChipText}>Next free slot</Text>
              </Pressable>

              {/* Course */}
              <SectionHeader title="Course" style={{ marginTop: space.sm }} />
              {courses.map((c) => (
                <Pressable key={c.id} onPress={() => setCourseOfferingId(c.id)} style={[styles.courseOpt, courseOfferingId === c.id && styles.courseOptOn]}>
                  <Text style={[styles.courseOptText, courseOfferingId === c.id && { color: colors.campus }]}>{c.course_name}</Text>
                  <Text style={styles.courseOptSub}>{c.department} · Y{c.year} {c.class_section}</Text>
                </Pressable>
              ))}

              {/* Event type */}
              <SectionHeader title="Event type" />
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: space.sm }}>
                <View style={styles.evRow}>
                  {evChoices.map((ev) => (
                    <Pressable key={ev} onPress={() => setEventType(ev)} style={[styles.evPill, eventType === ev && styles.evPillOn]}>
                      <Text style={[styles.evPillText, eventType === ev && styles.evPillTextOn]}>{EVENT_LABELS[ev]}</Text>
                    </Pressable>
                  ))}
                </View>
              </ScrollView>

              {/* Start time */}
              <SectionHeader title="Start" />
              {Platform.OS === 'ios' ? (
                <DateTimePicker
                  value={start}
                  mode="datetime"
                  display="compact"
                  minimumDate={new Date(minBookingStartMs())}
                  accentColor={colors.campus}
                  onChange={(event, d) => {
                    if (event.type === 'dismissed' || !d) return;
                    applyStart(d);
                  }}
                  style={styles.iosCompactPicker}
                />
              ) : (
                <View style={styles.androidPickerRow}>
                  <Pressable style={styles.androidPickerBtn} onPress={() => setShowStartDatePicker(true)}>
                    <Ionicons name="calendar-outline" size={16} color={colors.accent} />
                    <Text style={styles.androidPickerText}>
                      {start.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
                    </Text>
                  </Pressable>
                  <Pressable style={styles.androidPickerBtn} onPress={() => setShowStartTimePicker(true)}>
                    <Ionicons name="time-outline" size={16} color={colors.accent} />
                    <Text style={styles.androidPickerText}>
                      {start.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}
                    </Text>
                  </Pressable>
                  {showStartDatePicker && (
                    <DateTimePicker
                      value={start}
                      mode="date"
                      display="default"
                      minimumDate={new Date(minBookingStartMs())}
                      onChange={(event, d) => {
                        setShowStartDatePicker(false);
                        if (event.type === 'dismissed' || !d) return;
                        setStart((prev) => {
                          const next = clampStartNotInPast(mergeDateKeepingTime(prev, d));
                          setEnd((e) => (e.getTime() <= next.getTime() ? new Date(next.getTime() + INITIAL_END_AFTER_START_MS) : e));
                          return next;
                        });
                      }}
                    />
                  )}
                  {showStartTimePicker && (
                    <DateTimePicker
                      value={start}
                      mode="time"
                      display="default"
                      is24Hour
                      onChange={(event, d) => {
                        setShowStartTimePicker(false);
                        if (event.type === 'dismissed' || !d) return;
                        setStart((prev) => {
                          const next = clampStartNotInPast(mergeTimeKeepingDate(prev, d));
                          setEnd((e) => (e.getTime() <= next.getTime() ? new Date(next.getTime() + INITIAL_END_AFTER_START_MS) : e));
                          return next;
                        });
                      }}
                    />
                  )}
                </View>
              )}

              {/* End time */}
              <SectionHeader title="End" />
              {Platform.OS === 'ios' ? (
                <DateTimePicker
                  value={end}
                  mode="datetime"
                  display="compact"
                  minimumDate={new Date(start.getTime() + 60 * 1000)}
                  accentColor={colors.campus}
                  onChange={(event, d) => {
                    if (event.type === 'dismissed' || !d) return;
                    setEnd(d);
                  }}
                  style={styles.iosCompactPicker}
                />
              ) : (
                <View style={styles.androidPickerRow}>
                  <Pressable style={styles.androidPickerBtn} onPress={() => setShowEndDatePicker(true)}>
                    <Ionicons name="calendar-outline" size={16} color={colors.accent} />
                    <Text style={styles.androidPickerText}>
                      {end.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
                    </Text>
                  </Pressable>
                  <Pressable style={styles.androidPickerBtn} onPress={() => setShowEndTimePicker(true)}>
                    <Ionicons name="time-outline" size={16} color={colors.accent} />
                    <Text style={styles.androidPickerText}>
                      {end.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}
                    </Text>
                  </Pressable>
                  {showEndDatePicker && (
                    <DateTimePicker
                      value={end}
                      mode="date"
                      display="default"
                      minimumDate={new Date(start.getTime())}
                      onChange={(event, d) => {
                        setShowEndDatePicker(false);
                        if (event.type === 'dismissed' || !d) return;
                        setEnd((prev) => mergeDateKeepingTime(prev, d));
                      }}
                    />
                  )}
                  {showEndTimePicker && (
                    <DateTimePicker
                      value={end}
                      mode="time"
                      display="default"
                      is24Hour
                      onChange={(event, d) => {
                        setShowEndTimePicker(false);
                        if (event.type === 'dismissed' || !d) return;
                        setEnd((prev) => mergeTimeKeepingDate(prev, d));
                      }}
                    />
                  )}
                </View>
              )}

              {/* Prefer next slot */}
              <View style={styles.switchRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.switchLabel}>Prefer same room next slot</Text>
                  <Text style={styles.switchHint}>Hint only — still checks conflicts.</Text>
                </View>
                <Switch value={preferNextSlot} onValueChange={setPreferNextSlot} trackColor={{ true: colors.campus }} />
              </View>

              {/* Actions */}
              <View style={styles.modalActions}>
                <Pressable onPress={() => setModal(false)} style={styles.modalCloseBtn}>
                  <Text style={styles.modalCloseText}>Close</Text>
                </Pressable>
                <PrimaryButton title="Save booking" onPress={onCreateBooking} style={{ flex: 1 }} />
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: colors.groupedBackground },
  scrollPad: { paddingBottom: 48 },

  /* Hero */
  heroCard: {
    marginHorizontal: space.lg,
    marginTop: space.md,
    backgroundColor: colors.systemBackground,
    borderRadius: radius.xl,
    padding: space.lg,
    paddingBottom: space.md,
    overflow: 'hidden',
    ...shadows.card,
  },
  heroStripe: { position: 'absolute', top: 0, left: 0, right: 0, height: 4, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl },
  heroBody: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginTop: space.xs },
  heroIconCircle: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  heroTitle: { ...type.headline, color: colors.label },
  heroSub: { ...type.caption1, color: colors.secondaryLabel, marginTop: 1 },
  heroRoom: { ...type.title1, color: colors.label, marginTop: space.sm },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs, marginTop: space.sm },
  infoChip: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: colors.fill, paddingHorizontal: space.xs + 2, paddingVertical: 4, borderRadius: radius.pill },
  chipText: { ...type.caption2, color: colors.secondaryLabel },

  /* Status callouts */
  callout: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    marginHorizontal: space.lg,
    marginTop: space.sm,
    padding: space.md,
    backgroundColor: colors.accentMuted,
    borderRadius: radius.md,
  },
  calloutTitle: { ...type.subhead, fontWeight: '700', color: colors.accent },
  calloutBody: { ...type.footnote, color: colors.secondaryLabel, marginTop: 2 },

  /* Alert banner */
  alertBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    marginHorizontal: space.lg,
    marginTop: space.sm,
    padding: space.md,
    backgroundColor: colors.campusMuted,
    borderRadius: radius.md,
  },
  alertText: { ...type.caption1, color: colors.campus, flex: 1, fontWeight: '600' },
  alertCancel: { ...type.subhead, color: colors.accent, fontWeight: '600' },

  /* Action bar */
  actionBar: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: space.xl,
    marginHorizontal: space.lg,
    marginTop: space.lg,
    marginBottom: space.xs,
  },
  actionBtn: { alignItems: 'center', gap: space.xs },
  actionIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionLabel: { ...type.caption1, fontWeight: '600', color: colors.secondaryLabel },

  /* Calendar */
  calendarWrap: { marginHorizontal: space.lg },

  /* QR */
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

  /* Modal */
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: colors.overlay },
  modalDismiss: { flex: 1 },
  modalSheet: {
    backgroundColor: colors.systemBackground,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingHorizontal: space.xl,
    paddingTop: space.md,
    maxHeight: '90%',
    flexShrink: 1,
  },
  modalHandle: { width: 40, height: 5, borderRadius: 3, backgroundColor: colors.fill, alignSelf: 'center', marginBottom: space.md },
  modalTitle: { ...type.title2, color: colors.label },
  modalScrollContent: { paddingBottom: space.xl },

  timeSummaryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    marginTop: space.md,
    padding: space.md,
    backgroundColor: colors.campusMuted,
    borderRadius: radius.md,
  },
  timeSummaryText: {
    ...type.subhead,
    fontWeight: '600',
    color: colors.campus,
    flex: 1,
  },
  linkChip: { alignSelf: 'flex-start', marginTop: space.sm, paddingVertical: space.xs, paddingHorizontal: space.sm },
  linkChipText: { ...type.subhead, color: colors.campus, fontWeight: '600' },

  evRow: { flexDirection: 'row', gap: space.xs },
  evPill: { paddingHorizontal: space.md, paddingVertical: space.xs, borderRadius: radius.pill, backgroundColor: colors.fill },
  evPillOn: { backgroundColor: colors.campus },
  evPillText: { ...type.subhead, color: colors.label },
  evPillTextOn: { ...type.subhead, color: '#fff', fontWeight: '600' },

  courseOpt: {
    padding: space.md,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.separator,
    marginBottom: space.xs,
  },
  courseOptOn: { borderColor: colors.campus, backgroundColor: colors.campusMuted },
  courseOptText: { ...type.body, color: colors.label },
  courseOptSub: { ...type.caption1, color: colors.secondaryLabel, marginTop: 2 },

  iosCompactPicker: {
    alignSelf: 'flex-start',
    marginBottom: space.sm,
  },

  androidPickerRow: {
    flexDirection: 'row',
    gap: space.sm,
    marginBottom: space.sm,
  },
  androidPickerBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
    padding: space.md,
    backgroundColor: colors.secondarySystemBackground,
    borderRadius: radius.md,
  },
  androidPickerText: {
    ...type.subhead,
    color: colors.label,
  },

  switchRow: { flexDirection: 'row', alignItems: 'center', marginTop: space.lg, gap: space.md },
  switchLabel: { ...type.subhead, color: colors.label, fontWeight: '600' },
  switchHint: { ...type.caption2, color: colors.tertiaryLabel, marginTop: 4 },

  modalActions: { flexDirection: 'row', alignItems: 'center', marginTop: space.xl, gap: space.md },
  modalCloseBtn: {
    paddingVertical: space.md,
    paddingHorizontal: space.lg,
  },
  modalCloseText: { ...type.headline, color: colors.secondaryLabel },
});
