/**
 * Import only specific expo-notifications modules — NOT the package root.
 * The root re-exports DevicePushTokenAutoRegistration.fx, which runs at load time
 * and throws on Android Expo Go (SDK 53+).
 */
import { Platform } from 'react-native';
import { setNotificationHandler } from 'expo-notifications/build/NotificationsHandler';
import { scheduleNotificationAsync } from 'expo-notifications/build/scheduleNotificationAsync';
import { requestPermissionsAsync } from 'expo-notifications/build/NotificationPermissions';
import { setNotificationChannelAsync } from 'expo-notifications/build/setNotificationChannelAsync';
import { AndroidImportance } from 'expo-notifications/build/NotificationChannelManager.types';
import { SchedulableTriggerInputTypes } from 'expo-notifications/build/Notifications.types';

export { SchedulableTriggerInputTypes };

export async function initLocalNotifications(): Promise<void> {
  setNotificationHandler({
    handleNotification: async () => ({
      shouldPlaySound: false,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
  if (Platform.OS === 'android') {
    await setNotificationChannelAsync('default', {
      name: 'Default',
      importance: AndroidImportance.DEFAULT,
    });
  }
  await requestPermissionsAsync();
}

export async function scheduleRoomNeededAlert(
  roomNum: string,
  triggerAt: Date | null,
  cutoffMinutesForMessage = 10
): Promise<void> {
  await requestPermissionsAsync();
  if (!triggerAt || triggerAt.getTime() <= Date.now()) {
    await scheduleNotificationAsync({
      content: {
        title: 'Room needed',
        body: `Room ${roomNum} is needed now.`,
      },
      trigger: null,
    });
  } else {
    await scheduleNotificationAsync({
      content: {
        title: 'Room needed soon',
        body: `Room ${roomNum} will be used in ${cutoffMinutesForMessage} minutes.`,
      },
      trigger: { type: SchedulableTriggerInputTypes.DATE, date: triggerAt },
    });
  }
}
