import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Palette, Radius } from '@/constants/theme';

export function Badge({ text, color }: { text: string; color?: string }) {
  const bg = color ?? Palette.accentSoft;
  return (
    <View style={[styles.badge, { backgroundColor: bg }]}>
      <Text style={styles.text}>{text}</Text>
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
    borderColor: 'rgba(21, 33, 31, 0.08)',
  },
  text: {
    fontSize: 12,
    fontWeight: '600',
    color: Palette.ink,
  },
});
