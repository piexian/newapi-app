import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Radius } from '@/constants/theme';
import { useAppTheme } from '@/hooks/use-app-theme';

export function EmptyState({
  title,
  description,
  icon = 'inbox',
}: {
  title: string;
  description?: string;
  icon?: React.ComponentProps<typeof MaterialIcons>['name'];
}) {
  const { colors } = useAppTheme();
  return (
    <View
      style={[
        styles.container,
        { borderColor: colors.border, backgroundColor: colors.surface },
      ]}>
      <View style={[styles.icon, { backgroundColor: colors.surfaceMuted }]}>
        <MaterialIcons name={icon} size={23} color={colors.muted} />
      </View>
      <Text style={[styles.title, { color: colors.ink }]}>{title}</Text>
      {!!description && (
        <Text style={[styles.description, { color: colors.muted }]}>{description}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    minHeight: 180,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    padding: 24,
    borderRadius: Radius.medium,
    borderWidth: 1,
  },
  icon: {
    width: 46,
    height: 46,
    marginBottom: 3,
    borderRadius: Radius.medium,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '800',
    textAlign: 'center',
  },
  description: {
    maxWidth: 360,
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
  },
});
