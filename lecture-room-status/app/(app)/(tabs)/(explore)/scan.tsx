import { useState, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, Pressable, Platform, Alert } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Stack, useRouter } from 'expo-router';
import Animated, { FadeIn } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { parseRoomIdFromQr } from '@/src/constants/qr';
import { PrimaryButton } from '@/src/components/ui/PrimaryButton';
import { colors, radius, space, type, shadows } from '@/src/theme/tokens';

export default function ScanScreen() {
  const router = useRouter();
  const [permission, requestPermission] = useCameraPermissions();
  const [done, setDone] = useState(false);
  const lastInvalidAt = useRef(0);

  const onBarcode = useCallback(
    (data: string) => {
      if (done) return;
      const roomId = parseRoomIdFromQr(data);
      if (roomId) {
        setDone(true);
        router.replace(`/(app)/(tabs)/(explore)/room/${roomId}`);
        return;
      }
      const t = data.trim();
      if (t.length > 4) {
        const n = Date.now();
        if (n - lastInvalidAt.current > 2500) {
          lastInvalidAt.current = n;
          Alert.alert('Invalid QR', 'This doesn\'t look like a room code. Try campus search instead.', [
            { text: 'Search', onPress: () => router.push('/(app)/(tabs)/(explore)/search') },
            { text: 'OK', style: 'cancel' },
          ]);
        }
      }
    },
    [done, router]
  );

  if (!permission) {
    return <View style={styles.center} />;
  }

  if (!permission.granted) {
    return (
      <>
        <Stack.Screen options={{ title: 'Camera', headerLargeTitle: false }} />
        <View style={styles.center}>
          <Animated.View entering={FadeIn.duration(400)} style={styles.permCard}>
            <View style={styles.permIcon}>
              <Ionicons name="camera" size={36} color={colors.campus} />
            </View>
            <Text style={styles.permTitle}>Camera access</Text>
            <Text style={styles.permBody}>
              We need camera access to scan room QR codes. Nothing is uploaded — processing happens entirely on your device.
            </Text>
            <PrimaryButton title="Allow camera" onPress={() => requestPermission()} style={{ width: '100%' }} />
          </Animated.View>
        </View>
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: 'Scan QR', headerLargeTitle: false }} />
      <CameraView
        style={styles.camera}
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
        onBarcodeScanned={({ data }) => onBarcode(data)}
      />
      <View style={styles.overlay} pointerEvents="none">
        <View style={styles.frame}>
          <View style={[styles.corner, styles.tl]} />
          <View style={[styles.corner, styles.tr]} />
          <View style={[styles.corner, styles.bl]} />
          <View style={[styles.corner, styles.br]} />
        </View>
      </View>
      <View style={styles.hintBox}>
        <Ionicons name="qr-code" size={18} color="rgba(255,255,255,0.9)" />
        <View>
          <Text style={styles.hintLabel}>Align room QR code</Text>
          <Text style={styles.hint}>
            Codes look like <Text style={styles.mono}>lecture-room://room/…</Text>
          </Text>
        </View>
      </View>
    </>
  );
}

const CORNER_SIZE = 28;
const CORNER_WIDTH = 4;
const CORNER_COLOR = 'rgba(255,255,255,0.9)';

const styles = StyleSheet.create({
  camera: { flex: 1, backgroundColor: '#000' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: space.xl, backgroundColor: colors.groupedBackground },
  permCard: {
    backgroundColor: colors.systemBackground,
    borderRadius: radius.xl,
    padding: space.xl,
    maxWidth: 380,
    width: '100%',
    alignItems: 'center',
    ...shadows.card,
  },
  permIcon: {
    width: 72,
    height: 72,
    borderRadius: 22,
    backgroundColor: colors.campusMuted,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: space.md,
  },
  permTitle: { ...type.title3, color: colors.label, marginBottom: space.sm },
  permBody: { ...type.subhead, color: colors.secondaryLabel, textAlign: 'center', marginBottom: space.lg },
  overlay: { ...StyleSheet.absoluteFillObject, justifyContent: 'center', alignItems: 'center' },
  frame: { width: 240, height: 240, position: 'relative' },
  corner: { position: 'absolute', width: CORNER_SIZE, height: CORNER_SIZE },
  tl: { top: 0, left: 0, borderTopWidth: CORNER_WIDTH, borderLeftWidth: CORNER_WIDTH, borderColor: CORNER_COLOR, borderTopLeftRadius: 8 },
  tr: { top: 0, right: 0, borderTopWidth: CORNER_WIDTH, borderRightWidth: CORNER_WIDTH, borderColor: CORNER_COLOR, borderTopRightRadius: 8 },
  bl: { bottom: 0, left: 0, borderBottomWidth: CORNER_WIDTH, borderLeftWidth: CORNER_WIDTH, borderColor: CORNER_COLOR, borderBottomLeftRadius: 8 },
  br: { bottom: 0, right: 0, borderBottomWidth: CORNER_WIDTH, borderRightWidth: CORNER_WIDTH, borderColor: CORNER_COLOR, borderBottomRightRadius: 8 },
  hintBox: {
    position: 'absolute',
    bottom: space.xxl + 16,
    left: space.lg,
    right: space.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    backgroundColor: 'rgba(0,0,0,0.75)',
    paddingVertical: space.md,
    paddingHorizontal: space.lg,
    borderRadius: radius.lg,
  },
  hintLabel: { ...type.subhead, color: 'rgba(255,255,255,0.95)', fontWeight: '600' },
  hint: { ...type.caption1, color: 'rgba(255,255,255,0.7)', marginTop: 2 },
  mono: { fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: undefined }) },
});
