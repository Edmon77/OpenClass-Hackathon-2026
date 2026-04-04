import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet, LayoutAnimation, Platform, UIManager } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, space, type as typography, shadows } from '@/src/theme/tokens';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export type TimelineBlock = {
  id: string;
  start_time: string;
  end_time: string;
  status: string;
  label?: string;
  event_type?: string;
  course_offering_id?: string;
};

type Props = {
  blocks: TimelineBlock[];
  dayStartHour?: number;
  dayEndHour?: number;
  onCancelBooking?: (id: string) => void;
  canCancelBooking?: (block: TimelineBlock) => boolean;
};

const HOUR_HEIGHT = 60;
const GUTTER_WIDTH = 48;
const NOW_LINE_COLOR = colors.statusBusy;

const EVENT_COLORS: Record<string, string> = {
  lecture: colors.campus,
  exam: colors.statusBusy,
  tutor: colors.accent,
  defense: '#AF52DE',
  lab: '#5856D6',
  presentation: colors.statusSoon,
};

function eventColor(eventType?: string): string {
  return EVENT_COLORS[eventType ?? ''] ?? colors.campus;
}

const EVENT_LABELS: Record<string, string> = {
  lecture: 'Lecture',
  exam: 'Exam',
  tutor: 'Tutor',
  defense: 'Defense',
  lab: 'Lab',
  presentation: 'Presentation',
};

function shortTime(iso: string): string {
  const d = new Date(iso);
  const h = d.getHours();
  const m = d.getMinutes();
  const ampm = h >= 12 ? 'PM' : 'AM';
  return `${h % 12 || 12}:${m.toString().padStart(2, '0')} ${ampm}`;
}

function hourLabel(hour: number): string {
  if (hour === 0) return '12 AM';
  if (hour < 12) return `${hour} AM`;
  if (hour === 12) return '12 PM';
  return `${hour - 12} PM`;
}

