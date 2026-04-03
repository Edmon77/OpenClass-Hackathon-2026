import { Pressable, Text, StyleSheet, type ViewStyle } from 'react-native';
import { colors, radius, space, type, shadows } from '@/src/theme/tokens';
import { PRESS_SCALE } from '@/src/theme/motion';

type Props = {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  style?: ViewStyle;
};

export function SecondaryButton({ title, onPress, disabled, style }: Props) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.btn,
        disabled && styles.disabled,
        pressed && { transform: [{ scale: PRESS_SCALE }] },
        style,
      ]}
    >
      <Text style={styles.text}>{title}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    backgroundColor: colors.fill,
    paddingVertical: 14,
    paddingHorizontal: space.xl,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  disabled: { opacity: 0.55 },
  text: { ...type.headline, color: colors.label },
});
