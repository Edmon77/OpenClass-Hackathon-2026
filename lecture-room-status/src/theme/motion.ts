import { FadeIn, FadeInDown, FadeInUp, withSpring } from 'react-native-reanimated';

const STAGGER_CAP = 400;
const STAGGER_STEP = 50;

export function enterFromBottom(index: number) {
  return FadeInDown.delay(Math.min(index * STAGGER_STEP, STAGGER_CAP))
    .springify()
    .damping(18)
    .stiffness(120);
}

export function enterFade(durationMs = 450) {
  return FadeIn.duration(durationMs);
}

export function enterFromTop(index: number) {
  return FadeInUp.delay(Math.min(index * STAGGER_STEP, STAGGER_CAP))
    .springify()
    .damping(18)
    .stiffness(120);
}

export const PRESS_SCALE = 0.97;

export const springConfig = {
  damping: 18,
  stiffness: 120,
  mass: 1,
};
