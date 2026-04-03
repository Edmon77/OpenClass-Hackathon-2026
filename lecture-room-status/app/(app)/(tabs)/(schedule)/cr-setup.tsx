import { useCallback, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  Alert,
  ScrollView,
  RefreshControl,
  Modal,
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

type CourseItem = {
  id: string;
  course_name: string;
  course_code: string | null;
  teacher_name: string | null;
  teacher_student_id: string | null;
};

type TeacherHit = { id: string; student_id: string; name: string };
type StudentHit = { id: string; student_id: string; name: string; section: string | null };

export default function CrSetupScreen() {
  const { user } = useAuth();
  const mySection = user?.section?.trim() || user?.class_section?.trim() || 'A';
  const [allowed, setAllowed] = useState(false);
  const [courseName, setCourseName] = useState('');
  const [courseCode, setCourseCode] = useState('');
  const [teacherId, setTeacherId] = useState('');
  const [list, setList] = useState<CourseItem[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const [editItem, setEditItem] = useState<CourseItem | null>(null);
  const [eName, setEName] = useState('');
  const [eCode, setECode] = useState('');
  const [eTeacher, setETeacher] = useState('');

  const [teacherModalFor, setTeacherModalFor] = useState<CourseItem | null>(null);
  const [teacherQ, setTeacherQ] = useState('');
  const [teacherHits, setTeacherHits] = useState<TeacherHit[]>([]);
  const [teacherLoading, setTeacherLoading] = useState(false);

  const [studentQ, setStudentQ] = useState('');
  const [studentHits, setStudentHits] = useState<StudentHit[]>([]);
  const [studentLoading, setStudentLoading] = useState(false);

  const load = useCallback(async () => {
    if (!isApiConfigured() || !user) return;
    try {
      const data = await apiFetch<{ courses: CourseItem[] }>('/courses/cr-list');
      setAllowed(true);
      setList(data.courses);
    } catch {
      setAllowed(false);
      setList([]);
    }
  }, [user]);

  useFocusEffect(useCallback(() => { load().catch(() => {}); }, [load]));
  async function onRefresh() {
    setRefreshing(true);
    try { await load(); } finally { setRefreshing(false); }
  }

  async function addCourse() {
    if (!user) return;
    if (!courseName.trim()) {
      Alert.alert('Missing', 'Enter course name.');
      return;
    }
    const tid = teacherId.trim();
    try {
      await apiFetch('/courses', {
        method: 'POST',
        json: {
          courseName: courseName.trim(),
          courseCode: courseCode.trim() || undefined,
          teacherStudentId: tid ? tid.toUpperCase() : undefined,
        },
      });
      setCourseName('');
      setCourseCode('');
      setTeacherId('');
      await load();
      Alert.alert('Saved', 'Course offering added for your class.');
    } catch (e) { Alert.alert('Error', String(e)); }
  }

  function openEdit(c: CourseItem) {
    setEditItem(c);
    setEName(c.course_name);
    setECode(c.course_code ?? '');
    setETeacher('');
  }

  async function saveEdit() {
    if (!editItem) return;
    try {
      await apiFetch(`/courses/${editItem.id}`, {
        method: 'PUT',
        json: {
          courseName: eName.trim() || undefined,
          courseCode: eCode.trim() || undefined,
          teacherStudentId: eTeacher.trim() ? eTeacher.trim().toUpperCase() : undefined,
        },
      });
      setEditItem(null);
      await load();
      Alert.alert('Saved', 'Course updated.');
    } catch (e) { Alert.alert('Error', String(e)); }
  }

  async function deleteCourse(id: string) {
    Alert.alert('Remove course?', 'This deactivates the offering for this year.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          try {
            await apiFetch(`/courses/${id}`, { method: 'DELETE' });
            await load();
          } catch (e) { Alert.alert('Error', String(e)); }
        },
      },
    ]);
  }

  async function searchTeachers(q: string) {
    setTeacherQ(q);
    if (q.trim().length < 1) { setTeacherHits([]); return; }
    setTeacherLoading(true);
    try {
      const d = await apiFetch<{ teachers: TeacherHit[] }>(
        `/courses/teachers/search?q=${encodeURIComponent(q.trim())}`
      );
      setTeacherHits(d.teachers);
    } catch {
      setTeacherHits([]);
    } finally {
      setTeacherLoading(false);
    }
  }

  async function assignTeacher(offeringId: string, teacherStudentId: string | null) {
    try {
      await apiFetch(`/courses/offerings/${offeringId}/teacher`, {
        method: 'PUT',
        json: { teacherStudentId },
      });
      setTeacherModalFor(null);
      setTeacherHits([]);
      setTeacherQ('');
      await load();
      Alert.alert('Saved', teacherStudentId ? 'Teacher assigned.' : 'Teacher cleared.');
    } catch (e) { Alert.alert('Error', String(e)); }
  }

  async function searchStudents(q: string) {
    setStudentQ(q);
    if (q.trim().length < 1) { setStudentHits([]); return; }
    setStudentLoading(true);
    try {
      const d = await apiFetch<{ students: StudentHit[] }>(
        `/courses/students/search?q=${encodeURIComponent(q.trim())}`
      );
      setStudentHits(d.students);
    } catch {
      setStudentHits([]);
    } finally {
      setStudentLoading(false);
    }
  }

  async function setStudentSection(studentId: string, section: string | null) {
    try {
      await apiFetch(`/courses/students/${studentId}/section`, {
        method: 'PUT',
        json: { section },
      });
      await searchStudents(studentQ);
      Alert.alert('OK', section ? 'Student section updated.' : 'Removed from section.');
    } catch (e) { Alert.alert('Error', String(e)); }
  }

  if (!isApiConfigured()) return <EmptyState icon="cloud-offline-outline" title="API not configured" />;
  if (!user) return null;
  if (!allowed) {
    return (
      <EmptyState
        icon="shield-outline"
        title="Class rep only"
        subtitle="Only assigned class representatives can manage courses for their section."
      />
    );
  }

  return (
    <>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.container}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.campus} />}
      >
        <SectionHeader title="Add course offering" style={{ marginTop: 0 }} />
        <GroupedCard style={{ padding: space.lg, marginBottom: space.lg }}>
          <Text style={styles.desc}>Creates a catalog course and ties it to your cohort for the active academic year.</Text>
          <TextInput style={styles.input} placeholder="Course name" placeholderTextColor={colors.tertiaryLabel} value={courseName} onChangeText={setCourseName} />
          <TextInput style={styles.input} placeholder="Course code (optional)" placeholderTextColor={colors.tertiaryLabel} value={courseCode} onChangeText={setCourseCode} autoCapitalize="characters" />
          <TextInput style={styles.input} placeholder="Teacher ID (optional, e.g. TCH001)" placeholderTextColor={colors.tertiaryLabel} autoCapitalize="characters" value={teacherId} onChangeText={setTeacherId} />
          <PrimaryButton title="Add course" onPress={addCourse} />
        </GroupedCard>

        <SectionHeader title="Students in your cohort" />
        <GroupedCard style={{ padding: space.lg, marginBottom: space.lg }}>
          <Text style={styles.desc}>Search classmates by ID or name. Assign them to your section or clear section.</Text>
          <TextInput
            style={styles.input}
            placeholder="Search students…"
            placeholderTextColor={colors.tertiaryLabel}
            value={studentQ}
            onChangeText={(t) => { void searchStudents(t); }}
          />
          {studentLoading && <ActivityIndicator color={colors.campus} />}
          {studentHits.map((s) => (
            <View key={s.id} style={styles.hitRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.hitName}>{s.name}</Text>
                <Text style={styles.hitSub}>{s.student_id} · sec {s.section ?? '—'}</Text>
              </View>
              <Pressable style={styles.smallBtn} onPress={() => setStudentSection(s.id, mySection)}>
                <Text style={styles.smallBtnTxt}>Sec {mySection}</Text>
              </Pressable>
              <Pressable style={styles.smallBtn} onPress={() => setStudentSection(s.id, null)}>
                <Text style={styles.smallBtnTxt}>Clear</Text>
              </Pressable>
            </View>
          ))}
        </GroupedCard>

        <SectionHeader title={`Your offerings (${list.length})`} />
        {list.map((c, i) => (
          <Animated.View key={c.id} entering={enterFromBottom(i)}>
            <View style={styles.courseBlock}>
              <Pressable
                onPress={() => openEdit(c)}
                onLongPress={() => deleteCourse(c.id)}
                style={({ pressed }) => [styles.courseRow, pressed && { transform: [{ scale: PRESS_SCALE }] }]}
              >
                <Ionicons name="book" size={18} color={colors.campus} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.courseText}>{c.course_name}</Text>
                  <Text style={styles.courseMeta}>
                    {c.teacher_name ? `${c.teacher_name} (${c.teacher_student_id})` : 'No teacher'}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={colors.tertiaryLabel} />
              </Pressable>
              <Pressable style={styles.linkRow} onPress={() => { setTeacherModalFor(c); setTeacherQ(''); setTeacherHits([]); }}>
                <Ionicons name="person-add-outline" size={16} color={colors.accent} />
                <Text style={styles.linkTxt}>Assign teacher</Text>
              </Pressable>
            </View>
          </Animated.View>
        ))}
        {list.length === 0 && <Text style={styles.emptyHint}>No courses yet — add one above.</Text>}
      </ScrollView>

      <Modal visible={editItem !== null} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <Pressable style={styles.modalDismiss} onPress={() => setEditItem(null)} />
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Edit offering</Text>
            <TextInput style={styles.input} placeholder="Course name" value={eName} onChangeText={setEName} placeholderTextColor={colors.tertiaryLabel} />
            <TextInput style={styles.input} placeholder="Course code" value={eCode} onChangeText={setECode} placeholderTextColor={colors.tertiaryLabel} />
            <TextInput style={styles.input} placeholder="Teacher ID (leave blank to keep)" value={eTeacher} onChangeText={setETeacher} autoCapitalize="characters" placeholderTextColor={colors.tertiaryLabel} />
            <View style={styles.modalActions}>
              <Pressable onPress={() => setEditItem(null)}>
                <Text style={styles.cancelLink}>Cancel</Text>
              </Pressable>
              <PrimaryButton title="Save" onPress={saveEdit} style={{ flex: 1, marginLeft: space.md }} />
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={teacherModalFor !== null} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <Pressable style={styles.modalDismiss} onPress={() => setTeacherModalFor(null)} />
          <View style={[styles.modalSheet, { maxHeight: '80%' }]}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Assign teacher</Text>
            <TextInput
              style={styles.input}
              placeholder="Search by ID or name"
              value={teacherQ}
              onChangeText={(t) => { void searchTeachers(t); }}
              placeholderTextColor={colors.tertiaryLabel}
            />
            {teacherLoading && <ActivityIndicator color={colors.campus} />}
            <ScrollView style={{ maxHeight: 220 }}>
              {teacherHits.map((t) => (
                <Pressable
                  key={t.id}
                  style={styles.hitPick}
                  onPress={() => teacherModalFor && assignTeacher(teacherModalFor.id, t.student_id)}
                >
                  <Text style={styles.hitName}>{t.name}</Text>
                  <Text style={styles.hitSub}>{t.student_id}</Text>
                </Pressable>
              ))}
            </ScrollView>
            {teacherModalFor && (
              <Pressable style={styles.clearTeacher} onPress={() => assignTeacher(teacherModalFor.id, null)}>
                <Text style={styles.clearTeacherTxt}>Remove teacher</Text>
              </Pressable>
            )}
            <PrimaryButton title="Close" onPress={() => setTeacherModalFor(null)} />
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: colors.groupedBackground },
  container: { padding: space.lg, paddingBottom: space.xxl * 2 },
  desc: { ...type.subhead, color: colors.secondaryLabel, marginBottom: space.md },
  input: { backgroundColor: colors.secondarySystemBackground, borderRadius: radius.md, padding: space.md, marginBottom: space.sm, ...type.body, color: colors.label },
  courseBlock: { marginBottom: space.sm },
  courseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    backgroundColor: colors.systemBackground,
    paddingVertical: space.md,
    paddingHorizontal: space.lg,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    ...shadows.card,
  },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
    backgroundColor: colors.systemBackground,
    paddingVertical: space.sm,
    paddingHorizontal: space.lg,
    borderBottomLeftRadius: radius.lg,
    borderBottomRightRadius: radius.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.separator,
  },
  linkTxt: { ...type.subhead, color: colors.accent, fontWeight: '600' },
  courseText: { ...type.body, color: colors.label, fontWeight: '600' },
  courseMeta: { ...type.caption1, color: colors.secondaryLabel, marginTop: 2 },
  emptyHint: { ...type.footnote, color: colors.tertiaryLabel, marginTop: space.sm },
  hitRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingVertical: space.sm, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.separator },
  hitName: { ...type.body, color: colors.label },
  hitSub: { ...type.caption2, color: colors.secondaryLabel },
  smallBtn: { backgroundColor: colors.fill, paddingHorizontal: space.sm, paddingVertical: 6, borderRadius: radius.pill },
  smallBtnTxt: { ...type.caption1, color: colors.campus, fontWeight: '600' },
  hitPick: { paddingVertical: space.sm, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.separator },
  clearTeacher: { paddingVertical: space.md, alignItems: 'center' },
  clearTeacherTxt: { ...type.subhead, color: colors.destructive, fontWeight: '600' },
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: colors.overlay },
  modalDismiss: { flex: 1 },
  modalSheet: { backgroundColor: colors.systemBackground, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, padding: space.xl, paddingBottom: 40 },
  modalHandle: { width: 40, height: 5, borderRadius: 3, backgroundColor: colors.fill, alignSelf: 'center', marginBottom: space.md },
  modalTitle: { ...type.title2, color: colors.label, marginBottom: space.md },
  modalActions: { flexDirection: 'row', alignItems: 'center', marginTop: space.md },
  cancelLink: { ...type.headline, color: colors.destructive },
});
