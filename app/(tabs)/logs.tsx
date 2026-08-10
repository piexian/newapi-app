import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Clipboard from 'expo-clipboard';
import AsyncStorage from '@react-native-async-storage/async-storage';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

import { Badge } from '@/components/ui/badge';
import { AppButton } from '@/components/ui/app-button';
import { DropdownSelect } from '@/components/ui/dropdown-select';
import { FloatingPageControls } from '@/components/ui/floating-page-controls';
import { ScrollTopButton } from '@/components/ui/scroll-top-button';
import { EmptyState } from '@/components/ui/empty-state';
import { InlineNotice } from '@/components/ui/inline-notice';
import { Surface } from '@/components/ui/surface';
import { Fonts, Layout, Radius } from '@/constants/theme';
import { useApi } from '@/hooks/use-api';
import { useAppTheme } from '@/hooks/use-app-theme';
import { formatCount, formatDateTimeEpochSeconds, formatOmega } from '@/lib/format';
import { parseLogs, parseLogStat } from '@/lib/parsers';
import { unwrapApiData } from '@/lib/unwrap';
import { useMe } from '@/providers/me-provider';

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

// 时间范围预设：选择器选项与对应的时间戳区间（all 表示不限制）
type TimeRangeKey = 'all' | 'today' | 'yesterday' | '7d' | '30d';

const TIME_RANGE_OPTIONS: { key: TimeRangeKey; label: string }[] = [
  { key: 'today', label: '今天' },
  { key: 'yesterday', label: '昨天' },
  { key: '7d', label: '最近 7 天' },
  { key: '30d', label: '最近 30 天' },
  { key: 'all', label: '全部时间' },
];

const TIME_RANGE_LABELS = TIME_RANGE_OPTIONS.map((o) => o.label);

function timeRangeLabel(key: TimeRangeKey): string {
  return TIME_RANGE_OPTIONS.find((o) => o.key === key)?.label ?? '今天';
}

