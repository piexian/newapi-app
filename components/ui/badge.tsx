import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

export function Badge({ text, color }: { text: string; color?: string }) {
  const bg = color ?? '#EEF2FF';
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
    borderRadius: 999,
  },
  text: {
    fontSize: 12,
    fontWeight: '600',
    color: '#11181C',
  },
});

