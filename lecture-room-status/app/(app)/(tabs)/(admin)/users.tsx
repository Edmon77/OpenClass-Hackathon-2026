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
  FlatList,
  Modal,
  Switch,
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
import { enterFromBottom, PRESS_SCALE } from '@/src/theme/motion';
import { colors, radius, space, type, shadows } from '@/src/theme/tokens';

type UserRow = { id: string; studentId: string; name: string; role: string; department: string | null; year: number | null; classSection: string | null; isActive: boolean; forcePasswordChange?: boolean };

export default function UsersScreen() {
  const { user } = useAuth();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [newStudentId, setNewStudentId] = useState('');
  const [newName, setNewName] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState<'student' | 'teacher' | 'admin'>('student');
  const [newDept, setNewDept] = useState('');
  const [newYear, setNewYear] = useState('');
  const [newClass, setNewClass] = useState('');
  const [bulkText, setBulkText] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [showBulk, setShowBulk] = useState(false);
  const [editUser, setEditUser] = useState<UserRow | null>(null);
  const [eName, setEName] = useState('');
  const [eRole, setERole] = useState<'student' | 'teacher' | 'admin'>('student');
  const [eDept, setEDept] = useState('');
  const [eYear, setEYear] = useState('');
  const [eClass, setEClass] = useState('');
  const [ePassword, setEPassword] = useState('');
  const [eActive, setEActive] = useState(true);
  const [eForceChange, setEForceChange] = useState(false);

  const load = useCallback(async () => {
    if (!isApiConfigured() || user?.role !== 'admin') return;
    const data = await apiFetch<{ users: UserRow[] }>('/admin/users');
    setUsers(data.users);
  }, [user?.role]);

  useFocusEffect(useCallback(() => { load().catch(() => {}); }, [load]));
  async function onRefresh() { setRefreshing(true); try { await load(); } finally { setRefreshing(false); } }

  async function createUser() {
    try {
      const year = newYear.trim() ? parseInt(newYear, 10) : undefined;
      await apiFetch('/admin/users', { method: 'POST', json: { studentId: newStudentId.trim().toUpperCase(), name: newName.trim(), password: newPassword, role: newRole, department: newDept.trim() || undefined, year: Number.isFinite(year) ? year : undefined, classSection: newClass.trim() || undefined } });
      setNewStudentId(''); setNewName(''); setNewPassword('');
      await load();
      Alert.alert('Created', 'User saved.');
    } catch (e) { Alert.alert('Error', String(e)); }
  }

  function parseUserCsv(text: string) {
    const lines = text.trim().split(/\r?\n/).filter(Boolean);
    if (!lines.length) return [];
    const head = lines[0].toLowerCase();
    const start = head.includes('student_id') || head.includes('studentid') ? 1 : 0;
    const out: { studentId: string; name: string; password: string; role?: 'student' | 'teacher' | 'admin'; department?: string; year?: number; classSection?: string }[] = [];
    for (let i = start; i < lines.length; i++) {
      const cols = lines[i].split(',').map((c) => c.trim().replace(/^"|"$/g, ''));
      if (cols.length < 3) continue;
      const [studentId, name, password, role, department, year, classSection] = cols;
      const row: (typeof out)[number] = { studentId, name, password };
      if (role && ['student', 'teacher', 'admin'].includes(role)) row.role = role as any;
      if (department) row.department = department;
      if (year && /^\d+$/.test(year)) row.year = parseInt(year, 10);
      if (classSection) row.classSection = classSection;
      out.push(row);
    }
    return out;
  }

  async function importBulk() {
    const parsed = parseUserCsv(bulkText);
    if (!parsed.length) { Alert.alert('Empty', 'Paste CSV lines: student_id,name,password[,role,dept,year,class]'); return; }
    try {
      const r = await apiFetch<{ created: number; updated: number }>('/admin/users/bulk', { method: 'POST', json: { users: parsed } });
      setBulkText(''); await load();
      Alert.alert('Import done', `Created ${r.created}, updated ${r.updated}.`);
    } catch (e) { Alert.alert('Error', String(e)); }
  }

  function openEdit(u: UserRow) {
    setEditUser(u);
    setEName(u.name);
    setERole(u.role as any);
    setEDept(u.department ?? '');
    setEYear(u.year != null ? String(u.year) : '');
    setEClass(u.classSection ?? '');
    setEPassword('');
    setEActive(u.isActive);
    setEForceChange(u.forcePasswordChange ?? false);
  }

  async function saveEdit() {
    if (!editUser) return;
    const y = eYear.trim() ? parseInt(eYear, 10) : null;
    try {
      await apiFetch(`/admin/users/${editUser.id}`, {
        method: 'PUT',
        json: {
          name: eName.trim() || undefined,
          role: eRole,
          department: eDept.trim() || null,
          year: y != null && Number.isFinite(y) ? y : null,
          classSection: eClass.trim() || null,
          isActive: eActive,
          forcePasswordChange: eForceChange,
          password: ePassword.trim() || undefined,
        },
      });
      setEditUser(null); await load();
      Alert.alert('Saved', 'User updated.');
    } catch (e) { Alert.alert('Error', String(e)); }
  }

  function roleBadge(r: string) {
    if (r === 'admin') return { color: colors.destructive, bg: 'rgba(255,59,48,0.12)' };
    if (r === 'teacher') return { color: colors.accent, bg: colors.accentMuted };
    return { color: colors.campus, bg: colors.campusMuted };
  }

  return (
    <>
    <ScrollView style={styles.scroll} contentContainerStyle={styles.container} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.campus} />}>
      {/* Actions */}
      <View style={styles.actionsRow}>
        <Pressable style={styles.actionChip} onPress={() => { setShowCreate(!showCreate); setShowBulk(false); }}>
          <Ionicons name={showCreate ? 'close' : 'person-add'} size={18} color={colors.accent} />
          <Text style={styles.actionText}>{showCreate ? 'Close' : 'New user'}</Text>
        </Pressable>
        <Pressable style={styles.actionChip} onPress={() => { setShowBulk(!showBulk); setShowCreate(false); }}>
          <Ionicons name={showBulk ? 'close' : 'cloud-upload'} size={18} color={colors.accent} />
          <Text style={styles.actionText}>{showBulk ? 'Close' : 'Bulk import'}</Text>
        </Pressable>
      </View>

      {showCreate && (
        <GroupedCard style={{ marginBottom: space.lg, padding: space.lg }}>
          <Text style={styles.formTitle}>Create user</Text>
          <TextInput style={styles.input} placeholder="Student ID" value={newStudentId} onChangeText={setNewStudentId} placeholderTextColor={colors.tertiaryLabel} />
          <TextInput style={styles.input} placeholder="Name" value={newName} onChangeText={setNewName} placeholderTextColor={colors.tertiaryLabel} />
          <TextInput style={styles.input} placeholder="Password (min 6)" secureTextEntry value={newPassword} onChangeText={setNewPassword} placeholderTextColor={colors.tertiaryLabel} />
          <View style={styles.pillRow}>
            {(['student', 'teacher', 'admin'] as const).map((r) => (
              <Pressable key={r} onPress={() => setNewRole(r)} style={[styles.pill, newRole === r && styles.pillOn]}>
                <Text style={newRole === r ? styles.pillTextOn : styles.pillTextOff}>{r}</Text>
              </Pressable>
            ))}
          </View>
          <TextInput style={styles.input} placeholder="Department (optional)" value={newDept} onChangeText={setNewDept} placeholderTextColor={colors.tertiaryLabel} />
          <TextInput style={styles.input} placeholder="Year (optional)" value={newYear} onChangeText={setNewYear} keyboardType="number-pad" placeholderTextColor={colors.tertiaryLabel} />
          <TextInput style={styles.input} placeholder="Class section (optional)" value={newClass} onChangeText={setNewClass} placeholderTextColor={colors.tertiaryLabel} />
          <PrimaryButton title="Create user" onPress={createUser} style={{ marginTop: space.sm }} />
        </GroupedCard>
      )}

      {showBulk && (
        <GroupedCard style={{ marginBottom: space.lg, padding: space.lg }}>
          <Text style={styles.formTitle}>Bulk import (CSV)</Text>
          <Text style={styles.hint}>student_id,name,password[,role,department,year,class]</Text>
          <TextInput style={[styles.input, styles.bulkInput]} placeholder="STU002,Jane,temp456,student,SE,5,A" value={bulkText} onChangeText={setBulkText} multiline placeholderTextColor={colors.tertiaryLabel} />
          <PrimaryButton title="Import users" onPress={importBulk} style={{ marginTop: space.sm }} />
        </GroupedCard>
      )}

      {/* User list */}
      <SectionHeader title={`All users (${users.length})`} style={{ marginTop: 0 }} />
      {users.map((u, i) => {
        const rb = roleBadge(u.role);
        return (
          <Animated.View key={u.id} entering={enterFromBottom(i)}>
            <Pressable
              onPress={() => openEdit(u)}
              style={({ pressed }) => [styles.userCard, pressed && { transform: [{ scale: PRESS_SCALE }] }]}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.userNameText}>{u.name}</Text>
                <Text style={styles.userIdText}>{u.studentId}{u.department ? ` · ${u.department}` : ''}{u.year ? ` · Y${u.year}` : ''}{u.classSection ? ` · ${u.classSection}` : ''}</Text>
              </View>
              <View style={[styles.rolePill, { backgroundColor: rb.bg }]}>
                <Text style={[styles.roleText, { color: rb.color }]}>{u.role}</Text>
              </View>
            </Pressable>
          </Animated.View>
        );
      })}
    </ScrollView>

    {/* Edit user modal */}
    <Modal visible={editUser !== null} animationType="slide" transparent>
      <View style={styles.modalOverlay}>
        <Pressable style={styles.modalDismiss} onPress={() => setEditUser(null)} />
        <ScrollView style={styles.modalSheet} contentContainerStyle={{ padding: space.xl, paddingBottom: 40 }}>
          <View style={styles.modalHandle} />
          <Text style={styles.modalTitle}>Edit {editUser?.studentId}</Text>
          <TextInput style={styles.input} placeholder="Name" value={eName} onChangeText={setEName} placeholderTextColor={colors.tertiaryLabel} />
          <View style={styles.pillRow}>
            {(['student', 'teacher', 'admin'] as const).map((r) => (
              <Pressable key={r} onPress={() => setERole(r)} style={[styles.pill, eRole === r && styles.pillOn]}>
                <Text style={eRole === r ? styles.pillTextOn : styles.pillTextOff}>{r}</Text>
              </Pressable>
            ))}
          </View>
          <TextInput style={styles.input} placeholder="Department" value={eDept} onChangeText={setEDept} placeholderTextColor={colors.tertiaryLabel} />
          <TextInput style={styles.input} placeholder="Year" value={eYear} onChangeText={setEYear} keyboardType="number-pad" placeholderTextColor={colors.tertiaryLabel} />
          <TextInput style={styles.input} placeholder="Class section" value={eClass} onChangeText={setEClass} placeholderTextColor={colors.tertiaryLabel} />
          <TextInput style={styles.input} placeholder="New password (leave blank to keep)" secureTextEntry value={ePassword} onChangeText={setEPassword} placeholderTextColor={colors.tertiaryLabel} />
          <View style={styles.switchRow}>
            <Text style={styles.switchLabel}>Active</Text>
            <Switch value={eActive} onValueChange={setEActive} trackColor={{ true: colors.campus }} />
          </View>
          <View style={styles.switchRow}>
            <Text style={styles.switchLabel}>Force password change</Text>
            <Switch value={eForceChange} onValueChange={setEForceChange} trackColor={{ true: colors.campus }} />
          </View>
          <View style={styles.modalActions}>
            <Pressable onPress={() => setEditUser(null)}>
              <Text style={styles.cancelLink}>Cancel</Text>
            </Pressable>
            <PrimaryButton title="Save" onPress={saveEdit} style={{ flex: 1, marginLeft: space.md }} />
          </View>
        </ScrollView>
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
  pillRow: { flexDirection: 'row', gap: space.sm, marginBottom: space.sm },
  pill: { paddingHorizontal: space.md, paddingVertical: space.xs, borderRadius: radius.pill, backgroundColor: colors.fill },
  pillOn: { backgroundColor: colors.campus },
  pillTextOff: { ...type.subhead, color: colors.label },
  pillTextOn: { ...type.subhead, color: '#fff', fontWeight: '600' },
  userCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.systemBackground, borderRadius: radius.lg, padding: space.md, marginBottom: space.xs, ...shadows.card },
  userNameText: { ...type.subhead, color: colors.label, fontWeight: '600' },
  userIdText: { ...type.caption1, color: colors.secondaryLabel, marginTop: 2 },
  rolePill: { paddingHorizontal: space.sm, paddingVertical: 3, borderRadius: radius.pill },
  roleText: { ...type.caption2, fontWeight: '700' },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: space.sm },
  switchLabel: { ...type.subhead, color: colors.label },
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: colors.overlay },
  modalDismiss: { flex: 1 },
  modalSheet: { backgroundColor: colors.systemBackground, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, maxHeight: '85%' },
  modalHandle: { width: 40, height: 5, borderRadius: 3, backgroundColor: colors.fill, alignSelf: 'center', marginBottom: space.md },
  modalTitle: { ...type.title2, color: colors.label, marginBottom: space.md },
  modalActions: { flexDirection: 'row', alignItems: 'center', marginTop: space.md },
  cancelLink: { ...type.headline, color: colors.destructive },
});
