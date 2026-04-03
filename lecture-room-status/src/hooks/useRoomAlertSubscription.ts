import { useCallback, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const key = (roomId: string) => `lrs_room_alert_${roomId}`;
const TWO_H_MS = 2 * 60 * 60 * 1000;

export type RoomAlertPersist = { expiresAt: number };

export function useRoomAlertSubscription(roomId: string | undefined) {
  const [alert, setAlert] = useState<RoomAlertPersist | null>(null);

  const refresh = useCallback(async () => {
    if (!roomId) {
      setAlert(null);
      return;
    }
    const raw = await AsyncStorage.getItem(key(roomId));
    if (!raw) {
      setAlert(null);
      return;
    }
    try {
      const parsed = JSON.parse(raw) as RoomAlertPersist;
      if (parsed.expiresAt <= Date.now()) {
        await AsyncStorage.removeItem(key(roomId));
        setAlert(null);
        return;
      }
      setAlert(parsed);
    } catch {
      setAlert(null);
    }
  }, [roomId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const persistAfterSubscribe = useCallback(async () => {
    if (!roomId) return;
    const next: RoomAlertPersist = { expiresAt: Date.now() + TWO_H_MS };
    await AsyncStorage.setItem(key(roomId), JSON.stringify(next));
    setAlert(next);
  }, [roomId]);

  const cancel = useCallback(async () => {
    if (!roomId) return;
    await AsyncStorage.removeItem(key(roomId));
    setAlert(null);
  }, [roomId]);

  return { alert, refresh, persistAfterSubscribe, cancel };
}
