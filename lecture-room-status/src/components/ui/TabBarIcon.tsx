import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, type as typography } from '@/src/theme/tokens';

type Props = {
  name: keyof typeof Ionicons.glyphMap;
  color: string;
  size: number;
  badge?: number;
};

export function TabBarIcon({ name, color, size, badge }: Props) {
  return (
    <View style={styles.wrap}>
      <Ionicons name={name} size={size} color={color} />
      {badge != null && badge > 0 && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{badge > 99 ? '99+' : badge}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },
  badge: {
    position: 'absolute',
    top: -4,
    right: -10,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.destructive,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  badgeText: {
    ...typography.caption2,
    color: '#fff',
    fontWeight: '700',
    fontSize: 10,
  },
});
