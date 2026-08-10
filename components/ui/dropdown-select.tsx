import React, { useMemo, useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

import { AppButton } from '@/components/ui/app-button';
import { EmptyState } from '@/components/ui/empty-state';
import { Surface } from '@/components/ui/surface';
import { Radius } from '@/constants/theme';
import { useAppTheme } from '@/hooks/use-app-theme';

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
  placeholderTextColor,
  onChange,
}: DropdownSelectProps) {
  const { colors } = useAppTheme();
  const placeholderColor = placeholderTextColor ?? colors.subtle;
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
        accessibilityState={{ disabled: !!disabled }}
        style={({ pressed }) => [
          styles.field,
          { borderColor: colors.borderStrong, backgroundColor: colors.surface },
          pressed ? { backgroundColor: colors.surfaceMuted } : null,
          disabled ? styles.fieldDisabled : null,
          style,
        ]}
        onPress={() => {
          setQuery('');
          setOpen(true);
        }}
        disabled={disabled}
      >
        <Text
          style={[
            styles.fieldText,
            { color: colors.ink },
            textStyle,
            !displayValue ? { color: placeholderColor } : null,
          ]}
          numberOfLines={1}
        >
          {displayValue || placeholder}
        </Text>
        <MaterialIcons name="unfold-more" size={19} color={placeholderColor} />
      </Pressable>

      <Modal transparent visible={open} animationType="fade" onRequestClose={() => setOpen(false)}>
        {/* 点遮罩关闭；内层拦截 responder 避免内容区点击穿透 */}
        <Pressable style={[styles.backdrop, { backgroundColor: colors.overlay }]} onPress={() => setOpen(false)}>
          <View onStartShouldSetResponder={() => true}>
            <Surface style={styles.modalCard} accessibilityViewIsModal>
              <View style={styles.modalHeader}>
                <Text style={[styles.modalTitle, { color: colors.ink }]}>{title}</Text>
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

              <View
                style={[
                  styles.searchShell,
                  { borderColor: colors.borderStrong, backgroundColor: colors.surface },
                ]}>
                <MaterialIcons name="search" size={19} color={colors.muted} />
                <TextInput
                  value={query}
                  onChangeText={setQuery}
                  placeholder="搜索选项"
                  placeholderTextColor={colors.subtle}
                  autoCapitalize="none"
                  autoCorrect={false}
                  style={[styles.search, { color: colors.ink }]}
                />
              </View>

              <FlatList
                data={filteredOptions}
                keyExtractor={(it) => it}
                keyboardShouldPersistTaps="handled"
                ListEmptyComponent={<EmptyState icon="search-off" title="暂无选项" />}
                renderItem={({ item }) => {
                  const active = selected.has(item);
                  return (
                    <Pressable
                      accessibilityRole={multiple ? 'checkbox' : 'radio'}
                      accessibilityState={{ checked: active }}
                      style={({ pressed }) => [
                        styles.optionRow,
                        { borderBottomColor: colors.border },
                        active ? { backgroundColor: colors.accentSoft } : null,
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
                      <Text style={[styles.optionText, { color: colors.ink }]} numberOfLines={1}>
                        {item}
                      </Text>
                      <View
                        style={[
                          styles.check,
                          active
                            ? { backgroundColor: colors.accent, borderColor: colors.accent }
                            : { backgroundColor: colors.surface, borderColor: colors.borderStrong },
                        ]}>
                        {active && <MaterialIcons name="check" size={15} color={colors.onAccent} />}
                      </View>
                    </Pressable>
                  );
                }}
              />
            </Surface>
          </View>
        </Pressable>
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
  },
  fieldDisabled: {
    opacity: 0.5,
  },
  fieldText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
  },
  backdrop: {
    flex: 1,
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
    fontWeight: '800',
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
    borderRadius: Radius.medium,
    paddingHorizontal: 12,
  },
  search: {
    flex: 1,
    paddingVertical: 10,
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
  },
  optionRowPressed: {
    opacity: 0.72,
  },
  optionText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
  },
  check: {
    width: 22,
    height: 22,
    borderRadius: Radius.small,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
});
