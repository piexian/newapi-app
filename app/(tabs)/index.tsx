import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useApi } from '@/hooks/use-api';
import { formatDateTimeEpochSeconds, formatQuota } from '@/lib/format';
import { parseQuotaData, parseUser } from '@/lib/parsers';
import { useAuth } from '@/providers/auth-provider';
import { useStatus } from '@/providers/status-provider';
import { useSettings } from '@/providers/settings-provider';
import { Surface } from '@/components/ui/surface';
import { StatTile } from '@/components/ui/stat-tile';
import { FloatingRefreshButton } from '@/components/ui/floating-refresh';
import { InlineNotice } from '@/components/ui/inline-notice';
import { Layout, Radius } from '@/constants/theme';
import { useAppTheme } from '@/hooks/use-app-theme';

type ModelAgg = { model: string; quota: number; count: number; tokens: number };

// 顶部首屏安全区偏移（刷新/头部固定 20pt 节奏）
const HEADER_INSET = 20;

function nowSeconds() {
  return Math.floor(Date.now() / 1000);
}

function greetingPrefix() {
  const hours = new Date().getHours();
  if (hours >= 5 && hours < 12) return '早上好';
  if (hours >= 12 && hours < 14) return '中午好';
  if (hours >= 14 && hours < 18) return '下午好';
  return '晚上好';
}

function bucketSizeSeconds(rangeSeconds: number) {
  if (rangeSeconds > 72 * 3600) return 24 * 3600;
  return 3600;
}

type ApiEnvelope = {
  success?: boolean;
  message?: string;
};

function getApiError(body: unknown): string | null {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return null;
  const env = body as ApiEnvelope;
  if (typeof env.success === 'boolean' && env.success === false) {
    return typeof env.message === 'string' && env.message.trim() ? env.message : '请求失败';
  }
  return null;
}

