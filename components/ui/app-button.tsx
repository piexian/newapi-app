import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { Palette, Radius } from '@/constants/theme';

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'quiet';

export type AppButtonProps = Omit<PressableProps, 'children' | 'style'> & {
  label: string;
  icon?: React.ComponentProps<typeof MaterialIcons>['name'];
  variant?: ButtonVariant;
  loading?: boolean;
  compact?: boolean;
  fullWidth?: boolean;
  style?: StyleProp<ViewStyle>;
};

const variantStyles = {
  primary: { backgroundColor: Palette.accent, borderColor: Palette.accent },
  secondary: { backgroundColor: Palette.surface, borderColor: Palette.borderStrong },
  danger: { backgroundColor: Palette.dangerSoft, borderColor: '#F4B7B1' },
  quiet: { backgroundColor: 'transparent', borderColor: 'transparent' },
} as const;

const textColors = {
  primary: '#FFFFFF',
  secondary: Palette.ink,
  danger: Palette.danger,
  quiet: Palette.accent,
} as const;

export function AppButton({
  label,
  icon,
  variant = 'primary',
  loading,
  compact,
  fullWidth,
  disabled,
  style,
  ...props
}: AppButtonProps) {
  const isDisabled = disabled || loading;
  const foreground = textColors[variant];

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={isDisabled}
      style={({ pressed, hovered }) => [
        styles.button,
        variantStyles[variant],
        compact ? styles.compact : null,
        fullWidth ? styles.fullWidth : null,
        hovered && !isDisabled ? styles.hovered : null,
        pressed && !isDisabled ? styles.pressed : null,
        isDisabled ? styles.disabled : null,
        style,
      ]}
      {...props}>
      {loading ? (
        <ActivityIndicator size="small" color={foreground} />
      ) : icon ? (
        <MaterialIcons name={icon} size={18} color={foreground} />
      ) : null}
      <Text style={[styles.label, { color: foreground }]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 46,
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderRadius: Radius.medium,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    alignSelf: 'flex-start',
  },
  compact: {
    minHeight: 40,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  fullWidth: {
    width: '100%',
    alignSelf: 'stretch',
  },
  hovered: {
    opacity: 0.9,
  },
  pressed: {
    opacity: 0.82,
    transform: [{ translateY: 1 }, { scale: 0.99 }],
  },
  disabled: {
    opacity: 0.5,
  },
  label: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '700',
  },
});
