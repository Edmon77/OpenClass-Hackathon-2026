import { Pressable, Text, StyleSheet, type ViewStyle, ActivityIndicator } from 'react-native';
import * as Haptics from 'expo-haptics';
import { colors, radius, space, type, shadows } from '@/src/theme/tokens';
import { PRESS_SCALE } from '@/src/theme/motion';

type Props = {
  title: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
};

export function PrimaryButton({ title, onPress, loading, disabled, style }: Props) {
  function handlePress() {
    try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); } catch {}
    onPress();
  }

  return (
    <Pressable
      onPress={handlePress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.btn,
        (disabled || loading) && styles.disabled,
        pressed && { transform: [{ scale: PRESS_SCALE }] },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color="#fff" size="small" />
      ) : (
        <Text style={styles.text}>{title}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    backgroundColor: colors.campus,
    paddingVertical: 16,
    paddingHorizontal: space.xl,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
    ...shadows.button,
  },
  disabled: { opacity: 0.55 },
  text: { ...type.headline, color: '#fff' },
});
