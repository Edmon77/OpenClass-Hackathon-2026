import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { useHeaderHeight } from '@react-navigation/elements';
import { Stack, useRouter } from 'expo-router';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/src/context/AuthContext';
import { PrimaryButton } from '@/src/components/ui/PrimaryButton';
import { colors, radius, space, shadows, type } from '@/src/theme/tokens';

export default function ChangePasswordScreen() {
  const router = useRouter();
  const headerHeight = useHeaderHeight();
  const { changePassword, user } = useAuth();
  const [p1, setP1] = useState('');
  const [p2, setP2] = useState('');
  const [busy, setBusy] = useState(false);

  async function onSave() {
    if (p1.length < 6) { Alert.alert('Too short', 'Use at least 6 characters.'); return; }
    if (p1 !== p2) { Alert.alert('Mismatch', 'Passwords do not match.'); return; }
    setBusy(true);
    try {
      await changePassword(p1);
      router.replace('/(app)/(tabs)/(explore)');
    } catch (e) {
      Alert.alert('Error', String(e));
    } finally {
      setBusy(false);
    }
  }

  if (!user) return null;

  return (
    <>
      <Stack.Screen options={{ title: 'New password', headerLargeTitle: false }} />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={headerHeight}
        style={styles.container}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
          showsVerticalScrollIndicator={false}
          automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'}
          contentContainerStyle={styles.scrollContent}
        >
          <Animated.View entering={FadeIn.duration(400)} style={styles.header}>
            <View style={styles.iconCircle}>
              <Ionicons name="lock-closed" size={28} color={colors.campus} />
            </View>
            <Text style={styles.title}>Secure your account</Text>
            <Text style={styles.hint}>Hello {user.name}. Choose a strong password.</Text>
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(150).duration(400)}>
            <View style={styles.inputGroup}>
              <View style={styles.inputRow}>
                <Ionicons name="key-outline" size={18} color={colors.tertiaryLabel} />
                <TextInput
                  style={styles.input}
                  placeholder="New password"
                  placeholderTextColor={colors.tertiaryLabel}
                  secureTextEntry
                  value={p1}
                  onChangeText={setP1}
                  returnKeyType="next"
                />
              </View>
              <View style={styles.divider} />
              <View style={styles.inputRow}>
                <Ionicons name="checkmark-circle-outline" size={18} color={colors.tertiaryLabel} />
                <TextInput
                  style={styles.input}
                  placeholder="Confirm password"
                  placeholderTextColor={colors.tertiaryLabel}
                  secureTextEntry
                  value={p2}
                  onChangeText={setP2}
                  returnKeyType="go"
                  onSubmitEditing={() => void onSave()}
                />
              </View>
            </View>

            <PrimaryButton
              title={busy ? 'Saving…' : 'Save and continue'}
              onPress={onSave}
              loading={busy}
              disabled={busy}
              style={{ marginTop: space.lg }}
            />
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.groupedBackground },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: space.xl,
    paddingVertical: space.lg,
    paddingBottom: space.xxl,
  },
  header: { alignItems: 'center', marginBottom: space.xl },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: colors.campusMuted,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: space.md,
  },
  title: { ...type.title2, color: colors.label },
  hint: { ...type.body, color: colors.secondaryLabel, marginTop: space.xs, textAlign: 'center' },
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
});
