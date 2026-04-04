import AsyncStorage from '@react-native-async-storage/async-storage';

const ASSISTANT_STORAGE_PREFIX = 'campus_assistant_messages_v2';
const LEGACY_ASSISTANT_STORAGE_KEY = 'campus_assistant_messages_v1';

export function assistantStorageKeyForUser(userId: string): string {
  return `${ASSISTANT_STORAGE_PREFIX}:${userId}`;
}

export async function clearAssistantStorageForUser(userId: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(assistantStorageKeyForUser(userId));
  } catch {
    // ignore local storage failures
  }
}

export async function clearLegacyAssistantStorage(): Promise<void> {
  try {
    await AsyncStorage.removeItem(LEGACY_ASSISTANT_STORAGE_KEY);
  } catch {
    // ignore local storage failures
  }
}
