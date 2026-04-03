/**
 * Apple-inspired semantic colors & layout (iOS grouped + clarity).
 */
import { Platform, StyleSheet } from 'react-native';

export const colors = {
  systemBackground: '#FFFFFF',
  secondarySystemBackground: '#F2F2F7',
  tertiarySystemBackground: '#FFFFFF',
  groupedBackground: '#F2F2F7',
  label: '#000000',
  secondaryLabel: 'rgba(60, 60, 67, 0.6)',
  tertiaryLabel: 'rgba(60, 60, 67, 0.3)',
  separator: 'rgba(60, 60, 67, 0.12)',
  opaqueSeparator: '#C6C6C8',
  accent: '#007AFF',
  accentMuted: 'rgba(0, 122, 255, 0.12)',
  campus: '#1C7C54',
  campusMuted: 'rgba(28, 124, 84, 0.12)',
  statusFree: '#34C759',
  statusSoon: '#FF9F0A',
  statusBusy: '#FF453A',
  destructive: '#FF3B30',
  fill: 'rgba(120, 120, 128, 0.12)',
  cardShadow: 'rgba(0, 0, 0, 0.06)',
  overlay: 'rgba(0, 0, 0, 0.45)',
};

export const radius = {
  sm: 10,
  md: 14,
  lg: 20,
  xl: 28,
  pill: 999,
};

export const space = {
  xs: 6,
  sm: 10,
  md: 16,
  lg: 20,
  xl: 28,
  xxl: 36,
};

export const type = {
  largeTitle: { fontSize: 34, fontWeight: '700' as const, letterSpacing: 0.37 },
  title1: { fontSize: 28, fontWeight: '700' as const },
  title2: { fontSize: 22, fontWeight: '700' as const },
  title3: { fontSize: 20, fontWeight: '600' as const },
  headline: { fontSize: 17, fontWeight: '600' as const },
  body: { fontSize: 17, fontWeight: '400' as const },
  callout: { fontSize: 16, fontWeight: '400' as const },
  subhead: { fontSize: 15, fontWeight: '400' as const },
  footnote: { fontSize: 13, fontWeight: '400' as const },
  caption1: { fontSize: 12, fontWeight: '400' as const },
  caption2: { fontSize: 11, fontWeight: '400' as const },
};

export const shadows = StyleSheet.create({
  card: Platform.select({
    ios: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.07,
      shadowRadius: 12,
    },
    default: { elevation: 3 },
  }),
  button: Platform.select({
    ios: {
      shadowColor: colors.campus,
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.25,
      shadowRadius: 16,
    },
    default: { elevation: 6 },
  }),
});

export const stackScreenOptions = {
  headerStyle: { backgroundColor: colors.secondarySystemBackground },
  headerTintColor: colors.accent,
  headerTitleStyle: { fontWeight: '600' as const, fontSize: 17, color: colors.label },
  headerShadowVisible: false,
  headerBackTitleVisible: false,
  ...(Platform.OS === 'ios' && {
    headerLargeTitle: true,
    headerLargeTitleShadowVisible: false,
  }),
};
