import { View, Text, Pressable, StyleSheet, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import Animated from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/src/context/AuthContext';
import { isApiConfigured } from '@/src/api/config';
import { EmptyState } from '@/src/components/ui/EmptyState';
import { enterFromBottom, PRESS_SCALE } from '@/src/theme/motion';
import { colors, radius, space, shadows, type } from '@/src/theme/tokens';

type HubCard = {
  title: string;
  subtitle: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  bg: string;
  route: string;
};

const cards: HubCard[] = [
  { title: 'Users', subtitle: 'Faculty → department → search', icon: 'people', color: colors.accent, bg: colors.accentMuted, route: '/(app)/(tabs)/(admin)/users' },
  { title: 'Buildings & Rooms', subtitle: 'Campus infrastructure', icon: 'business', color: colors.campus, bg: colors.campusMuted, route: '/(app)/(tabs)/(admin)/buildings-rooms' },
  { title: 'Course catalog', subtitle: 'Name + code (no offerings)', icon: 'library', color: '#34C759', bg: 'rgba(52,199,89,0.12)', route: '/(app)/(tabs)/(admin)/catalog' },
  { title: 'Course offerings', subtitle: 'Per academic year & department', icon: 'layers', color: '#30B0C7', bg: 'rgba(48,176,199,0.12)', route: '/(app)/(tabs)/(admin)/course-offerings' },
  { title: 'Courses', subtitle: 'Quick create (catalog + offering)', icon: 'book', color: '#34C759', bg: 'rgba(52,199,89,0.12)', route: '/(app)/(tabs)/(admin)/courses' },
  { title: 'Academic years', subtitle: 'Create, activate, close', icon: 'calendar', color: '#AF52DE', bg: 'rgba(175,82,222,0.12)', route: '/(app)/(tabs)/(admin)/semesters' },
  { title: 'CR Assignments', subtitle: 'Faculty → department → year → section', icon: 'school', color: '#FF9500', bg: 'rgba(255,149,0,0.12)', route: '/(app)/(tabs)/(admin)/cr-assignments' },
];

export default function AdminHub() {
  const { user } = useAuth();
  const router = useRouter();

  if (!isApiConfigured()) {
    return <EmptyState icon="cloud-offline-outline" title="API not configured" />;
  }

  if (user?.role !== 'admin') {
    return <EmptyState icon="shield-outline" title="Admin only" subtitle="Sign in with an admin account." />;
  }

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
      <Text style={styles.largeTitle}>Admin</Text>
      <Text style={styles.subtitle}>Manage the campus system</Text>

      <View style={styles.grid}>
        {cards.map((card, i) => (
          <Animated.View key={card.title} entering={enterFromBottom(i)} style={styles.cardWrap}>
            <Pressable
              style={({ pressed }) => [styles.card, pressed && { transform: [{ scale: PRESS_SCALE }] }]}
              onPress={() => router.push(card.route as any)}
            >
              <View style={[styles.iconCircle, { backgroundColor: card.bg }]}>
                <Ionicons name={card.icon} size={26} color={card.color} />
              </View>
              <Text style={styles.cardTitle}>{card.title}</Text>
              <Text style={styles.cardSub}>{card.subtitle}</Text>
              <Ionicons name="chevron-forward" size={16} color={colors.tertiaryLabel} style={styles.chevron} />
            </Pressable>
          </Animated.View>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: colors.groupedBackground },
  content: { padding: space.lg, paddingBottom: space.xxl * 2 },
  largeTitle: { ...type.largeTitle, color: colors.label },
  subtitle: { ...type.subhead, color: colors.secondaryLabel, marginTop: space.xs, marginBottom: space.xl },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md },
  cardWrap: { width: '47%', flexGrow: 1 },
  card: {
    backgroundColor: colors.systemBackground,
    borderRadius: radius.xl,
    padding: space.lg,
    minHeight: 160,
    ...shadows.card,
  },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: space.md,
  },
  cardTitle: { ...type.headline, color: colors.label },
  cardSub: { ...type.caption1, color: colors.secondaryLabel, marginTop: 4 },
  chevron: { position: 'absolute', top: space.lg, right: space.lg },
});
