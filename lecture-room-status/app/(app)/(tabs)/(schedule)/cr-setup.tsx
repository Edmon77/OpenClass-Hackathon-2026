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
import { enterFromBottom } from '@/src/theme/motion';
import { colors, radius, space, type, shadows } from '@/src/theme/tokens';

export default function CrSetupScreen() {
  const { user } = useAuth();
  const [allowed, setAllowed] = useState(false);
  const [courseName, setCourseName] = useState('');
  const [teacherId, setTeacherId] = useState('');
  const [contact, setContact] = useState('');
  const [list, setList] = useState<{ id: string; course_name: string }[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!isApiConfigured() || !user) return;
    try {
      const data = await apiFetch<{ courses: { id: string; course_name: string }[] }>('/courses/cr-list');
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

  if (!isApiConfigured()) return <EmptyState icon="cloud-offline-outline" title="API not configured" />;
  if (!user) return null;

  if (!allowed) {
    return <EmptyState icon="shield-outline" title="Class rep only" subtitle="Only assigned class representatives can manage semester courses." />;
  }

  return (
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
          <View style={styles.courseRow}>
            <Ionicons name="book" size={18} color={colors.campus} />
            <Text style={styles.courseText}>{c.course_name}</Text>
          </View>
        </Animated.View>
      ))}
      {list.length === 0 && (
        <Text style={styles.emptyHint}>No courses yet — add one above.</Text>
      )}
    </ScrollView>
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
});
