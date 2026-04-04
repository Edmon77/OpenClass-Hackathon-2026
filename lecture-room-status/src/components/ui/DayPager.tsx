import { useMemo, useState } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import { colors, radius, space, type as typography, shadows } from '@/src/theme/tokens';
import { DayTimeline, type TimelineBlock } from './DayTimeline';

type Props = {
  blocks: TimelineBlock[];
  dayCount?: number;
  dayStartHour?: number;
  dayEndHour?: number;
  onCancelBooking?: (id: string) => void;
  canCancelBooking?: (block: TimelineBlock) => boolean;
};

function startOfDay(d: Date): Date {
  const copy = new Date(d);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function addDays(d: Date, n: number): Date {
  const copy = new Date(d);
  copy.setDate(copy.getDate() + n);
  return copy;
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function dayLabel(d: Date, today: Date): string {
  if (isSameDay(d, today)) return 'Today';
  if (isSameDay(d, addDays(today, 1))) return 'Tomorrow';
  const weekday = d.toLocaleDateString(undefined, { weekday: 'short' });
  const day = d.getDate();
  return `${weekday} ${day}`;
}

function monthLabel(d: Date): string {
  return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

export function DayPager({
  blocks,
  dayCount = 7,
  dayStartHour = 7,
  dayEndHour = 21,
  onCancelBooking,
  canCancelBooking,
}: Props) {
  const today = useMemo(() => startOfDay(new Date()), []);
  const days = useMemo(
    () => Array.from({ length: dayCount }, (_, i) => addDays(today, i)),
    [today, dayCount]
  );
  const [selectedIdx, setSelectedIdx] = useState(0);
  const selectedDay = days[selectedIdx];

  const dayBlocks = useMemo(() => {
    const dayStart = startOfDay(selectedDay).getTime();
    const dayEnd = dayStart + 86_400_000;
    return blocks.filter((b) => {
      const s = new Date(b.start_time).getTime();
      const e = new Date(b.end_time).getTime();
      return s < dayEnd && e > dayStart;
    });
  }, [blocks, selectedDay]);

  const bookingCountByDay = useMemo(() => {
    const counts: number[] = new Array(dayCount).fill(0);
    for (let i = 0; i < dayCount; i++) {
      const ds = startOfDay(days[i]).getTime();
      const de = ds + 86_400_000;
      counts[i] = blocks.filter((b) => {
        const s = new Date(b.start_time).getTime();
        const e = new Date(b.end_time).getTime();
        return s < de && e > ds && String(b.status).toLowerCase() === 'booked';
      }).length;
    }
    return counts;
  }, [blocks, days, dayCount]);

  return (
    <View style={styles.wrap}>
      {/* Day selector */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.pillRow}
      >
        {days.map((d, i) => {
          const active = i === selectedIdx;
          const count = bookingCountByDay[i];
          return (
            <Pressable
              key={i}
              onPress={() => setSelectedIdx(i)}
              style={[styles.pill, active && styles.pillActive]}
            >
              <Text style={[styles.pillText, active && styles.pillTextActive]}>
                {dayLabel(d, today)}
              </Text>
              {count > 0 && (
                <View style={[styles.dotBadge, active && styles.dotBadgeActive]}>
                  <Text style={[styles.dotText, active && styles.dotTextActive]}>{count}</Text>
                </View>
              )}
            </Pressable>
          );
        })}
      </ScrollView>

      {/* Date label */}
      <Text style={styles.dateSubtitle}>{monthLabel(selectedDay)}</Text>

      {/* Timeline */}
      <View style={styles.timelineWrap}>
        <DayTimeline
          blocks={dayBlocks}
          dayStartHour={dayStartHour}
          dayEndHour={dayEndHour}
          onCancelBooking={onCancelBooking}
          canCancelBooking={canCancelBooking}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: colors.systemBackground,
    borderRadius: radius.xl,
    overflow: 'hidden',
    ...shadows.card,
  },

  pillRow: {
    flexDirection: 'row',
    gap: space.xs,
    paddingHorizontal: space.md,
    paddingTop: space.md,
    paddingBottom: space.xs,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: space.md,
    paddingVertical: space.xs + 2,
    borderRadius: radius.pill,
    backgroundColor: colors.fill,
  },
  pillActive: {
    backgroundColor: colors.campus,
  },
  pillText: {
    ...typography.subhead,
    fontWeight: '600',
    color: colors.label,
  },
  pillTextActive: {
    color: '#fff',
  },
  dotBadge: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.campus + '25',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  dotBadgeActive: {
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  dotText: {
    ...typography.caption2,
    fontWeight: '700',
    color: colors.campus,
  },
  dotTextActive: {
    color: '#fff',
  },

  dateSubtitle: {
    ...typography.caption1,
    color: colors.secondaryLabel,
    paddingHorizontal: space.md,
    paddingBottom: space.xs,
  },

  timelineWrap: {
    height: 340,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.separator,
  },
});