export function DayTimeline({
  blocks,
  dayStartHour = 7,
  dayEndHour = 21,
  onCancelBooking,
  canCancelBooking,
}: Props) {
  const scrollRef = useRef<ScrollView>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const totalHours = dayEndHour - dayStartHour;
  const totalHeight = totalHours * HOUR_HEIGHT;

  const booked = useMemo(
    () => blocks.filter((b) => String(b.status).toLowerCase() === 'booked'),
    [blocks]
  );

  const nowOffset = useMemo(() => {
    const now = new Date();
    const h = now.getHours() + now.getMinutes() / 60;
    if (h < dayStartHour || h > dayEndHour) return null;
    return ((h - dayStartHour) / totalHours) * totalHeight;
  }, [dayStartHour, dayEndHour, totalHours, totalHeight]);

  const [, forceRender] = useState(0);
  useEffect(() => {
    const id = setInterval(() => forceRender((n) => n + 1), 60_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (nowOffset != null && scrollRef.current) {
      const y = Math.max(0, nowOffset - 120);
      setTimeout(() => scrollRef.current?.scrollTo({ y, animated: false }), 50);
    }
  }, []);

  const toggleExpand = useCallback((id: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedId((prev) => (prev === id ? null : id));
  }, []);

  const hourRows = useMemo(() => {
    const rows = [];
    for (let i = 0; i <= totalHours; i++) {
      rows.push(dayStartHour + i);
    }
    return rows;
  }, [dayStartHour, totalHours]);

  function blockTop(iso: string): number {
    const d = new Date(iso);
    const h = d.getHours() + d.getMinutes() / 60;
    return Math.max(0, ((h - dayStartHour) / totalHours) * totalHeight);
  }

  function blockHeight(startIso: string, endIso: string): number {
    const s = new Date(startIso);
    const e = new Date(endIso);
    const sH = s.getHours() + s.getMinutes() / 60;
    const eH = e.getHours() + e.getMinutes() / 60;
    const clampS = Math.max(sH, dayStartHour);
    const clampE = Math.min(eH, dayEndHour);
    return Math.max(((clampE - clampS) / totalHours) * totalHeight, 24);
  }

  return (
    <ScrollView
      ref={scrollRef}
      style={styles.container}
      contentContainerStyle={{ height: totalHeight + 20 }}
      showsVerticalScrollIndicator={false}
      nestedScrollEnabled
    >
      {/* Hour grid lines */}
      {hourRows.map((hour) => {
        const top = ((hour - dayStartHour) / totalHours) * totalHeight;
        return (
          <View key={hour} style={[styles.hourRow, { top }]}>
            <Text style={styles.hourLabel}>{hourLabel(hour)}</Text>
            <View style={styles.hourLine} />
          </View>
        );
      })}

      {/* Event blocks */}
      {booked.map((b) => {
        const top = blockTop(b.start_time);
        const height = blockHeight(b.start_time, b.end_time);
        const color = eventColor(b.event_type);
        const isExpanded = expandedId === b.id;
        const canCancel = canCancelBooking?.(b) ?? false;

        return (
          <Pressable
            key={b.id}
            onPress={() => toggleExpand(b.id)}
            style={[
              styles.eventBlock,
              {
                top,
                minHeight: isExpanded ? Math.max(height, 80) : height,
                left: GUTTER_WIDTH + 4,
                right: 8,
                borderLeftColor: color,
              },
            ]}
          >
            <View style={styles.eventHeader}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.eventLabel} numberOfLines={isExpanded ? 3 : 1}>
                  {b.label ?? 'Booking'}
                </Text>
                <Text style={styles.eventTime}>
                  {shortTime(b.start_time)} – {shortTime(b.end_time)}
                </Text>
              </View>
              {b.event_type && (
                <View style={[styles.eventTypeBadge, { backgroundColor: color + '20' }]}>
                  <Text style={[styles.eventTypeBadgeText, { color }]}>
                    {EVENT_LABELS[b.event_type] ?? b.event_type}
                  </Text>
                </View>
              )}
            </View>
            {isExpanded && canCancel && onCancelBooking && (
              <Pressable
                style={styles.cancelRow}
                onPress={() => onCancelBooking(b.id)}
                hitSlop={8}
              >
                <Ionicons name="close-circle-outline" size={16} color={colors.destructive} />
                <Text style={styles.cancelText}>Cancel booking</Text>
              </Pressable>
            )}
          </Pressable>
        );
      })}

      {/* Now indicator */}
      {nowOffset != null && (
        <View style={[styles.nowLine, { top: nowOffset }]}>
          <View style={styles.nowDot} />
          <View style={styles.nowRule} />
        </View>
      )}

      {/* Empty state */}
      {booked.length === 0 && (
        <View style={styles.emptyWrap}>
          <Ionicons name="calendar-outline" size={28} color={colors.tertiaryLabel} />
          <Text style={styles.emptyText}>No bookings this day</Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.systemBackground,
  },

  hourRow: {
    position: 'absolute',
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    height: 0,
  },
  hourLabel: {
    width: GUTTER_WIDTH - 4,
    textAlign: 'right',
    paddingRight: 8,
    ...typography.caption2,
    fontSize: 10,
    color: colors.tertiaryLabel,
  },
  hourLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.separator,
  },

  eventBlock: {
    position: 'absolute',
    backgroundColor: colors.systemBackground,
    borderLeftWidth: 4,
    borderRadius: radius.sm,
    paddingHorizontal: space.sm,
    paddingVertical: space.xs,
    ...shadows.card,
    overflow: 'hidden',
  },
  eventHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: space.xs,
  },
  eventLabel: {
    ...typography.subhead,
    fontWeight: '600',
    color: colors.label,
  },
  eventTime: {
    ...typography.caption1,
    color: colors.secondaryLabel,
    marginTop: 1,
  },
  eventTypeBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radius.sm - 4,
  },
  eventTypeBadgeText: {
    ...typography.caption2,
    fontWeight: '600',
  },

  cancelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: space.xs,
    paddingTop: space.xs,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.separator,
  },
  cancelText: {
    ...typography.subhead,
    color: colors.destructive,
    fontWeight: '600',
  },

  nowLine: {
    position: 'absolute',
    left: GUTTER_WIDTH - 2,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    height: 0,
    zIndex: 20,
  },
  nowDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: NOW_LINE_COLOR,
    marginLeft: -4,
  },
  nowRule: {
    flex: 1,
    height: 2,
    backgroundColor: NOW_LINE_COLOR,
  },

  emptyWrap: {
    position: 'absolute',
    top: 80,
    left: GUTTER_WIDTH,
    right: 0,
    alignItems: 'center',
    gap: space.xs,
  },
  emptyText: {
    ...typography.subhead,
    color: colors.tertiaryLabel,
  },
});
