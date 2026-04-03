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

type CourseItem = { id: string; course_name: string };

export default function CrSetupScreen() {
  const { user } = useAuth();
  const [allowed, setAllowed] = useState(false);
  const [courseName, setCourseName] = useState('');
  const [teacherId, setTeacherId] = useState('');
  const [contact, setContact] = useState('');
  const [list, setList] = useState<CourseItem[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const [editItem, setEditItem] = useState<CourseItem | null>(null);
  const [eName, setEName] = useState('');
  const [eTeacher, setETeacher] = useState('');
  const [eContact, setEContact] = useState('');

  const load = useCallback(async () => {
    if (!isApiConfigured() || !user) return;
    try {
      const data = await apiFetch<{ courses: CourseItem[] }>('/courses/cr-list');
      setAllowed(true);
      setList(data.courses);
    } catch { setAllowed(false); setList([]); }
  }, [user]);

  useFocusEffect(useCallback(() => { load().catch(() => {}); }, [load]));
  async function onRefresh() { setRefreshing(true); try { await load(); } finally { setRefreshing(false); } }

  async function addCourse() {
    if (!user) return;
    const tid = teacherId.trim();
    if (!courseName.trim() || !tid) { Alert.alert('Missing', 'Enter course name and teacher user ID.'); return; }
    try {
      await apiFetch('/courses', { method: 'POST', json: { courseName: courseName.trim(), teacherStudentId: tid.toUpperCase(), teacherContact: contact.trim() || undefined } });
      setCourseName(''); setTeacherId(''); setContact('');
      await load(); Alert.alert('Saved', 'Course added for your class.');
    } catch (e) { Alert.alert('Error', String(e)); }
  }

  function openEdit(c: CourseItem) {
    setEditItem(c);
    setEName(c.course_name);
    setETeacher('');
    setEContact('');
  }

  async function saveEdit() {
    if (!editItem) return;
    try {
      await apiFetch(`/courses/${editItem.id}`, {
        method: 'PUT',
        json: {
          courseName: eName.trim() || undefined,
          teacherStudentId: eTeacher.trim().toUpperCase() || undefined,
          teacherContact: eContact.trim() || undefined,
        },
      });
      setEditItem(null); await load();
      Alert.alert('Saved', 'Course updated.');
    } catch (e) { Alert.alert('Error', String(e)); }
  }

  async function deleteCourse(id: string) {
    Alert.alert('Remove course?', 'This deactivates the course for this semester.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: async () => {
        try { await apiFetch(`/courses/${id}`, { method: 'DELETE' }); await load(); } catch (e) { Alert.alert('Error', String(e)); }
      }},
    ]);
  }

  if (!isApiConfigured()) return <EmptyState icon="cloud-offline-outline" title="API not configured" />;
  if (!user) return null;
  if (!allowed) return <EmptyState icon="shield-outline" title="Class rep only" subtitle="Only assigned class representatives can manage semester courses." />;

  return (
    <>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.container}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.campus} />}
      >
        <SectionHeader title="Add new course" style={{ marginTop: 0 }} />
        <GroupedCard style={{ padding: space.lg, marginBottom: space.lg }}>
          <Text style={styles.desc}>Link a course to a teacher for your cohort this semester.</Text>
          <TextInput style={styles.input} placeholder="Course name" placeholderTextColor={colors.tertiaryLabel} value={courseName} onChangeText={setCourseName} />
          <TextInput style={styles.input} placeholder="Teacher user ID (e.g. TCH001)" placeholderTextColor={colors.tertiaryLabel} autoCapitalize="characters" value={teacherId} onChangeText={setTeacherId} />
          <TextInput style={styles.input} placeholder="Teacher contact (optional)" placeholderTextColor={colors.tertiaryLabel} value={contact} onChangeText={setContact} />
          <PrimaryButton title="Add course" onPress={addCourse} />
        </GroupedCard>

        <SectionHeader title={`Your courses (${list.length})`} />
        {list.map((c, i) => (
          <Animated.View key={c.id} entering={enterFromBottom(i)}>
            <Pressable
              onPress={() => openEdit(c)}
              onLongPress={() => deleteCourse(c.id)}
              style={({ pressed }) => [styles.courseRow, pressed && { transform: [{ scale: PRESS_SCALE }] }]}
            >
              <Ionicons name="book" size={18} color={colors.campus} />
              <Text style={styles.courseText}>{c.course_name}</Text>
              <Ionicons name="chevron-forward" size={16} color={colors.tertiaryLabel} />
            </Pressable>
          </Animated.View>
        ))}
        {list.length === 0 && <Text style={styles.emptyHint}>No courses yet — add one above.</Text>}
      </ScrollView>

      <Modal visible={editItem !== null} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <Pressable style={styles.modalDismiss} onPress={() => setEditItem(null)} />
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Edit course</Text>
            <TextInput style={styles.input} placeholder="Course name" value={eName} onChangeText={setEName} placeholderTextColor={colors.tertiaryLabel} />
            <TextInput style={styles.input} placeholder="Teacher ID (leave blank to keep)" value={eTeacher} onChangeText={setETeacher} autoCapitalize="characters" placeholderTextColor={colors.tertiaryLabel} />
            <TextInput style={styles.input} placeholder="Teacher contact" value={eContact} onChangeText={setEContact} placeholderTextColor={colors.tertiaryLabel} />
            <View style={styles.modalActions}>
              <Pressable onPress={() => setEditItem(null)}>
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
  desc: { ...type.subhead, color: colors.secondaryLabel, marginBottom: space.md },
  input: { backgroundColor: colors.secondarySystemBackground, borderRadius: radius.md, padding: space.md, marginBottom: space.sm, ...type.body, color: colors.label },
  courseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    backgroundColor: colors.systemBackground,
    paddingVertical: space.md,
    paddingHorizontal: space.lg,
    borderRadius: radius.lg,
    marginBottom: space.xs,
    ...shadows.card,
  },
  courseText: { ...type.body, color: colors.label, flex: 1 },
  emptyHint: { ...type.footnote, color: colors.tertiaryLabel, marginTop: space.sm },
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: colors.overlay },
  modalDismiss: { flex: 1 },
  modalSheet: { backgroundColor: colors.systemBackground, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, padding: space.xl, paddingBottom: 40 },
  modalHandle: { width: 40, height: 5, borderRadius: 3, backgroundColor: colors.fill, alignSelf: 'center', marginBottom: space.md },
  modalTitle: { ...type.title2, color: colors.label, marginBottom: space.md },
  modalActions: { flexDirection: 'row', alignItems: 'center', marginTop: space.md },
  cancelLink: { ...type.headline, color: colors.destructive },
});
