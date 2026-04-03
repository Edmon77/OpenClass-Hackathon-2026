import { useCallback, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  Pressable,
  StyleSheet,
  RefreshControl,
  TextInput,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { apiFetch } from '@/src/api/client';
import { isApiConfigured } from '@/src/api/config';
import { StatusBar } from '@/src/components/ui/StatusBar';
import { EmptyState } from '@/src/components/ui/EmptyState';
import { enterFade, enterFromBottom, PRESS_SCALE } from '@/src/theme/motion';
import { colors, radius, space, shadows, type } from '@/src/theme/tokens';

type Row = {
  id: string;
  building_name: string;
  floor_count: number;
  room_count: number;
  status_summary?: { green: number; yellow: number; red: number };
};

export default function BuildingsScreen() {
  const router = useRouter();
  const [rows, setRows] = useState<Row[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    if (!isApiConfigured()) return;
    const data = await apiFetch<{ buildings: Row[] }>('/buildings');
    setRows(data.buildings);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load().catch(() => setRows([]));
    }, [load])
  );

  async function onRefresh() {
    setRefreshing(true);
    try { await load(); } finally { setRefreshing(false); }
  }

  const filtered = search.trim()
    ? rows.filter((r) => r.building_name.toLowerCase().includes(search.trim().toLowerCase()))
    : rows;

  if (!isApiConfigured()) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <EmptyState icon="cloud-offline-outline" title="API not configured" subtitle="Set EXPO_PUBLIC_API_URL in .env and restart Expo." />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <Animated.View entering={enterFade(400)} style={styles.header}>
        <Text style={styles.largeTitle}>Campus</Text>
        <Pressable
          onPress={() => router.push('/(app)/(tabs)/(explore)/scan')}
          style={styles.scanBtn}
          hitSlop={8}
        >
          <Ionicons name="qr-code-outline" size={22} color={colors.accent} />
        </Pressable>
      </Animated.View>

      <View style={styles.searchRow}>
        <Ionicons name="search" size={18} color={colors.tertiaryLabel} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search buildings or rooms…"
          placeholderTextColor={colors.tertiaryLabel}
          value={search}
          onChangeText={setSearch}
          onSubmitEditing={() => {
            if (search.trim()) router.push('/(app)/(tabs)/(explore)/search');
          }}
          returnKeyType="search"
        />
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.campus} />
        }
        renderItem={({ item, index }) => {
          const s = item.status_summary;
          return (
            <Animated.View entering={enterFromBottom(index)}>
              <Pressable
                onPress={() => router.push(`/(app)/(tabs)/(explore)/building/${item.id}`)}
                style={({ pressed }) => [styles.card, pressed && { transform: [{ scale: PRESS_SCALE }] }]}
              >
                <View style={styles.cardRow}>
                  <View style={styles.iconWrap}>
                    <Ionicons name="business" size={24} color={colors.campus} />
                  </View>
                  <View style={styles.cardBody}>
                    <Text style={styles.cardTitle}>{item.building_name}</Text>
                    <Text style={styles.cardMeta}>
                      {item.floor_count} floor{item.floor_count !== 1 ? 's' : ''} · {item.room_count} room{item.room_count !== 1 ? 's' : ''}
                    </Text>
                    {s && (
                      <View style={styles.statusSection}>
                        <StatusBar green={s.green} yellow={s.yellow} red={s.red} height={5} />
                        <View style={styles.statusLegend}>
                          <Text style={[styles.legendText, { color: colors.statusFree }]}>{s.green} free</Text>
                          <Text style={[styles.legendText, { color: colors.statusSoon }]}>{s.yellow} soon</Text>
                          <Text style={[styles.legendText, { color: colors.statusBusy }]}>{s.red} busy</Text>
                        </View>
                      </View>
                    )}
                  </View>
                  <Ionicons name="chevron-forward" size={20} color={colors.tertiaryLabel} />
                </View>
              </Pressable>
            </Animated.View>
          );
        }}
        ListEmptyComponent={
          <EmptyState
            icon="business-outline"
            title="No buildings yet"
            subtitle="Buildings appear here once an admin sets up the campus."
          />
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.groupedBackground },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space.lg,
    paddingTop: space.sm,
    paddingBottom: space.sm,
  },
  largeTitle: { ...type.largeTitle, color: colors.label },
  scanBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.accentMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: space.lg,
    marginBottom: space.md,
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
  listContent: { paddingHorizontal: space.lg, paddingBottom: space.xxl },
  card: {
    backgroundColor: colors.systemBackground,
    borderRadius: radius.lg,
    padding: space.lg,
    marginBottom: space.md,
    ...shadows.card,
  },
  cardRow: { flexDirection: 'row', alignItems: 'center' },
  iconWrap: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: colors.campusMuted,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: space.md,
  },
  cardBody: { flex: 1 },
  cardTitle: { ...type.headline, color: colors.label },
  cardMeta: { ...type.subhead, color: colors.secondaryLabel, marginTop: 2 },
  statusSection: { marginTop: space.sm },
  statusLegend: { flexDirection: 'row', gap: space.md, marginTop: 4 },
  legendText: { ...type.caption2, fontWeight: '600' },
});
