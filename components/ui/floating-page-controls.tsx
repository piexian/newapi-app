import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { BlurView } from 'expo-blur';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Palette, Radius, Shadows } from '@/constants/theme';

type IconButtonProps = {
  label: string;
  icon: React.ComponentProps<typeof MaterialIcons>['name'];
  onPress: () => void;
  disabled?: boolean;
};

function IconButton({ label, icon, onPress, disabled }: IconButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.iconButton, pressed && !disabled ? styles.pressed : null]}>
      <MaterialIcons name={icon} size={21} color={disabled ? Palette.subtle : Palette.ink} />
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
  return (
    <View pointerEvents="box-none" style={styles.anchor}>
      <View style={styles.dock}>
        <BlurView intensity={48} tint="light" style={StyleSheet.absoluteFill} />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={refreshLabel ?? '刷新'}
          disabled={disabledRefresh}
          onPress={onRefresh}
          style={({ pressed }) => [
            styles.refreshButton,
            pressed && !disabledRefresh ? styles.pressed : null,
            disabledRefresh ? styles.disabled : null,
          ]}>
          <MaterialIcons name="refresh" size={19} color={Palette.accent} />
          <Text style={styles.refreshText}>{refreshLabel ?? '刷新'}</Text>
        </Pressable>
        <View style={styles.divider} />
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
    bottom: 12,
    alignItems: 'center',
  },
  dock: {
    width: '100%',
    maxWidth: 520,
    minHeight: 56,
    padding: 6,
    borderRadius: Radius.medium,
    borderWidth: 1,
    borderColor: 'rgba(184, 198, 194, 0.86)',
    backgroundColor: 'rgba(255, 255, 255, 0.86)',
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'center',
    ...(Shadows ?? {}),
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
    color: Palette.accent,
    fontSize: 13,
    fontWeight: '700',
  },
  divider: {
    width: 1,
    height: 28,
    backgroundColor: Palette.border,
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
  pressed: {
    backgroundColor: Palette.surfaceMuted,
    transform: [{ scale: 0.97 }],
  },
  disabled: {
    opacity: 0.5,
  },
});
