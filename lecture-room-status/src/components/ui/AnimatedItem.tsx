import { type ReactNode } from 'react';
import Animated, { FadeInDown } from 'react-native-reanimated';

type Props = {
  index: number;
  children: ReactNode;
};

export function AnimatedItem({ index, children }: Props) {
  return (
    <Animated.View entering={FadeInDown.delay(Math.min(index * 55, 400)).duration(400)}>
      {children}
    </Animated.View>
  );
}
