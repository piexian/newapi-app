import React, { useMemo, useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

import { AppButton } from '@/components/ui/app-button';
import { Surface } from '@/components/ui/surface';
import { Palette, Radius } from '@/constants/theme';

function splitCommaList(value: string): string[] {
  return value
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

function uniqKeepOrder(values: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const v of values) {
    if (!v) continue;
    if (seen.has(v)) continue;
    seen.add(v);
    out.push(v);
  }
  return out;
}

export type DropdownSelectProps = {
  title?: string;
  value: string;
  options: string[];
  placeholder?: string;
  multiple?: boolean;
  disabled?: boolean;
  style?: any;
  textStyle?: any;
  placeholderTextColor?: string;
  onChange: (nextValue: string) => void;
};

export function DropdownSelect({
  title = '选择',
  value,
  options,
  placeholder = '请选择',
  multiple = false,
  disabled,
  style,
  textStyle,
  placeholderTextColor = '#98A2B3',
  onChange,
}: DropdownSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const normalizedOptions = useMemo(
    () => uniqKeepOrder(options.map((o) => o.trim()).filter(Boolean)),
    [options]
  );
  const optionSet = useMemo(() => new Set(normalizedOptions), [normalizedOptions]);

  const selected = useMemo(() => {
    if (!multiple) return new Set(value.trim() ? [value.trim()] : []);
    return new Set(splitCommaList(value));
  }, [multiple, value]);

  const filteredOptions = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return normalizedOptions;
    return normalizedOptions.filter((o) => o.toLowerCase().includes(q));
  }, [normalizedOptions, query]);

  const displayValue = useMemo(() => {
    if (!multiple) return value.trim();
    return splitCommaList(value).join(',');
  }, [multiple, value]);

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${title}，当前值：${displayValue || placeholder}`}
        style={({ pressed }) => [styles.field, pressed ? styles.fieldPressed : null, style]}
        onPress={() => {
          setQuery('');
          setOpen(true);
        }}
        disabled={disabled}
      >
        <Text
          style={[
            styles.fieldText,
            textStyle,
            !displayValue ? { color: placeholderTextColor } : null,
          ]}
          numberOfLines={1}
        >
          {displayValue || placeholder}
        </Text>
        <MaterialIcons name="unfold-more" size={19} color={placeholderTextColor} />
      </Pressable>

      <Modal transparent visible={open} animationType="fade" onRequestClose={() => setOpen(false)}>
        <View style={styles.backdrop}>
          <Surface style={styles.modalCard} accessibilityViewIsModal>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{title}</Text>
              <View style={styles.modalHeaderActions}>
                <AppButton
                  label="清空"
                  icon="backspace"
                  variant="quiet"
                  compact
                  onPress={() => {
                    onChange('');
                    setOpen(false);
                  }}
                />
                <AppButton
                  label={multiple ? '完成' : '关闭'}
                  icon={multiple ? 'check' : 'close'}
                  compact
                  onPress={() => setOpen(false)}
                />
              </View>
            </View>

            <View style={styles.searchShell}>
              <MaterialIcons name="search" size={19} color={Palette.muted} />
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder="搜索选项"
                placeholderTextColor={Palette.subtle}
                autoCapitalize="none"
                autoCorrect={false}
                style={styles.search}
              />
            </View>

            <FlatList
              data={filteredOptions}
              keyExtractor={(it) => it}
              keyboardShouldPersistTaps="handled"
              ListEmptyComponent={<Text style={styles.empty}>暂无选项</Text>}
              renderItem={({ item }) => {
                const active = selected.has(item);
                return (
                  <Pressable
                    accessibilityRole={multiple ? 'checkbox' : 'radio'}
                    accessibilityState={{ checked: active }}
                    style={({ pressed }) => [
                      styles.optionRow,
                      active ? styles.optionRowActive : null,
                      pressed ? styles.optionRowPressed : null,
                    ]}
                    onPress={() => {
                      if (!multiple) {
                        onChange(item);
                        setOpen(false);
                        return;
                      }
                      const next = new Set(selected);
                      if (next.has(item)) next.delete(item);
                      else next.add(item);
                      const nextOrdered = [
                        ...normalizedOptions.filter((o) => next.has(o)),
                        ...splitCommaList(value).filter((o) => next.has(o) && !optionSet.has(o)),
                      ];
                      onChange(uniqKeepOrder(nextOrdered).join(','));
                    }}
                  >
                    <Text style={styles.optionText} numberOfLines={1}>
                      {item}
                    </Text>
                    <View style={[styles.check, active ? styles.checkActive : styles.checkIdle]}>
                      {active && <MaterialIcons name="check" size={15} color="#FFFFFF" />}
                    </View>
                  </Pressable>
                );
              }}
            />
          </Surface>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  field: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    borderRadius: Radius.medium,
    borderWidth: 1,
    borderColor: Palette.borderStrong,
    backgroundColor: Palette.surface,
  },
  fieldPressed: {
    backgroundColor: Palette.surfaceMuted,
  },
  fieldText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: Palette.ink,
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 27, 24, 0.48)',
    padding: 16,
    justifyContent: 'center',
  },
  modalCard: {
    padding: 12,
    gap: 10,
    maxHeight: '80%',
    width: '100%',
    maxWidth: 560,
    alignSelf: 'center',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: Palette.ink,
  },
  modalHeaderActions: {
    flexDirection: 'row',
    gap: 8,
  },
  searchShell: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: Palette.borderStrong,
    backgroundColor: Palette.surface,
    borderRadius: Radius.medium,
    paddingHorizontal: 12,
  },
  search: {
    flex: 1,
    paddingVertical: 10,
    color: Palette.ink,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 46,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: Radius.small,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Palette.border,
  },
  optionRowActive: {
    backgroundColor: Palette.accentSoft,
  },
  optionRowPressed: {
    opacity: 0.72,
  },
  optionText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: Palette.ink,
  },
  check: {
    width: 22,
    height: 22,
    borderRadius: 5,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  checkActive: {
    backgroundColor: Palette.accent,
    borderColor: Palette.accent,
  },
  checkIdle: {
    backgroundColor: Palette.surface,
    borderColor: Palette.borderStrong,
  },
  empty: {
    textAlign: 'center',
    color: Palette.muted,
    paddingVertical: 10,
    fontWeight: '700',
  },
});
