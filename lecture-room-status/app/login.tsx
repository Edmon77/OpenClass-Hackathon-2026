import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Pressable,
  ScrollView,
} from 'react-native';
import { useHeaderHeight } from '@react-navigation/elements';
import { Stack, useRouter } from 'expo-router';
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/src/context/AuthContext';
import { getApiBaseUrl, isApiConfigured } from '@/src/api/config';
import { testApiConnectionSummary } from '@/src/api/connection';
import { PrimaryButton } from '@/src/components/ui/PrimaryButton';
import { colors, radius, space, shadows, type } from '@/src/theme/tokens';

export default function LoginScreen() {
  const router = useRouter();
  const headerHeight = useHeaderHeight();
  const { login } = useAuth();
  const [id, setId] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [testing, setTesting] = useState(false);

  async function onTestConnection() {
    const base = getApiBaseUrl();
    if (!base) {
      Alert.alert('API URL', 'Set EXPO_PUBLIC_API_URL in lecture-room-status/.env and restart Expo.');
      return;
    }
    setTesting(true);
    try {
      const r = await testApiConnectionSummary(base);
      Alert.alert(r.ok ? 'Connection OK' : 'Cannot reach API', r.text);
    } finally {
      setTesting(false);
    }
  }

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
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={headerHeight}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
          showsVerticalScrollIndicator={false}
          automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'}
          contentContainerStyle={styles.scrollContent}
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
              <>
                <Text style={styles.apiUrl} selectable numberOfLines={2}>
                  {getApiBaseUrl()}
                </Text>
                {Platform.OS !== 'web' && /localhost|127\.0\.0\.1/i.test(getApiBaseUrl()) && (
                  <Text style={styles.warn}>
                    localhost here points at this device, not your PC. Use your computer&apos;s LAN IP (e.g. same as Metro: 192.168.x.x) plus :3000. Android emulator: 10.0.2.2:3000.
                  </Text>
                )}
                {isApiConfigured() && (
                  <Pressable onPress={onTestConnection} disabled={testing} style={({ pressed }) => [styles.testBtn, pressed && { opacity: 0.7 }]}>
                    <Text style={styles.testBtnTxt}>{testing ? 'Testing…' : 'Test API connection'}</Text>
                  </Pressable>
                )}
              </>
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
                  returnKeyType="next"
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
                  returnKeyType="go"
                  onSubmitEditing={() => void onSubmit()}
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
        </ScrollView>
      </KeyboardAvoidingView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.groupedBackground,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: space.xl,
    paddingVertical: space.lg,
    paddingBottom: space.xxl,
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
  apiUrl: { ...type.caption2, color: colors.tertiaryLabel, marginBottom: space.sm },
  warn: {
    ...type.caption2,
    color: colors.destructive,
    marginBottom: space.md,
    lineHeight: 18,
  },
  testBtn: { alignSelf: 'flex-start', marginBottom: space.md, paddingVertical: space.xs },
  testBtnTxt: { ...type.subhead, color: colors.campus, fontWeight: '600' },
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
