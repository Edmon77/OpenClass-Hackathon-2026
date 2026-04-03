import { type ReactNode } from 'react';
import { View, StyleSheet, type ViewStyle } from 'react-native';
import { colors, radius, shadows } from '@/src/theme/tokens';

type Props = {
  children: ReactNode;
  style?: ViewStyle;
};

export function GroupedCard({ children, style }: Props) {
  return <View style={[styles.card, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.systemBackground,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.separator,
    overflow: 'hidden',
    ...shadows.card,
  },
});
