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

type CatRow = { id: string; course_name: string; course_code: string | null; is_active: boolean };

export default function CourseCatalogScreen() {
  const { user } = useAuth();
  const [rows, setRows] = useState<CatRow[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [editRow, setEditRow] = useState<CatRow | null>(null);
  const [eName, setEName] = useState('');
  const [eCode, setECode] = useState('');

  const load = useCallback(async () => {
    if (!isApiConfigured() || user?.role !== 'admin') return;
    const d = await apiFetch<{ courses: CatRow[] }>('/admin/catalog/courses');
    setRows(d.courses);
  }, [user?.role]);

  useFocusEffect(useCallback(() => { load().catch(() => {}); }, [load]));
  async function onRefresh() {
    setRefreshing(true);
    try { await load(); } finally { setRefreshing(false); }
  }

  async function createCat() {
    if (!name.trim()) { Alert.alert('Missing', 'Enter course name.'); return; }
    try {
      await apiFetch('/admin/catalog/courses', {
        method: 'POST',
        json: { courseName: name.trim(), courseCode: code.trim() || undefined },
      });
      setName('');
      setCode('');
      setShowCreate(false);
      await load();
      Alert.alert('Created', 'Catalog entry added.');
    } catch (e) { Alert.alert('Error', String(e)); }
  }

  function openEdit(r: CatRow) {
    setEditRow(r);
    setEName(r.course_name);
    setECode(r.course_code ?? '');
  }

  async function saveEdit() {
    if (!editRow) return;
    try {
      await apiFetch(`/admin/catalog/courses/${editRow.id}`, {
        method: 'PUT',
        json: { courseName: eName.trim() || undefined, courseCode: eCode.trim() || null },
      });
      setEditRow(null);
      await load();
      Alert.alert('Saved', 'Catalog updated.');
    } catch (e) { Alert.alert('Error', String(e)); }
  }

  async function deactivate(id: string) {
    Alert.alert('Deactivate catalog entry?', 'Offerings that reference it may still exist.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Deactivate',
        style: 'destructive',
        onPress: async () => {
          try {
            await apiFetch(`/admin/catalog/courses/${id}`, { method: 'DELETE' });
            await load();
          } catch (e) { Alert.alert('Error', String(e)); }
        },
      },
    ]);
  }

  if (!isApiConfigured()) return <EmptyState icon="cloud-offline-outline" title="API not configured" />;
  if (user?.role !== 'admin') return <EmptyState icon="shield-outline" title="Admin only" />;

  return (
    <>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.container}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.campus} />}
      >
        <Pressable style={styles.actionChip} onPress={() => setShowCreate(!showCreate)}>
          <Ionicons name={showCreate ? 'close' : 'add-circle'} size={18} color={colors.accent} />
          <Text style={styles.actionText}>{showCreate ? 'Close' : 'New catalog course'}</Text>
        </Pressable>

        {showCreate && (
          <GroupedCard style={{ padding: space.lg, marginBottom: space.lg }}>
            <Text style={styles.formTitle}>Add to catalog</Text>
            <Text style={styles.hint}>Name + optional code. Offerings link catalog rows to departments/years.</Text>
            <TextInput style={styles.input} placeholder="Course name" value={name} onChangeText={setName} placeholderTextColor={colors.tertiaryLabel} />
            <TextInput style={styles.input} placeholder="Code (optional)" value={code} onChangeText={setCode} autoCapitalize="characters" placeholderTextColor={colors.tertiaryLabel} />
            <PrimaryButton title="Create" onPress={createCat} />
          </GroupedCard>
        )}

        <SectionHeader title={`Catalog (${rows.length})`} style={{ marginTop: 0 }} />
        {rows.map((r, i) => (
          <Animated.View key={r.id} entering={enterFromBottom(i)}>
            <Pressable
              onPress={() => openEdit(r)}
              onLongPress={() => deactivate(r.id)}
              style={({ pressed }) => [styles.card, pressed && { transform: [{ scale: PRESS_SCALE }] }]}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>{r.course_name}</Text>
                <Text style={styles.cardSub}>{r.course_code ?? '—'}</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={colors.tertiaryLabel} />
            </Pressable>
          </Animated.View>
        ))}
        {rows.length === 0 && <EmptyState icon="book-outline" title="Empty catalog" subtitle="Add courses that can be offered each year." />}
      </ScrollView>

      <Modal visible={editRow !== null} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <Pressable style={styles.modalDismiss} onPress={() => setEditRow(null)} />
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Edit catalog</Text>
            <TextInput style={styles.input} placeholder="Name" value={eName} onChangeText={setEName} placeholderTextColor={colors.tertiaryLabel} />
            <TextInput style={styles.input} placeholder="Code" value={eCode} onChangeText={setECode} placeholderTextColor={colors.tertiaryLabel} />
            <View style={styles.modalActions}>
              <Pressable onPress={() => setEditRow(null)}>
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
  actionChip: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: space.xs, backgroundColor: colors.accentMuted, paddingHorizontal: space.md, paddingVertical: space.sm, borderRadius: radius.pill, marginBottom: space.lg },
  actionText: { ...type.subhead, color: colors.accent, fontWeight: '600' },
  formTitle: { ...type.headline, color: colors.label, marginBottom: space.sm },
  hint: { ...type.caption1, color: colors.secondaryLabel, marginBottom: space.md },
  input: { backgroundColor: colors.secondarySystemBackground, borderRadius: radius.md, padding: space.md, marginBottom: space.sm, ...type.body, color: colors.label },
  card: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.systemBackground, borderRadius: radius.lg, padding: space.md, marginBottom: space.xs, ...shadows.card },
  cardTitle: { ...type.subhead, color: colors.label, fontWeight: '600' },
  cardSub: { ...type.caption1, color: colors.secondaryLabel, marginTop: 2 },
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: colors.overlay },
  modalDismiss: { flex: 1 },
  modalSheet: { backgroundColor: colors.systemBackground, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, padding: space.xl, paddingBottom: 40 },
  modalHandle: { width: 40, height: 5, borderRadius: 3, backgroundColor: colors.fill, alignSelf: 'center', marginBottom: space.md },
  modalTitle: { ...type.title2, color: colors.label, marginBottom: space.md },
  modalActions: { flexDirection: 'row', alignItems: 'center', marginTop: space.md },
  cancelLink: { ...type.headline, color: colors.destructive },
});
