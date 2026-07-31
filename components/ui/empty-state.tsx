import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Palette, Radius } from '@/constants/theme';

export function EmptyState({
  title,
  description,
  icon = 'inbox',
}: {
  title: string;
  description?: string;
  icon?: React.ComponentProps<typeof MaterialIcons>['name'];
}) {
  return (
    <View style={styles.container}>
      <View style={styles.icon}>
        <MaterialIcons name={icon} size={23} color={Palette.muted} />
      </View>
      <Text style={styles.title}>{title}</Text>
      {!!description && <Text style={styles.description}>{description}</Text>}
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
    borderColor: Palette.border,
    backgroundColor: Palette.surface,
  },
  icon: {
    width: 46,
    height: 46,
    marginBottom: 3,
    borderRadius: Radius.medium,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Palette.surfaceMuted,
  },
  title: {
    color: Palette.ink,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '800',
    textAlign: 'center',
  },
  description: {
    maxWidth: 360,
    color: Palette.muted,
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
  },
});
