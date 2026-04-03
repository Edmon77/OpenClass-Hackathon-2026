import { Redirect } from 'expo-router';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/src/context/AuthContext';
import { colors, type, space } from '@/src/theme/tokens';

export default function Index() {
  const { user, ready } = useAuth();
  if (!ready) {
    return (
      <View style={styles.center}>
        <Animated.View entering={FadeIn} exiting={FadeOut} style={styles.inner}>
          <View style={styles.iconWrap}>
            <Ionicons name="school" size={36} color={colors.campus} />
          </View>
          <Text style={styles.appName}>Lecture Rooms</Text>
          <ActivityIndicator size="large" color={colors.campus} style={styles.spin} />
        </Animated.View>
      </View>
    );
  }
  if (!user) return <Redirect href="/login" />;
  if (user.force_password_change) return <Redirect href="/change-password" />;
  return <Redirect href="/(app)/(tabs)/(explore)" />;
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.groupedBackground },
  inner: { alignItems: 'center' },
  iconWrap: {
    width: 72,
    height: 72,
    borderRadius: 22,
    backgroundColor: colors.campusMuted,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: space.md,
  },
  appName: { ...type.title2, color: colors.label, marginBottom: space.lg },
  spin: { marginBottom: space.md },
});
