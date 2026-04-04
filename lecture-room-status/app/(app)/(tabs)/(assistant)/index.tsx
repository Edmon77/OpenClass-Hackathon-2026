import { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, usePathname, useRouter } from 'expo-router';
import { useAuth } from '@/src/context/AuthContext';
import { apiFetch } from '@/src/api/client';
import { isApiConfigured } from '@/src/api/config';
import { assistantStorageKeyForUser, clearLegacyAssistantStorage } from '@/src/lib/assistantSession';
import { EmptyState } from '@/src/components/ui/EmptyState';
import { colors, radius, space, type } from '@/src/theme/tokens';

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

export default function AssistantScreen() {
  const { user } = useAuth();
  const params = useLocalSearchParams<{ q?: string | string[] }>();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const pathname = usePathname();
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<ChatTurn[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isCr, setIsCr] = useState(false);
  const [actionBusyId, setActionBusyId] = useState<string | null>(null);
  const listRef = useRef<FlatList<ChatTurn>>(null);
  const requestAbortRef = useRef<AbortController | null>(null);
  const lastPrefillRef = useRef<string | null>(null);
  const storageKey = user ? assistantStorageKeyForUser(user.id) : null;

  useEffect(() => {
    clearLegacyAssistantStorage().catch(() => {});
  }, []);

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
    AsyncStorage.getItem(storageKey)
      .then((raw) => {
        if (cancelled || !raw) return;
        try {
          const parsed = JSON.parse(raw) as unknown;
          if (
            Array.isArray(parsed) &&
            parsed.every((m) => m && typeof m.content === 'string' && (m.role === 'user' || m.role === 'assistant'))
          ) {
            setMessages(parsed as ChatTurn[]);
          }
        } catch {
          // ignore invalid cache
        }
      })
      .finally(() => {
        if (!cancelled) setHydrated(true);
      });
    return () => {
      cancelled = true;
    };
  }, [storageKey]);

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
    if (!hydrated || !storageKey) return;
    AsyncStorage.setItem(storageKey, JSON.stringify(messages)).catch(() => {});
  }, [messages, hydrated, storageKey]);

  useEffect(() => {
    let cancelled = false;
    async function detectCr() {
      if (!user || user.role !== 'student' || !isApiConfigured()) {
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

  async function requestAiChat(
    history: ChatTurn[],
    attempt = 1
  ): Promise<{ message: { role: string; content: string }; proposal?: Proposal; suggested_actions?: SuggestedAction[] }> {
    requestAbortRef.current?.abort();
    const controller = new AbortController();
    requestAbortRef.current = controller;
    try {
      const roomMatch = pathname.match(/\/room\/([^/]+)/);
      const buildingMatch = pathname.match(/\/building\/([^/]+)/);
      const bookingMatch = pathname.match(/\/bookings\/([^/]+)/);
      return await apiFetch<{
        message: { role: string; content: string };
        proposal?: Proposal;
        suggested_actions?: SuggestedAction[];
      }>('/ai/chat', {
        method: 'POST',
        json: {
          messages: history.map((m) => ({ role: m.role, content: m.content })),
          client_context: {
            screen: 'campus_assistant',
            platform: Platform.OS,
            route: pathname,
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
      if (roomId) router.push(`/(app)/(tabs)/(explore)/room/${roomId}`);
      return;
    }
    if (action.type === 'open_building') {
      const buildingId = String(action.payload.building_id ?? '');
      if (buildingId) router.push(`/(app)/(tabs)/(explore)/building/${buildingId}`);
      return;
    }
    if (action.type === 'open_bookings') {
      router.push('/(app)/(tabs)/(schedule)/bookings');
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
    [loading, messages, pathname]
  );

  const onSend = useCallback(() => void sendMessage(input), [input, sendMessage]);

  const clearThread = useCallback(() => {
    requestAbortRef.current?.abort();
    requestAbortRef.current = null;
    setMessages([]);
    setError(null);
    if (storageKey) AsyncStorage.removeItem(storageKey).catch(() => {});
  }, [storageKey]);

  useEffect(() => {
    const raw = params.q;
    const q = Array.isArray(raw) ? raw[0] : raw;
    const text = typeof q === 'string' ? q.trim() : '';
    if (!text || !hydrated || !user) return;
    if (lastPrefillRef.current === text) return;
    lastPrefillRef.current = text;
    void sendMessage(text);
  }, [params.q, hydrated, user, sendMessage]);

  if (!isApiConfigured() || !user) {
    return <EmptyState icon="cloud-offline-outline" title="Sign in required" subtitle="Configure API URL and sign in to use the assistant." />;
  }

  const chips = suggestionChips(user.role, isCr);

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={insets.top + 56}
    >
      <View style={styles.toolbar}>
        <Pressable onPress={clearThread} style={styles.toolbarBtn} hitSlop={12}>
          <Ionicons name="create-outline" size={20} color={colors.accent} />
          <Text style={styles.toolbarBtnText}>New chat</Text>
        </Pressable>
      </View>

      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[styles.listContent, { paddingBottom: space.md }]}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
        ListFooterComponent={
          loading ? (
            <View style={[styles.bubble, styles.bubbleAssistant, styles.thinkingBubble]}>
              <ActivityIndicator size="small" color={colors.accent} />
              <Text style={styles.thinkingText}>Assistant is thinking...</Text>
            </View>
          ) : null
        }
        ListEmptyComponent={
          <View style={styles.hintWrap}>
            <Text style={styles.hintTitle}>Campus Assistant</Text>
            <Text style={styles.hintBody}>
              Ask about your schedule, availability by building, bookable offerings, alerts, or policy. Answers use live data from your account.
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
              {chips.map((c) => (
                <Pressable key={c.label} style={styles.chip} onPress={() => void sendMessage(c.text)} disabled={loading}>
                  <Text style={styles.chipText}>{c.label}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        }
        renderItem={({ item }) => (
          <View style={[styles.bubble, item.role === 'user' ? styles.bubbleUser : styles.bubbleAssistant]}>
            <Text style={item.role === 'user' ? styles.bubbleTextUser : styles.bubbleTextAssistant}>{item.content}</Text>
            {item.failed && item.retry_text ? (
              <Pressable style={styles.actionBtn} onPress={() => void sendMessage(item.retry_text ?? '')} disabled={loading}>
                <Text style={styles.actionBtnText}>Retry</Text>
              </Pressable>
            ) : null}
            {item.proposal ? (
              <View style={styles.proposalCard}>
                <Text style={styles.proposalTitle}>Confirmation required</Text>
                <Text style={styles.proposalText}>{item.proposal.summary}</Text>
                <Text style={styles.proposalMeta}>Expires: {new Date(item.proposal.expires_at).toLocaleString()}</Text>
              </View>
            ) : null}
            {item.actions?.length ? (
              <View style={styles.actionsRow}>
                {item.actions.map((a: SuggestedAction) => {
                  const proposalId = String(a.payload?.proposal_id ?? '');
                  const expiresAt = item.proposal ? new Date(item.proposal.expires_at).getTime() : null;
                  const expired = expiresAt != null && expiresAt <= Date.now();
                  const disabled = loading || expired || (!!actionBusyId && actionBusyId !== proposalId);
                  return (
                    <Pressable
                      key={`${item.id}-${a.type}-${a.label}`}
                      style={[styles.actionBtn, disabled && styles.actionBtnDisabled]}
                      onPress={() => void handleSuggestedAction(a)}
                      disabled={disabled}
                    >
                      <Text style={styles.actionBtnText}>{expired ? `${a.label} (expired)` : a.label}</Text>
                    </Pressable>
                  );
                })}
              </View>
            ) : null}
          </View>
        )}
      />

      {messages.length > 0 && !loading ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRowInline}>
          {chips.map((c) => (
            <Pressable key={`inline-${c.label}`} style={styles.chipSmall} onPress={() => void sendMessage(c.text)}>
              <Text style={styles.chipTextSmall}>{c.label}</Text>
            </Pressable>
          ))}
        </ScrollView>
      ) : null}

      {error ? (
        <View style={styles.errorBanner}>
          <Ionicons name="warning-outline" size={18} color={colors.destructive} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      <View style={[styles.composer, { paddingBottom: Math.max(insets.bottom, space.sm) }]}>
        <TextInput
          style={styles.input}
          placeholder="Ask a question..."
          placeholderTextColor={colors.tertiaryLabel}
          value={input}
          onChangeText={setInput}
          editable={!loading}
          multiline
          maxLength={4000}
          onSubmitEditing={() => void onSend()}
        />
        <Pressable
          style={[styles.sendBtn, (!input.trim() || loading) && styles.sendBtnDisabled]}
          onPress={() => void onSend()}
          disabled={!input.trim() || loading}
        >
          {loading ? <ActivityIndicator color="#fff" /> : <Ionicons name="arrow-up" size={22} color="#fff" />}
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.groupedBackground,
  },
  toolbar: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: space.md,
    paddingTop: space.sm,
    paddingBottom: space.xs,
  },
  toolbarBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  toolbarBtnText: {
    ...type.subhead,
    color: colors.accent,
    fontWeight: '600',
  },
  listContent: {
    paddingHorizontal: space.md,
    paddingTop: space.sm,
    flexGrow: 1,
  },
  hintWrap: {
    paddingVertical: space.lg,
    paddingHorizontal: space.sm,
  },
  hintTitle: {
    ...type.title3,
    color: colors.label,
    marginBottom: space.sm,
  },
  hintBody: {
    ...type.body,
    color: colors.secondaryLabel,
    lineHeight: 22,
    marginBottom: space.md,
  },
  chipRow: {
    flexDirection: 'row',
    gap: space.sm,
    paddingVertical: space.xs,
  },
  chipRowInline: {
    flexDirection: 'row',
    gap: space.sm,
    paddingHorizontal: space.md,
    paddingBottom: space.xs,
  },
  chip: {
    paddingVertical: space.sm,
    paddingHorizontal: space.md,
    borderRadius: radius.pill,
    backgroundColor: colors.secondarySystemBackground,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.separator,
  },
  chipSmall: {
    paddingVertical: 6,
    paddingHorizontal: space.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.fill,
  },
  chipText: {
    ...type.subhead,
    color: colors.campus,
    fontWeight: '600',
  },
  chipTextSmall: {
    ...type.caption1,
    color: colors.campus,
    fontWeight: '600',
  },
  bubble: {
    maxWidth: '88%',
    paddingVertical: space.sm,
    paddingHorizontal: space.md,
    borderRadius: radius.lg,
    marginBottom: space.sm,
  },
  bubbleUser: {
    alignSelf: 'flex-end',
    backgroundColor: colors.campus,
  },
  bubbleAssistant: {
    alignSelf: 'flex-start',
    backgroundColor: colors.secondarySystemBackground,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.separator,
  },
  bubbleTextUser: {
    ...type.body,
    color: '#fff',
  },
  bubbleTextAssistant: {
    ...type.body,
    color: colors.label,
  },
  thinkingBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
  },
  thinkingText: {
    ...type.footnote,
    color: colors.secondaryLabel,
  },
  proposalCard: {
    marginTop: space.sm,
    padding: space.sm,
    borderRadius: radius.md,
    backgroundColor: colors.fill,
  },
  proposalTitle: {
    ...type.caption1,
    color: colors.label,
    fontWeight: '700',
  },
  proposalText: {
    ...type.footnote,
    color: colors.label,
    marginTop: 2,
  },
  proposalMeta: {
    ...type.caption2,
    color: colors.secondaryLabel,
    marginTop: 2,
  },
  actionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space.sm,
    marginTop: space.sm,
  },
  actionBtn: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: radius.pill,
    backgroundColor: colors.accentMuted,
  },
  actionBtnDisabled: {
    opacity: 0.5,
  },
  actionBtnText: {
    ...type.caption1,
    color: colors.accent,
    fontWeight: '700',
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    backgroundColor: 'rgba(255,59,48,0.08)',
  },
  errorText: {
    ...type.footnote,
    color: colors.destructive,
    flex: 1,
  },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: space.md,
    paddingTop: space.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.separator,
    backgroundColor: colors.systemBackground,
    gap: space.sm,
  },
  input: {
    flex: 1,
    ...type.body,
    maxHeight: 120,
    minHeight: 40,
    paddingVertical: space.sm,
    paddingHorizontal: space.md,
    borderRadius: radius.md,
    backgroundColor: colors.secondarySystemBackground,
    color: colors.label,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.campus,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  sendBtnDisabled: {
    opacity: 0.45,
  },
});
