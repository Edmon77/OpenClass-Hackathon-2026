import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/src/context/AuthContext';
import { getApiBaseUrl } from '@/src/api/config';
import { PrimaryButton } from '@/src/components/ui/PrimaryButton';
import { colors, radius, space, shadows, type } from '@/src/theme/tokens';

export default function LoginScreen() {
  const router = useRouter();
  const { login } = useAuth();
  const [id, setId] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  async function onSubmit() {
    setBusy(true);
    try {
      const r = await login(id, password);
      if (!r.ok) {
        Alert.alert('Sign in failed', r.error ?? 'Unknown error');
        return;
      }
      if (r.forcePasswordChange) router.replace('/change-password');
      else router.replace('/(app)/(tabs)/(explore)');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Stack.Screen options={{ title: 'Sign in', headerLargeTitle: false }} />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.container}
      >
        <Animated.View entering={FadeIn.duration(600)} style={styles.brand}>
          <View style={styles.brandCircle}>
            <Ionicons name="school" size={36} color={colors.campus} />
          </View>
          <Text style={styles.title}>Lecture Rooms</Text>
          <Text style={styles.tagline}>Live campus availability & booking</Text>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(200).duration(500)}>
          <Text style={styles.hint}>University ID and password</Text>
          {!!getApiBaseUrl() && (
            <Text style={styles.apiUrl} selectable numberOfLines={2}>
              {getApiBaseUrl()}
            </Text>
          )}
          <View style={styles.inputGroup}>
            <View style={styles.inputRow}>
              <Ionicons name="person-outline" size={18} color={colors.tertiaryLabel} />
              <TextInput
                style={styles.input}
                placeholder="User ID"
                placeholderTextColor={colors.tertiaryLabel}
                autoCapitalize="characters"
                value={id}
                onChangeText={setId}
              />
            </View>
            <View style={styles.divider} />
            <View style={styles.inputRow}>
              <Ionicons name="lock-closed-outline" size={18} color={colors.tertiaryLabel} />
              <TextInput
                style={styles.input}
                placeholder="Password"
                placeholderTextColor={colors.tertiaryLabel}
                secureTextEntry
                value={password}
                onChangeText={setPassword}
              />
            </View>
          </View>

          <PrimaryButton
            title={busy ? 'Signing in…' : 'Continue'}
            onPress={onSubmit}
            loading={busy}
            disabled={busy}
            style={{ marginTop: space.lg }}
          />

          <Text style={styles.seed}>
            Demo: ADMIN001 / admin123 · STU001 / 123456
          </Text>
        </Animated.View>
      </KeyboardAvoidingView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: space.xl,
    justifyContent: 'center',
    backgroundColor: colors.groupedBackground,
  },
  brand: { alignItems: 'center', marginBottom: space.xxl },
  brandCircle: {
    width: 72,
    height: 72,
    borderRadius: 22,
    backgroundColor: colors.campusMuted,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: space.md,
  },
  title: { ...type.title1, color: colors.label },
  tagline: { ...type.subhead, color: colors.secondaryLabel, marginTop: space.xs },
  hint: { ...type.subhead, color: colors.secondaryLabel, marginBottom: space.md },
  apiUrl: { ...type.caption2, color: colors.tertiaryLabel, marginBottom: space.md },
  inputGroup: {
    backgroundColor: colors.systemBackground,
    borderRadius: radius.lg,
    overflow: 'hidden',
    ...shadows.card,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: space.md,
    gap: space.sm,
  },
  input: {
    flex: 1,
    paddingVertical: 16,
    ...type.body,
    color: colors.label,
  },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.separator, marginLeft: space.md + 18 + space.sm },
  seed: { marginTop: space.xl, ...type.caption2, color: colors.tertiaryLabel, textAlign: 'center' },
});
