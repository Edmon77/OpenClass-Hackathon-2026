import { Stack } from 'expo-router';
import { stackScreenOptions } from '@/src/theme/tokens';

export default function AdminLayout() {
  return (
    <Stack screenOptions={stackScreenOptions}>
      <Stack.Screen name="index" options={{ title: 'Admin' }} />
      <Stack.Screen name="users" options={{ title: 'Users' }} />
      <Stack.Screen name="buildings-rooms" options={{ title: 'Buildings & Rooms' }} />
      <Stack.Screen name="semesters" options={{ title: 'Semesters' }} />
      <Stack.Screen name="courses" options={{ title: 'Courses' }} />
      <Stack.Screen name="cr-assignments" options={{ title: 'CR Assignments' }} />
    </Stack>
  );
}
