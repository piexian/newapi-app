import React from 'react';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { BlurView } from 'expo-blur';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type ButtonProps = {
  label: string;
  icon: React.ComponentProps<typeof MaterialIcons>['name'];
  onPress: () => void;
  disabled?: boolean;
  position: { left?: number; right?: number; bottom: number };
};

function GlassFab({ label, icon, onPress, disabled, position }: ButtonProps) {
  return (
    <View pointerEvents="box-none" style={[styles.fabWrap, position, disabled ? styles.disabled : null]}>
      <BlurView intensity={22} tint="light" style={styles.blur} />
      <View style={styles.border} />
      <Pressable accessibilityRole="button" onPress={onPress} disabled={disabled} style={styles.btn}>
        <MaterialIcons name={icon} size={18} color={disabled ? '#98A2B3' : '#11181C'} />
        <Text style={[styles.text, disabled ? styles.textDisabled : null]}>{label}</Text>
      </Pressable>
    </View>
  );
}

export type FloatingPageControlsProps = {
  onRefresh: () => void;
  onPrev: () => void;
  onNext: () => void;
  disabledRefresh?: boolean;
  disabledPrev?: boolean;
  disabledNext?: boolean;
  refreshLabel?: string;
};

export function FloatingPageControls({
  onRefresh,
  onPrev,
  onNext,
  disabledRefresh,
  disabledPrev,
  disabledNext,
  refreshLabel,
}: FloatingPageControlsProps) {
  const insets = useSafeAreaInsets();

  const baseBottom = insets.bottom + 84;
  const prevBottom = baseBottom + 12;
  const refreshBottom = prevBottom + 56;
  const nextBottom = baseBottom;

  return (
    <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
      <GlassFab
        label={refreshLabel ?? '刷新'}
        icon="refresh"
        onPress={onRefresh}
        disabled={disabledRefresh}
        position={{ left: 16, bottom: refreshBottom }}
      />
      <GlassFab
        label="上一页"
        icon="chevron-left"
        onPress={onPrev}
        disabled={disabledPrev}
        position={{ left: 16, bottom: prevBottom }}
      />
      <GlassFab
        label="下一页"
        icon="chevron-right"
        onPress={onNext}
        disabled={disabledNext}
        position={{ right: 16, bottom: nextBottom }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  fabWrap: {
    position: 'absolute',
    borderRadius: 999,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.20)',
  },
  blur: {
    ...StyleSheet.absoluteFillObject,
  },
  border: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.65)',
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  btn: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 999,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  text: {
    color: '#11181C',
    fontWeight: '900',
    fontSize: 13,
  },
  disabled: {
    opacity: 0.7,
  },
  textDisabled: {
    color: '#98A2B3',
  },
});

