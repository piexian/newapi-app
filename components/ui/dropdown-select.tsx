import React, { useMemo, useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { Surface } from '@/components/ui/surface';

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
        style={[styles.field, style]}
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
        <Text style={[styles.chevron, { color: placeholderTextColor }]} accessibilityElementsHidden>
          ▾
        </Text>
      </Pressable>

      <Modal transparent visible={open} animationType="fade" onRequestClose={() => setOpen(false)}>
        <View style={styles.backdrop}>
          <Surface style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{title}</Text>
              <View style={styles.modalHeaderActions}>
                <Pressable
                  style={[styles.modalBtn, styles.modalBtnGhost]}
                  onPress={() => {
                    onChange('');
                    setOpen(false);
                  }}
                >
                  <Text style={[styles.modalBtnText, styles.modalBtnTextGhost]}>清空</Text>
                </Pressable>
                <Pressable style={styles.modalBtn} onPress={() => setOpen(false)}>
                  <Text style={styles.modalBtnText}>{multiple ? '完成' : '关闭'}</Text>
                </Pressable>
              </View>
            </View>

            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="搜索…"
              autoCapitalize="none"
              autoCorrect={false}
              style={styles.search}
            />

            <FlatList
              data={filteredOptions}
              keyExtractor={(it) => it}
              keyboardShouldPersistTaps="handled"
              ListEmptyComponent={<Text style={styles.empty}>暂无选项</Text>}
              renderItem={({ item }) => {
                const active = selected.has(item);
                return (
                  <Pressable
                    style={styles.optionRow}
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
                    <Text style={[styles.check, active ? styles.checkActive : styles.checkIdle]}>
                      {active ? '✓' : ''}
                    </Text>
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  fieldText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: '#11181C',
  },
  chevron: {
    fontSize: 14,
    fontWeight: '900',
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    padding: 16,
    justifyContent: 'center',
  },
  modalCard: {
    padding: 12,
    gap: 10,
    maxHeight: '80%',
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
    color: '#11181C',
  },
  modalHeaderActions: {
    flexDirection: 'row',
    gap: 8,
  },
  modalBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: '#11181C',
  },
  modalBtnGhost: {
    backgroundColor: '#EEF2FF',
  },
  modalBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#fff',
  },
  modalBtnTextGhost: {
    color: '#11181C',
  },
  search: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(0,0,0,0.12)',
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#11181C',
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(0,0,0,0.06)',
  },
  optionText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: '#11181C',
  },
  check: {
    width: 22,
    textAlign: 'center',
    fontWeight: '900',
  },
  checkActive: {
    color: '#11181C',
  },
  checkIdle: {
    color: 'transparent',
  },
  empty: {
    textAlign: 'center',
    color: '#667085',
    paddingVertical: 10,
    fontWeight: '700',
  },
});
