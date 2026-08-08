import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { BlurView } from 'expo-blur';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Radius } from '@/constants/theme';
import { useAppTheme } from '@/hooks/use-app-theme';

type IconButtonProps = {
  label: string;
  icon: React.ComponentProps<typeof MaterialIcons>['name'];
  onPress: () => void;
  disabled?: boolean;
};

function IconButton({ label, icon, onPress, disabled }: IconButtonProps) {
  const { colors } = useAppTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.iconButton,
        pressed && !disabled ? { backgroundColor: colors.surfaceMuted, transform: [{ scale: 0.97 }] } : null,
      ]}>
      <MaterialIcons name={icon} size={21} color={disabled ? colors.subtle : colors.ink} />
    </Pressable>
  );
}

export type FloatingPageControlsProps = {
  onRefresh: () => void;
  onPrev: () => void;
  onNext: () => void;
  disabledRefresh?: boolean;
  disabledPrev?: boolean;
  disabledNext?: boolean;
  refreshLabel?: string;
};

export function FloatingPageControls({
  onRefresh,
  onPrev,
  onNext,
  disabledRefresh,
  disabledPrev,
  disabledNext,
  refreshLabel,
}: FloatingPageControlsProps) {
  const { colors, isDark, shadow } = useAppTheme();
  const insets = useSafeAreaInsets();
  return (
    <View pointerEvents="box-none" style={[styles.anchor, { bottom: insets.bottom + 12 }]}>
      <View
        style={[
          styles.dock,
          {
            borderColor: isDark ? 'rgba(62, 84, 77, 0.86)' : 'rgba(184, 198, 194, 0.86)',
            backgroundColor: isDark ? 'rgba(23, 35, 31, 0.88)' : 'rgba(255, 255, 255, 0.86)',
          },
          shadow ?? null,
        ]}>
        <BlurView intensity={48} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={refreshLabel ?? '刷新'}
          disabled={disabledRefresh}
          onPress={onRefresh}
          style={({ pressed }) => [
            styles.refreshButton,
            pressed && !disabledRefresh
              ? { backgroundColor: colors.surfaceMuted, transform: [{ scale: 0.97 }] }
              : null,
            disabledRefresh ? styles.disabled : null,
          ]}>
          <MaterialIcons name="refresh" size={19} color={colors.accent} />
          <Text style={[styles.refreshText, { color: colors.accent }]}>{refreshLabel ?? '刷新'}</Text>
        </Pressable>
        <View style={[styles.divider, { backgroundColor: colors.border }]} />
        <View style={styles.pagerGroup}>
          <IconButton label="上一页" icon="chevron-left" onPress={onPrev} disabled={disabledPrev} />
          <IconButton label="下一页" icon="chevron-right" onPress={onNext} disabled={disabledNext} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  anchor: {
    position: 'absolute',
    left: 16,
    right: 16,
    alignItems: 'center',
  },
  dock: {
    width: '100%',
    maxWidth: 520,
    minHeight: 56,
    padding: 6,
    borderRadius: Radius.medium,
    borderWidth: 1,
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'center',
  },
  refreshButton: {
    minHeight: 42,
    flex: 1,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: Radius.small,
  },
  refreshText: {
    fontSize: 13,
    fontWeight: '700',
  },
  divider: {
    width: 1,
    height: 28,
  },
  pagerGroup: {
    flexDirection: 'row',
    gap: 4,
    marginLeft: 4,
  },
  iconButton: {
    width: 42,
    height: 42,
    borderRadius: Radius.small,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabled: {
    opacity: 0.5,
  },
});