export default function DashboardScreen() {
  const api = useApi();
  const { baseUrl } = useSettings();
  const { userId } = useAuth();
  const { quota } = useStatus();
  const insets = useSafeAreaInsets();
  const { colors } = useAppTheme();

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [hasLoaded, setHasLoaded] = useState(false);
  const [user, setUser] = useState<ReturnType<typeof parseUser>>(null);
  const [quotaData, setQuotaData] = useState<ReturnType<typeof parseQuotaData>>([]);
  const [rangeDays, setRangeDays] = useState<1 | 7 | 30>(7);
  const [endTimestamp, setEndTimestamp] = useState(() => nowSeconds() + 3600);

  const displayName = user?.displayName || user?.username || '用户';

  const currentBalance = user?.quota;
  const usedQuota = user?.usedQuota;
  const requestCount = user?.requestCount;

  const startTimestamp = useMemo(() => endTimestamp - rangeDays * 24 * 3600, [endTimestamp, rangeDays]);

  const totals = useMemo(() => {
    let totalQuota = 0;
    let totalTimes = 0;
    let totalTokens = 0;
    const modelMap = new Map<string, ModelAgg>();

    for (const row of quotaData) {
      const q = row.quota ?? 0;
      const c = row.count ?? 0;
      const t = row.tokenUsed ?? 0;
      totalQuota += q;
      totalTimes += c;
      totalTokens += t;
      const model = row.modelName || '未知';
      const prev = modelMap.get(model) ?? { model, quota: 0, count: 0, tokens: 0 };
      prev.quota += q;
      prev.count += c;
      prev.tokens += t;
      modelMap.set(model, prev);
    }

    const models = Array.from(modelMap.values()).sort((a, b) => b.quota - a.quota);
    return { totalQuota, totalTimes, totalTokens, models };
  }, [quotaData]);

  const series = useMemo(() => {
    const rangeSeconds = endTimestamp - startTimestamp;
    const size = bucketSizeSeconds(rangeSeconds);
    const start = startTimestamp - (startTimestamp % size);
    const end = endTimestamp - (endTimestamp % size);
    const buckets = Math.max(1, Math.floor((end - start) / size) + 1);

    const quota = new Array<number>(buckets).fill(0);
    const tokens = new Array<number>(buckets).fill(0);
    const times = new Array<number>(buckets).fill(0);

    for (const row of quotaData) {
      if (!row.createdAt) continue;
      const idx = Math.floor((row.createdAt - start) / size);
      if (idx < 0 || idx >= buckets) continue;
      quota[idx] += row.quota ?? 0;
      tokens[idx] += row.tokenUsed ?? 0;
      times[idx] += row.count ?? 0;
    }

    const take = Math.min(24, buckets);
    const quotaTail = quota.slice(-take);
    const tokensTail = tokens.slice(-take);
    const timesTail = times.slice(-take);

    const minutes = Math.max(1, Math.floor(rangeSeconds / 60));
    const avgRPM = totals.totalTimes / minutes;
    const avgTPM = totals.totalTokens / minutes;

    const rpmSeries = timesTail.map((v) => v / (size / 60));
    const tpmSeries = tokensTail.map((v) => v / (size / 60));

    return {
      quota: quotaTail,
      tokens: tokensTail,
      times: timesTail,
      rpm: rpmSeries,
      tpm: tpmSeries,
      avgRPM: avgRPM.toFixed(3),
      avgTPM: avgTPM.toFixed(3),
    };
  }, [endTimestamp, quotaData, startTimestamp, totals.totalTimes, totals.totalTokens]);

  const refresh = useCallback(async () => {
    setError('');
    setBusy(true);
    try {
      const localEnd = nowSeconds() + 3600;
      const localStart = localEnd - rangeDays * 24 * 3600;
      const [userRes, dataRes] = await Promise.all([
        api.request({ path: '/api/user/self' }),
        api.request({
          path: '/api/data/self',
          query: { start_timestamp: localStart, end_timestamp: localEnd },
        }),
      ]);

      const userErr = getApiError(userRes.body);
      if (userErr) {
        setError(userErr);
        return;
      }
      const dataErr = getApiError(dataRes.body);
      if (dataErr) {
        setError(dataErr);
        return;
      }

      setEndTimestamp(localEnd);
      setUser(parseUser(userRes.body));
      setQuotaData(parseQuotaData(dataRes.body));
      setHasLoaded(true);

      const firstError = [userRes, dataRes].find((r) => !r.ok);
      if (firstError) setError(`请求失败：HTTP ${firstError.status}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : '请求失败');
    } finally {
      setBusy(false);
    }
  }, [api, rangeDays]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return (
    <View style={[styles.screen, { backgroundColor: colors.canvas }]}>
      <ScrollView
        contentContainerStyle={[
          styles.container,
          { paddingTop: insets.top + HEADER_INSET, paddingBottom: insets.bottom + HEADER_INSET + 8 },
        ]}
        keyboardShouldPersistTaps="handled">
        <View style={styles.headerRow}>
          <View style={styles.headerCopy}>
            <Text style={[styles.greet, { color: colors.ink }]}>
              {greetingPrefix()}，{displayName}
            </Text>
            <Text style={[styles.sub, { color: colors.muted }]} numberOfLines={1} ellipsizeMode="tail">
              Base URL：{baseUrl || '未设置'} · UserId：{userId}
            </Text>
          </View>
          <FloatingRefreshButton onPress={refresh} disabled={busy} loading={busy} label={busy ? '刷新中' : '刷新'} />
        </View>

        {!!error && <InlineNotice message={error} />}

        {busy && !hasLoaded ? (
          <View style={styles.loading}>
            <ActivityIndicator size="large" color={colors.accent} />
            <Text style={[styles.loadingText, { color: colors.muted }]}>加载中</Text>
          </View>
        ) : (
          <>
            <Surface style={styles.rangeCard}>
              <Text style={[styles.sectionTitle, { color: colors.ink }]}>统计范围</Text>
              <View style={styles.chipRow}>
                {([1, 7, 30] as const).map((d) => {
                  const active = rangeDays === d;
                  return (
                    <Pressable
                      key={d}
                      accessibilityRole="button"
                      accessibilityState={{ selected: active }}
                      disabled={busy}
                      onPress={() => {
                        setRangeDays(d);
                        setEndTimestamp(nowSeconds() + 3600);
                      }}
                      style={({ pressed }) => [
                        styles.chip,
                        {
                          backgroundColor: active ? colors.accent : colors.surface,
                          borderColor: active ? colors.accent : colors.border,
                        },
                        pressed ? styles.chipPressed : null,
                        busy ? styles.chipDisabled : null,
                      ]}>
                      <Text style={[styles.chipText, { color: active ? colors.onAccent : colors.ink }]}>{d}天</Text>
                    </Pressable>
                  );
                })}
              </View>
              <Text style={[styles.hint, { color: colors.muted }]}>
                范围：{formatDateTimeEpochSeconds(startTimestamp)} ~ {formatDateTimeEpochSeconds(endTimestamp)}
              </Text>
            </Surface>

            <Text style={[styles.groupTitle, { color: colors.ink }]}>账户数据</Text>
            <View style={styles.grid}>
              <View style={styles.tile}>
                <StatTile
                  title="当前余额"
                  value={formatQuota(currentBalance, quota ?? undefined)}
                  subtitle="账户可用额度"
                  icon="wallet"
                />
              </View>
              <View style={styles.tile}>
                <StatTile
                  title="历史消耗"
                  value={formatQuota(usedQuota, quota ?? undefined)}
                  subtitle="累计消耗"
                  icon="bar-chart"
                />
              </View>
            </View>

            <Text style={[styles.groupTitle, { color: colors.ink }]}>使用统计</Text>
            <View style={styles.grid}>
              <View style={styles.tile}>
                <StatTile
                  title="请求次数"
                  value={typeof requestCount === 'number' ? String(requestCount) : '—'}
                  subtitle="历史累计"
                  icon="send"
                />
              </View>
              <View style={styles.tile}>
                <StatTile
                  title="统计次数"
                  value={String(totals.totalTimes)}
                  subtitle={`${rangeDays}天内`}
                  icon="pulse"
                  sparkline={series.times}
                />
              </View>
            </View>

            <Text style={[styles.groupTitle, { color: colors.ink }]}>资源消耗</Text>
            <View style={styles.grid}>
              <View style={styles.tile}>
                <StatTile
                  title="统计额度"
                  value={formatQuota(totals.totalQuota, quota ?? undefined)}
                  subtitle={`${rangeDays}天内`}
                  icon="logo-bitcoin"
                  sparkline={series.quota}
                />
              </View>
              <View style={styles.tile}>
                <StatTile
                  title="统计 Tokens"
                  value={Number.isFinite(totals.totalTokens) ? totals.totalTokens.toLocaleString() : '—'}
                  subtitle={`${rangeDays}天内`}
                  icon="flash"
                  sparkline={series.tokens}
                />
              </View>
            </View>

            <Text style={[styles.groupTitle, { color: colors.ink }]}>性能指标</Text>
            <View style={styles.grid}>
              <View style={styles.tile}>
                <StatTile
                  title="平均 RPM"
                  value={series.avgRPM}
                  subtitle="每分钟请求数"
                  icon="stopwatch"
                  sparkline={series.rpm}
                />
              </View>
              <View style={styles.tile}>
                <StatTile
                  title="平均 TPM"
                  value={series.avgTPM}
                  subtitle="每分钟 Tokens"
                  icon="text-outline"
                  sparkline={series.tpm}
                />
              </View>
            </View>

            <Surface style={styles.modelsCard}>
              <Text style={[styles.sectionTitle, { color: colors.ink }]}>模型消耗分布</Text>
              {!totals.models.length ? (
                <Text style={[styles.hint, { color: colors.muted }]}>暂无数据</Text>
              ) : (
                totals.models.slice(0, 8).map((m) => (
                  <View key={m.model} style={styles.modelRow}>
                    <Text style={[styles.modelName, { color: colors.ink }]} numberOfLines={1}>
                      {m.model}
                    </Text>
                    <Text style={[styles.modelVal, { color: colors.ink }]}>
                      {formatQuota(m.quota, quota ?? undefined)}
                    </Text>
                  </View>
                ))
              )}
              {!!totals.models.length && (
                <Text style={[styles.hint, { color: colors.muted }]}>按额度排序，仅展示前 8 个模型</Text>
              )}
            </Surface>

            <Surface style={styles.profileCard}>
              <Text style={[styles.sectionTitle, { color: colors.ink }]}>账户信息</Text>
              <View style={styles.kvRow}>
                <Text style={[styles.k, { color: colors.muted }]}>用户名</Text>
                <Text style={[styles.v, { color: colors.ink }]}>{user?.username ?? '—'}</Text>
              </View>
              <View style={styles.kvRow}>
                <Text style={[styles.k, { color: colors.muted }]}>邮箱</Text>
                <Text style={[styles.v, { color: colors.ink }]}>{user?.email ?? '—'}</Text>
              </View>
              <View style={styles.kvRow}>
                <Text style={[styles.k, { color: colors.muted }]}>分组</Text>
                <Text style={[styles.v, { color: colors.ink }]}>{user?.group ?? '—'}</Text>
              </View>
            </Surface>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  container: {
    flexGrow: 1,
    width: '100%',
    maxWidth: Layout.contentMaxWidth,
    alignSelf: 'center',
    padding: Layout.pagePadding,
    gap: Layout.sectionGap,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  headerCopy: {
    minWidth: 0,
    flex: 1,
  },
  greet: {
    fontSize: 22,
    fontWeight: '800',
  },
  sub: {
    marginTop: 4,
    minWidth: 0,
    fontSize: 12,
  },
  loading: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingVertical: 48,
  },
  loadingText: {
    fontSize: 14,
    fontWeight: '600',
  },
  rangeCard: {
    gap: 10,
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
    opacity: 0.8,
  },
  chipDisabled: {
    opacity: 0.5,
  },
  chipText: {
    fontSize: 12,
    fontWeight: '600',
  },
  groupTitle: {
    marginTop: 4,
    fontSize: 14,
    fontWeight: '700',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    rowGap: 12,
    justifyContent: 'space-between',
  },
  tile: {
    width: '48%',
  },
  modelsCard: {
    gap: 10,
  },
  modelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  modelName: {
    flex: 1,
    fontSize: 13,
    fontWeight: '800',
  },
  modelVal: {
    fontSize: 13,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  profileCard: {
    gap: 10,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  kvRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  k: {
    fontSize: 13,
    fontWeight: '600',
  },
  v: {
    fontSize: 13,
    fontWeight: '700',
  },
  hint: {
    fontSize: 12,
    fontWeight: '600',
  },
});