import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Radius, type ToneName } from '@/constants/theme';
import { useAppTheme } from '@/hooks/use-app-theme';

export function Badge({
  text,
  color,
  tone = 'accent',
}: {
  text: string;
  /** 自定义背景色（保留兼容）；优先使用 tone */
  color?: string;
  tone?: ToneName;
}) {
  const { colors, tones } = useAppTheme();
  const t = tones[tone];
  const bg = color ?? t.bg;
  return (
    <View style={[styles.badge, { backgroundColor: bg, borderColor: colors.border }]}>
      <Text style={[styles.text, { color: color ? colors.ink : t.fg }]}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: Radius.small,
    borderWidth: 1,
  },
  text: {
    fontSize: 12,
    fontWeight: '600',
  },
});
