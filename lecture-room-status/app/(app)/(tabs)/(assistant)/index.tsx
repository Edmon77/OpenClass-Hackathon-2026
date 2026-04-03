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
import { useAuth } from '@/src/context/AuthContext';
import { apiFetch } from '@/src/api/client';
import { isApiConfigured } from '@/src/api/config';
import { EmptyState } from '@/src/components/ui/EmptyState';
import { colors, radius, space, type } from '@/src/theme/tokens';

type ChatTurn = { role: 'user' | 'assistant'; content: string };

const STORAGE_KEY = 'campus_assistant_messages_v1';

function suggestionChips(role: string): { label: string; text: string }[] {
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
  const insets = useSafeAreaInsets();
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<ChatTurn[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const listRef = useRef<FlatList>(null);

  useEffect(() => {
    let cancelled = false;
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (cancelled || !raw) return;
        try {
          const parsed = JSON.parse(raw) as unknown;
          if (Array.isArray(parsed) && parsed.every((m) => m && typeof m.content === 'string' && (m.role === 'user' || m.role === 'assistant'))) {
            setMessages(parsed as ChatTurn[]);
          }
        } catch {
          /* ignore */
        }
      })
      .finally(() => {
        if (!cancelled) setHydrated(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(messages)).catch(() => {});
  }, [messages, hydrated]);

  const sendMessage = useCallback(
    async (userText: string) => {
      const text = userText.trim();
      if (!text || loading) return;

      const nextUser: ChatTurn = { role: 'user', content: text };
      const history = [...messages, nextUser];
      setMessages(history);
      setInput('');
      setError(null);
      setLoading(true);

      try {
        const res = await apiFetch<{ message: { role: string; content: string } }>('/ai/chat', {
          method: 'POST',
          json: {
            messages: history.map((m) => ({ role: m.role, content: m.content })),
            client_context: {
              screen: 'campus_assistant',
              platform: Platform.OS,
            },
          },
          timeoutMs: 120_000,
        });
        const reply = res.message?.content?.trim() ?? '';
        setMessages((prev) => [...prev, { role: 'assistant', content: reply || '—' }]);
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Request failed';
        setError(msg);
        setMessages((prev) => prev.slice(0, -1));
      } finally {
        setLoading(false);
      }
    },
    [loading, messages]
  );

  const onSend = useCallback(() => void sendMessage(input), [input, sendMessage]);

  const clearThread = useCallback(() => {
    setMessages([]);
    setError(null);
    AsyncStorage.removeItem(STORAGE_KEY).catch(() => {});
  }, []);

  if (!isApiConfigured() || !user) {
    return <EmptyState icon="cloud-offline-outline" title="Sign in required" subtitle="Configure API URL and sign in to use the assistant." />;
  }

  const chips = suggestionChips(user.role);

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
        keyExtractor={(_, i) => `${i}`}
        contentContainerStyle={[styles.listContent, { paddingBottom: space.md }]}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
        ListEmptyComponent={
          <View style={styles.hintWrap}>
            <Text style={styles.hintTitle}>Campus Assistant</Text>
            <Text style={styles.hintBody}>
              Ask about your schedule, bookable offerings, rooms, alerts, or policy. Answers use live data from your account.
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
              {chips.map((c) => (
                <Pressable
                  key={c.label}
                  style={styles.chip}
                  onPress={() => void sendMessage(c.text)}
                  disabled={loading}
                >
                  <Text style={styles.chipText}>{c.label}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        }
        renderItem={({ item }) => (
          <View
            style={[
              styles.bubble,
              item.role === 'user' ? styles.bubbleUser : styles.bubbleAssistant,
            ]}
          >
            <Text style={item.role === 'user' ? styles.bubbleTextUser : styles.bubbleTextAssistant}>
              {item.content}
            </Text>
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
          placeholder="Ask a question…"
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
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Ionicons name="arrow-up" size={22} color="#fff" />
          )}
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
