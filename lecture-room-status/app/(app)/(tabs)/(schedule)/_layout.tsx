import { Stack } from 'expo-router';
import { stackScreenOptions } from '@/src/theme/tokens';

export default function ScheduleLayout() {
  return (
    <Stack screenOptions={stackScreenOptions}>
      <Stack.Screen name="index" options={{ title: 'Schedule' }} />
      <Stack.Screen name="bookings" options={{ title: 'My Bookings' }} />
      <Stack.Screen name="cr-setup" options={{ title: 'CR: Courses' }} />
    </Stack>
  );
}
