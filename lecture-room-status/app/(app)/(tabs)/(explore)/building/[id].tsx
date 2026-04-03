import { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  Pressable,
  StyleSheet,
  ScrollView,
  RefreshControl,
} from 'react-native';
import { useLocalSearchParams, useRouter, useFocusEffect, Stack } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { apiFetch } from '@/src/api/client';
import { isApiConfigured } from '@/src/api/config';
import { getRoomUiState, type BookingRow } from '@/src/domain/roomState';
import { formatDateTime } from '@/src/lib/time';
import { StatusDot } from '@/src/components/ui/StatusDot';
import { EmptyState } from '@/src/components/ui/EmptyState';
import { enterFromBottom, PRESS_SCALE } from '@/src/theme/motion';
import { colors, radius, space, shadows, type } from '@/src/theme/tokens';

type RoomRow = {
  id: string;
  room_number: string;
  floor_index: number;
  capacity: number;
};

function floorLabel(n: number): string {
  if (n === 0) return 'Ground';
  if (n === 1) return '1st';
  if (n === 2) return '2nd';
  if (n === 3) return '3rd';
  return `${n}th`;
}

type BuildingPayload = {
  building: { id: string; building_name: string; floor_count: number };
  rooms: RoomRow[];
  bookings_by_room: Record<string, BookingRow[]>;
};

