import React, { useEffect, useRef } from 'react';
import { Animated, Pressable, StyleSheet } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Radius } from '@/constants/theme';
import { useAppTheme } from '@/hooks/use-app-theme';

type ScrollTopButtonProps = {
  visible: boolean;
  onPress: () => void;
  // 距底部偏移，默认避开浮动分页栏（其自身已处理底部安全区）
  bottomOffset?: number;
};

// 长列表下滑后浮现的"返回顶部"圆形按钮，淡入淡出；贴近底部右侧、悬浮在分页栏上方
export function ScrollTopButton({ visible, onPress, bottomOffset = 96 }: ScrollTopButtonProps) {
  const { colors, shadow } = useAppTheme();
  const insets = useSafeAreaInsets();
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(opacity, {
      toValue: visible ? 1 : 0,
      duration: 180,
      useNativeDriver: true,
    }).start();
  }, [visible, opacity]);

  return (
    <Animated.View
      pointerEvents={visible ? 'auto' : 'none'}
      style={[styles.wrap, { bottom: insets.bottom + bottomOffset, opacity }]}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="返回顶部"
        onPress={onPress}
        style={({ pressed }) => [
          styles.btn,
          { backgroundColor: colors.surface, borderColor: colors.borderStrong },
          shadow ?? null,
          pressed ? styles.pressed : null,
        ]}
      >
        <MaterialIcons name="keyboard-arrow-up" size={26} color={colors.ink} />
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    right: 16,
    zIndex: 10,
  },
  btn: {
    width: 44,
    height: 44,
    borderRadius: Radius.pill,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.75,
  },
});
