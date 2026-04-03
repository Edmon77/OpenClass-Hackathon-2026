import { useCallback, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Alert,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import Animated from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/src/context/AuthContext';
import { apiFetch } from '@/src/api/client';
import { isApiConfigured } from '@/src/api/config';
import { SectionHeader } from '@/src/components/ui/SectionHeader';
import { GroupedCard } from '@/src/components/ui/GroupedCard';
import { PrimaryButton } from '@/src/components/ui/PrimaryButton';
import { enterFromBottom } from '@/src/theme/motion';
import { colors, radius, space, type, shadows } from '@/src/theme/tokens';

type SemesterRow = { id: string; name: string; start_date: string; end_date: string; is_active: boolean };

export default function SemestersScreen() {
  const { user } = useAuth();
  const [semesters, setSemesters] = useState<SemesterRow[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [semName, setSemName] = useState('');
  const [semStart, setSemStart] = useState('2026-01-01');
  const [semEnd, setSemEnd] = useState('2026-06-30');
  const [showForm, setShowForm] = useState(false);

  const load = useCallback(async () => {
    if (!isApiConfigured() || user?.role !== 'admin') return;
    const s = await apiFetch<{ semesters: SemesterRow[] }>('/admin/semesters');
    setSemesters(s.semesters);
  }, [user?.role]);

  useFocusEffect(useCallback(() => { load().catch(() => {}); }, [load]));
  async function onRefresh() { setRefreshing(true); try { await load(); } finally { setRefreshing(false); } }

  async function createSemester() {
    if (!semName.trim()) { Alert.alert('Missing', 'Enter semester name and dates.'); return; }
    try {
      await apiFetch('/admin/semesters', { method: 'POST', json: { name: semName.trim(), startDate: semStart.trim(), endDate: semEnd.trim() } });
      setSemName(''); await load(); Alert.alert('Created', 'Academic year added.');
    } catch (e) { Alert.alert('Error', String(e)); }
  }

  async function activateSemester(id: string) {
    try { await apiFetch(`/admin/semesters/${id}/activate`, { method: 'POST' }); await load(); Alert.alert('OK', 'Active academic year updated.'); } catch (e) { Alert.alert('Error', String(e)); }
  }

  function closeSemester(id: string) {
    Alert.alert('Close academic year?', 'Deactivates offerings and CR assignments tied to this year.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Close', style: 'destructive', onPress: async () => {
        try { await apiFetch(`/admin/semesters/${id}/close`, { method: 'POST' }); await load(); Alert.alert('Closed', 'Archived.'); } catch (e) { Alert.alert('Error', String(e)); }
      }},
    ]);
  }

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.container} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.campus} />}>
      <Pressable style={styles.actionChip} onPress={() => setShowForm(!showForm)}>
        <Ionicons name={showForm ? 'close' : 'add-circle'} size={18} color={colors.accent} />
        <Text style={styles.actionText}>{showForm ? 'Close' : 'New academic year'}</Text>
      </Pressable>

      {showForm && (
        <GroupedCard style={{ padding: space.lg, marginVertical: space.md }}>
          <Text style={styles.formTitle}>Create academic year</Text>
          <TextInput style={styles.input} placeholder="Name (e.g. 2025/26)" value={semName} onChangeText={setSemName} placeholderTextColor={colors.tertiaryLabel} />
          <TextInput style={styles.input} placeholder="Start YYYY-MM-DD" value={semStart} onChangeText={setSemStart} autoCapitalize="none" placeholderTextColor={colors.tertiaryLabel} />
          <TextInput style={styles.input} placeholder="End YYYY-MM-DD" value={semEnd} onChangeText={setSemEnd} autoCapitalize="none" placeholderTextColor={colors.tertiaryLabel} />
          <PrimaryButton title="Create academic year" onPress={createSemester} />
        </GroupedCard>
      )}

      <SectionHeader title={`Academic years (${semesters.length})`} style={{ marginTop: space.md }} />
      {semesters.map((s, i) => (
        <Animated.View key={s.id} entering={enterFromBottom(i)}>
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={[styles.statusDot, { backgroundColor: s.is_active ? colors.statusFree : colors.fill }]} />
              <Text style={styles.cardTitle}>{s.name}</Text>
              {s.is_active && <View style={styles.activeBadge}><Text style={styles.activeBadgeText}>Active</Text></View>}
            </View>
            <Text style={styles.cardDates}>{s.start_date} → {s.end_date}</Text>
            <View style={styles.cardActions}>
              <Pressable onPress={() => activateSemester(s.id)} style={styles.actionBtn}>
                <Text style={styles.linkText}>Set active</Text>
              </Pressable>
              <Pressable onPress={() => closeSemester(s.id)} style={styles.actionBtn}>
                <Text style={styles.linkDanger}>Close & archive</Text>
              </Pressable>
            </View>
          </View>
        </Animated.View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: colors.groupedBackground },
  container: { padding: space.lg, paddingBottom: space.xxl * 2 },
  actionChip: { flexDirection: 'row', alignItems: 'center', gap: space.xs, backgroundColor: colors.accentMuted, paddingHorizontal: space.md, paddingVertical: space.sm, borderRadius: radius.pill, alignSelf: 'flex-start' },
  actionText: { ...type.subhead, color: colors.accent, fontWeight: '600' },
  formTitle: { ...type.headline, color: colors.label, marginBottom: space.md },
  input: { backgroundColor: colors.secondarySystemBackground, borderRadius: radius.md, padding: space.md, marginBottom: space.sm, ...type.body, color: colors.label },
  card: { backgroundColor: colors.systemBackground, borderRadius: radius.lg, padding: space.lg, marginBottom: space.sm, ...shadows.card },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  statusDot: { width: 10, height: 10, borderRadius: 5 },
  cardTitle: { ...type.headline, color: colors.label, flex: 1 },
  activeBadge: { backgroundColor: colors.campusMuted, paddingHorizontal: space.sm, paddingVertical: 2, borderRadius: radius.pill },
  activeBadgeText: { ...type.caption2, color: colors.campus, fontWeight: '700' },
  cardDates: { ...type.footnote, color: colors.secondaryLabel, marginTop: space.xs },
  cardActions: { flexDirection: 'row', gap: space.lg, marginTop: space.sm },
  actionBtn: { paddingVertical: space.xs },
  linkText: { ...type.subhead, color: colors.accent, fontWeight: '600' },
  linkDanger: { ...type.subhead, color: colors.destructive, fontWeight: '600' },
});
