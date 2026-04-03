import { View, Text, StyleSheet } from 'react-native';
import { colors, type, radius, space } from '@/src/theme/tokens';

type Status = 'green' | 'yellow' | 'red';

const config: Record<Status, { color: string; label: string }> = {
  green: { color: colors.statusFree, label: 'Free' },
  yellow: { color: colors.statusSoon, label: 'Soon' },
  red: { color: colors.statusBusy, label: 'Busy' },
};

type Props = {
  status: Status;
  showLabel?: boolean;
  size?: 'sm' | 'md';
};

export function StatusDot({ status, showLabel = true, size = 'md' }: Props) {
  const c = config[status];
  const dotSize = size === 'sm' ? 6 : 8;
  return (
    <View style={styles.row}>
      <View style={[styles.dot, { width: dotSize, height: dotSize, borderRadius: dotSize / 2, backgroundColor: c.color }]} />
      {showLabel && <Text style={[styles.label, { color: c.color }, size === 'sm' && styles.labelSm]}>{c.label}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  dot: {},
  label: { ...type.caption1, fontWeight: '700' },
  labelSm: { ...type.caption2 },
});
