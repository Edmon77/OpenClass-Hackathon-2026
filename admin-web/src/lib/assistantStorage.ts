/** Match mobile `assistantSession.ts` so the same user id uses the same logical key shape. */
const PREFIX = 'campus_assistant_messages_v2';

export function assistantStorageKeyForUser(userId: string): string {
  return `${PREFIX}:${userId}`;
}

export function clearAssistantStorageForUser(userId: string): void {
  try {
    localStorage.removeItem(assistantStorageKeyForUser(userId));
  } catch {
    /* ignore */
  }
}
