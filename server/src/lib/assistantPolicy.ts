export const ASSISTANT_ALL_EVENT_TYPES = ['lecture', 'exam', 'tutor', 'defense', 'lab', 'presentation'] as const;
export const ASSISTANT_TEACHER_EVENT_TYPES = ['lecture', 'tutor', 'exam', 'lab', 'presentation'] as const;
export const ASSISTANT_CR_EVENT_TYPES = ['lecture', 'presentation', 'lab'] as const;

export type AssistantRole = 'admin' | 'teacher' | 'student';

export function isAssistantEventTypeAllowed(
  role: AssistantRole,
  eventType: string
): { ok: true } | { ok: false; error: string } {
  if (role === 'admin') return { ok: true };
  if (role === 'teacher') {
    if ((ASSISTANT_TEACHER_EVENT_TYPES as readonly string[]).includes(eventType)) return { ok: true };
    return { ok: false, error: `Teachers cannot create "${eventType}" events.` };
  }
  if (role === 'student') {
    if ((ASSISTANT_CR_EVENT_TYPES as readonly string[]).includes(eventType)) return { ok: true };
    return { ok: false, error: `Class reps cannot create "${eventType}" events.` };
  }
  return { ok: false, error: 'Forbidden' };
}

export function categorizeAssistantErrorMessage(errorMessage: string): { status: number; code: string } {
  const msg = errorMessage.toLowerCase();
  if (msg.includes('too many requests')) return { status: 429, code: 'rate_limit' };
  if (msg.includes('timeout') || msg.includes('aborted')) return { status: 504, code: 'timeout' };
  if (msg.includes('openrouter') || msg.includes('groq')) return { status: 502, code: 'upstream_error' };
  return { status: 502, code: 'tool_error' };
}

export function isAssistantProposalExpired(expiresAt: Date | string, nowMs = Date.now()): boolean {
  const ts = expiresAt instanceof Date ? expiresAt.getTime() : new Date(expiresAt).getTime();
  if (!Number.isFinite(ts)) return true;
  return ts <= nowMs;
}

export function assistantMaxRoundsFallbackMessage(): string {
  return 'I reached my step limit while processing this request. Please narrow it down (for example include exact start/end time).';
}
