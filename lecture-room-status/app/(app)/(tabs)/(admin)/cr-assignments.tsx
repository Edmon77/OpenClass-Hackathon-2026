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
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/src/context/AuthContext';
import { apiFetch } from '@/src/api/client';
import { isApiConfigured } from '@/src/api/config';
import { SectionHeader } from '@/src/components/ui/SectionHeader';
import { GroupedCard } from '@/src/components/ui/GroupedCard';
import { PrimaryButton } from '@/src/components/ui/PrimaryButton';
import { colors, radius, space, type, shadows } from '@/src/theme/tokens';

type SemesterRow = { id: string; name: string; is_active: boolean };

export default function CrAssignmentsScreen() {
  const { user } = useAuth();
  const [semesters, setSemesters] = useState<SemesterRow[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [crUserId, setCrUserId] = useState('');
  const [crSemId, setCrSemId] = useState<string | null>(null);
  const [crDept, setCrDept] = useState('');
  const [crYear, setCrYear] = useState('');
  const [crClass, setCrClass] = useState('');

  const load = useCallback(async () => {
    if (!isApiConfigured() || user?.role !== 'admin') return;
    const s = await apiFetch<{ semesters: SemesterRow[] }>('/admin/semesters');
    setSemesters(s.semesters);
    setCrSemId((prev) => {
      if (prev) return prev;
      const active = s.semesters.find((x) => x.is_active);
      return s.semesters.length ? (active?.id ?? s.semesters[0].id) : null;
    });
  }, [user?.role]);

  useFocusEffect(useCallback(() => { load().catch(() => {}); }, [load]));
  async function onRefresh() { setRefreshing(true); try { await load(); } finally { setRefreshing(false); } }

  async function createCr() {
    if (!crSemId || !crUserId.trim() || !crDept.trim() || !crYear.trim() || !crClass.trim()) {
      Alert.alert('Missing', 'All fields required: semester, user UUID, department, year, class.'); return;
    }
    const y = parseInt(crYear, 10);
    if (!Number.isFinite(y)) { Alert.alert('Invalid year', ''); return; }
    try {
      await apiFetch('/admin/cr-assignments', { method: 'POST', json: { userId: crUserId.trim(), semesterId: crSemId, department: crDept.trim(), year: y, classSection: crClass.trim() } });
      setCrUserId(''); Alert.alert('OK', 'Class rep assignment created.');
    } catch (e) { Alert.alert('Error', String(e)); }
  }

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.container} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.campus} />}>
      <Text style={styles.desc}>Assign a student as class representative for a semester, department, year, and section. The student must already exist in the system.</Text>

      <GroupedCard style={{ padding: space.lg }}>
        <SectionHeader title="Semester" style={{ marginTop: 0 }} />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: space.md }}>
          {semesters.map((s) => (
            <Pressable key={s.id} onPress={() => setCrSemId(s.id)} style={[styles.pick, crSemId === s.id && styles.pickOn]}>
              <Text style={[styles.pickText, crSemId === s.id && { color: colors.campus, fontWeight: '600' }]}>
                {s.name} {s.is_active ? '(active)' : ''}
              </Text>
            </Pressable>
          ))}
        </ScrollView>

        <SectionHeader title="Student" />
        <TextInput style={styles.input} placeholder="User UUID" value={crUserId} onChangeText={setCrUserId} autoCapitalize="none" placeholderTextColor={colors.tertiaryLabel} />

        <SectionHeader title="Cohort" />
        <TextInput style={styles.input} placeholder="Department" value={crDept} onChangeText={setCrDept} placeholderTextColor={colors.tertiaryLabel} />
        <TextInput style={styles.input} placeholder="Year" value={crYear} onChangeText={setCrYear} keyboardType="number-pad" placeholderTextColor={colors.tertiaryLabel} />
        <TextInput style={styles.input} placeholder="Class section" value={crClass} onChangeText={setCrClass} placeholderTextColor={colors.tertiaryLabel} />

        <PrimaryButton title="Assign CR" onPress={createCr} style={{ marginTop: space.sm }} />
      </GroupedCard>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: colors.groupedBackground },
  container: { padding: space.lg, paddingBottom: space.xxl * 2 },
  desc: { ...type.subhead, color: colors.secondaryLabel, marginBottom: space.lg },
  input: { backgroundColor: colors.secondarySystemBackground, borderRadius: radius.md, padding: space.md, marginBottom: space.sm, ...type.body, color: colors.label },
  pick: { paddingHorizontal: space.md, paddingVertical: space.sm, borderRadius: radius.pill, backgroundColor: colors.fill, marginRight: space.sm },
  pickOn: { backgroundColor: colors.campusMuted },
  pickText: { ...type.subhead, color: colors.label },
});
