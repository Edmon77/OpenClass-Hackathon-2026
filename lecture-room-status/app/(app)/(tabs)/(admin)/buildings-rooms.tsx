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

const ROOM_TYPES = ['lecture_hall', 'lab', 'office', 'seminar', 'other'] as const;

type BuildingRow = { id: string; building_name: string; floor_count: number; room_count: number };

export default function BuildingsRoomsScreen() {
  const { user } = useAuth();
  const [buildings, setBuildings] = useState<BuildingRow[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const [bName, setBName] = useState('');
  const [bFloors, setBFloors] = useState('3');

  const [roomBuildingId, setRoomBuildingId] = useState<string | null>(null);
  const [roomNum, setRoomNum] = useState('');
  const [roomFloor, setRoomFloor] = useState('0');
  const [roomCap, setRoomCap] = useState('30');
  const [roomType, setRoomType] = useState<(typeof ROOM_TYPES)[number]>('lecture_hall');
  const [hasProjector, setHasProjector] = useState(false);
  const [hasInternet, setHasInternet] = useState(false);
  const [hasPower, setHasPower] = useState(true);
  const [buildingPickerOpen, setBuildingPickerOpen] = useState(false);

  const load = useCallback(async () => {
    if (!isApiConfigured() || user?.role !== 'admin') return;
    const b = await apiFetch<{ buildings: BuildingRow[] }>('/buildings');
    setBuildings(b.buildings);
    setRoomBuildingId((prev) => prev ?? (b.buildings[0]?.id ?? null));
  }, [user?.role]);

  useFocusEffect(useCallback(() => { load().catch(() => {}); }, [load]));
  async function onRefresh() { setRefreshing(true); try { await load(); } finally { setRefreshing(false); } }

  async function createBuilding() {
    const n = parseInt(bFloors, 10);
    if (!bName.trim() || !Number.isFinite(n) || n < 1) { Alert.alert('Invalid', 'Name and floor count (≥1) required.'); return; }
    try {
      await apiFetch('/admin/buildings', { method: 'POST', json: { name: bName.trim(), floorCount: n } });
      setBName(''); await load(); Alert.alert('Created', 'Building added.');
    } catch (e) { Alert.alert('Error', String(e)); }
  }

  async function createRoom() {
    if (!roomBuildingId) { Alert.alert('Missing', 'Select a building first.'); return; }
    const fi = parseInt(roomFloor, 10); const cap = parseInt(roomCap, 10);
    if (!roomNum.trim() || !Number.isFinite(fi) || fi < 0 || !Number.isFinite(cap) || cap < 1) { Alert.alert('Invalid', 'Room number, floor index, and capacity required.'); return; }
    try {
      await apiFetch('/admin/rooms', {
        method: 'POST',
        json: {
          buildingId: roomBuildingId,
          roomNumber: roomNum.trim(),
          floorIndex: fi,
          capacity: cap,
          roomType,
          hasProjector,
          hasInternet,
          hasPower,
        },
      });
      setRoomNum(''); await load(); Alert.alert('Created', 'Room added.');
    } catch (e) { Alert.alert('Error', String(e)); }
  }

  const selectedBuilding = buildings.find((b) => b.id === roomBuildingId);

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.container} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.campus} />}>
      <SectionHeader title="Add building" style={{ marginTop: 0 }} />
      <GroupedCard style={{ padding: space.lg, marginBottom: space.lg }}>
        <TextInput style={styles.input} placeholder="Building name" value={bName} onChangeText={setBName} placeholderTextColor={colors.tertiaryLabel} />
        <TextInput style={styles.input} placeholder="Floor count" value={bFloors} onChangeText={setBFloors} keyboardType="number-pad" placeholderTextColor={colors.tertiaryLabel} />
        <PrimaryButton title="Add building" onPress={createBuilding} />
      </GroupedCard>

      <SectionHeader title="Add room" />
      <GroupedCard style={{ padding: space.lg, marginBottom: space.lg }}>
        <Text style={styles.label}>Building</Text>
        <Pressable
          onPress={() => setBuildingPickerOpen(!buildingPickerOpen)}
          style={styles.dropdownBtn}
        >
          <Text style={styles.dropdownBtnText}>{selectedBuilding?.building_name ?? 'Select building'}</Text>
          <Ionicons name={buildingPickerOpen ? 'chevron-up' : 'chevron-down'} size={20} color={colors.tertiaryLabel} />
        </Pressable>
        {buildingPickerOpen && (
          <View style={styles.dropdownList}>
            {buildings.map((b) => (
              <Pressable
                key={b.id}
                onPress={() => { setRoomBuildingId(b.id); setBuildingPickerOpen(false); }}
                style={[styles.dropdownItem, roomBuildingId === b.id && styles.dropdownItemOn]}
              >
                <Text style={styles.dropdownItemText}>{b.building_name}</Text>
              </Pressable>
            ))}
          </View>
        )}
        <Text style={styles.label}>Room type</Text>
        <View style={styles.pillRow}>
          {ROOM_TYPES.map((rt) => (
            <Pressable key={rt} onPress={() => setRoomType(rt)} style={[styles.pill, roomType === rt && styles.pillOn]}>
              <Text style={roomType === rt ? styles.pillTextOn : styles.pillTextOff}>{rt.replace('_', ' ')}</Text>
            </Pressable>
          ))}
        </View>
        <TextInput style={styles.input} placeholder="Room number" value={roomNum} onChangeText={setRoomNum} placeholderTextColor={colors.tertiaryLabel} />
        <TextInput style={styles.input} placeholder="Floor index (0=ground)" value={roomFloor} onChangeText={setRoomFloor} keyboardType="number-pad" placeholderTextColor={colors.tertiaryLabel} />
        <TextInput style={styles.input} placeholder="Capacity" value={roomCap} onChangeText={setRoomCap} keyboardType="number-pad" placeholderTextColor={colors.tertiaryLabel} />
        <View style={styles.switchRow}>
          <Text style={styles.switchLabel}>Projector</Text>
          <Switch value={hasProjector} onValueChange={setHasProjector} trackColor={{ true: colors.campus }} />
        </View>
        <View style={styles.switchRow}>
          <Text style={styles.switchLabel}>Internet</Text>
          <Switch value={hasInternet} onValueChange={setHasInternet} trackColor={{ true: colors.campus }} />
        </View>
        <View style={styles.switchRow}>
          <Text style={styles.switchLabel}>Power</Text>
          <Switch value={hasPower} onValueChange={setHasPower} trackColor={{ true: colors.campus }} />
        </View>
        <PrimaryButton title="Add room" onPress={createRoom} />
      </GroupedCard>

      <SectionHeader title={`Buildings (${buildings.length})`} />
      {buildings.map((b, i) => (
        <Animated.View key={b.id} entering={enterFromBottom(i)}>
          <Pressable style={({ pressed }) => [styles.card, pressed && { transform: [{ scale: PRESS_SCALE }] }]}>
            <Ionicons name="business" size={20} color={colors.campus} />
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>{b.building_name}</Text>
              <Text style={styles.cardSub}>{b.floor_count} floors · {b.room_count} rooms</Text>
            </View>
          </Pressable>
        </Animated.View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: colors.groupedBackground },
  container: { padding: space.lg, paddingBottom: space.xxl * 2 },
  label: { ...type.subhead, color: colors.secondaryLabel, marginBottom: space.xs },
  input: { backgroundColor: colors.secondarySystemBackground, borderRadius: radius.md, padding: space.md, marginBottom: space.sm, ...type.body, color: colors.label },
  dropdownBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.secondarySystemBackground,
    borderRadius: radius.md,
    padding: space.md,
    marginBottom: space.sm,
  },
  dropdownBtnText: { ...type.body, color: colors.label, flex: 1 },
  dropdownList: {
    backgroundColor: colors.systemBackground,
    borderRadius: radius.md,
    marginBottom: space.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.separator,
    overflow: 'hidden',
  },
  dropdownItem: { paddingVertical: space.md, paddingHorizontal: space.md },
  dropdownItemOn: { backgroundColor: colors.campusMuted },
  dropdownItemText: { ...type.body, color: colors.label },
  pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs, marginBottom: space.md },
  pill: { paddingHorizontal: space.sm, paddingVertical: space.xs, borderRadius: radius.pill, backgroundColor: colors.fill },
  pillOn: { backgroundColor: colors.campus },
  pillTextOff: { ...type.caption1, color: colors.label },
  pillTextOn: { ...type.caption1, color: '#fff', fontWeight: '600' },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: space.sm },
  switchLabel: { ...type.subhead, color: colors.label },
  card: { flexDirection: 'row', alignItems: 'center', gap: space.md, backgroundColor: colors.systemBackground, borderRadius: radius.lg, padding: space.md, marginBottom: space.xs, ...shadows.card },
  cardTitle: { ...type.subhead, color: colors.label, fontWeight: '600' },
  cardSub: { ...type.caption1, color: colors.secondaryLabel, marginTop: 2 },
});
