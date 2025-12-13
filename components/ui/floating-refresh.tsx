import React from 'react';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export function FloatingRefreshButton({
  onPress,
  disabled,
  label,
}: {
  onPress: () => void;
  disabled?: boolean;
  label?: string;
}) {
  const insets = useSafeAreaInsets();

  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={[
        styles.btn,
        {
          left: 16,
          bottom: insets.bottom + 84,
          opacity: disabled ? 0.6 : 1,
        },
      ]}>
      <View style={styles.row}>
        <MaterialIcons name="refresh" size={18} color="#fff" />
        <Text style={styles.text}>{label ?? '刷新'}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    position: 'absolute',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 999,
    backgroundColor: '#11181C',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.16)',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  text: {
    color: '#fff',
    fontWeight: '900',
    fontSize: 13,
  },
});