function timeRangeToTimestamps(key: TimeRangeKey): { startTs: string; endTs: string } {
  const end = nowSeconds();
  const todayStart = todayStartSeconds();
  switch (key) {
    case 'today':
      return { startTs: String(todayStart), endTs: String(end) };
    case 'yesterday':
      return { startTs: String(todayStart - 86400), endTs: String(todayStart) };
    case '7d':
      return { startTs: String(end - 7 * 86400), endTs: String(end) };
    case '30d':
      return { startTs: String(end - 30 * 86400), endTs: String(end) };
    default:
      return { startTs: '', endTs: '' };
  }
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
  const { colors, shadow } = useAppTheme();
  const insets = useSafeAreaInsets();
  const { isAdmin } = useMe();

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
  const [groupOptions, setGroupOptions] = useState<string[]>([]);
  const [timeRange, setTimeRange] = useState<TimeRangeKey>('today');

  // applied*：已提交的筛选条件。文本输入直接改的是上面的 draft（tokenName/modelName），
  // 点"查询"才提交；类型/分组/时间范围等点击类筛选即时提交（draft 与 applied 同步），
  // load/effect 依赖 applied，从而避免文本输入每个字符都触发一次网络请求。
  const [applied, setApplied] = useState(() => ({
    logType,
    tokenName,
    modelName,
    group,
    ...timeRangeToTimestamps('today'),
  }));

  // 筛选卡片折叠状态持久化：下次进页面保持用户上次的展开/收起选择
  const FILTER_COLLAPSED_KEY = '@logs/filterCollapsed';
  const [filtersCollapsed, setFiltersCollapsed] = useState(false);
  useEffect(() => {
    AsyncStorage.getItem(FILTER_COLLAPSED_KEY)
      .then((v) => {
        if (v === '1') setFiltersCollapsed(true);
      })
      .catch(() => {});
     
  }, []);
  const toggleFiltersCollapsed = useCallback(() => {
    setFiltersCollapsed((prev) => {
      const next = !prev;
      AsyncStorage.setItem(FILTER_COLLAPSED_KEY, next ? '1' : '0').catch(() => {});
      return next;
    });
     
  }, []);

  const [detailsOpen, setDetailsOpen] = useState(false);
  const [detailsLog, setDetailsLog] = useState<(typeof logs)[number] | null>(null);
  const [error, setError] = useState('');

  const [copied, setCopied] = useState(false);
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (copyTimer.current) clearTimeout(copyTimer.current);
  }, []);

  const queryParams = useMemo(() => {
    const startNum = applied.startTs.trim() ? Number(applied.startTs.trim()) : undefined;
    const endNum = applied.endTs.trim() ? Number(applied.endTs.trim()) : undefined;
    return {
      type: applied.logType ? applied.logType : undefined,
      token_name: applied.tokenName.trim() ? applied.tokenName.trim() : undefined,
      model_name: applied.modelName.trim() ? applied.modelName.trim() : undefined,
      group: applied.group.trim() ? applied.group.trim() : undefined,
      start_timestamp: Number.isFinite(startNum) ? startNum : undefined,
      end_timestamp: Number.isFinite(endNum) ? endNum : undefined,
    } as const;
  }, [applied]);

  // 请求序号守卫：仅最新一次请求的响应才会写入 state，丢弃过期响应，消除慢请求覆盖快请求的竞态。
  const requestSeq = useRef(0);
  const listRef = useRef<FlatList<ReturnType<typeof parseLogs>[number]>>(null);
  const [showTop, setShowTop] = useState(false);

  const load = useCallback(
    async (nextPage = 1) => {
      const seq = ++requestSeq.current;
      setError('');
      setBusy(true);
      try {
        const statPath = isAdmin ? '/api/log/stat' : '/api/log/self/stat';
        const logsPath = isAdmin ? '/api/log/' : '/api/log/self';
        const [statRes, logsRes] = await Promise.all([
          api.request({ path: statPath, query: queryParams }),
          api.request({
            path: logsPath,
            query: { ...queryParams, p: nextPage, page_size: pageSize },
          }),
        ]);
        if (seq !== requestSeq.current) return;

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
        if (seq !== requestSeq.current) return;
        setError(e instanceof Error ? e.message : '请求失败');
      } finally {
        if (seq === requestSeq.current) setBusy(false);
      }
    },
    [api, isAdmin, pageSize, queryParams]
  );

  // 文本类输入仍走"查询"提交，避免每次击键都发请求
  const applyFilters = useCallback(() => {
    setApplied((a) => ({ ...a, tokenName, modelName }));
  }, [tokenName, modelName]);

  const resetFilters = useCallback(() => {
    setLogType(0);
    setTokenName('');
    setModelName('');
    setGroup('');
    setTimeRange('today');
    setApplied({ logType: 0, tokenName: '', modelName: '', group: '', ...timeRangeToTimestamps('today') });
  }, []);

  // 点击类筛选（类型/分组/时间范围）即时提交：draft 与 applied 同步，load 依赖 applied 自动重新查询
  const applyLogType = useCallback((t: number) => {
    setLogType(t);
    setApplied((a) => ({ ...a, logType: t }));
  }, []);

  const applyGroup = useCallback((g: string) => {
    setGroup(g);
    setApplied((a) => ({ ...a, group: g }));
  }, []);

  const applyTimeRange = useCallback((key: TimeRangeKey) => {
    setTimeRange(key);
    setApplied((a) => ({ ...a, ...timeRangeToTimestamps(key) }));
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

  const fetchGroups = useCallback(async () => {
    try {
      const res = await api.request({ path: isAdmin ? '/api/group/' : '/api/user/self/groups' });
      const env = res.body as unknown;
      if (isRecord(env) && typeof env.success === 'boolean' && env.success === false) return;
      const data = unwrapApiData(res.body) as unknown;
      if (Array.isArray(data)) {
        setGroupOptions(data.filter((g): g is string => typeof g === 'string' && g.trim().length > 0));
        return;
      }
      if (isRecord(data)) {
        setGroupOptions(Object.keys(data).filter((g) => typeof g === 'string' && g.trim().length > 0));
      }
    } catch {
      // ignore
    }
  }, [api, isAdmin]);

  useEffect(() => {
    void fetchGroups();
  }, [fetchGroups]);

  const copyHandler = useCallback(async () => {
    const content = [
      `时间：${formatDateTimeEpochSeconds(detailsLog?.createdAt)}`,
      `类型：${logTypeLabel(detailsLog?.type)}`,
      detailsLog?.username ? `用户：${detailsLog.username}` : '',
      detailsLog?.channel !== undefined ? `渠道：${detailsLog.channel}` : '',
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
    if (copyTimer.current) clearTimeout(copyTimer.current);
    setCopied(true);
    copyTimer.current = setTimeout(() => setCopied(false), 1500);
  }, [detailsLog]);

  // 胶囊筛选按钮（类型 / 时间范围 / 每页条数共用）
  const renderChip = (label: string, active: boolean, onPress: () => void, disabled = busy) => (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        active
          ? { backgroundColor: colors.accent, borderColor: colors.accent }
          : { backgroundColor: colors.surface, borderColor: colors.border },
        pressed ? styles.chipPressed : null,
      ]}>
      <Text style={[styles.chipText, { color: active ? colors.onAccent : colors.ink }]}>{label}</Text>
    </Pressable>
  );

  return (
    <KeyboardAvoidingView style={[styles.screen, { backgroundColor: colors.canvas }]} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Modal transparent visible={detailsOpen} animationType="fade" onRequestClose={() => setDetailsOpen(false)}>
        <View style={[styles.modalBackdrop, { backgroundColor: colors.overlay }]}>
          <View style={[styles.modalCard, { backgroundColor: colors.surface }, shadow ?? null]}>
            <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
              <Text style={[styles.modalTitle, { color: colors.ink }]}>日志详情</Text>
              <View style={styles.modalHeaderActions}>
                <AppButton
                  label={copied ? '已复制' : '复制'}
                  icon={copied ? 'check' : 'content-copy'}
                  compact
                  onPress={copyHandler}
                  style={{ backgroundColor: colors.info, borderColor: colors.info }}
                />
                <AppButton label="关闭" icon="close" variant="secondary" compact onPress={() => setDetailsOpen(false)} />
              </View>
            </View>
            <ScrollView contentContainerStyle={styles.modalBody}>
              <View style={styles.kvRow}>
                <Text style={[styles.k, { color: colors.muted }]}>时间</Text>
                <Text style={[styles.v, { color: colors.ink }]}>{formatDateTimeEpochSeconds(detailsLog?.createdAt)}</Text>
              </View>
              <View style={styles.kvRow}>
                <Text style={[styles.k, { color: colors.muted }]}>类型</Text>
                <Text style={[styles.v, { color: colors.ink }]}>{logTypeLabel(detailsLog?.type)}</Text>
              </View>
              {!!detailsLog?.username && (
                <View style={styles.kvRow}>
                  <Text style={[styles.k, { color: colors.muted }]}>用户</Text>
                  <Text style={[styles.v, { color: colors.ink }]}>{detailsLog.username}</Text>
                </View>
              )}
              {detailsLog?.channel !== undefined && (
                <View style={styles.kvRow}>
                  <Text style={[styles.k, { color: colors.muted }]}>渠道</Text>
                  <Text style={[styles.v, { color: colors.ink }]}>{detailsLog.channel}</Text>
                </View>
              )}
              {!!detailsLog?.modelName && (
                <View style={styles.kvRow}>
                  <Text style={[styles.k, { color: colors.muted }]}>模型</Text>
                  <Text style={[styles.v, { color: colors.ink }]}>{detailsLog.modelName}</Text>
                </View>
              )}
              {!!detailsLog?.tokenName && (
                <View style={styles.kvRow}>
                  <Text style={[styles.k, { color: colors.muted }]}>令牌</Text>
                  <Text style={[styles.v, { color: colors.ink }]}>{detailsLog.tokenName}</Text>
                </View>
              )}
              {!!detailsLog?.group && (
                <View style={styles.kvRow}>
                  <Text style={[styles.k, { color: colors.muted }]}>分组</Text>
                  <Text style={[styles.v, { color: colors.ink }]}>{detailsLog.group}</Text>
                </View>
              )}
              <View style={styles.kvRow}>
                <Text style={[styles.k, { color: colors.muted }]}>消耗</Text>
                <Text style={[styles.v, { color: colors.ink }]}>{formatOmega(detailsLog?.quota)}</Text>
              </View>
              <View style={styles.kvRow}>
                <Text style={[styles.k, { color: colors.muted }]}>Tokens</Text>
                <Text style={[styles.v, { color: colors.ink }]}>
                  {formatCount((detailsLog?.promptTokens ?? 0) + (detailsLog?.completionTokens ?? 0))}
                </Text>
              </View>
              <View style={styles.kvRow}>
                <Text style={[styles.k, { color: colors.muted }]}>用时</Text>
                <Text style={[styles.v, { color: colors.ink }]}>{detailsLog?.useTime ? `${detailsLog.useTime}s` : '—'}</Text>
              </View>
              {!!detailsLog?.ip && (
                <View style={styles.kvRow}>
                  <Text style={[styles.k, { color: colors.muted }]}>IP</Text>
                  <Text style={[styles.v, { color: colors.ink }]}>{detailsLog.ip}</Text>
                </View>
              )}

              <Text style={[styles.modalSection, { color: colors.ink }]}>内容</Text>
              <Text selectable style={[styles.mono, { color: colors.ink }]}>
                {detailsLog?.content || '—'}
              </Text>

              <Text style={[styles.modalSection, { color: colors.ink }]}>Other</Text>
              {(() => {
                const parsed = safeParseJson(detailsLog?.other);
                if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
                  const entries = Object.entries(parsed as Record<string, unknown>);
                  if (!entries.length) {
                    return <Text style={[styles.mono, { color: colors.ink }]}>—</Text>;
                  }
                  // JSON 解析为键值行：嵌套对象/数组压成单行 JSON，标量直接展示
                  return entries.map(([key, val]) => (
                    <View style={styles.kvRow} key={key}>
                      <Text style={[styles.k, { color: colors.muted }]}>{key}</Text>
                      <Text selectable style={[styles.v, { color: colors.ink }]}>
                        {val !== null && typeof val === 'object' ? JSON.stringify(val) : String(val)}
                      </Text>
                    </View>
                  ));
                }
                return (
                  <Text selectable style={[styles.mono, { color: colors.ink }]}>
                    {detailsLog?.other || '—'}
                  </Text>
                );
              })()}
            </ScrollView>
          </View>
        </View>
      </Modal>

      <FlatList
        style={styles.list}
        ref={listRef}
        onScroll={(e) => setShowTop(e.nativeEvent.contentOffset.y > 480)}
        scrollEventThrottle={16}
        contentContainerStyle={[
          styles.container,
          { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 120 },
        ]}
        data={logs}
        keyExtractor={(item) => String(item.id)}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={[styles.title, { color: colors.ink }]}>日志</Text>

            {!!error && <InlineNotice message={error} />}

            <Surface style={styles.filterCard}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={filtersCollapsed ? '展开筛选' : '收起筛选'}
                accessibilityState={{ expanded: !filtersCollapsed }}
                style={styles.filterHeader}
                onPress={toggleFiltersCollapsed}
              >
                <Text style={[styles.cardTitle, { color: colors.ink }]}>筛选</Text>
                <MaterialIcons
                  name={filtersCollapsed ? 'expand-more' : 'expand-less'}
                  size={20}
                  color={colors.muted}
                />
              </Pressable>
              {filtersCollapsed ? (
                <Text numberOfLines={1} style={[styles.collapsedSummary, { color: colors.muted }]}>
                  {[
                    applied.logType ? logTypeLabel(applied.logType) : null,
                    timeRangeLabel(timeRange),
                    applied.group.trim() ? `分组 ${applied.group.trim()}` : null,
                    applied.tokenName.trim() ? `令牌 ${applied.tokenName.trim()}` : null,
                    applied.modelName.trim() ? `模型 ${applied.modelName.trim()}` : null,
                  ]
                    .filter(Boolean)
                    .join(' · ') || '全部'}
                </Text>
              ) : (
                <>
                  <View style={styles.chipRow}>
                    {[0, 2, 1, 5, 3, 4].map((t) => renderChip(logTypeLabel(t), logType === t, () => applyLogType(t)))}
                  </View>

                  <TextInput
                    value={tokenName}
                    onChangeText={setTokenName}
                    placeholder="令牌名 token_name（可选）"
                    placeholderTextColor={colors.subtle}
                    autoCapitalize="none"
                    autoCorrect={false}
                    returnKeyType="search"
                    onSubmitEditing={applyFilters}
                    style={[styles.input, { borderColor: colors.border, backgroundColor: colors.surface, color: colors.ink }]}
                  />
                  <TextInput
                    value={modelName}
                    onChangeText={setModelName}
                    placeholder="模型名 model_name（可选）"
                    placeholderTextColor={colors.subtle}
                    autoCapitalize="none"
                    autoCorrect={false}
                    returnKeyType="search"
                    onSubmitEditing={applyFilters}
                    style={[styles.input, { borderColor: colors.border, backgroundColor: colors.surface, color: colors.ink }]}
                  />
                  <DropdownSelect
                    title="选择分组"
                    value={group}
                    onChange={applyGroup}
                    options={groupOptions}
                    placeholder="分组（可选）"
                    style={styles.input}
                    textStyle={{ color: colors.ink }}
                  />
                  <DropdownSelect
                    title="选择时间范围"
                    value={timeRangeLabel(timeRange)}
                    onChange={(label) => {
                      const found = TIME_RANGE_OPTIONS.find((o) => o.label === label);
                      if (found) applyTimeRange(found.key);
                    }}
                    options={TIME_RANGE_LABELS}
                    placeholder="时间范围"
                    style={styles.input}
                    textStyle={{ color: colors.ink }}
                  />

                  <View style={styles.inlineRow}>
                    <AppButton label="查询" icon="search" compact loading={busy} onPress={applyFilters} />
                    <AppButton
                      label="重置"
                      icon="restart-alt"
                      variant="secondary"
                      compact
                      onPress={resetFilters}
                      disabled={busy}
                    />
                  </View>
                </>
              )}
            </Surface>

            <Surface style={styles.statCard}>
              <Text style={[styles.cardTitle, { color: colors.ink }]}>统计</Text>
              <View style={styles.statRow}>
                <Text style={[styles.statKey, { color: colors.muted }]}>消耗</Text>
                <Text style={[styles.statVal, { color: colors.ink }]}>{formatOmega(stat.quota)}</Text>
              </View>
              <View style={styles.statRow}>
                <Text style={[styles.statKey, { color: colors.muted }]}>RPM</Text>
                <Text style={[styles.statVal, { color: colors.ink }]}>{formatCount(stat.rpm)}</Text>
              </View>
              <View style={styles.statRow}>
                <Text style={[styles.statKey, { color: colors.muted }]}>TPM</Text>
                <Text style={[styles.statVal, { color: colors.ink }]}>{formatCount(stat.tpm)}</Text>
              </View>
            </Surface>

            <Surface style={styles.pagerCard}>
              <Text style={[styles.cardTitle, { color: colors.ink }]}>分页</Text>
              <Text style={[styles.pagerInfo, { color: colors.muted }]}>
                第 {page} / {maxPage} 页 · 共 {total} 条
              </Text>
              <View style={styles.chipRow}>
                {[10, 20, 50].map((s) =>
                  renderChip(`${s}/页`, pageSize === s, () => {
                    // 只更新状态，不再手动 load：pageSize 变化会让 load 重建，[load] effect 自动以新 pageSize 查询第 1 页，
                    // 避免旧闭包里带旧 pageSize 触发一次错误请求。
                    setPageSize(s);
                    setPage(1);
                  })
                )}
              </View>
            </Surface>

            <Text style={[styles.listTitle, { color: colors.ink }]}>列表</Text>
          </View>
        }
        renderItem={({ item }) => {
          const totalTokens = (item.promptTokens ?? 0) + (item.completionTokens ?? 0);
          const meta = [
            item.username ? `用户：${item.username}` : null,
            item.channel !== undefined ? `渠道：${item.channel}` : null,
          ]
            .filter((s): s is string => !!s)
            .join(' · ');
          return (
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                setDetailsLog(item);
                setDetailsOpen(true);
              }}
              disabled={busy}>
              <Surface style={styles.item}>
                <View style={styles.itemTop}>
                  <Badge text={logTypeLabel(item.type)} tone="accent" />
                  <Text style={[styles.time, { color: colors.subtle }]}>{formatDateTimeEpochSeconds(item.createdAt)}</Text>
                </View>
                {!!(item.modelName || item.tokenName) && (
                  <Text style={[styles.title2, { color: colors.ink }]} numberOfLines={1}>
                    {(item.modelName ? `${item.modelName}` : '—') + (item.tokenName ? ` · ${item.tokenName}` : '')}
                  </Text>
                )}
                {!!meta && (
                  <Text style={[styles.meta, { color: colors.muted }]} numberOfLines={1}>
                    {meta}
                  </Text>
                )}
                <View style={styles.kvInline}>
                  <Text style={[styles.inlineKey, { color: colors.muted }]}>消耗</Text>
                  <Text style={[styles.inlineVal, { color: colors.ink }]}>{formatOmega(item.quota)}</Text>
                  <Text style={[styles.inlineKey, { color: colors.muted }]}>Tokens</Text>
                  <Text style={[styles.inlineVal, { color: colors.ink }]}>{formatCount(totalTokens)}</Text>
                  <Text style={[styles.inlineKey, { color: colors.muted }]}>用时</Text>
                  <Text style={[styles.inlineVal, { color: colors.ink }]}>{item.useTime ? `${item.useTime}s` : '—'}</Text>
                </View>
                <Text style={[styles.content, { color: colors.ink }]} numberOfLines={3}>
                  {item.content || '—'}
                </Text>
              </Surface>
            </Pressable>
          );
        }}
        ListEmptyComponent={
          <EmptyState title="暂无日志" description="调整筛选条件，或刷新后重试。" icon="receipt-long" />
        }
      />

      <ScrollTopButton
        visible={showTop}
        onPress={() => listRef.current?.scrollToOffset({ offset: 0, animated: true })}
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
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  list: {
    flex: 1,
  },
  container: {
    width: '100%',
    maxWidth: Layout.contentMaxWidth,
    alignSelf: 'center',
    padding: Layout.pagePadding,
    gap: Layout.sectionGap,
  },
  header: {
    gap: 12,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  filterCard: {
    gap: 10,
  },
  filterHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  collapsedSummary: {
    fontSize: 12,
  },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.medium,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  inlineRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
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
    fontSize: 13,
    fontWeight: '600',
  },
  statVal: {
    fontSize: 13,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  pagerCard: {
    gap: 10,
  },
  listTitle: {
    marginTop: 4,
    fontSize: 14,
    fontWeight: '800',
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
    fontWeight: '700',
  },
  kvInline: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    alignItems: 'center',
  },
  inlineKey: {
    fontSize: 12,
    fontWeight: '700',
  },
  inlineVal: {
    fontSize: 12,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  time: {
    fontSize: 12,
    fontWeight: '600',
  },
  content: {
    fontSize: 13,
    lineHeight: 18,
  },
  meta: {
    fontSize: 12,
    marginTop: 2,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: Radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
  },
  chipPressed: {
    opacity: 0.7,
  },
  chipText: {
    fontSize: 12,
    fontWeight: '600',
  },
  pagerInfo: {
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '700',
  },
  modalBackdrop: {
    flex: 1,
    justifyContent: 'center',
    padding: Layout.pagePadding,
  },
  modalCard: {
    maxHeight: '85%',
    borderRadius: Radius.medium,
    overflow: 'hidden',
  },
  modalHeader: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  modalHeaderActions: {
    flexDirection: 'row',
    gap: 10,
  },
  modalTitle: {
    fontSize: 14,
    fontWeight: '700',
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
    fontSize: 12,
    fontWeight: '700',
  },
  v: {
    fontSize: 12,
    fontWeight: '600',
    flex: 1,
    textAlign: 'right',
  },
  modalSection: {
    marginTop: 8,
    fontSize: 13,
    fontWeight: '700',
  },
  mono: {
    fontFamily: Fonts.mono,
    fontSize: 12,
    opacity: 0.9,
  },
});