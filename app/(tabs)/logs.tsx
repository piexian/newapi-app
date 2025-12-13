import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, FlatList, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Clipboard from 'expo-clipboard';

import { Badge } from '@/components/ui/badge';
import { FloatingPageControls } from '@/components/ui/floating-page-controls';
import { Surface } from '@/components/ui/surface';
import { useApi } from '@/hooks/use-api';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { formatCount, formatDateTimeEpochSeconds, formatOmega } from '@/lib/format';
import { parseLogs, parseLogStat } from '@/lib/parsers';

type AnyRecord = Record<string, unknown>;

function isRecord(v: unknown): v is AnyRecord {
  return !!v && typeof v === 'object' && !Array.isArray(v);
}

function safeParseJson(input?: string): unknown {
  if (!input) return null;
  try {
    return JSON.parse(input) as unknown;
  } catch {
    return null;
  }
}

function nowSeconds() {
  return Math.floor(Date.now() / 1000);
}

function todayStartSeconds() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return Math.floor(d.getTime() / 1000);
}

function logTypeLabel(type?: number) {
  switch (type) {
    case 1:
      return '充值';
    case 2:
      return '消费';
    case 3:
      return '管理';
    case 4:
      return '系统';
    case 5:
      return '错误';
    case 6:
      return '退款';
    default:
      return type === 0 ? '全部' : `Type ${type ?? '—'}`;
  }
}

