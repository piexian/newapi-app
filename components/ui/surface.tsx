import React from 'react';
import { StyleSheet, View, ViewProps } from 'react-native';

import { Radius } from '@/constants/theme';
import { useAppTheme } from '@/hooks/use-app-theme';

export function Surface({ style, ...props }: ViewProps) {
  const { colors, shadow } = useAppTheme();
  return (
    <View
      {...props}
      style={[
        styles.card,
        { backgroundColor: colors.surface, borderColor: colors.border },
        shadow ?? null,
        style,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Radius.medium,
    padding: 16,
    borderWidth: 1,
  },
});
