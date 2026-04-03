import { Stack } from 'expo-router';
import { stackScreenOptions } from '@/src/theme/tokens';

export default function ExploreLayout() {
  return (
    <Stack screenOptions={stackScreenOptions}>
      <Stack.Screen name="index" options={{ title: 'Campus' }} />
      <Stack.Screen name="building/[id]" options={{ title: 'Building' }} />
      <Stack.Screen name="room/[roomId]" options={{ title: 'Room' }} />
      <Stack.Screen name="search" options={{ title: 'Search' }} />
      <Stack.Screen name="scan" options={{ title: 'Scan QR', presentation: 'modal' }} />
    </Stack>
  );
}
