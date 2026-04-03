import { Text, StyleSheet, type TextStyle } from 'react-native';
import { colors, type as typography, space } from '@/src/theme/tokens';

type Props = {
  title: string;
  style?: TextStyle;
};

export function SectionHeader({ title, style }: Props) {
  return <Text style={[styles.label, style]}>{title}</Text>;
}

const styles = StyleSheet.create({
  label: {
    ...typography.caption1,
    color: colors.tertiaryLabel,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: space.xs,
    marginLeft: space.sm,
    marginTop: space.lg,
  },
});
