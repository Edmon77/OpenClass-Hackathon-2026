import { View, StyleSheet } from 'react-native';
import { colors, radius } from '@/src/theme/tokens';

type Props = {
  green: number;
  yellow: number;
  red: number;
  height?: number;
};

export function StatusBar({ green, yellow, red, height = 4 }: Props) {
  const total = green + yellow + red;
  if (total === 0) return null;

  return (
    <View style={[styles.track, { height }]}>
      {green > 0 && (
        <View style={[styles.segment, { flex: green, backgroundColor: colors.statusFree, borderTopLeftRadius: height / 2, borderBottomLeftRadius: height / 2 }]} />
      )}
      {yellow > 0 && (
        <View style={[styles.segment, { flex: yellow, backgroundColor: colors.statusSoon, ...(green === 0 ? { borderTopLeftRadius: height / 2, borderBottomLeftRadius: height / 2 } : {}) }]} />
      )}
      {red > 0 && (
        <View style={[styles.segment, { flex: red, backgroundColor: colors.statusBusy, borderTopRightRadius: height / 2, borderBottomRightRadius: height / 2 }]} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    flexDirection: 'row',
    borderRadius: 99,
    overflow: 'hidden',
    backgroundColor: colors.fill,
  },
  segment: {},
});
