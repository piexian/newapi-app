import React, { forwardRef, type ReactNode } from 'react';
import { StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';

import { Layout, Radius } from '@/constants/theme';
import { useAppTheme } from '@/hooks/use-app-theme';

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
  const { colors } = useAppTheme();
  return (
    <View style={styles.field}>
      <Text style={[styles.label, { color: colors.inkSoft }]}>{label}</Text>
      <View
        style={[
          styles.inputShell,
          {
            borderColor: error ? colors.danger : colors.borderStrong,
            backgroundColor: colors.surface,
          },
        ]}>
        <TextInput
          ref={ref}
          placeholderTextColor={colors.subtle}
          selectionColor={colors.accent}
          style={[styles.input, { color: colors.ink }, style]}
          {...props}
        />
        {trailing}
      </View>
      {!!error && <Text style={[styles.error, { color: colors.danger }]}>{error}</Text>}
      {!error && !!hint && <Text style={[styles.hint, { color: colors.muted }]}>{hint}</Text>}
    </View>
  );
});

const styles = StyleSheet.create({
  field: {
    gap: 7,
  },
  label: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '700',
  },
  inputShell: {
    minHeight: Layout.controlHeight,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: Radius.medium,
    overflow: 'hidden',
  },
  input: {
    minWidth: 0,
    flex: 1,
    paddingHorizontal: 13,
    paddingVertical: 11,
    fontSize: 15,
    lineHeight: 20,
  },
  hint: {
    fontSize: 12,
    lineHeight: 17,
  },
  error: {
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '600',
  },
});
