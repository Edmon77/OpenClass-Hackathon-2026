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
  ActivityIndicator,
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
import { EmptyState } from '@/src/components/ui/EmptyState';
import { enterFromBottom, PRESS_SCALE } from '@/src/theme/motion';
import { colors, radius, space, type, shadows } from '@/src/theme/tokens';

type YearRow = { id: string; name: string; is_active: boolean };
type Opt = { id: string; name: string };
type UserHit = { id: string; student_id: string; name: string; year: number | null; section: string | null };
type CrRow = {
  id: string;
  user_name: string;
  student_id: string;
  department_name: string;
  year: number;
  section: string | null;
  is_active: boolean;
};

export default function CrAssignmentsScreen() {
  const { user } = useAuth();
  const [years, setYears] = useState<YearRow[]>([]);
  const [faculties, setFaculties] = useState<Opt[]>([]);
  const [departments, setDepartments] = useState<Opt[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const [crYearId, setCrYearId] = useState<string | null>(null);
  const [selFacultyId, setSelFacultyId] = useState<string | null>(null);
  const [selDeptId, setSelDeptId] = useState<string | null>(null);
  const [crYearNum, setCrYearNum] = useState('');
  const [crSection, setCrSection] = useState('');

  const [studentQ, setStudentQ] = useState('');
  const [studentHits, setStudentHits] = useState<UserHit[]>([]);
  const [studentLoading, setStudentLoading] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<UserHit | null>(null);

  const [crList, setCrList] = useState<CrRow[]>([]);

  const load = useCallback(async () => {
    if (!isApiConfigured() || user?.role !== 'admin') return;
    const [s, f] = await Promise.all([
      apiFetch<{ semesters: YearRow[] }>('/admin/semesters'),
      apiFetch<{ faculties: Opt[] }>('/structure/faculties'),
    ]);
    setYears(s.semesters);
    setFaculties(f.faculties);
    setCrYearId((prev) => {
      if (prev) return prev;
      const active = s.semesters.find((x) => x.is_active);
      return s.semesters.length ? (active?.id ?? s.semesters[0].id) : null;
    });
  }, [user?.role]);

  const loadDepts = useCallback(async (facultyId: string) => {
    const d = await apiFetch<{ departments: Opt[] }>(`/structure/departments?faculty_id=${encodeURIComponent(facultyId)}`);
    setDepartments(d.departments);
    setSelDeptId(null);
  }, []);

  const loadCrList = useCallback(async () => {
    if (!crYearId || !selDeptId) { setCrList([]); return; }
    try {
      const d = await apiFetch<{ assignments: CrRow[] }>(
        `/admin/cr-assignments?academic_year_id=${encodeURIComponent(crYearId)}&department_id=${encodeURIComponent(selDeptId)}`
      );
      setCrList(d.assignments ?? []);
    } catch {
      setCrList([]);
    }
  }, [crYearId, selDeptId]);

  useFocusEffect(useCallback(() => { load().catch(() => {}); }, [load]));
  useFocusEffect(useCallback(() => { loadCrList().catch(() => {}); }, [loadCrList]));
  async function onRefresh() { setRefreshing(true); try { await load(); await loadCrList(); } finally { setRefreshing(false); } }

  async function searchStudents(q: string) {
    setStudentQ(q);
    setSelectedStudent(null);
    if (q.trim().length < 2 || !selDeptId) { setStudentHits([]); return; }
    setStudentLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('department_id', selDeptId);
      if (crYearNum.trim()) params.set('year', crYearNum.trim());
      params.set('search', q.trim());
      const d = await apiFetch<{ users: UserHit[] }>(`/admin/users?${params.toString()}`);
      setStudentHits((d.users ?? []).filter((u) => (u as any).role === 'student' || true).slice(0, 20));
    } catch {
      setStudentHits([]);
    } finally {
      setStudentLoading(false);
    }
  }

  async function createCr() {
    if (!crYearId || !selDeptId || !selectedStudent || !crYearNum.trim()) {
      Alert.alert('Missing', 'Select academic year, department, search & pick a student, and enter cohort year.');
      return;
    }
    const y = parseInt(crYearNum, 10);
    if (!Number.isFinite(y)) { Alert.alert('Invalid year', 'Enter a valid cohort year number.'); return; }
    try {
      await apiFetch('/admin/cr-assignments', {
        method: 'POST',
        json: {
          userId: selectedStudent.id,
          academicYearId: crYearId,
          departmentId: selDeptId,
          year: y,
          section: crSection.trim() || null,
        },
      });
      setSelectedStudent(null);
      setStudentQ('');
      setStudentHits([]);
      await loadCrList();
      Alert.alert('OK', `${selectedStudent.name} assigned as CR.`);
    } catch (e) { Alert.alert('Error', String(e)); }
  }

  if (!isApiConfigured()) return <EmptyState icon="cloud-offline-outline" title="API not configured" />;
  if (user?.role !== 'admin') return <EmptyState icon="shield-outline" title="Admin only" />;

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.container} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.campus} />}>
      <Text style={styles.desc}>Assign a student as class representative for a department cohort (year + optional section).</Text>

      <GroupedCard style={{ padding: space.lg }}>
        <SectionHeader title="Academic year" style={{ marginTop: 0 }} />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: space.md }}>
          {years.map((s) => (
            <Pressable key={s.id} onPress={() => setCrYearId(s.id)} style={[styles.pick, crYearId === s.id && styles.pickOn]}>
              <Text style={[styles.pickText, crYearId === s.id && { color: colors.campus, fontWeight: '600' }]}>
                {s.name} {s.is_active ? '(active)' : ''}
              </Text>
            </Pressable>
          ))}
        </ScrollView>

        <SectionHeader title="Faculty" />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: space.sm }}>
          {faculties.map((f) => (
            <Pressable
              key={f.id}
              onPress={() => { setSelFacultyId(f.id); loadDepts(f.id).catch(() => {}); }}
              style={[styles.pick, selFacultyId === f.id && styles.pickOn]}
            >
              <Text style={[styles.pickText, selFacultyId === f.id && { color: colors.campus }]} numberOfLines={1}>{f.name}</Text>
            </Pressable>
          ))}
        </ScrollView>

        <SectionHeader title="Department" />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: space.md }}>
          {departments.map((d) => (
            <Pressable key={d.id} onPress={() => setSelDeptId(d.id)} style={[styles.pick, selDeptId === d.id && styles.pickOn]}>
              <Text style={[styles.pickText, selDeptId === d.id && { color: colors.campus, fontWeight: '600' }]} numberOfLines={1}>{d.name}</Text>
            </Pressable>
          ))}
        </ScrollView>

        <SectionHeader title="Cohort" />
        <TextInput style={styles.input} placeholder="Year (e.g. 5)" value={crYearNum} onChangeText={setCrYearNum} keyboardType="number-pad" placeholderTextColor={colors.tertiaryLabel} />
        <TextInput style={styles.input} placeholder="Section A,B,... (optional)" value={crSection} onChangeText={setCrSection} placeholderTextColor={colors.tertiaryLabel} />

        <SectionHeader title="Search student" />
        <TextInput
          style={styles.input}
          placeholder="Search by ID or name"
          value={studentQ}
          onChangeText={(t) => { void searchStudents(t); }}
          placeholderTextColor={colors.tertiaryLabel}
        />
        {studentLoading && <ActivityIndicator color={colors.campus} />}
        {studentHits.map((s) => (
          <Pressable
            key={s.id}
            style={[styles.hitRow, selectedStudent?.id === s.id && styles.hitRowSel]}
            onPress={() => setSelectedStudent(s)}
          >
            <Ionicons
              name={selectedStudent?.id === s.id ? 'checkmark-circle' : 'ellipse-outline'}
              size={20}
              color={selectedStudent?.id === s.id ? colors.campus : colors.tertiaryLabel}
            />
            <View style={{ flex: 1 }}>
              <Text style={styles.hitName}>{s.name}</Text>
              <Text style={styles.hitSub}>{s.student_id} · yr {s.year ?? '?'} · sec {s.section ?? '—'}</Text>
            </View>
          </Pressable>
        ))}
        {selectedStudent && (
          <View style={styles.selectedBanner}>
            <Ionicons name="person" size={18} color={colors.campus} />
            <Text style={styles.selectedTxt}>{selectedStudent.name} ({selectedStudent.student_id})</Text>
          </View>
        )}

        <PrimaryButton title="Assign CR" onPress={createCr} style={{ marginTop: space.md }} />
      </GroupedCard>

      {crList.length > 0 && (
        <>
          <SectionHeader title={`Existing CRs (${crList.length})`} />
          {crList.map((cr, i) => (
            <Animated.View key={cr.id} entering={enterFromBottom(i)}>
              <View style={styles.crCard}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.crName}>{cr.user_name}</Text>
                  <Text style={styles.crSub}>{cr.student_id} · {cr.department_name} · yr {cr.year}{cr.section ? ` · sec ${cr.section}` : ''}</Text>
                </View>
                <View style={[styles.activeDot, { backgroundColor: cr.is_active ? colors.statusFree : colors.fill }]} />
              </View>
            </Animated.View>
          ))}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: colors.groupedBackground },
  container: { padding: space.lg, paddingBottom: space.xxl * 2 },
  desc: { ...type.subhead, color: colors.secondaryLabel, marginBottom: space.lg },
  input: { backgroundColor: colors.secondarySystemBackground, borderRadius: radius.md, padding: space.md, marginBottom: space.sm, ...type.body, color: colors.label },
  pick: { paddingHorizontal: space.md, paddingVertical: space.sm, borderRadius: radius.pill, backgroundColor: colors.fill, marginRight: space.sm, maxWidth: 280 },
  pickOn: { backgroundColor: colors.campusMuted },
  pickText: { ...type.subhead, color: colors.label },
  hitRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingVertical: space.sm, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.separator },
  hitRowSel: { backgroundColor: colors.campusMuted, borderRadius: radius.md, paddingHorizontal: space.sm },
  hitName: { ...type.body, color: colors.label },
  hitSub: { ...type.caption2, color: colors.secondaryLabel },
  selectedBanner: { flexDirection: 'row', alignItems: 'center', gap: space.sm, backgroundColor: colors.campusMuted, borderRadius: radius.md, paddingHorizontal: space.md, paddingVertical: space.sm, marginTop: space.sm },
  selectedTxt: { ...type.subhead, color: colors.campus, fontWeight: '600' },
  crCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.systemBackground, borderRadius: radius.lg, padding: space.md, marginBottom: space.xs, ...shadows.card },
  crName: { ...type.subhead, color: colors.label, fontWeight: '600' },
  crSub: { ...type.caption2, color: colors.secondaryLabel, marginTop: 2 },
  activeDot: { width: 10, height: 10, borderRadius: 5 },
});
