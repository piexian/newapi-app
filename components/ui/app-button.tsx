import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import * as Haptics from 'expo-haptics';
import React from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  type GestureResponderEvent,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { Radius } from '@/constants/theme';
import { useAppTheme } from '@/hooks/use-app-theme';

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

export function AppButton({
  label,
  icon,
  variant = 'primary',
  loading,
  compact,
  fullWidth,
  disabled,
  style,
  onPress,
  ...props
}: AppButtonProps) {
  const { colors } = useAppTheme();
  const isDisabled = disabled || loading;

  const variantStyle = {
    primary: { backgroundColor: colors.accent, borderColor: colors.accent },
    secondary: { backgroundColor: colors.surface, borderColor: colors.borderStrong },
    danger: { backgroundColor: colors.dangerSoft, borderColor: `${colors.danger}59` },
    quiet: { backgroundColor: 'transparent', borderColor: 'transparent' },
  }[variant];

  const foreground = {
    primary: colors.onAccent,
    secondary: colors.ink,
    danger: colors.danger,
    quiet: colors.accent,
  }[variant];

  const handlePress = (e: GestureResponderEvent) => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    onPress?.(e);
  };

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={isDisabled}
      onPress={handlePress}
      style={({ pressed, hovered }) => [
        styles.button,
        variantStyle,
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
