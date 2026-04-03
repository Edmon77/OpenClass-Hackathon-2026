import { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  Pressable,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { apiFetch } from '@/src/api/client';
import { isApiConfigured } from '@/src/api/config';
import { colors, radius, space, shadows, type } from '@/src/theme/tokens';

type Hit = {
  id: string;
  room_number: string;
  floor_index: number;
  building_id: string;
  building_name: string;
  status: 'green' | 'yellow' | 'red';
};

function floorLabel(n: number): string {
  if (n === 0) return 'Ground';
  if (n === 1) return '1st floor';
  if (n === 2) return '2nd floor';
  if (n === 3) return '3rd floor';
  return `${n}th floor`;
}

function statusStyle(st: Hit['status']) {
  if (st === 'green') return { bg: 'rgba(52, 199, 89, 0.15)', dot: colors.statusFree, label: 'Free' };
  if (st === 'yellow') return { bg: 'rgba(255, 159, 10, 0.18)', dot: colors.statusSoon, label: 'Soon' };
  return { bg: 'rgba(255, 69, 58, 0.15)', dot: colors.statusBusy, label: 'Busy' };
}

export default function CampusSearchScreen() {
  const router = useRouter();
  const [q, setQ] = useState('');
  const [hits, setHits] = useState<Hit[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const runSearch = useCallback(async (query: string) => {
    const t = query.trim();
    if (!isApiConfigured() || t.length < 1) {
      setHits([]);
      setSearched(!!t);
      return;
    }
    setLoading(true);
    setSearched(true);
    try {
      const data = await apiFetch<{ rooms: Hit[] }>(`/rooms/search?q=${encodeURIComponent(t)}`);
      setHits(data.rooms);
    } catch {
      setHits([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const emptyMessage = useMemo(() => {
    if (!searched) return 'Type a room number to search every building.';
    if (loading) return '';
    return 'No room matches campus-wide. Try a shorter fragment (e.g. G-2).';
  }, [searched, loading]);

  if (!isApiConfigured()) {
    return (
      <SafeAreaView style={styles.safe}>
        <Text style={styles.err}>Configure EXPO_PUBLIC_API_URL</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <View style={styles.searchRow}>
        <Ionicons name="search" size={18} color={colors.tertiaryLabel} style={styles.searchIcon} />
        <TextInput
          style={styles.input}
          placeholder="Room ID (e.g. G-203, LT-2)"
          placeholderTextColor={colors.tertiaryLabel}
          value={q}
          onChangeText={setQ}
          onSubmitEditing={() => runSearch(q)}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
        />
      </View>
      <Pressable style={styles.searchBtn} onPress={() => runSearch(q)}>
        <Text style={styles.searchBtnText}>Search</Text>
      </Pressable>

      {loading && (
        <View style={styles.loading}>
          <ActivityIndicator color={colors.campus} />
        </View>
      )}

      <FlatList
        data={hits}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        keyboardShouldPersistTaps="handled"
        renderItem={({ item, index }) => {
          const st = statusStyle(item.status);
          return (
            <Animated.View entering={FadeInDown.delay(Math.min(index * 40, 300)).duration(350)}>
              <Pressable
                style={({ pressed }) => [styles.card, pressed && { opacity: 0.92 }]}
                onPress={() => router.push(`/(app)/(tabs)/(explore)/room/${item.id}`)}
              >
                <View style={styles.cardTop}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.roomNum}>{item.room_number}</Text>
                    <Text style={styles.building}>
                      {item.building_name} · {floorLabel(item.floor_index)}
                    </Text>
                  </View>
                  <View style={[styles.pill, { backgroundColor: st.bg }]}>
                    <View style={[styles.pillDot, { backgroundColor: st.dot }]} />
                    <Text style={[styles.pillText, { color: st.dot }]}>{st.label}</Text>
                  </View>
                </View>
              </Pressable>
            </Animated.View>
          );
        }}
        ListEmptyComponent={
          !loading ? (
            <View style={styles.emptyWrap}>
              <Ionicons name="search-outline" size={40} color={colors.tertiaryLabel} />
              <Text style={styles.empty}>{emptyMessage}</Text>
            </View>
          ) : null
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.groupedBackground },
  err: { padding: space.lg, color: colors.destructive },
  searchRow: {
    marginHorizontal: space.lg,
    marginTop: space.sm,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.systemBackground,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.separator,
    ...shadows.card,
  },
  searchIcon: { paddingLeft: space.md },
  input: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: space.sm,
    ...type.body,
    color: colors.label,
  },
  searchBtn: {
    marginHorizontal: space.lg,
    marginTop: space.sm,
    backgroundColor: colors.label,
    padding: space.md,
    borderRadius: radius.lg,
    alignItems: 'center',
  },
  searchBtnText: { ...type.headline, color: '#fff' },
  loading: { padding: space.lg },
  list: { padding: space.lg, paddingBottom: space.xxl },
  card: {
    backgroundColor: colors.systemBackground,
    borderRadius: radius.lg,
    padding: space.lg,
    marginBottom: space.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.separator,
    ...shadows.card,
  },
  cardTop: { flexDirection: 'row', alignItems: 'center' },
  roomNum: { ...type.headline, color: colors.label },
  building: { ...type.subhead, color: colors.secondaryLabel, marginTop: 4 },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: space.sm,
    paddingVertical: 6,
    borderRadius: radius.pill,
    gap: 4,
  },
  pillDot: { width: 8, height: 8, borderRadius: 4 },
  pillText: { ...type.caption1, fontWeight: '700' },
  emptyWrap: { alignItems: 'center', paddingVertical: space.xxl },
  empty: { ...type.body, color: colors.secondaryLabel, textAlign: 'center', marginTop: space.md, paddingHorizontal: space.lg },
});
