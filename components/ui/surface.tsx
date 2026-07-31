import React from 'react';
import { StyleSheet, View, ViewProps } from 'react-native';

import { Palette, Radius, Shadows } from '@/constants/theme';

export function Surface({ style, ...props }: ViewProps) {
  return <View {...props} style={[styles.card, style]} />;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Palette.surface,
    borderRadius: Radius.medium,
    padding: 16,
    borderWidth: 1,
    borderColor: Palette.border,
    ...(Shadows ?? {}),
  },
});
