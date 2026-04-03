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
  Modal,
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

type CourseRow = {
  id: string;
  course_name: string;
  course_code: string | null;
  faculty_name: string;
  department: string;
  year: number;
  class_section: string;
  teacher_name: string | null;
  teacher_student_id: string | null;
  semester_name: string;
  is_active: boolean;
};

export default function AdminCoursesScreen() {
  const { user } = useAuth();
  const [courses, setCourses] = useState<CourseRow[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const [showCreate, setShowCreate] = useState(false);
  const [showBulk, setShowBulk] = useState(false);
  const [cName, setCName] = useState('');
  const [cCode, setCCode] = useState('');
  const [cTeacher, setCTeacher] = useState('');
  const [cFaculty, setCFaculty] = useState('Faculty of Computing');
  const [cDept, setCDept] = useState('Software Engineering');
  const [cYear, setCYear] = useState('');
  const [cClass, setCClass] = useState('');
  const [bulkText, setBulkText] = useState('');

  const [editCourse, setEditCourse] = useState<CourseRow | null>(null);
  const [eName, setEName] = useState('');
  const [eCode, setECode] = useState('');
  const [eTeacher, setETeacher] = useState('');
  const [eFaculty, setEFaculty] = useState('');
  const [eDept, setEDept] = useState('');
  const [eYear, setEYear] = useState('');
  const [eClass, setEClass] = useState('');

  const load = useCallback(async () => {
    if (!isApiConfigured() || user?.role !== 'admin') return;
    const data = await apiFetch<{ courses: CourseRow[] }>('/admin/courses');
    setCourses(data.courses);
  }, [user?.role]);

  useFocusEffect(useCallback(() => { load().catch(() => {}); }, [load]));
  async function onRefresh() { setRefreshing(true); try { await load(); } finally { setRefreshing(false); } }

  async function createCourse() {
    const y = parseInt(cYear, 10);
    if (!cName.trim() || !cDept.trim() || !Number.isFinite(y)) {
      Alert.alert('Missing', 'Course name, faculty, department, and year are required.'); return;
    }
    try {
      await apiFetch('/admin/courses', {
        method: 'POST',
        json: {
          courseName: cName.trim(),
          courseCode: cCode.trim() || undefined,
          teacherStudentId: cTeacher.trim() ? cTeacher.trim().toUpperCase() : undefined,
          faculty: cFaculty.trim(),
          department: cDept.trim(),
          year: y,
          classSection: cClass.trim() || undefined,
        },
      });
      setCName(''); setCCode(''); setCTeacher(''); setCDept(''); setCYear(''); setCClass('');
      await load(); Alert.alert('Created', 'Course offering added.');
    } catch (e) { Alert.alert('Error', String(e)); }
  }

  function openEdit(c: CourseRow) {
    setEditCourse(c);
    setEName(c.course_name);
    setECode(c.course_code ?? '');
    setETeacher(c.teacher_student_id ?? '');
    setEFaculty(c.faculty_name || 'Faculty of Computing');
    setEDept(c.department);
    setEYear(String(c.year));
    setEClass(c.class_section);
  }

  async function saveEdit() {
    if (!editCourse) return;
    const y = parseInt(eYear, 10);
    try {
      await apiFetch(`/admin/courses/${editCourse.id}`, {
        method: 'PUT',
        json: {
          courseName: eName.trim() || undefined,
          courseCode: eCode.trim() || undefined,
          teacherStudentId: eTeacher.trim() ? eTeacher.trim().toUpperCase() : '',
          faculty: eFaculty.trim() || undefined,
          department: eDept.trim() || undefined,
          year: Number.isFinite(y) ? y : undefined,
          classSection: eClass.trim() || undefined,
        },
      });
      setEditCourse(null); await load();
      Alert.alert('Saved', 'Course updated.');
    } catch (e) { Alert.alert('Error', String(e)); }
  }

  async function deleteCourse(id: string) {
    Alert.alert('Deactivate course?', 'This hides it from booking lists.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Deactivate', style: 'destructive', onPress: async () => {
        try { await apiFetch(`/admin/courses/${id}`, { method: 'DELETE' }); await load(); } catch (e) { Alert.alert('Error', String(e)); }
      }},
    ]);
  }

  function parseCourseCsv(text: string) {
    const lines = text.trim().split(/\r?\n/).filter(Boolean);
    if (!lines.length) return [];
    const head = lines[0].toLowerCase();
    const start = head.includes('course_name') || head.includes('coursename') ? 1 : 0;
    const out: {
      courseName: string;
      courseCode?: string;
      teacherStudentId?: string;
      faculty: string;
      department: string;
      year: number;
      classSection?: string;
    }[] = [];
    for (let i = start; i < lines.length; i++) {
      const cols = lines[i].split(',').map((c) => c.trim().replace(/^"|"$/g, ''));
      if (cols.length < 5) continue;
      const [courseName, faculty, department, yearStr, classSection, teacherStudentId, courseCode] = cols;
      const year = parseInt(yearStr, 10);
      if (!Number.isFinite(year)) continue;
      const row: (typeof out)[number] = { courseName, faculty, department, year, classSection: classSection || '' };
      if (teacherStudentId) row.teacherStudentId = teacherStudentId;
      if (courseCode) row.courseCode = courseCode;
      out.push(row);
    }
    return out;
  }

  async function importBulk() {
    const parsed = parseCourseCsv(bulkText);
    if (!parsed.length) { Alert.alert('Empty', 'Paste CSV: course_name,faculty,department,year,section[,teacher_id,code]'); return; }
    try {
      const r = await apiFetch<{ created: number; skipped: number }>('/admin/courses/bulk', { method: 'POST', json: { courses: parsed } });
      setBulkText(''); await load();
      Alert.alert('Import done', `Created ${r.created}, skipped ${r.skipped} (teacher not found).`);
    } catch (e) { Alert.alert('Error', String(e)); }
  }

  if (!isApiConfigured()) return <EmptyState icon="cloud-offline-outline" title="API not configured" />;

  return (
    <>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.container} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.campus} />}>
        <View style={styles.actionsRow}>
          <Pressable style={styles.actionChip} onPress={() => { setShowCreate(!showCreate); setShowBulk(false); }}>
            <Ionicons name={showCreate ? 'close' : 'add-circle'} size={18} color={colors.accent} />
            <Text style={styles.actionText}>{showCreate ? 'Close' : 'New course'}</Text>
          </Pressable>
          <Pressable style={styles.actionChip} onPress={() => { setShowBulk(!showBulk); setShowCreate(false); }}>
            <Ionicons name={showBulk ? 'close' : 'cloud-upload'} size={18} color={colors.accent} />
            <Text style={styles.actionText}>{showBulk ? 'Close' : 'Bulk import'}</Text>
          </Pressable>
        </View>

        {showCreate && (
          <GroupedCard style={{ marginBottom: space.lg, padding: space.lg }}>
            <Text style={styles.formTitle}>Create course</Text>
            <TextInput style={styles.input} placeholder="Course name" value={cName} onChangeText={setCName} placeholderTextColor={colors.tertiaryLabel} />
            <TextInput style={styles.input} placeholder="Course code (optional)" value={cCode} onChangeText={setCCode} placeholderTextColor={colors.tertiaryLabel} />
            <TextInput style={styles.input} placeholder="Faculty (exact name)" value={cFaculty} onChangeText={setCFaculty} placeholderTextColor={colors.tertiaryLabel} />
            <TextInput style={styles.input} placeholder="Department (exact name)" value={cDept} onChangeText={setCDept} placeholderTextColor={colors.tertiaryLabel} />
            <TextInput style={styles.input} placeholder="Teacher ID (optional)" value={cTeacher} onChangeText={setCTeacher} autoCapitalize="characters" placeholderTextColor={colors.tertiaryLabel} />
            <TextInput style={styles.input} placeholder="Year" value={cYear} onChangeText={setCYear} keyboardType="number-pad" placeholderTextColor={colors.tertiaryLabel} />
            <TextInput style={styles.input} placeholder="Section A,B,... (optional)" value={cClass} onChangeText={setCClass} placeholderTextColor={colors.tertiaryLabel} />
            <PrimaryButton title="Create course" onPress={createCourse} />
          </GroupedCard>
        )}

        {showBulk && (
          <GroupedCard style={{ marginBottom: space.lg, padding: space.lg }}>
            <Text style={styles.formTitle}>Bulk import (CSV)</Text>
            <Text style={styles.hint}>course_name,faculty,department,year,section[,teacher_id,code]</Text>
            <TextInput style={[styles.input, styles.bulkInput]} placeholder="Database Systems,Faculty of Computing,Software Engineering,5,A,TCH001,CS401" value={bulkText} onChangeText={setBulkText} multiline placeholderTextColor={colors.tertiaryLabel} />
            <PrimaryButton title="Import courses" onPress={importBulk} />
          </GroupedCard>
        )}

        <SectionHeader title={`All courses (${courses.length})`} style={{ marginTop: 0 }} />
        {courses.map((c, i) => (
          <Animated.View key={c.id} entering={enterFromBottom(i)}>
            <Pressable
              onPress={() => openEdit(c)}
              onLongPress={() => deleteCourse(c.id)}
              style={({ pressed }) => [styles.card, pressed && { transform: [{ scale: PRESS_SCALE }] }]}
            >
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.xs }}>
                  <Text style={styles.cardTitle}>{c.course_name}</Text>
                  {!c.is_active && <View style={styles.inactiveBadge}><Text style={styles.inactiveBadgeText}>Inactive</Text></View>}
                </View>
                <Text style={styles.cardSub}>{c.teacher_name ? `${c.teacher_name} (${c.teacher_student_id})` : 'No teacher assigned'}</Text>
                <Text style={styles.cardMeta}>{c.department} · Year {c.year} · {c.class_section} · {c.semester_name}</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={colors.tertiaryLabel} />
            </Pressable>
          </Animated.View>
        ))}
        {courses.length === 0 && <EmptyState icon="book-outline" title="No courses" subtitle="Create courses or import via CSV." />}
      </ScrollView>

      {/* Edit modal */}
      <Modal visible={editCourse !== null} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <Pressable style={styles.modalDismiss} onPress={() => setEditCourse(null)} />
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Edit course</Text>
            <TextInput style={styles.input} placeholder="Course name" value={eName} onChangeText={setEName} placeholderTextColor={colors.tertiaryLabel} />
            <TextInput style={styles.input} placeholder="Course code" value={eCode} onChangeText={setECode} placeholderTextColor={colors.tertiaryLabel} />
            <TextInput style={styles.input} placeholder="Faculty" value={eFaculty} onChangeText={setEFaculty} placeholderTextColor={colors.tertiaryLabel} />
            <TextInput style={styles.input} placeholder="Teacher ID (empty to clear)" value={eTeacher} onChangeText={setETeacher} autoCapitalize="characters" placeholderTextColor={colors.tertiaryLabel} />
            <TextInput style={styles.input} placeholder="Department" value={eDept} onChangeText={setEDept} placeholderTextColor={colors.tertiaryLabel} />
            <TextInput style={styles.input} placeholder="Year" value={eYear} onChangeText={setEYear} keyboardType="number-pad" placeholderTextColor={colors.tertiaryLabel} />
            <TextInput style={styles.input} placeholder="Section" value={eClass} onChangeText={setEClass} placeholderTextColor={colors.tertiaryLabel} />
            <View style={styles.modalActions}>
              <Pressable onPress={() => setEditCourse(null)}>
                <Text style={styles.cancelLink}>Cancel</Text>
              </Pressable>
              <PrimaryButton title="Save" onPress={saveEdit} style={{ flex: 1, marginLeft: space.md }} />
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: colors.groupedBackground },
  container: { padding: space.lg, paddingBottom: space.xxl * 2 },
  actionsRow: { flexDirection: 'row', gap: space.sm, marginBottom: space.lg },
  actionChip: { flexDirection: 'row', alignItems: 'center', gap: space.xs, backgroundColor: colors.accentMuted, paddingHorizontal: space.md, paddingVertical: space.sm, borderRadius: radius.pill },
  actionText: { ...type.subhead, color: colors.accent, fontWeight: '600' },
  formTitle: { ...type.headline, color: colors.label, marginBottom: space.md },
  hint: { ...type.caption1, color: colors.secondaryLabel, marginBottom: space.sm },
  input: { backgroundColor: colors.secondarySystemBackground, borderRadius: radius.md, padding: space.md, marginBottom: space.sm, ...type.body, color: colors.label },
  bulkInput: { minHeight: 80, textAlignVertical: 'top' },
  card: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.systemBackground, borderRadius: radius.lg, padding: space.md, marginBottom: space.xs, ...shadows.card },
  cardTitle: { ...type.subhead, color: colors.label, fontWeight: '600' },
  cardSub: { ...type.caption1, color: colors.secondaryLabel, marginTop: 2 },
  cardMeta: { ...type.caption2, color: colors.tertiaryLabel, marginTop: 2 },
  inactiveBadge: { backgroundColor: 'rgba(255,59,48,0.12)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: radius.sm },
  inactiveBadgeText: { ...type.caption2, color: colors.destructive, fontWeight: '700' },
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: colors.overlay },
  modalDismiss: { flex: 1 },
  modalSheet: { backgroundColor: colors.systemBackground, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, padding: space.xl, paddingBottom: 40 },
  modalHandle: { width: 40, height: 5, borderRadius: 3, backgroundColor: colors.fill, alignSelf: 'center', marginBottom: space.md },
  modalTitle: { ...type.title2, color: colors.label, marginBottom: space.md },
  modalActions: { flexDirection: 'row', alignItems: 'center', marginTop: space.md },
  cancelLink: { ...type.headline, color: colors.destructive },
});
