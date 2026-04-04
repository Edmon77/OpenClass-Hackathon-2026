import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { apiFetch } from '@/lib/api';
import { assistantStorageKeyForUser } from '@/lib/assistantStorage';
import { Button, Card, PageHeader } from '@/components/ui';

type SuggestedAction = {
  type: 'confirm_proposal' | 'cancel_proposal' | 'open_room' | 'open_building' | 'open_bookings';
  label: string;
  payload: Record<string, unknown>;
};

type Proposal = {
  proposal_id: string;
  action: string;
  summary: string;
  expires_at: string;
};

type ChatTurn = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  failed?: boolean;
  retry_text?: string;
  actions?: SuggestedAction[];
  proposal?: Proposal;
};

function suggestionChips(role: string, isCr: boolean): { label: string; text: string }[] {
  if (role === 'student' && isCr) {
    return [
      { label: 'Cohort bookings', text: 'Show upcoming bookings for my class cohort this week.' },
      { label: 'What can I book?', text: 'What event types and offerings can I book for as class representative?' },
      { label: 'Free room now', text: 'Find free rooms in my campus now with capacity 40+' },
    ];
  }
  switch (role) {
    case 'admin':
      return [
        { label: 'Booking stats', text: 'What are booking counts for the last 7 days?' },
        { label: 'Buildings', text: 'List all buildings on campus.' },
        { label: 'Org structure', text: 'Show faculties and departments.' },
      ];
    case 'teacher':
      return [
        { label: 'My bookings', text: 'What are my upcoming room bookings?' },
        { label: 'My offerings', text: 'What course offerings am I assigned to teach?' },
        { label: 'Event types', text: 'What event types can I use when booking a room?' },
      ];
    default:
      return [
        { label: 'My classes', text: 'What classes am I enrolled in this term?' },
        { label: 'My bookings', text: 'What are my upcoming room bookings?' },
        { label: 'Policy', text: 'Explain reminder and cutoff rules before class.' },
      ];
  }
}

function isLikelyTransientAssistantError(msg: string): boolean {
  const x = msg.toLowerCase();
  return (
    x.includes('timeout:') ||
    x.includes('aborted') ||
    x.includes('temporarily unavailable') ||
    x.includes('bad gateway') ||
    x.includes('gateway') ||
    x.includes('openrouter')
  );
}

