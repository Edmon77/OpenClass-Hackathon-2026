import { type ReactNode } from 'react';
import { Pressable, type ViewStyle } from 'react-native';
import Animated from 'react-native-reanimated';
import { enterFromBottom, PRESS_SCALE } from '@/src/theme/motion';

type Props = {
  index: number;
  children: ReactNode;
  onPress?: () => void;
  style?: ViewStyle;
};

export function AnimatedListItem({ index, children, onPress, style }: Props) {
  const content = (
    <Animated.View entering={enterFromBottom(index)} style={style}>
      {children}
    </Animated.View>
  );

  if (!onPress) return content;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => pressed ? { transform: [{ scale: PRESS_SCALE }] } : undefined}
    >
      {content}
    </Pressable>
  );
}
