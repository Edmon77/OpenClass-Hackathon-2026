import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider } from '../src/context/AuthContext';
import { initLocalNotifications } from '../src/lib/localNotifications';
import { stackScreenOptions } from '../src/theme/tokens';

function NotificationBootstrap() {
  useEffect(() => {
    initLocalNotifications().catch(() => {});
  }, []);
  return null;
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <NotificationBootstrap />
      <StatusBar style="dark" />
      <Stack screenOptions={stackScreenOptions}>
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="login" options={{ title: 'Sign in', headerLargeTitle: false }} />
        <Stack.Screen name="change-password" options={{ title: 'New password', headerLargeTitle: false }} />
        <Stack.Screen name="(app)" options={{ headerShown: false }} />
      </Stack>
    </AuthProvider>
  );
}
