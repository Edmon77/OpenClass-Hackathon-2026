import { useCallback, useState } from 'react';
import { Tabs } from 'expo-router';
import { useFocusEffect } from 'expo-router';
import { useAuth } from '@/src/context/AuthContext';
import { apiFetch } from '@/src/api/client';
import { isApiConfigured } from '@/src/api/config';
import { TabBarIcon } from '@/src/components/ui/TabBarIcon';
import { colors, type as typography } from '@/src/theme/tokens';

export default function TabsLayout() {
  const { user } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);

  useFocusEffect(
    useCallback(() => {
      if (!isApiConfigured() || !user) return;
      apiFetch<{ notifications: { is_read: boolean }[] }>('/notifications')
        .then((d) => setUnreadCount(d.notifications.filter((n) => !n.is_read).length))
        .catch(() => {});
    }, [user])
  );

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.campus,
        tabBarInactiveTintColor: colors.tertiaryLabel,
        tabBarStyle: {
          backgroundColor: colors.systemBackground,
          borderTopColor: colors.separator,
          borderTopWidth: 0.5,
        },
        tabBarLabelStyle: {
          ...typography.caption2,
          fontWeight: '600',
        },
      }}
    >
      <Tabs.Screen
        name="(explore)"
        options={{
          title: 'Explore',
          tabBarIcon: ({ color, size }) => (
            <TabBarIcon name="compass-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="(schedule)"
        options={{
          title: 'Schedule',
          tabBarIcon: ({ color, size }) => (
            <TabBarIcon name="calendar-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="(assistant)"
        options={{
          title: 'Assistant',
          tabBarIcon: ({ color, size }) => (
            <TabBarIcon name="chatbubble-ellipses-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="(notifications)"
        options={{
          title: 'Alerts',
          tabBarIcon: ({ color, size }) => (
            <TabBarIcon name="notifications-outline" size={size} color={color} badge={unreadCount} />
          ),
        }}
      />
      <Tabs.Screen
        name="(profile)"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, size }) => (
            <TabBarIcon name="person-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="(admin)"
        options={{
          title: 'Admin',
          href: user?.role === 'admin' ? undefined : null,
          tabBarIcon: ({ color, size }) => (
            <TabBarIcon name="shield-outline" size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
