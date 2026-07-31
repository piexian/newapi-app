import React, { forwardRef, type ReactNode } from 'react';
import { StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';

import { Layout, Palette, Radius } from '@/constants/theme';

export type FormFieldProps = TextInputProps & {
  label: string;
  hint?: string;
  error?: string;
  trailing?: ReactNode;
};

export const FormField = forwardRef<TextInput, FormFieldProps>(function FormField(
  { label, hint, error, trailing, style, ...props },
  ref
) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <View style={[styles.inputShell, error ? styles.inputError : null]}>
        <TextInput
          ref={ref}
          placeholderTextColor={Palette.subtle}
          selectionColor={Palette.accent}
          style={[styles.input, style]}
          {...props}
        />
        {trailing}
      </View>
      {!!error && <Text style={styles.error}>{error}</Text>}
      {!error && !!hint && <Text style={styles.hint}>{hint}</Text>}
    </View>
  );
});

const styles = StyleSheet.create({
  field: {
    gap: 7,
  },
  label: {
    color: Palette.inkSoft,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '700',
  },
  inputShell: {
    minHeight: Layout.controlHeight,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Palette.borderStrong,
    borderRadius: Radius.medium,
    backgroundColor: Palette.surface,
    overflow: 'hidden',
  },
  inputError: {
    borderColor: Palette.danger,
  },
  input: {
    minWidth: 0,
    flex: 1,
    paddingHorizontal: 13,
    paddingVertical: 11,
    color: Palette.ink,
    fontSize: 15,
    lineHeight: 20,
  },
  hint: {
    color: Palette.muted,
    fontSize: 12,
    lineHeight: 17,
  },
  error: {
    color: Palette.danger,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '600',
  },
});
