import { Stack } from 'expo-router';
import { stackScreenOptions } from '@/src/theme/tokens';

export default function ProfileLayout() {
  return (
    <Stack screenOptions={stackScreenOptions}>
      <Stack.Screen name="index" options={{ title: 'Profile' }} />
    </Stack>
  );
}
