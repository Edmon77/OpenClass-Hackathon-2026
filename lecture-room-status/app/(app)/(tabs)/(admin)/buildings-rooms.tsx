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

type BuildingRow = { id: string; building_name: string; floor_count: number; room_count: number };

export default function BuildingsRoomsScreen() {
  const { user } = useAuth();
  const [buildings, setBuildings] = useState<BuildingRow[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [bName, setBName] = useState('');
  const [bFloors, setBFloors] = useState('3');
  const [showBuildingForm, setShowBuildingForm] = useState(false);

  const [roomBuildingId, setRoomBuildingId] = useState<string | null>(null);
  const [roomNum, setRoomNum] = useState('');
  const [roomFloor, setRoomFloor] = useState('0');
  const [roomCap, setRoomCap] = useState('30');
  const [showRoomForm, setShowRoomForm] = useState(false);

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
      await apiFetch('/admin/rooms', { method: 'POST', json: { buildingId: roomBuildingId, roomNumber: roomNum.trim(), floorIndex: fi, capacity: cap } });
      setRoomNum(''); await load(); Alert.alert('Created', 'Room added.');
    } catch (e) { Alert.alert('Error', String(e)); }
  }

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.container} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.campus} />}>
      {/* Building list */}
      <SectionHeader title={`Buildings (${buildings.length})`} style={{ marginTop: 0 }} />
      {buildings.map((b, i) => (
        <Animated.View key={b.id} entering={enterFromBottom(i)}>
          <View style={styles.card}>
            <Ionicons name="business" size={20} color={colors.campus} />
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>{b.building_name}</Text>
              <Text style={styles.cardSub}>{b.floor_count} floors · {b.room_count} rooms</Text>
            </View>
          </View>
        </Animated.View>
      ))}

      <View style={styles.actionsRow}>
        <Pressable style={styles.actionChip} onPress={() => { setShowBuildingForm(!showBuildingForm); setShowRoomForm(false); }}>
          <Ionicons name={showBuildingForm ? 'close' : 'add-circle'} size={18} color={colors.accent} />
          <Text style={styles.actionText}>{showBuildingForm ? 'Close' : 'Add building'}</Text>
        </Pressable>
        <Pressable style={styles.actionChip} onPress={() => { setShowRoomForm(!showRoomForm); setShowBuildingForm(false); }}>
          <Ionicons name={showRoomForm ? 'close' : 'add-circle'} size={18} color={colors.accent} />
          <Text style={styles.actionText}>{showRoomForm ? 'Close' : 'Add room'}</Text>
        </Pressable>
      </View>

      {showBuildingForm && (
        <GroupedCard style={{ padding: space.lg, marginBottom: space.lg }}>
          <Text style={styles.formTitle}>New building</Text>
          <TextInput style={styles.input} placeholder="Building name" value={bName} onChangeText={setBName} placeholderTextColor={colors.tertiaryLabel} />
          <TextInput style={styles.input} placeholder="Floor count" value={bFloors} onChangeText={setBFloors} keyboardType="number-pad" placeholderTextColor={colors.tertiaryLabel} />
          <PrimaryButton title="Add building" onPress={createBuilding} />
        </GroupedCard>
      )}

      {showRoomForm && (
        <GroupedCard style={{ padding: space.lg, marginBottom: space.lg }}>
          <Text style={styles.formTitle}>New room</Text>
          <Text style={styles.hint}>Select building</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: space.sm }}>
            {buildings.map((b) => (
              <Pressable key={b.id} onPress={() => setRoomBuildingId(b.id)} style={[styles.pick, roomBuildingId === b.id && styles.pickOn]}>
                <Text style={[styles.pickText, roomBuildingId === b.id && { color: colors.campus }]}>{b.building_name}</Text>
              </Pressable>
            ))}
          </ScrollView>
          <TextInput style={styles.input} placeholder="Room number" value={roomNum} onChangeText={setRoomNum} placeholderTextColor={colors.tertiaryLabel} />
          <TextInput style={styles.input} placeholder="Floor index (0=ground)" value={roomFloor} onChangeText={setRoomFloor} keyboardType="number-pad" placeholderTextColor={colors.tertiaryLabel} />
          <TextInput style={styles.input} placeholder="Capacity" value={roomCap} onChangeText={setRoomCap} keyboardType="number-pad" placeholderTextColor={colors.tertiaryLabel} />
          <PrimaryButton title="Add room" onPress={createRoom} />
        </GroupedCard>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: colors.groupedBackground },
  container: { padding: space.lg, paddingBottom: space.xxl * 2 },
  card: { flexDirection: 'row', alignItems: 'center', gap: space.md, backgroundColor: colors.systemBackground, borderRadius: radius.lg, padding: space.md, marginBottom: space.xs, ...shadows.card },
  cardTitle: { ...type.subhead, color: colors.label, fontWeight: '600' },
  cardSub: { ...type.caption1, color: colors.secondaryLabel, marginTop: 2 },
  actionsRow: { flexDirection: 'row', gap: space.sm, marginVertical: space.md },
  actionChip: { flexDirection: 'row', alignItems: 'center', gap: space.xs, backgroundColor: colors.accentMuted, paddingHorizontal: space.md, paddingVertical: space.sm, borderRadius: radius.pill },
  actionText: { ...type.subhead, color: colors.accent, fontWeight: '600' },
  formTitle: { ...type.headline, color: colors.label, marginBottom: space.md },
  hint: { ...type.caption1, color: colors.secondaryLabel, marginBottom: space.xs },
  input: { backgroundColor: colors.secondarySystemBackground, borderRadius: radius.md, padding: space.md, marginBottom: space.sm, ...type.body, color: colors.label },
  pick: { paddingHorizontal: space.md, paddingVertical: space.sm, borderRadius: radius.pill, backgroundColor: colors.fill, marginRight: space.sm },
  pickOn: { backgroundColor: colors.campusMuted },
  pickText: { ...type.subhead, color: colors.label },
});
