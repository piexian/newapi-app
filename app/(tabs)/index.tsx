import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useApi } from '@/hooks/use-api';
import { formatCount, formatDateTimeEpochSeconds, formatOmega } from '@/lib/format';
import { parseQuotaData, parseUser } from '@/lib/parsers';
import { useAuth } from '@/providers/auth-provider';
import { useSettings } from '@/providers/settings-provider';
import { Surface } from '@/components/ui/surface';
import { StatTile } from '@/components/ui/stat-tile';
import { FloatingRefreshButton } from '@/components/ui/floating-refresh';

type ModelAgg = { model: string; quota: number; count: number; tokens: number };

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
  const insets = useSafeAreaInsets();

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
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
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={[
          styles.container,
          { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 120 },
        ]}
        keyboardShouldPersistTaps="handled">
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.greet}>
              {greetingPrefix()}，{displayName}
            </Text>
            <Text style={styles.sub}>Base URL：{baseUrl || '未设置'} · UserId：{userId}</Text>
          </View>
        </View>

        {!!error && (
          <Surface>
            <Text style={styles.error}>{error}</Text>
          </Surface>
        )}

        <Surface style={styles.rangeCard}>
          <Text style={styles.sectionTitle}>统计范围</Text>
          <View style={styles.chipRow}>
            {([1, 7, 30] as const).map((d) => {
              const active = rangeDays === d;
              return (
                <Pressable
                  key={d}
                  style={[styles.chip, active ? styles.chipActive : styles.chipIdle]}
                  onPress={() => {
                    setRangeDays(d);
                    setEndTimestamp(nowSeconds() + 3600);
                  }}
                  disabled={busy}>
                  <Text style={[styles.chipText, active ? styles.chipTextActive : styles.chipTextIdle]}>{d}天</Text>
                </Pressable>
              );
            })}
          </View>
          <Text style={styles.hint}>
            范围：{formatDateTimeEpochSeconds(startTimestamp)} ~ {formatDateTimeEpochSeconds(endTimestamp)}
          </Text>
        </Surface>

        <Text style={styles.groupTitle}>账户数据</Text>
        <View style={styles.grid}>
          <View style={styles.tile}>
            <StatTile title="当前余额" value={formatOmega(currentBalance)} subtitle="账户可用额度" icon="wallet" iconColor="#2563EB" />
          </View>
          <View style={styles.tile}>
            <StatTile title="历史消耗" value={formatOmega(usedQuota)} subtitle="累计消耗" icon="bar-chart" iconColor="#8B5CF6" />
          </View>
        </View>

        <Text style={styles.groupTitle}>使用统计</Text>
        <View style={styles.grid}>
          <View style={styles.tile}>
            <StatTile title="请求次数" value={formatCount(requestCount)} subtitle="历史累计" icon="send" iconColor="#10B981" />
          </View>
          <View style={styles.tile}>
            <StatTile
              title="统计次数"
              value={formatCount(totals.totalTimes)}
              subtitle={`${rangeDays}天内`}
              icon="pulse"
              iconColor="#06B6D4"
              sparkline={series.times}
            />
          </View>
        </View>

        <Text style={styles.groupTitle}>资源消耗</Text>
        <View style={styles.grid}>
          <View style={styles.tile}>
            <StatTile
              title="统计额度"
              value={formatOmega(totals.totalQuota)}
              subtitle={`${rangeDays}天内`}
              icon="logo-bitcoin"
              iconColor="#F59E0B"
              sparkline={series.quota}
            />
          </View>
          <View style={styles.tile}>
            <StatTile
              title="统计 Tokens"
              value={formatCount(totals.totalTokens)}
              subtitle={`${rangeDays}天内`}
              icon="flash"
              iconColor="#EC4899"
              sparkline={series.tokens}
            />
          </View>
        </View>

        <Text style={styles.groupTitle}>性能指标</Text>
        <View style={styles.grid}>
          <View style={styles.tile}>
            <StatTile
              title="平均 RPM"
              value={series.avgRPM}
              subtitle="每分钟请求数"
              icon="stopwatch"
              iconColor="#6366F1"
              sparkline={series.rpm}
            />
          </View>
          <View style={styles.tile}>
            <StatTile
              title="平均 TPM"
              value={series.avgTPM}
              subtitle="每分钟 Tokens"
              icon="text-outline"
              iconColor="#F97316"
              sparkline={series.tpm}
            />
          </View>
        </View>

        <Surface style={styles.modelsCard}>
          <Text style={styles.sectionTitle}>模型消耗分布</Text>
          {!totals.models.length ? (
            <Text style={styles.hint}>暂无数据</Text>
          ) : (
            totals.models.slice(0, 8).map((m) => (
              <View key={m.model} style={styles.modelRow}>
                <Text style={styles.modelName} numberOfLines={1}>
                  {m.model}
                </Text>
                <Text style={styles.modelVal}>{formatOmega(m.quota)}</Text>
              </View>
            ))
          )}
          {!!totals.models.length && (
            <Text style={styles.hint}>按额度排序，仅展示前 8 个模型</Text>
          )}
        </Surface>

        <Surface style={styles.profileCard}>
          <Text style={styles.sectionTitle}>账户信息</Text>
          <View style={styles.kvRow}>
            <Text style={styles.k}>用户名</Text>
            <Text style={styles.v}>{user?.username ?? '—'}</Text>
          </View>
          <View style={styles.kvRow}>
            <Text style={styles.k}>邮箱</Text>
            <Text style={styles.v}>{user?.email ?? '—'}</Text>
          </View>
          <View style={styles.kvRow}>
            <Text style={styles.k}>分组</Text>
            <Text style={styles.v}>{user?.group ?? '—'}</Text>
          </View>
        </Surface>
      </ScrollView>

      <FloatingRefreshButton onPress={refresh} disabled={busy} label={busy ? '刷新中…' : '刷新'} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#F7F8FA',
  },
  container: {
    padding: 16,
    gap: 12,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  greet: {
    fontSize: 22,
    fontWeight: '800',
    color: '#11181C',
  },
  sub: {
    marginTop: 4,
    fontSize: 12,
    color: '#667085',
  },
  error: {
    color: '#d11',
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
  groupTitle: {
    marginTop: 4,
    fontSize: 14,
    fontWeight: '900',
    color: '#11181C',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
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
    color: '#11181C',
    fontSize: 13,
    fontWeight: '800',
  },
  modelVal: {
    color: '#11181C',
    fontSize: 13,
    fontWeight: '900',
  },
  profileCard: {
    gap: 10,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#11181C',
  },
  kvRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  k: {
    color: '#667085',
    fontSize: 13,
    fontWeight: '600',
  },
  v: {
    color: '#11181C',
    fontSize: 13,
    fontWeight: '700',
  },
  hint: {
    color: '#667085',
    fontSize: 12,
    fontWeight: '600',
  },
});