export default function BuildingScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [buildingName, setBuildingName] = useState('');
  const [floors, setFloors] = useState<number[]>([]);
  const [floor, setFloor] = useState(0);
  const [search, setSearch] = useState('');
  const [rooms, setRooms] = useState<RoomRow[]>([]);
  const [bookingsByRoom, setBookingsByRoom] = useState<Record<string, BookingRow[]>>({});
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!isApiConfigured() || !id) return;
    const data = await apiFetch<BuildingPayload>(`/rooms/building/${id}`);
    setBuildingName(data.building.building_name);
    setFloors(Array.from({ length: data.building.floor_count }, (_, i) => i));
    setRooms(data.rooms);
    const m: Record<string, BookingRow[]> = {};
    for (const r of data.rooms) {
      m[r.id] = (data.bookings_by_room[r.id] ?? []) as BookingRow[];
    }
    setBookingsByRoom(m);
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      load().catch(() => {});
    }, [load])
  );

  async function onRefresh() {
    setRefreshing(true);
    try { await load(); } finally { setRefreshing(false); }
  }

  const filteredRooms = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (q) return rooms.filter((r) => r.room_number.toLowerCase().includes(q));
    return rooms.filter((r) => r.floor_index === floor);
  }, [rooms, search, floor]);

  if (!isApiConfigured()) {
    return (
      <SafeAreaView style={styles.safe}>
        <EmptyState icon="cloud-offline-outline" title="API not configured" />
      </SafeAreaView>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: buildingName || 'Building' }} />
      <SafeAreaView style={styles.safe} edges={['bottom']}>
        {/* Search bar */}
        <View style={styles.searchRow}>
          <Ionicons name="search" size={18} color={colors.tertiaryLabel} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search rooms in this building…"
            placeholderTextColor={colors.tertiaryLabel}
            value={search}
            onChangeText={setSearch}
            autoCapitalize="characters"
            autoCorrect={false}
          />
          {search.trim().length > 0 && (
            <Pressable onPress={() => setSearch('')} hitSlop={8}>
              <Ionicons name="close-circle" size={18} color={colors.tertiaryLabel} />
            </Pressable>
          )}
        </View>

        {/* Floor segmented control */}
        {!search.trim() && floors.length > 0 && (
          <View style={styles.segmentWrap}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.segmentRow}>
              {floors.map((f) => {
                const on = floor === f;
                return (
                  <Pressable
                    key={f}
                    onPress={() => setFloor(f)}
                    style={[styles.segment, on && styles.segmentOn]}
                  >
                    <Text style={[styles.segmentText, on && styles.segmentTextOn]}>
                      {floorLabel(f)}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        )}

        {!!search.trim() && (
          <Text style={styles.searchHint}>Searching all floors</Text>
        )}

        {/* Room grid */}
        <FlatList
          data={filteredRooms}
          numColumns={2}
          keyExtractor={(item) => item.id}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.campus} />
          }
          columnWrapperStyle={styles.gridRow}
          contentContainerStyle={styles.gridContent}
          renderItem={({ item, index }) => {
            const bs = bookingsByRoom[item.id] ?? [];
            const st = getRoomUiState(new Date(), bs);
            const next = bs
              .filter((b) => b.status === 'booked' && new Date(b.start_time) > new Date())
              .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime())[0];
            return (
              <Animated.View entering={enterFromBottom(index)} style={styles.roomCardWrap}>
                <Pressable
                  onPress={() => router.push(`/(app)/(tabs)/(explore)/room/${item.id}`)}
                  style={({ pressed }) => [styles.roomCard, pressed && { transform: [{ scale: PRESS_SCALE }] }]}
                >
                  <View style={[styles.accentStrip, { backgroundColor: st === 'green' ? colors.statusFree : st === 'yellow' ? colors.statusSoon : colors.statusBusy }]} />
                  <StatusDot status={st} size="sm" />
                  <Text style={styles.roomNum}>{item.room_number}</Text>
                  <View style={styles.roomMeta}>
                    <Ionicons name="people-outline" size={12} color={colors.tertiaryLabel} />
                    <Text style={styles.roomCapacity}>{item.capacity}</Text>
                  </View>
                  {next && (
                    <Text style={styles.nextHint} numberOfLines={1}>
                      Next {formatDateTime(next.start_time)}
                    </Text>
                  )}
                </Pressable>
              </Animated.View>
            );
          }}
          ListEmptyComponent={
            <EmptyState
              icon="cube-outline"
              title={search.trim() ? 'No matches' : 'No rooms on this floor'}
              subtitle={search.trim() ? 'Try a different search term.' : undefined}
            />
          }
        />
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.groupedBackground },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: space.lg,
    marginTop: space.xs,
    marginBottom: space.sm,
    paddingHorizontal: space.md,
    backgroundColor: colors.fill,
    borderRadius: radius.sm,
    gap: space.sm,
    height: 38,
  },
  searchInput: {
    flex: 1,
    ...type.body,
    color: colors.label,
    paddingVertical: 0,
  },
  segmentWrap: { marginBottom: space.sm },
  segmentRow: { paddingHorizontal: space.lg, gap: 2 },
  segment: {
    paddingHorizontal: space.md,
    paddingVertical: 8,
    borderRadius: radius.sm,
  },
  segmentOn: {
    backgroundColor: colors.label,
  },
  segmentText: { ...type.subhead, fontWeight: '600', color: colors.secondaryLabel },
  segmentTextOn: { color: colors.systemBackground },
  searchHint: {
    marginHorizontal: space.lg,
    marginBottom: space.sm,
    ...type.caption1,
    color: colors.accent,
    fontWeight: '600',
  },
  gridContent: { paddingHorizontal: space.md, paddingBottom: space.xxl },
  gridRow: { gap: space.sm },
  roomCardWrap: { flex: 1, maxWidth: '50%' },
  roomCard: {
    backgroundColor: colors.systemBackground,
    borderRadius: radius.lg,
    padding: space.md,
    marginBottom: space.sm,
    ...shadows.card,
    overflow: 'hidden',
  },
  accentStrip: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
    borderTopLeftRadius: radius.lg,
    borderBottomLeftRadius: radius.lg,
  },
  roomNum: { ...type.title3, color: colors.label, marginTop: space.xs },
  roomMeta: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  roomCapacity: { ...type.caption1, color: colors.tertiaryLabel },
  nextHint: { ...type.caption2, color: colors.tertiaryLabel, marginTop: space.sm },
});
