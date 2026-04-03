import { useCallback, useMemo, useState } from 'react';
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
import { EmptyState } from '@/src/components/ui/EmptyState';
import { enterFromBottom, PRESS_SCALE } from '@/src/theme/motion';
import { colors, radius, space, type, shadows } from '@/src/theme/tokens';

type YearRow = { id: string; name: string; start_date: string; end_date: string; is_active: boolean };
type OfferingRow = {
  id: string;
  course_name: string;
  course_code: string | null;
  department_name: string;
  year: number;
  section: string | null;
  teacher_name: string | null;
  teacher_student_id: string | null;
  is_active: boolean;
};

export default function CourseOfferingsScreen() {
  const { user } = useAuth();
  const [years, setYears] = useState<YearRow[]>([]);
  const [yearId, setYearId] = useState<string | null>(null);
  const [offerings, setOfferings] = useState<OfferingRow[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const [cCatalogId, setCCatalogId] = useState('');
  const [cFaculty, setCFaculty] = useState('Faculty of Computing');
  const [cDept, setCDept] = useState('Software Engineering');
  const [cYear, setCYear] = useState('5');
  const [cSection, setCSection] = useState('');
  const [cTeacher, setCTeacher] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [showBulk, setShowBulk] = useState(false);
  const [bulkText, setBulkText] = useState('');

  const loadYears = useCallback(async () => {
    if (!isApiConfigured() || user?.role !== 'admin') return;
    const d = await apiFetch<{ semesters: YearRow[] }>('/admin/semesters');
    setYears(d.semesters);
    setYearId((prev) => {
      if (prev && d.semesters.some((y) => y.id === prev)) return prev;
      const active = d.semesters.find((y) => y.is_active);
      return active?.id ?? d.semesters[0]?.id ?? null;
    });
  }, [user?.role]);

  const loadOfferings = useCallback(async () => {
    if (!yearId || !isApiConfigured() || user?.role !== 'admin') {
      setOfferings([]);
      return;
    }
    const d = await apiFetch<{ offerings: OfferingRow[] }>(
      `/admin/course-offerings?academic_year_id=${encodeURIComponent(yearId)}`
    );
    setOfferings(d.offerings);
  }, [user?.role, yearId]);

  useFocusEffect(
    useCallback(() => {
      loadYears().catch(() => {});
    }, [loadYears])
  );

  useFocusEffect(
    useCallback(() => {
      loadOfferings().catch(() => {});
    }, [loadOfferings])
  );

  async function onRefresh() {
    setRefreshing(true);
    try {
      await loadYears();
      await loadOfferings();
    } finally {
      setRefreshing(false);
    }
  }

  const catalogHint = useMemo(
    () => 'Paste a catalog course UUID from the Course catalog screen, or create offerings from the Courses hub.',
    []
  );

  async function createOffering() {
    if (!yearId) { Alert.alert('Pick a year', 'Select an academic year first.'); return; }
    if (!cCatalogId.trim()) { Alert.alert('Missing', 'Enter catalog course id (UUID).'); return; }
    const y = parseInt(cYear, 10);
    if (!Number.isFinite(y)) { Alert.alert('Missing', 'Enter year.'); return; }
    try {
      const fac = await apiFetch<{ faculties: { id: string; name: string }[] }>('/structure/faculties');
      const matchF = fac.faculties.find((f) => f.name.trim() === cFaculty.trim());
      if (!matchF) { Alert.alert('Faculty not found', 'Use the exact faculty name from the seed.'); return; }
      const dep = await apiFetch<{ departments: { id: string; name: string }[] }>(
        `/structure/departments?faculty_id=${encodeURIComponent(matchF.id)}`
      );
      const matchD = dep.departments.find((d) => d.name.trim() === cDept.trim());
      if (!matchD) { Alert.alert('Department not found', 'Use the exact department name under that faculty.'); return; }
      await apiFetch('/admin/course-offerings', {
        method: 'POST',
        json: {
          courseId: cCatalogId.trim(),
          academicYearId: yearId,
          departmentId: matchD.id,
          year: y,
          section: cSection.trim() || null,
          teacherStudentId: cTeacher.trim() || undefined,
        },
      });
      setCCatalogId('');
      setCTeacher('');
      setShowCreate(false);
      await loadOfferings();
      Alert.alert('Created', 'Offering added.');
    } catch (e) { Alert.alert('Error', String(e)); }
  }

  function parseBulkCsv(text: string) {
    const lines = text.trim().split(/\r?\n/).filter(Boolean);
    if (!lines.length) return [];
    const head = lines[0].toLowerCase();
    const start = head.includes('course_code') ? 1 : 0;
    const out: { courseCode: string; faculty: string; department: string; year: number; section?: string; teacherStudentId?: string }[] = [];
    for (let i = start; i < lines.length; i++) {
      const cols = lines[i].split(',').map((c) => c.trim().replace(/^"|"$/g, ''));
      if (cols.length < 4) continue;
      const [courseCode, faculty, department, yearStr, section, teacherStudentId] = cols;
      const year = parseInt(yearStr, 10);
      if (!Number.isFinite(year)) continue;
      const row: (typeof out)[number] = { courseCode, faculty, department, year };
      if (section) row.section = section;
      if (teacherStudentId) row.teacherStudentId = teacherStudentId;
      out.push(row);
    }
    return out;
  }

  async function importBulk() {
    const parsed = parseBulkCsv(bulkText);
    if (!parsed.length) {
      Alert.alert('Empty', 'Paste CSV: course_code,faculty,department,year[,section,teacher_id]');
      return;
    }
    try {
      const r = await apiFetch<{ created: number; skipped: number }>('/admin/course-offerings/bulk', { method: 'POST', json: { offerings: parsed } });
      setBulkText('');
      await loadOfferings();
      Alert.alert('Import done', `Created ${r.created}, skipped ${r.skipped}.`);
    } catch (e) { Alert.alert('Error', String(e)); }
  }

  async function deactivateOffering(id: string) {
    Alert.alert('Deactivate offering?', 'It will no longer be bookable.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Deactivate',
        style: 'destructive',
        onPress: async () => {
          try {
            await apiFetch(`/admin/course-offerings/${id}`, { method: 'DELETE' });
            await loadOfferings();
          } catch (e) { Alert.alert('Error', String(e)); }
        },
      },
    ]);
  }

  if (!isApiConfigured()) return <EmptyState icon="cloud-offline-outline" title="API not configured" />;
  if (user?.role !== 'admin') return <EmptyState icon="shield-outline" title="Admin only" />;

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.campus} />}
    >
      <Text style={styles.lead}>Browse offerings per academic year. Activate a year on the Academic years screen.</Text>

      <SectionHeader title="Academic year" style={{ marginTop: 0 }} />
      <GroupedCard style={{ padding: space.sm }}>
        {years.map((y) => (
          <Pressable
            key={y.id}
            onPress={() => setYearId(y.id)}
            style={[styles.yearRow, yearId === y.id && styles.yearRowOn]}
          >
            <Ionicons name={y.is_active ? 'checkmark-circle' : 'ellipse-outline'} size={18} color={y.is_active ? colors.campus : colors.tertiaryLabel} />
            <View style={{ flex: 1 }}>
              <Text style={styles.yearName}>{y.name}</Text>
              <Text style={styles.yearMeta}>{y.start_date} → {y.end_date}</Text>
            </View>
          </Pressable>
        ))}
        {years.length === 0 && <Text style={styles.muted}>No academic years yet.</Text>}
      </GroupedCard>

      <View style={styles.actionsRow}>
        <Pressable style={styles.actionChip} onPress={() => { setShowCreate(!showCreate); setShowBulk(false); }}>
          <Ionicons name={showCreate ? 'close' : 'add-circle'} size={18} color={colors.accent} />
          <Text style={styles.actionText}>{showCreate ? 'Close' : 'New offering'}</Text>
        </Pressable>
        <Pressable style={styles.actionChip} onPress={() => { setShowBulk(!showBulk); setShowCreate(false); }}>
          <Ionicons name={showBulk ? 'close' : 'cloud-upload'} size={18} color={colors.accent} />
          <Text style={styles.actionText}>{showBulk ? 'Close' : 'Bulk import'}</Text>
        </Pressable>
      </View>

      {showBulk && yearId && (
        <GroupedCard style={{ padding: space.lg, marginBottom: space.lg }}>
          <Text style={styles.formTitle}>Bulk import (CSV)</Text>
          <Text style={styles.hint}>course_code,faculty,department,year[,section,teacher_id]</Text>
          <TextInput
            style={[styles.input, styles.bulkInput]}
            placeholder="CS401,Faculty of Computing,Software Engineering,5,A,TCH001"
            value={bulkText}
            onChangeText={setBulkText}
            multiline
            placeholderTextColor={colors.tertiaryLabel}
          />
          <PrimaryButton title="Import offerings" onPress={importBulk} />
        </GroupedCard>
      )}

      {showCreate && yearId && (
        <GroupedCard style={{ padding: space.lg, marginBottom: space.lg }}>
          <Text style={styles.formTitle}>Create offering</Text>
          <Text style={styles.hint}>{catalogHint}</Text>
          <TextInput style={styles.input} placeholder="Catalog course ID (UUID)" value={cCatalogId} onChangeText={setCCatalogId} autoCapitalize="none" placeholderTextColor={colors.tertiaryLabel} />
          <TextInput style={styles.input} placeholder="Faculty (exact name)" value={cFaculty} onChangeText={setCFaculty} placeholderTextColor={colors.tertiaryLabel} />
          <TextInput style={styles.input} placeholder="Department (exact name)" value={cDept} onChangeText={setCDept} placeholderTextColor={colors.tertiaryLabel} />
          <TextInput style={styles.input} placeholder="Year" value={cYear} onChangeText={setCYear} keyboardType="number-pad" placeholderTextColor={colors.tertiaryLabel} />
          <TextInput style={styles.input} placeholder="Section (optional)" value={cSection} onChangeText={setCSection} placeholderTextColor={colors.tertiaryLabel} />
          <TextInput style={styles.input} placeholder="Teacher ID (optional)" value={cTeacher} onChangeText={setCTeacher} autoCapitalize="characters" placeholderTextColor={colors.tertiaryLabel} />
          <PrimaryButton title="Create offering" onPress={createOffering} />
        </GroupedCard>
      )}

      <SectionHeader title={`Offerings (${offerings.length})`} />
      {offerings.map((o, i) => (
        <Animated.View key={o.id} entering={enterFromBottom(i)}>
          <Pressable
            onLongPress={() => deactivateOffering(o.id)}
            style={({ pressed }) => [styles.card, pressed && { transform: [{ scale: PRESS_SCALE }] }]}
          >
            <Text style={styles.cardTitle}>{o.course_name}</Text>
            <Text style={styles.cardSub}>
              {o.teacher_name ? `${o.teacher_name} (${o.teacher_student_id})` : 'No teacher'}
            </Text>
            <Text style={styles.cardMeta}>
              {o.department_name} · Year {o.year}
              {o.section ? ` · Sec ${o.section}` : ''}
              {!o.is_active ? ' · Inactive' : ''}
            </Text>
          </Pressable>
        </Animated.View>
      ))}
      {yearId && offerings.length === 0 && (
        <EmptyState icon="layers-outline" title="No offerings" subtitle="Create offerings or use the combined Courses screen." />
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: colors.groupedBackground },
  container: { padding: space.lg, paddingBottom: space.xxl * 2 },
  lead: { ...type.subhead, color: colors.secondaryLabel, marginBottom: space.md },
  yearRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingVertical: space.md, paddingHorizontal: space.md, borderRadius: radius.md },
  yearRowOn: { backgroundColor: colors.campusMuted },
  yearName: { ...type.subhead, color: colors.label, fontWeight: '600' },
  yearMeta: { ...type.caption2, color: colors.secondaryLabel },
  muted: { ...type.footnote, color: colors.tertiaryLabel, padding: space.md },
  actionChip: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: space.xs, backgroundColor: colors.accentMuted, paddingHorizontal: space.md, paddingVertical: space.sm, borderRadius: radius.pill, marginVertical: space.md },
  actionText: { ...type.subhead, color: colors.accent, fontWeight: '600' },
  formTitle: { ...type.headline, color: colors.label, marginBottom: space.sm },
  hint: { ...type.caption1, color: colors.secondaryLabel, marginBottom: space.md },
  input: { backgroundColor: colors.secondarySystemBackground, borderRadius: radius.md, padding: space.md, marginBottom: space.sm, ...type.body, color: colors.label },
  actionsRow: { flexDirection: 'row', gap: space.sm, marginVertical: space.md },
  bulkInput: { minHeight: 80, textAlignVertical: 'top' },
  card: { backgroundColor: colors.systemBackground, borderRadius: radius.lg, padding: space.md, marginBottom: space.xs, ...shadows.card },
  cardTitle: { ...type.subhead, color: colors.label, fontWeight: '600' },
  cardSub: { ...type.caption1, color: colors.secondaryLabel, marginTop: 2 },
  cardMeta: { ...type.caption2, color: colors.tertiaryLabel, marginTop: 4 },
});