export default function LogsScreen() {
  const api = useApi();
  const colorScheme = useColorScheme();
  const insets = useSafeAreaInsets();

  const [busy, setBusy] = useState(false);
  const [stat, setStat] = useState<Record<string, number>>({});
  const [logs, setLogs] = useState<ReturnType<typeof parseLogs>>([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [total, setTotal] = useState(0);

  const [logType, setLogType] = useState(0);
  const [tokenName, setTokenName] = useState('');
  const [modelName, setModelName] = useState('');
  const [group, setGroup] = useState('');
  const [startTs, setStartTs] = useState(String(todayStartSeconds()));
  const [endTs, setEndTs] = useState(String(nowSeconds()));

  const [detailsOpen, setDetailsOpen] = useState(false);
  const [detailsLog, setDetailsLog] = useState<(typeof logs)[number] | null>(null);
  const [error, setError] = useState('');

  const inputStyle = useMemo(
    () => [
      styles.input,
      colorScheme === 'dark' ? styles.inputDark : styles.inputLight,
    ],
    [colorScheme]
  );

  const queryParams = useMemo(() => {
    const startNum = startTs.trim() ? Number(startTs.trim()) : undefined;
    const endNum = endTs.trim() ? Number(endTs.trim()) : undefined;
    return {
      type: logType ? logType : undefined,
      token_name: tokenName.trim() ? tokenName.trim() : undefined,
      model_name: modelName.trim() ? modelName.trim() : undefined,
      group: group.trim() ? group.trim() : undefined,
      start_timestamp: Number.isFinite(startNum) ? startNum : undefined,
      end_timestamp: Number.isFinite(endNum) ? endNum : undefined,
    } as const;
  }, [endTs, group, logType, modelName, startTs, tokenName]);

  const load = useCallback(
    async (nextPage = 1) => {
      setError('');
      setBusy(true);
      try {
        const [statRes, logsRes] = await Promise.all([
          api.request({ path: '/api/log/self/stat', query: queryParams }),
          api.request({
            path: '/api/log/self',
            query: { ...queryParams, p: nextPage, page_size: pageSize },
          }),
        ]);

        const statEnv = statRes.body as unknown;
        if (isRecord(statEnv) && typeof statEnv.success === 'boolean' && statEnv.success === false) {
          setError(typeof statEnv.message === 'string' ? statEnv.message : 'stat 失败');
          return;
        }
        const logsEnv = logsRes.body as unknown;
        if (isRecord(logsEnv) && typeof logsEnv.success === 'boolean' && logsEnv.success === false) {
          setError(typeof logsEnv.message === 'string' ? logsEnv.message : 'logs 失败');
          return;
        }

        setStat(parseLogStat(statRes.body));
        setLogs(parseLogs(logsRes.body));

        const data = (isRecord(logsEnv) && isRecord(logsEnv.data) ? logsEnv.data : null) as AnyRecord | null;
        setPage(typeof data?.page === 'number' ? data.page : nextPage);
        setPageSize(typeof data?.page_size === 'number' ? data.page_size : pageSize);
        setTotal(typeof data?.total === 'number' ? data.total : 0);

        if (!statRes.ok) setError(`stat 失败：HTTP ${statRes.status}`);
        if (!logsRes.ok) setError((prev) => prev || `logs 失败：HTTP ${logsRes.status}`);
      } catch (e) {
        setError(e instanceof Error ? e.message : '请求失败');
      } finally {
        setBusy(false);
      }
    },
    [api, pageSize, queryParams]
  );

  const applyToday = useCallback(() => {
    setStartTs(String(todayStartSeconds()));
    setEndTs(String(nowSeconds()));
  }, []);

  const applyRange = useCallback((days: number) => {
    const end = nowSeconds();
    const start = end - days * 24 * 3600;
    setStartTs(String(start));
    setEndTs(String(end));
  }, []);

  const maxPage = useMemo(() => {
    if (!total) return page;
    return Math.max(1, Math.ceil(total / pageSize));
  }, [page, pageSize, total]);

  const canPrev = page > 1;
  const canNext = page < maxPage;

  useEffect(() => {
    void load(1);
  }, [load]);

  return (
    <View style={styles.screen}>
      <Modal transparent visible={detailsOpen} animationType="fade" onRequestClose={() => setDetailsOpen(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>日志详情</Text>
              <View style={styles.modalHeaderActions}>
                <Pressable
                  style={[styles.modalClose, styles.modalCopy]}
                  onPress={async () => {
                    const content = [
                      `时间：${formatDateTimeEpochSeconds(detailsLog?.createdAt)}`,
                      `类型：${logTypeLabel(detailsLog?.type)}`,
                      detailsLog?.modelName ? `模型：${detailsLog.modelName}` : '',
                      detailsLog?.tokenName ? `令牌：${detailsLog.tokenName}` : '',
                      detailsLog?.group ? `分组：${detailsLog.group}` : '',
                      `消耗：${formatOmega(detailsLog?.quota)}`,
                      `Tokens：${(detailsLog?.promptTokens ?? 0) + (detailsLog?.completionTokens ?? 0)}`,
                      detailsLog?.useTime ? `用时：${detailsLog.useTime}s` : '',
                      detailsLog?.ip ? `IP：${detailsLog.ip}` : '',
                      '',
                      '内容：',
                      detailsLog?.content || '',
                      '',
                      'Other：',
                      (() => {
                        const parsed = safeParseJson(detailsLog?.other);
                        if (parsed && typeof parsed === 'object') return JSON.stringify(parsed, null, 2);
                        return detailsLog?.other || '';
                      })(),
                    ]
                      .filter(Boolean)
                      .join('\n');
                    await Clipboard.setStringAsync(content);
                    Alert.alert('已复制', '已复制详情到剪贴板');
                  }}>
                  <Text style={styles.modalCloseText}>复制</Text>
                </Pressable>
                <Pressable style={styles.modalClose} onPress={() => setDetailsOpen(false)}>
                  <Text style={styles.modalCloseText}>关闭</Text>
                </Pressable>
              </View>
            </View>
            <ScrollView contentContainerStyle={styles.modalBody}>
              <View style={styles.kvRow}>
                <Text style={styles.k}>时间</Text>
                <Text style={styles.v}>{formatDateTimeEpochSeconds(detailsLog?.createdAt)}</Text>
              </View>
              <View style={styles.kvRow}>
                <Text style={styles.k}>类型</Text>
                <Text style={styles.v}>{logTypeLabel(detailsLog?.type)}</Text>
              </View>
              {!!detailsLog?.modelName && (
                <View style={styles.kvRow}>
                  <Text style={styles.k}>模型</Text>
                  <Text style={styles.v}>{detailsLog.modelName}</Text>
                </View>
              )}
              {!!detailsLog?.tokenName && (
                <View style={styles.kvRow}>
                  <Text style={styles.k}>令牌</Text>
                  <Text style={styles.v}>{detailsLog.tokenName}</Text>
                </View>
              )}
              {!!detailsLog?.group && (
                <View style={styles.kvRow}>
                  <Text style={styles.k}>分组</Text>
                  <Text style={styles.v}>{detailsLog.group}</Text>
                </View>
              )}
              <View style={styles.kvRow}>
                <Text style={styles.k}>消耗</Text>
                <Text style={styles.v}>{formatOmega(detailsLog?.quota)}</Text>
              </View>
              <View style={styles.kvRow}>
                <Text style={styles.k}>Tokens</Text>
                <Text style={styles.v}>
                  {formatCount((detailsLog?.promptTokens ?? 0) + (detailsLog?.completionTokens ?? 0))}
                </Text>
              </View>
              <View style={styles.kvRow}>
                <Text style={styles.k}>用时</Text>
                <Text style={styles.v}>{detailsLog?.useTime ? `${detailsLog.useTime}s` : '—'}</Text>
              </View>
              {!!detailsLog?.ip && (
                <View style={styles.kvRow}>
                  <Text style={styles.k}>IP</Text>
                  <Text style={styles.v}>{detailsLog.ip}</Text>
                </View>
              )}

              <Text style={styles.modalSection}>内容</Text>
              <Text selectable style={styles.mono}>
                {detailsLog?.content || '—'}
              </Text>

              <Text style={styles.modalSection}>Other</Text>
              <Text selectable style={styles.mono}>
                {(() => {
                  const parsed = safeParseJson(detailsLog?.other);
                  if (parsed && typeof parsed === 'object') return `${JSON.stringify(parsed, null, 2)}\n`;
                  return detailsLog?.other || '—';
                })()}
              </Text>
            </ScrollView>
          </View>
        </View>
      </Modal>

      <FlatList
        style={styles.list}
        contentContainerStyle={[
          styles.container,
          { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 120 },
        ]}
        data={logs}
        keyExtractor={(item, index) => `${item.createdAt ?? 't'}-${item.id}-${index}`}
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={styles.title}>日志</Text>

            {!!error && (
              <Surface>
                <Text style={styles.errorText}>{error}</Text>
              </Surface>
            )}

            <Surface style={styles.filterCard}>
              <Text style={styles.cardTitle}>筛选</Text>
              <View style={styles.chipRow}>
                {[0, 2, 1, 5, 3, 4].map((t) => {
                  const active = logType === t;
                  return (
                    <Pressable
                      key={t}
                      style={[styles.chip, active ? styles.chipActive : styles.chipIdle]}
                      onPress={() => setLogType(t)}
                      disabled={busy}>
                      <Text style={[styles.chipText, active ? styles.chipTextActive : styles.chipTextIdle]}>
                        {logTypeLabel(t)}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              <TextInput
                value={tokenName}
                onChangeText={setTokenName}
                placeholder="令牌名 token_name（可选）"
                placeholderTextColor={colorScheme === 'dark' ? '#9BA1A6' : '#98A2B3'}
                autoCapitalize="none"
                autoCorrect={false}
                style={inputStyle}
              />
              <TextInput
                value={modelName}
                onChangeText={setModelName}
                placeholder="模型名 model_name（可选）"
                placeholderTextColor={colorScheme === 'dark' ? '#9BA1A6' : '#98A2B3'}
                autoCapitalize="none"
                autoCorrect={false}
                style={inputStyle}
              />
              <TextInput
                value={group}
                onChangeText={setGroup}
                placeholder="分组 group（可选）"
                placeholderTextColor={colorScheme === 'dark' ? '#9BA1A6' : '#98A2B3'}
                autoCapitalize="none"
                autoCorrect={false}
                style={inputStyle}
              />

              <View style={styles.timeRow}>
                <TextInput
                  value={startTs}
                  onChangeText={setStartTs}
                  placeholder="start_timestamp（秒）"
                  keyboardType="numeric"
                  style={[inputStyle, styles.timeInput]}
                />
                <TextInput
                  value={endTs}
                  onChangeText={setEndTs}
                  placeholder="end_timestamp（秒）"
                  keyboardType="numeric"
                  style={[inputStyle, styles.timeInput]}
                />
              </View>
              <View style={styles.chipRow}>
                <Pressable style={[styles.chip, styles.chipIdle]} onPress={applyToday} disabled={busy}>
                  <Text style={[styles.chipText, styles.chipTextIdle]}>今天</Text>
                </Pressable>
                <Pressable style={[styles.chip, styles.chipIdle]} onPress={() => applyRange(7)} disabled={busy}>
                  <Text style={[styles.chipText, styles.chipTextIdle]}>7天</Text>
                </Pressable>
                <Pressable style={[styles.chip, styles.chipIdle]} onPress={() => applyRange(30)} disabled={busy}>
                  <Text style={[styles.chipText, styles.chipTextIdle]}>30天</Text>
                </Pressable>
              </View>

              <View style={styles.inlineRow}>
                <Pressable style={styles.smallBtn} onPress={() => load(1)} disabled={busy}>
                  <Text style={styles.smallBtnText}>{busy ? '加载中…' : '查询'}</Text>
                </Pressable>
                <Pressable
                  style={[styles.smallBtn, styles.ghostBtn]}
                  onPress={() => {
                    setLogType(0);
                    setTokenName('');
                    setModelName('');
                    setGroup('');
                    setStartTs(String(todayStartSeconds()));
                    setEndTs(String(nowSeconds()));
                    void load(1);
                  }}
                  disabled={busy}>
                  <Text style={styles.smallBtnText}>重置</Text>
                </Pressable>
              </View>
            </Surface>

            <Surface style={styles.statCard}>
              <Text style={styles.cardTitle}>统计</Text>
              <View style={styles.statRow}>
                <Text style={styles.statKey}>消耗</Text>
                <Text style={styles.statVal}>{formatOmega(stat.quota)}</Text>
              </View>
              <View style={styles.statRow}>
                <Text style={styles.statKey}>RPM</Text>
                <Text style={styles.statVal}>{formatCount(stat.rpm)}</Text>
              </View>
              <View style={styles.statRow}>
                <Text style={styles.statKey}>TPM</Text>
                <Text style={styles.statVal}>{formatCount(stat.tpm)}</Text>
              </View>
            </Surface>

            <Surface style={styles.pagerCard}>
              <Text style={styles.cardTitle}>分页</Text>
              <View style={styles.pagerRow}>
                <Text style={styles.pagerInfo}>
                  第 {page} / {maxPage} 页 · 共 {total} 条
                </Text>
              </View>
              <View style={styles.chipRow}>
                {[10, 20, 50].map((s) => {
                  const active = pageSize === s;
                  return (
                    <Pressable
                      key={s}
                      style={[styles.chip, active ? styles.chipActive : styles.chipIdle]}
                      onPress={() => {
                        setPageSize(s);
                        setPage(1);
                        void load(1);
                      }}
                      disabled={busy}>
                      <Text style={[styles.chipText, active ? styles.chipTextActive : styles.chipTextIdle]}>{s}/页</Text>
                    </Pressable>
                  );
                })}
              </View>
            </Surface>

            <Text style={styles.listTitle}>列表</Text>
          </View>
        }
        renderItem={({ item }) => {
          const totalTokens = (item.promptTokens ?? 0) + (item.completionTokens ?? 0);
          return (
            <Pressable
              onPress={() => {
                setDetailsLog(item);
                setDetailsOpen(true);
              }}
              disabled={busy}>
              <Surface style={styles.item}>
                <View style={styles.itemTop}>
                  <Badge text={logTypeLabel(item.type)} color="#EEF2FF" />
                  <Text style={styles.time}>{formatDateTimeEpochSeconds(item.createdAt)}</Text>
                </View>
                {!!(item.modelName || item.tokenName) && (
                  <Text style={styles.title2} numberOfLines={1}>
                    {(item.modelName ? `${item.modelName}` : '—') + (item.tokenName ? ` · ${item.tokenName}` : '')}
                  </Text>
                )}
                <View style={styles.kvInline}>
                  <Text style={styles.inlineKey}>消耗</Text>
                  <Text style={styles.inlineVal}>{formatOmega(item.quota)}</Text>
                  <Text style={styles.inlineKey}>Tokens</Text>
                  <Text style={styles.inlineVal}>{formatCount(totalTokens)}</Text>
                  <Text style={styles.inlineKey}>用时</Text>
                  <Text style={styles.inlineVal}>{item.useTime ? `${item.useTime}s` : '—'}</Text>
                </View>
                <Text style={styles.content} numberOfLines={3}>
                  {item.content || '—'}
                </Text>
              </Surface>
            </Pressable>
          );
        }}
        ListEmptyComponent={<Text style={styles.empty}>暂无日志</Text>}
      />

      <FloatingPageControls
        onPrev={() => load(Math.max(1, page - 1))}
        onRefresh={() => load(page)}
        onNext={() => load(Math.min(maxPage, page + 1))}
        disabledPrev={busy || !canPrev}
        disabledRefresh={busy}
        disabledNext={busy || !canNext}
        refreshLabel={busy ? '刷新中…' : '刷新'}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#F7F8FA',
  },
  list: {
    flex: 1,
  },
  container: {
    padding: 16,
    gap: 12,
  },
  header: {
    gap: 12,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: '#11181C',
  },
  errorText: {
    color: '#d11',
    fontWeight: '600',
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#11181C',
  },
  filterCard: {
    gap: 10,
  },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  inputLight: {
    borderColor: 'rgba(0,0,0,0.12)',
    backgroundColor: '#fff',
    color: '#11181C',
  },
  inputDark: {
    borderColor: '#333',
    backgroundColor: '#1e1f20',
    color: '#ECEDEE',
  },
  inlineRow: {
    flexDirection: 'row',
    gap: 10,
  },
  smallBtn: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: '#11181C',
  },
  smallBtnText: {
    color: '#fff',
    fontWeight: '800',
  },
  ghostBtn: {
    backgroundColor: '#667085',
  },
  statCard: {
    gap: 10,
  },
  statRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  statKey: {
    color: '#667085',
    fontSize: 13,
    fontWeight: '600',
  },
  statVal: {
    color: '#11181C',
    fontSize: 13,
    fontWeight: '800',
  },
  pagerCard: {
    gap: 10,
  },
  listTitle: {
    marginTop: 4,
    fontSize: 14,
    fontWeight: '800',
    color: '#11181C',
  },
  item: {
    gap: 10,
  },
  itemTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title2: {
    fontSize: 13,
    fontWeight: '900',
    color: '#11181C',
  },
  kvInline: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    alignItems: 'center',
  },
  inlineKey: {
    color: '#667085',
    fontSize: 12,
    fontWeight: '700',
  },
  inlineVal: {
    color: '#11181C',
    fontSize: 12,
    fontWeight: '900',
  },
  time: {
    color: '#98A2B3',
    fontSize: 12,
    fontWeight: '600',
  },
  content: {
    color: '#11181C',
    fontSize: 13,
    lineHeight: 18,
  },
  empty: {
    paddingTop: 16,
    color: '#667085',
    textAlign: 'center',
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
  },
  chipIdle: {
    backgroundColor: '#fff',
    borderColor: 'rgba(0,0,0,0.12)',
  },
  chipActive: {
    backgroundColor: '#11181C',
    borderColor: '#11181C',
  },
  chipText: {
    fontSize: 12,
    fontWeight: '900',
  },
  chipTextIdle: {
    color: '#11181C',
  },
  chipTextActive: {
    color: '#fff',
  },
  timeRow: {
    flexDirection: 'row',
    gap: 10,
  },
  timeInput: {
    flex: 1,
  },
  pagerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  pagerInfo: {
    flex: 1,
    textAlign: 'center',
    color: '#667085',
    fontSize: 12,
    fontWeight: '700',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    padding: 16,
  },
  modalCard: {
    maxHeight: '85%',
    borderRadius: 16,
    backgroundColor: '#fff',
    overflow: 'hidden',
  },
  modalHeader: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(0,0,0,0.12)',
  },
  modalHeaderActions: {
    flexDirection: 'row',
    gap: 10,
  },
  modalTitle: {
    fontSize: 14,
    fontWeight: '900',
    color: '#11181C',
  },
  modalClose: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: '#11181C',
  },
  modalCopy: {
    backgroundColor: '#2563EB',
  },
  modalCloseText: {
    color: '#fff',
    fontWeight: '900',
  },
  modalBody: {
    padding: 14,
    gap: 10,
  },
  kvRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
  },
  k: {
    color: '#667085',
    fontSize: 12,
    fontWeight: '700',
  },
  v: {
    color: '#11181C',
    fontSize: 12,
    fontWeight: '900',
    flex: 1,
    textAlign: 'right',
  },
  modalSection: {
    marginTop: 8,
    fontSize: 13,
    fontWeight: '900',
    color: '#11181C',
  },
  mono: {
    fontFamily: 'ui-monospace',
    fontSize: 12,
    color: '#11181C',
    opacity: 0.9,
  },
});
