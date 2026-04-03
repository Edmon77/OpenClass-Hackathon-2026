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

type UserRow = {
  id: string;
  studentId: string;
  name: string;
  role: string;
  department_name?: string | null;
  faculty_name?: string | null;
  year: number | null;
  section?: string | null;
  isActive: boolean;
  forcePasswordChange?: boolean;
};

type Opt = { id: string; name: string };

export default function UsersScreen() {
  const { user } = useAuth();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [total, setTotal] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  const [faculties, setFaculties] = useState<Opt[]>([]);
  const [departments, setDepartments] = useState<Opt[]>([]);
  const [selFacultyId, setSelFacultyId] = useState<string | null>(null);
  const [selDeptId, setSelDeptId] = useState<string | null>(null);
  const [filterYear, setFilterYear] = useState('');
  const [searchQ, setSearchQ] = useState('');

  const [newStudentId, setNewStudentId] = useState('');
  const [newName, setNewName] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState<'student' | 'teacher' | 'admin'>('student');
  const [newFacultyId, setNewFacultyId] = useState<string | null>(null);
  const [newDeptId, setNewDeptId] = useState<string | null>(null);
  const [newDeptList, setNewDeptList] = useState<Opt[]>([]);
  const [newYear, setNewYear] = useState('');
  const [newSection, setNewSection] = useState('');
  const [newGender, setNewGender] = useState('');
  const [newProgram, setNewProgram] = useState('');
  const [newFieldOfStudy, setNewFieldOfStudy] = useState('');
  const [newAdmissionType, setNewAdmissionType] = useState('');
  const [bulkText, setBulkText] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [showBulk, setShowBulk] = useState(false);
  const [editUser, setEditUser] = useState<UserRow | null>(null);
  const [eName, setEName] = useState('');
  const [eRole, setERole] = useState<'student' | 'teacher' | 'admin'>('student');
  const [eDeptId, setEDeptId] = useState<string | null>(null);
  const [eYear, setEYear] = useState('');
  const [eSection, setESection] = useState('');
  const [ePassword, setEPassword] = useState('');
  const [eActive, setEActive] = useState(true);
  const [eForceChange, setEForceChange] = useState(false);

  const loadFaculties = useCallback(async () => {
    const d = await apiFetch<{ faculties: Opt[] }>('/structure/faculties');
    setFaculties(d.faculties);
  }, []);

  const loadDepartments = useCallback(async (facultyId: string) => {
    const d = await apiFetch<{ departments: Opt[] }>(`/structure/departments?faculty_id=${encodeURIComponent(facultyId)}`);
    setDepartments(d.departments);
  }, []);

  const loadNewDepts = useCallback(async (facultyId: string) => {
    const d = await apiFetch<{ departments: Opt[] }>(`/structure/departments?faculty_id=${encodeURIComponent(facultyId)}`);
    setNewDeptList(d.departments);
  }, []);

  const load = useCallback(async () => {
    if (!isApiConfigured() || user?.role !== 'admin') return;
    const params = new URLSearchParams();
    if (selDeptId) params.set('department_id', selDeptId);
    else if (selFacultyId) params.set('faculty_id', selFacultyId);
    const y = filterYear.trim() ? parseInt(filterYear, 10) : null;
    if (y != null && Number.isFinite(y)) params.set('year', String(y));
    const q = searchQ.trim();
    if (q) params.set('search', q);
    if (!params.toString()) {
      setUsers([]);
      setTotal(0);
      return;
    }
    const data = await apiFetch<{ users: UserRow[]; total: number }>(`/admin/users?${params.toString()}`);
    setUsers(data.users);
    setTotal(data.total);
  }, [user?.role, selFacultyId, selDeptId, filterYear, searchQ]);

  useFocusEffect(
    useCallback(() => {
      if (user?.role === 'admin') {
        loadFaculties().catch(() => {});
      }
    }, [user?.role, loadFaculties])
  );

  useFocusEffect(useCallback(() => { load().catch(() => {}); }, [load]));

  async function onRefresh() {
    setRefreshing(true);
    try {
      await load();
    } finally {
      setRefreshing(false);
    }
  }

  async function createUser() {
    try {
      const year = newYear.trim() ? parseInt(newYear, 10) : undefined;
      await apiFetch('/admin/users', {
        method: 'POST',
        json: {
          studentId: newStudentId.trim().toUpperCase(),
          name: newName.trim(),
          password: newPassword,
          role: newRole,
          facultyId: newFacultyId ?? undefined,
          departmentId: newDeptId ?? undefined,
          gender: newGender.trim() || undefined,
          program: newProgram.trim() || undefined,
          fieldOfStudy: newFieldOfStudy.trim() || undefined,
          admissionType: newAdmissionType.trim() || undefined,
          year: Number.isFinite(year!) ? year : undefined,
          section: newSection.trim() || undefined,
        },
      });
      setNewStudentId('');
      setNewName('');
      setNewPassword('');
      setNewGender('');
      setNewProgram('');
      setNewFieldOfStudy('');
      setNewAdmissionType('');
      await load();
      Alert.alert('Created', 'User saved.');
    } catch (e) {
      Alert.alert('Error', String(e));
    }
  }

  function parseUserCsv(text: string) {
    const lines = text.trim().split(/\r?\n/).filter(Boolean);
    if (!lines.length) return [];
    const split = (line: string) => line.split(',').map((c) => c.trim().replace(/^"|"$/g, ''));
    const header = split(lines[0]).map((h) => h.toLowerCase());
    const hasHeader = header.includes('student_id') || header.includes('studentid');
    const idx = (name: string) => header.indexOf(name);
    const start = hasHeader ? 1 : 0;

    type BulkRow = {
      studentId: string;
      name: string;
      password: string;
      role?: 'student' | 'teacher' | 'admin';
      gender?: string;
      program?: string;
      faculty?: string;
      department?: string;
      fieldOfStudy?: string;
      admissionType?: string;
      year?: number;
      section?: string;
    };
    const out: BulkRow[] = [];

    const extended = hasHeader && (idx('first_name') >= 0 || idx('firstname') >= 0);

    for (let i = start; i < lines.length; i++) {
      const cols = split(lines[i]);
      if (extended && hasHeader) {
        const g = (k: string) => {
          const j = idx(k);
          return j >= 0 ? cols[j] : '';
        };
        const sid = g('student_id') || g('studentid');
        const fn = g('first_name') || g('firstname');
        const father = g('father_name') || g('fathername');
        const name = [fn, father].filter(Boolean).join(' ').trim() || g('name');
        const password = g('password');
        if (!sid || !name || !password) continue;
        const row: BulkRow = { studentId: sid, name, password };
        const r = g('role');
        if (r && ['student', 'teacher', 'admin'].includes(r)) row.role = r as BulkRow['role'];
        const yRaw = g('year');
        if (yRaw && /^\d+$/.test(yRaw)) row.year = parseInt(yRaw, 10);
        const gen = g('gender');
        if (gen) row.gender = gen;
        const prog = g('program');
        if (prog) row.program = prog;
        const fac = g('faculty');
        if (fac) row.faculty = fac;
        const dep = g('department');
        if (dep) row.department = dep;
        const fos = g('field_of_study') || g('fieldofstudy');
        if (fos) row.fieldOfStudy = fos;
        const adm = g('admission_type') || g('admissiontype');
        if (adm) row.admissionType = adm;
        const sec = g('section');
        if (sec) row.section = sec;
        out.push(row);
        continue;
      }

      if (cols.length < 3) continue;
      const [studentId, name, password, role, faculty, department, year, section] = cols;
      const row: BulkRow = { studentId, name, password };
      if (role && ['student', 'teacher', 'admin'].includes(role)) row.role = role as BulkRow['role'];
      if (faculty) row.faculty = faculty;
      if (department) row.department = department;
      if (year && /^\d+$/.test(year)) row.year = parseInt(year, 10);
      if (section) row.section = section;
      out.push(row);
    }
    return out;
  }

  async function importBulk() {
    const parsed = parseUserCsv(bulkText);
    if (!parsed.length) {
      Alert.alert('Empty', 'Paste CSV (see csv-templates/students_template.csv) or legacy: student_id,name,password,...');
      return;
    }
    try {
      const r = await apiFetch<{ created: number; updated: number }>('/admin/users/bulk', { method: 'POST', json: { users: parsed } });
      setBulkText('');
      await load();
      Alert.alert('Import done', `Created ${r.created}, updated ${r.updated}.`);
    } catch (e) {
      Alert.alert('Error', String(e));
    }
  }

  function openEdit(u: UserRow) {
    setEditUser(u);
    setEName(u.name);
    setERole(u.role as any);
    setEDeptId(null);
    setEYear(u.year != null ? String(u.year) : '');
    setESection(u.section ?? '');
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
          departmentId: eDeptId,
          year: y != null && Number.isFinite(y) ? y : null,
          section: eSection.trim() || null,
          isActive: eActive,
          forcePasswordChange: eForceChange,
          password: ePassword.trim() || undefined,
        },
      });
      setEditUser(null);
      await load();
      Alert.alert('Saved', 'User updated.');
    } catch (e) {
      Alert.alert('Error', String(e));
    }
  }

  function roleBadge(r: string) {
    if (r === 'admin') return { bg: 'rgba(255,59,48,0.12)', color: colors.destructive };
    if (r === 'teacher') return { bg: colors.accentMuted, color: colors.accent };
    return { bg: colors.campusMuted, color: colors.campus };
  }

  if (!isApiConfigured()) return null;
  if (user?.role !== 'admin') return null;

  return (
    <>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.container}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.campus} />}
      >
        <SectionHeader title="Find users" style={{ marginTop: 0 }} />
        <GroupedCard style={{ padding: space.lg, marginBottom: space.md }}>
          <Text style={styles.hint}>Pick faculty and/or department, optional year, then search by ID or name.</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: space.sm }}>
            <View style={styles.pillRow}>
              {faculties.map((f) => (
                <Pressable key={f.id} onPress={() => { setSelFacultyId(f.id); setSelDeptId(null); loadDepartments(f.id).catch(() => {}); }} style={[styles.pill, selFacultyId === f.id && styles.pillOn]}>
                  <Text style={selFacultyId === f.id ? styles.pillTextOn : styles.pillTextOff} numberOfLines={1}>{f.name}</Text>
                </Pressable>
              ))}
            </View>
          </ScrollView>
          {selFacultyId && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: space.sm }}>
              <View style={styles.pillRow}>
                <Pressable onPress={() => setSelDeptId(null)} style={[styles.pill, selDeptId === null && styles.pillOn]}>
                  <Text style={selDeptId === null ? styles.pillTextOn : styles.pillTextOff}>All depts</Text>
                </Pressable>
                {departments.map((d) => (
                  <Pressable key={d.id} onPress={() => setSelDeptId(d.id)} style={[styles.pill, selDeptId === d.id && styles.pillOn]}>
                    <Text style={selDeptId === d.id ? styles.pillTextOn : styles.pillTextOff} numberOfLines={1}>{d.name}</Text>
                  </Pressable>
                ))}
              </View>
            </ScrollView>
          )}
          <TextInput style={styles.input} placeholder="Year (optional)" value={filterYear} onChangeText={setFilterYear} keyboardType="number-pad" placeholderTextColor={colors.tertiaryLabel} />
          <TextInput style={styles.input} placeholder="Search ID or name" value={searchQ} onChangeText={setSearchQ} placeholderTextColor={colors.tertiaryLabel} />
          <PrimaryButton title="Apply filter" onPress={() => load().catch(() => {})} />
          <Text style={styles.meta}>{total} user(s) match</Text>
        </GroupedCard>

        <View style={styles.actionsRow}>
          <Pressable style={styles.actionChip} onPress={() => { setShowCreate(!showCreate); setShowBulk(false); }}>
            <Ionicons name={showCreate ? 'close' : 'add-circle'} size={18} color={colors.accent} />
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
            <TextInput style={styles.input} placeholder="Student / staff ID" value={newStudentId} onChangeText={setNewStudentId} autoCapitalize="characters" placeholderTextColor={colors.tertiaryLabel} />
            <TextInput style={styles.input} placeholder="Full name" value={newName} onChangeText={setNewName} placeholderTextColor={colors.tertiaryLabel} />
            <TextInput style={styles.input} placeholder="Password" secureTextEntry value={newPassword} onChangeText={setNewPassword} placeholderTextColor={colors.tertiaryLabel} />
            <View style={styles.pillRow}>
              {(['student', 'teacher', 'admin'] as const).map((r) => (
                <Pressable key={r} onPress={() => setNewRole(r)} style={[styles.pill, newRole === r && styles.pillOn]}>
                  <Text style={newRole === r ? styles.pillTextOn : styles.pillTextOff}>{r}</Text>
                </Pressable>
              ))}
            </View>
            <Text style={styles.subLabel}>Faculty / department</Text>
            <ScrollView horizontal style={{ marginBottom: space.sm }}>
              <View style={styles.pillRow}>
                {faculties.map((f) => (
                  <Pressable key={f.id} onPress={() => { setNewFacultyId(f.id); loadNewDepts(f.id).catch(() => {}); }} style={[styles.pill, newFacultyId === f.id && styles.pillOn]}>
                    <Text style={newFacultyId === f.id ? styles.pillTextOn : styles.pillTextOff} numberOfLines={1}>{f.name}</Text>
                  </Pressable>
                ))}
              </View>
            </ScrollView>
            {newFacultyId && (
              <ScrollView horizontal style={{ marginBottom: space.sm }}>
                <View style={styles.pillRow}>
                  {newDeptList.map((d) => (
                    <Pressable key={d.id} onPress={() => setNewDeptId(d.id)} style={[styles.pill, newDeptId === d.id && styles.pillOn]}>
                      <Text style={newDeptId === d.id ? styles.pillTextOn : styles.pillTextOff} numberOfLines={1}>{d.name}</Text>
                    </Pressable>
                  ))}
                </View>
              </ScrollView>
            )}
            <TextInput style={styles.input} placeholder="Year" value={newYear} onChangeText={setNewYear} keyboardType="number-pad" placeholderTextColor={colors.tertiaryLabel} />
            <TextInput style={styles.input} placeholder="Section (A,B,...)" value={newSection} onChangeText={setNewSection} placeholderTextColor={colors.tertiaryLabel} />
            <TextInput style={styles.input} placeholder="Gender (M/F)" value={newGender} onChangeText={setNewGender} autoCapitalize="characters" placeholderTextColor={colors.tertiaryLabel} />
            <TextInput style={styles.input} placeholder="Program (Degree/Masters/PhD)" value={newProgram} onChangeText={setNewProgram} placeholderTextColor={colors.tertiaryLabel} />
            <TextInput style={styles.input} placeholder="Field of study" value={newFieldOfStudy} onChangeText={setNewFieldOfStudy} placeholderTextColor={colors.tertiaryLabel} />
            <TextInput style={styles.input} placeholder="Admission type (Regular/Extension/Summer)" value={newAdmissionType} onChangeText={setNewAdmissionType} placeholderTextColor={colors.tertiaryLabel} />
            <PrimaryButton title="Create user" onPress={createUser} />
          </GroupedCard>
        )}

        {showBulk && (
          <GroupedCard style={{ marginBottom: space.lg, padding: space.lg }}>
            <Text style={styles.formTitle}>Bulk import</Text>
            <Text style={styles.hint}>student_id,name,password[,role,faculty,department,year,section]</Text>
            <TextInput style={[styles.input, styles.bulkInput]} multiline value={bulkText} onChangeText={setBulkText} placeholderTextColor={colors.tertiaryLabel} />
            <PrimaryButton title="Import" onPress={importBulk} />
          </GroupedCard>
        )}

        <SectionHeader title={`Results (${users.length})`} />
        {users.map((u, i) => {
          const rb = roleBadge(u.role);
          return (
            <Animated.View key={u.id} entering={enterFromBottom(i)}>
              <Pressable onPress={() => openEdit(u)} style={({ pressed }) => [styles.userCard, pressed && { transform: [{ scale: PRESS_SCALE }] }]}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.userNameText}>{u.name}</Text>
                  <Text style={styles.userIdText}>
                    {u.studentId}
                    {u.department_name ? ` · ${u.department_name}` : ''}
                    {u.year ? ` · Y${u.year}` : ''}
                    {u.section ? ` · ${u.section}` : ''}
                  </Text>
                </View>
                <View style={[styles.rolePill, { backgroundColor: rb.bg }]}>
                  <Text style={[styles.roleText, { color: rb.color }]}>{u.role}</Text>
                </View>
              </Pressable>
            </Animated.View>
          );
        })}
      </ScrollView>

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
            <Text style={styles.hint}>Set department (optional): pick from structure in admin Departments</Text>
            <TextInput style={styles.input} placeholder="Department UUID (optional)" value={eDeptId ?? ''} onChangeText={(t) => setEDeptId(t || null)} placeholderTextColor={colors.tertiaryLabel} />
            <TextInput style={styles.input} placeholder="Year" value={eYear} onChangeText={setEYear} keyboardType="number-pad" placeholderTextColor={colors.tertiaryLabel} />
            <TextInput style={styles.input} placeholder="Section" value={eSection} onChangeText={setESection} placeholderTextColor={colors.tertiaryLabel} />
            <TextInput style={styles.input} placeholder="New password (optional)" secureTextEntry value={ePassword} onChangeText={setEPassword} placeholderTextColor={colors.tertiaryLabel} />
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
  hint: { ...type.caption1, color: colors.secondaryLabel, marginBottom: space.sm },
  subLabel: { ...type.subhead, color: colors.label, marginBottom: space.xs },
  meta: { ...type.caption2, color: colors.tertiaryLabel, marginTop: space.sm },
  input: {
    backgroundColor: colors.secondarySystemBackground,
    borderRadius: radius.md,
    padding: space.md,
    marginBottom: space.sm,
    ...type.body,
    color: colors.label,
  },
  bulkInput: { minHeight: 100, textAlignVertical: 'top' },
  actionsRow: { flexDirection: 'row', gap: space.sm, marginBottom: space.lg },
  actionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
    backgroundColor: colors.accentMuted,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    borderRadius: radius.pill,
  },
  actionText: { ...type.subhead, color: colors.accent, fontWeight: '600' },
  formTitle: { ...type.headline, color: colors.label, marginBottom: space.md },
  pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginBottom: space.sm },
  pill: { paddingHorizontal: space.md, paddingVertical: space.xs, borderRadius: radius.pill, backgroundColor: colors.fill },
  pillOn: { backgroundColor: colors.campus },
  pillTextOff: { ...type.caption1, color: colors.label },
  pillTextOn: { ...type.caption1, color: '#fff', fontWeight: '600' },
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.systemBackground,
    borderRadius: radius.lg,
    padding: space.md,
    marginBottom: space.xs,
    ...shadows.card,
  },
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
