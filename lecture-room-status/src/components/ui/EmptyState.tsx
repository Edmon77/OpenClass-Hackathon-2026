import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated from 'react-native-reanimated';
import { enterFade } from '@/src/theme/motion';
import { colors, space, type } from '@/src/theme/tokens';

type Props = {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle?: string;
};

export function EmptyState({ icon, title, subtitle }: Props) {
  return (
    <Animated.View entering={enterFade(400)} style={styles.wrap}>
      <Ionicons name={icon} size={52} color={colors.tertiaryLabel} />
      <Text style={styles.title}>{title}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    paddingVertical: space.xxl * 2,
    paddingHorizontal: space.xl,
  },
  title: {
    ...type.title3,
    color: colors.label,
    marginTop: space.md,
    textAlign: 'center',
  },
  subtitle: {
    ...type.subhead,
    color: colors.secondaryLabel,
    marginTop: space.sm,
    textAlign: 'center',
    maxWidth: 300,
  },
});