export function AssistantPage() {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<ChatTurn[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isCr, setIsCr] = useState(false);
  const [actionBusyId, setActionBusyId] = useState<string | null>(null);
  const listEndRef = useRef<HTMLDivElement>(null);
  const requestAbortRef = useRef<AbortController | null>(null);
  const lastPrefillRef = useRef<string | null>(null);
  const storageKey = user ? assistantStorageKeyForUser(user.id) : null;

  useEffect(() => {
    return () => {
      requestAbortRef.current?.abort();
      requestAbortRef.current = null;
    };
  }, []);

  useEffect(() => {
    requestAbortRef.current?.abort();
    requestAbortRef.current = null;
  }, [user?.id]);

  useEffect(() => {
    let cancelled = false;
    setMessages([]);
    setError(null);
    setHydrated(false);
    if (!storageKey) {
      setHydrated(true);
      return () => {
        cancelled = true;
      };
    }
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw && !cancelled) {
        const parsed = JSON.parse(raw) as unknown;
        if (
          Array.isArray(parsed) &&
          parsed.every((m) => m && typeof m.content === 'string' && (m.role === 'user' || m.role === 'assistant'))
        ) {
          setMessages(parsed as ChatTurn[]);
        }
      }
    } catch {
      /* ignore */
    } finally {
      if (!cancelled) setHydrated(true);
    }
    return () => {
      cancelled = true;
    };
  }, [storageKey]);

  useEffect(() => {
    if (!hydrated || !storageKey) return;
    try {
      localStorage.setItem(storageKey, JSON.stringify(messages));
    } catch {
      /* ignore */
    }
  }, [messages, hydrated, storageKey]);

  useEffect(() => {
    let cancelled = false;
    async function detectCr() {
      if (!user || user.role !== 'student') {
        setIsCr(false);
        return;
      }
      try {
        const res = await apiFetch<{ courses: { id: string }[] }>('/courses/bookable', { timeoutMs: 20_000 });
        if (!cancelled) setIsCr(res.courses.length > 0);
      } catch {
        if (!cancelled) setIsCr(false);
      }
    }
    void detectCr();
    return () => {
      cancelled = true;
    };
  }, [user]);

  useEffect(() => {
    listEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  async function requestAiChat(
    history: ChatTurn[],
    attempt = 1
  ): Promise<{ message: { role: string; content: string }; proposal?: Proposal; suggested_actions?: SuggestedAction[] }> {
    requestAbortRef.current?.abort();
    const controller = new AbortController();
    requestAbortRef.current = controller;
    try {
      const path = location.pathname;
      const roomMatch = path.match(/\/campus\/room\/([^/]+)/);
      const buildingMatch = path.match(/\/campus\/building\/([^/]+)/);
      const bookingMatch = path.match(/\/bookings\/([^/]+)/);
      return await apiFetch<{
        message: { role: string; content: string };
        proposal?: Proposal;
        suggested_actions?: SuggestedAction[];
      }>('/ai/chat', {
        method: 'POST',
        json: {
          messages: history.map((m) => ({ role: m.role, content: m.content })),
          client_context: {
            screen: 'campus_assistant_web',
            platform: 'web',
            route: path + location.search,
            room_id: roomMatch?.[1],
            building_id: buildingMatch?.[1],
            booking_id: bookingMatch?.[1],
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          },
        },
        timeoutMs: 120_000,
        signal: controller.signal,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Request failed';
      if (attempt < 2 && isLikelyTransientAssistantError(msg)) {
        return requestAiChat(history, attempt + 1);
      }
      throw e;
    } finally {
      if (requestAbortRef.current === controller) requestAbortRef.current = null;
    }
  }

  function makeId(prefix: string): string {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  }

  async function handleSuggestedAction(action: SuggestedAction): Promise<void> {
    if (action.type === 'confirm_proposal' || action.type === 'cancel_proposal') {
      const proposalId = String(action.payload.proposal_id ?? '');
      if (!proposalId || loading || actionBusyId) return;
      setActionBusyId(proposalId);
      setLoading(true);
      setError(null);
      try {
        const res = await apiFetch<{ ok: boolean; action?: string }>('/ai/confirm', {
          method: 'POST',
          json: {
            proposal_id: proposalId,
            confirmed: action.type === 'confirm_proposal',
          },
          timeoutMs: 30_000,
        });
        const text =
          action.type === 'confirm_proposal'
            ? `Confirmed.${res.action ? ` Action: ${res.action}.` : ''}`
            : 'Proposal cancelled.';
        setMessages((prev) => [...prev, { id: makeId('assistant'), role: 'assistant', content: text }]);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Action failed');
      } finally {
        setActionBusyId(null);
        setLoading(false);
      }
      return;
    }

    if (action.type === 'open_room') {
      const roomId = String(action.payload.room_id ?? '');
      if (roomId) navigate(`/campus/room/${roomId}`);
      return;
    }
    if (action.type === 'open_building') {
      const buildingId = String(action.payload.building_id ?? '');
      if (buildingId) navigate(`/campus/building/${buildingId}`);
      return;
    }
    if (action.type === 'open_bookings') {
      navigate('/bookings');
    }
  }

  const sendMessage = useCallback(
    async (userText: string) => {
      const text = userText.trim();
      if (!text || loading) return;

      const nextUser: ChatTurn = { id: makeId('user'), role: 'user', content: text };
      const history = [...messages, nextUser];
      setMessages(history);
      setInput('');
      setError(null);
      setLoading(true);

      try {
        const res = await requestAiChat(history);
        const reply = res.message?.content?.trim() ?? '';
        setMessages((prev) => [
          ...prev,
          {
            id: makeId('assistant'),
            role: 'assistant',
            content: reply || '—',
            proposal: res.proposal,
            actions: res.suggested_actions,
          },
        ]);
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Request failed';
        setError(msg);
        setMessages((prev) => [
          ...prev,
          {
            id: makeId('assistant'),
            role: 'assistant',
            content: `I could not complete that request: ${msg}`,
            failed: true,
            retry_text: text,
          },
        ]);
      } finally {
        setLoading(false);
      }
    },
    [loading, messages, location.pathname, location.search]
  );

  const onSend = useCallback(() => void sendMessage(input), [input, sendMessage]);

  const clearThread = useCallback(() => {
    requestAbortRef.current?.abort();
    requestAbortRef.current = null;
    setMessages([]);
    setError(null);
    if (storageKey) {
      try {
        localStorage.removeItem(storageKey);
      } catch {
        /* ignore */
      }
    }
  }, [storageKey]);

  useEffect(() => {
    const q = searchParams.get('q')?.trim() ?? '';
    if (!q || !hydrated || !user) return;
    if (lastPrefillRef.current === q) return;
    lastPrefillRef.current = q;
    void sendMessage(q);
    const next = new URLSearchParams(searchParams);
    next.delete('q');
    setSearchParams(next, { replace: true });
  }, [hydrated, user, searchParams, setSearchParams, sendMessage]);

  if (!user) {
    return null;
  }

  const chips = suggestionChips(user.role, isCr);

  return (
    <div className="flex h-[calc(100vh-8rem)] min-h-[420px] flex-col md:h-[calc(100vh-6rem)]">
      <PageHeader
        title="Campus assistant"
        subtitle="Same AI as the mobile app: live data, proposals, and confirmations. Chats are stored per account in this browser."
      />

      <div className="mb-2 flex justify-end">
        <Button variant="ghost" className="text-sm text-app-accent" onClick={clearThread}>
          New chat
        </Button>
      </div>

      <Card className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
          {messages.length === 0 && !loading && (
            <div className="rounded-lg bg-app-secondary/90 p-4">
              <h2 className="font-medium text-app-label">Campus assistant</h2>
              <p className="mt-2 text-sm text-app-muted">
                Ask about your schedule, rooms, bookings, offerings, or policy. Answers use your signed-in account.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {chips.map((c) => (
                  <button
                    key={c.label}
                    type="button"
                    disabled={loading}
                    onClick={() => void sendMessage(c.text)}
                    className="rounded-full bg-app-fill px-3 py-1.5 text-sm text-app-accent hover:bg-app-fill disabled:opacity-50"
                  >
                    {c.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((item) => (
            <div
              key={item.id}
              className={`max-w-[90%] rounded-2xl px-4 py-2.5 text-sm ${
                item.role === 'user'
                  ? 'ml-auto bg-app-campus text-white'
                  : 'border border-app-separator bg-app-fill text-app-label'
              }`}
            >
              <p className="whitespace-pre-wrap">{item.content}</p>
              {item.failed && item.retry_text ? (
                <button
                  type="button"
                  className="mt-2 text-xs font-semibold text-app-accent"
                  onClick={() => void sendMessage(item.retry_text ?? '')}
                  disabled={loading}
                >
                  Retry
                </button>
              ) : null}
              {item.proposal ? (
                <div className="mt-3 rounded-lg bg-app-secondary p-3 text-xs">
                  <div className="font-semibold text-amber-900">Confirmation required</div>
                  <p className="mt-1 text-app-label">{item.proposal.summary}</p>
                  <p className="mt-1 text-app-subtle">
                    Expires: {new Date(item.proposal.expires_at).toLocaleString()}
                  </p>
                </div>
              ) : null}
              {item.actions?.length ? (
                <div className="mt-2 flex flex-wrap gap-2">
                  {item.actions.map((a) => {
                    const proposalId = String(a.payload?.proposal_id ?? '');
                    const expiresAt = item.proposal ? new Date(item.proposal.expires_at).getTime() : null;
                    const expired = expiresAt != null && expiresAt <= Date.now();
                    const disabled = loading || expired || (!!actionBusyId && actionBusyId !== proposalId);
                    return (
                      <button
                        key={`${item.id}-${a.type}-${a.label}`}
                        type="button"
                        disabled={disabled}
                        onClick={() => void handleSuggestedAction(a)}
                        className="rounded-full bg-app-accent-muted px-3 py-1 text-xs font-semibold text-app-accent disabled:opacity-40"
                      >
                        {expired ? `${a.label} (expired)` : a.label}
                      </button>
                    );
                  })}
                </div>
              ) : null}
            </div>
          ))}

          {loading ? (
            <div className="flex items-center gap-2 text-sm text-app-subtle">
              <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-app-muted border-t-app-accent" />
              Assistant is thinking…
            </div>
          ) : null}
          <div ref={listEndRef} />
        </div>

        {messages.length > 0 && !loading ? (
          <div className="flex flex-wrap gap-2 border-t border-app-separator px-4 py-2">
            {chips.map((c) => (
              <button
                key={`inline-${c.label}`}
                type="button"
                onClick={() => void sendMessage(c.text)}
                className="rounded-full bg-app-fill px-2 py-1 text-xs text-app-accent"
              >
                {c.label}
              </button>
            ))}
          </div>
        ) : null}

        {error ? (
          <div className="flex items-center gap-2 border-t border-app-destructive/20 bg-red-50 px-4 py-2 text-sm text-red-800">
            {error}
          </div>
        ) : null}

        <div className="flex gap-2 border-t border-app-separator p-3">
          <textarea
            className="max-h-32 min-h-[44px] flex-1 resize-y rounded-lg border border-app-separator bg-app-card px-3 py-2 text-sm text-app-label placeholder:text-app-subtle"
            placeholder="Ask a question…"
            value={input}
            maxLength={4000}
            disabled={loading}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                void onSend();
              }
            }}
          />
          <Button className="self-end" disabled={!input.trim() || loading} onClick={() => void onSend()}>
            Send
          </Button>
        </div>
      </Card>
    </div>
  );
}
