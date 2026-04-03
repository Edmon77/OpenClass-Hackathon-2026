import { View, Text, StyleSheet } from 'react-native';
import { colors, radius, space, type as typography } from '@/src/theme/tokens';

type Block = {
  id: string;
  start_time: string;
  end_time: string;
  status: string;
  label?: string;
};

type Props = {
  blocks: Block[];
  dayStartHour?: number;
  dayEndHour?: number;
};

function hourFraction(iso: string, dayStart: number, dayEnd: number): number {
  const d = new Date(iso);
  const h = d.getHours() + d.getMinutes() / 60;
  return Math.max(0, Math.min(1, (h - dayStart) / (dayEnd - dayStart)));
}

function shortTime(iso: string): string {
  const d = new Date(iso);
  const h = d.getHours();
  const m = d.getMinutes();
  const ampm = h >= 12 ? 'PM' : 'AM';
  return `${h % 12 || 12}:${m.toString().padStart(2, '0')} ${ampm}`;
}

export function ScheduleStrip({ blocks, dayStartHour = 7, dayEndHour = 21 }: Props) {
  const totalHours = dayEndHour - dayStartHour;
  const ticks = Array.from({ length: totalHours + 1 }, (_, i) => dayStartHour + i);

  return (
    <View style={styles.wrap}>
      <View style={styles.track}>
        {ticks.map((h) => {
          const left = ((h - dayStartHour) / totalHours) * 100;
          return (
            <View key={h} style={[styles.tick, { left: `${left}%` }]}>
              <Text style={styles.tickLabel}>{h % 12 || 12}{h < 12 ? 'a' : 'p'}</Text>
            </View>
          );
        })}
        {blocks
          .filter((b) => b.status === 'booked')
          .map((b) => {
            const left = hourFraction(b.start_time, dayStartHour, dayEndHour) * 100;
            const right = hourFraction(b.end_time, dayStartHour, dayEndHour) * 100;
            const width = Math.max(right - left, 2);
            return (
              <View
                key={b.id}
                style={[styles.block, { left: `${left}%`, width: `${width}%` }]}
              >
                <Text style={styles.blockLabel} numberOfLines={1}>
                  {b.label ?? shortTime(b.start_time)}
                </Text>
              </View>
            );
          })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: space.sm },
  track: {
    height: 36,
    backgroundColor: colors.fill,
    borderRadius: radius.sm,
    overflow: 'hidden',
    position: 'relative',
  },
  tick: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: StyleSheet.hairlineWidth,
    backgroundColor: colors.separator,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  tickLabel: {
    ...typography.caption2,
    fontSize: 8,
    color: colors.tertiaryLabel,
    position: 'absolute',
    bottom: -14,
  },
  block: {
    position: 'absolute',
    top: 2,
    bottom: 2,
    backgroundColor: colors.statusBusy,
    borderRadius: radius.sm - 2,
    opacity: 0.85,
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  blockLabel: {
    ...typography.caption2,
    color: '#fff',
    fontWeight: '600',
    fontSize: 9,
  },
});
