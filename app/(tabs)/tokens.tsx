import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useApi } from '@/hooks/use-api';
import { Badge } from '@/components/ui/badge';
import { Surface } from '@/components/ui/surface';
import { formatDateTimeEpochSeconds, formatQuota } from '@/lib/format';
import { parseTokens } from '@/lib/parsers';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { unwrapApiData } from '@/lib/unwrap';
import { FloatingPageControls } from '@/components/ui/floating-page-controls';
import { useStatus } from '@/providers/status-provider';

function maskKey(key?: string) {
  if (!key) return '—';
  if (key.length <= 10) return key;
  return `${key.slice(0, 6)}…${key.slice(-4)}`;
}

type AnyRecord = Record<string, unknown>;

function isRecord(v: unknown): v is AnyRecord {
  return !!v && typeof v === 'object' && !Array.isArray(v);
}

type ApiEnvelope = {
  success?: boolean;
  message?: string;
  data?: unknown;
};

function getApiEnvelope(body: unknown): ApiEnvelope | null {
  if (!isRecord(body)) return null;
  if (typeof body.success !== 'boolean') return null;
  return {
    success: body.success,
    message: typeof body.message === 'string' ? body.message : undefined,
    data: body.data,
  };
}

function safeParseJsonObject(input: string): AnyRecord | null {
  const trimmed = input.trim();
  if (!trimmed) return {};
  try {
    const parsed = JSON.parse(trimmed) as unknown;
    return isRecord(parsed) ? parsed : {};
  } catch {
    return null;
  }
}

function pickString(obj: AnyRecord, keys: string[]): string {
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === 'string') return v;
  }
  return '';
}

function parseNumberOrNull(input: string): number | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  const n = Number(trimmed);
  if (!Number.isFinite(n)) return null;
  return n;
}

export default function TokensScreen() {
  const api = useApi();
  const { quota } = useStatus();
  const colorScheme = useColorScheme();
  const insets = useSafeAreaInsets();
  const [busy, setBusy] = useState(false);
  const [tokens, setTokens] = useState<ReturnType<typeof parseTokens>>([]);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [total, setTotal] = useState(0);

  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingKey, setEditingKey] = useState<string>('');
  const [nameInput, setNameInput] = useState('');
  const [statusEnabled, setStatusEnabled] = useState(true);
  const [expiredTimeInput, setExpiredTimeInput] = useState('');
  const [remainQuotaInput, setRemainQuotaInput] = useState('');
  const [unlimitedQuota, setUnlimitedQuota] = useState(false);
  const [tokenGroupInput, setTokenGroupInput] = useState('');
  const [modelLimitInput, setModelLimitInput] = useState('');
  const [ipWhitelistInput, setIpWhitelistInput] = useState('');
  const [extraJson, setExtraJson] = useState('{\n  \"cross_group_retry\": false\n}\n');

  const inputStyle = useMemo(
    () => [
      styles.input,
      colorScheme === 'dark' ? styles.inputDark : styles.inputLight,
    ],
    [colorScheme]
  );

  const load = useCallback(
    async (nextPage = 1) => {
    setError('');
    setBusy(true);
    try {
      const res = await api.request({ path: '/api/token/', query: { p: nextPage, page_size: pageSize } });
      const env = getApiEnvelope(res.body);
      if (env && env.success === false) {
        setError(env.message || '请求失败');
        return;
      }
      setTokens(parseTokens(res.body));
      const data = (isRecord(env?.data) ? (env?.data as AnyRecord) : null) as AnyRecord | null;
      setPage(typeof data?.page === 'number' ? data.page : nextPage);
      setPageSize(typeof data?.page_size === 'number' ? data.page_size : pageSize);
      setTotal(typeof data?.total === 'number' ? data.total : 0);
      if (!res.ok) setError(`请求失败：HTTP ${res.status}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : '请求失败');
    } finally {
      setBusy(false);
    }
    },
    [api, pageSize]
  );

  const maxPage = useMemo(() => {
    if (!total) return page;
    return Math.max(1, Math.ceil(total / Math.max(1, pageSize)));
  }, [page, pageSize, total]);
  const canPrev = page > 1;
  const canNext = total <= 0 ? tokens.length >= pageSize : page < maxPage;

  const openCreate = useCallback(() => {
    setEditingId(null);
    setNameInput('');
    setStatusEnabled(true);
    setExpiredTimeInput('');
    setRemainQuotaInput('');
    setUnlimitedQuota(false);
    setEditingKey('');
    setTokenGroupInput('');
    setModelLimitInput('');
    setIpWhitelistInput('');
    setExtraJson('{\n  \"cross_group_retry\": false\n}\n');
    setFormOpen(true);
  }, []);

  const openEdit = useCallback(
    async (id: number) => {
      setError('');
      setBusy(true);
      try {
        const tok = tokens.find((t) => t.id === id);
        setEditingId(id);
        setNameInput(tok?.name ?? '');
        setStatusEnabled(tok?.status === 1);
        setExpiredTimeInput(tok?.expiredTime ? String(tok.expiredTime) : '');
        setRemainQuotaInput(tok?.remainQuota !== undefined ? String(tok.remainQuota) : '');
        setUnlimitedQuota(!!tok?.unlimitedQuota);
        setEditingKey(tok?.key ?? '');
        setTokenGroupInput('');
        setModelLimitInput('');
        setIpWhitelistInput('');
        setExtraJson('{\n  \"cross_group_retry\": false\n}\n');

        const detailRes = await api.request({ path: `/api/token/${id}` });
        const detailEnv = getApiEnvelope(detailRes.body);
        if (detailEnv && detailEnv.success === false) {
          setError(detailEnv.message || '获取令牌详情失败');
          return;
        }
        const data = unwrapApiData(detailRes.body) as unknown;
        const detail = isRecord(data) ? data : {};

        const knownKeys = new Set([
          'id',
          'user_id',
          'name',
          'key',
          'status',
          'expired_time',
          'remain_quota',
          'unlimited_quota',
          'group',
          'token_group',
          'models',
          'model_limit',
          'model_limits',
          'model_limits_enabled',
          'allow_ips',
          'ip_whitelist',
          'cross_group_retry',
        ]);
        const extra: AnyRecord = {};
        for (const [k, v] of Object.entries(detail)) {
          if (knownKeys.has(k)) continue;
          extra[k] = v;
        }

        setEditingKey((typeof detail.key === 'string' ? detail.key : '') || (tok?.key ?? ''));
        setNameInput((typeof detail.name === 'string' ? detail.name : '') || (tok?.name ?? ''));
        setStatusEnabled((typeof detail.status === 'number' ? detail.status : tok?.status) === 1);
        setExpiredTimeInput(
          typeof detail.expired_time === 'number'
            ? String(detail.expired_time)
            : tok?.expiredTime
              ? String(tok.expiredTime)
              : ''
        );
        setRemainQuotaInput(
          typeof detail.remain_quota === 'number'
            ? String(detail.remain_quota)
            : tok?.remainQuota !== undefined
              ? String(tok.remainQuota)
              : ''
        );
        setUnlimitedQuota(
          typeof detail.unlimited_quota === 'boolean' ? detail.unlimited_quota : !!tok?.unlimitedQuota
        );

        setTokenGroupInput(pickString(detail, ['group', 'token_group']));

        const models =
          (detail as AnyRecord).model_limits ??
          (detail as AnyRecord).models ??
          (detail as AnyRecord).model_limit;
        if (Array.isArray(models)) setModelLimitInput(models.filter((m) => typeof m === 'string').join(', '));
        else if (typeof models === 'string') setModelLimitInput(models.split(',').map((s) => s.trim()).filter(Boolean).join(', '));

        const ips = (detail as AnyRecord).allow_ips ?? (detail as AnyRecord).ip_whitelist;
        if (Array.isArray(ips)) setIpWhitelistInput(ips.filter((m) => typeof m === 'string').join('\n'));
        else if (typeof ips === 'string') setIpWhitelistInput(ips);

        const crossGroupRetry =
          typeof (detail as AnyRecord).cross_group_retry === 'boolean'
            ? ((detail as AnyRecord).cross_group_retry as boolean)
            : false;
        setExtraJson(`${JSON.stringify({ ...extra, cross_group_retry: crossGroupRetry }, null, 2)}\n`);
        setFormOpen(true);

        if (!detailRes.ok) setError(`获取令牌详情失败：HTTP ${detailRes.status}`);
      } catch (e) {
        setError(e instanceof Error ? e.message : '获取令牌详情失败');
      } finally {
        setBusy(false);
      }
    },
    [api, tokens]
  );

  const applyExpiryOffset = useCallback((seconds: number) => {
    const now = Math.floor(Date.now() / 1000);
    setExpiredTimeInput(String(now + seconds));
  }, []);

  const applyNeverExpire = useCallback(() => {
    setExpiredTimeInput('-1');
  }, []);

  const saveToken = useCallback(async () => {
    setError('');
    setBusy(true);
    try {
      const expired_time_raw = parseNumberOrNull(expiredTimeInput);
      const remain_quota_raw = parseNumberOrNull(remainQuotaInput);
      if (expiredTimeInput.trim() && expired_time_raw === null) {
        setError('到期时间必须是数字（epoch seconds）');
        return;
      }
      if (remainQuotaInput.trim() && remain_quota_raw === null) {
        setError('剩余额度必须是数字');
        return;
      }
      if (!nameInput.trim()) {
        setError('名称不能为空');
        return;
      }

      const extra = safeParseJsonObject(extraJson);
      if (extra === null) {
        setError('高级 JSON 格式不正确');
        return;
      }
      const crossGroupRetry = typeof extra.cross_group_retry === 'boolean' ? (extra.cross_group_retry as boolean) : false;

      const modelRaw = modelLimitInput.trim();
      let modelList: string[] = [];
      if (modelRaw) {
        if (modelRaw.startsWith('[')) {
          try {
            const arr = JSON.parse(modelRaw) as unknown;
            if (Array.isArray(arr)) modelList = arr.filter((m) => typeof m === 'string') as string[];
          } catch {
            modelList = [];
          }
        }
        if (!modelList.length) {
          modelList = modelRaw
            .split(/[,\n]/g)
            .map((s) => s.trim())
            .filter(Boolean);
        }
      }
      let base: AnyRecord = {};
      if (editingId) {
        const detailRes = await api.request({ path: `/api/token/${editingId}` });
        const detailEnv = getApiEnvelope(detailRes.body);
        if (detailEnv && detailEnv.success === false) {
          setError(detailEnv.message || '获取令牌详情失败');
          return;
        }
        if (!detailRes.ok) {
          setError(`获取令牌详情失败：HTTP ${detailRes.status}`);
          return;
        }
        const detailData = unwrapApiData(detailRes.body) as unknown;
        if (isRecord(detailData)) base = detailData;
      }

      const expired_time =
        expired_time_raw !== null
          ? expired_time_raw === 0
            ? -1
            : expired_time_raw
          : typeof base.expired_time === 'number'
            ? (base.expired_time as number)
            : -1;

      const remain_quota =
        remain_quota_raw !== null
          ? remain_quota_raw
          : typeof base.remain_quota === 'number'
            ? (base.remain_quota as number)
            : 0;

      const payload: Record<string, unknown> = {
        ...(editingId ? { id: editingId } : {}),
        name: nameInput.trim(),
        status: statusEnabled ? 1 : 2,
        expired_time,
        remain_quota,
        unlimited_quota: unlimitedQuota,
        group: tokenGroupInput.trim(),
        model_limits: modelList.join(','),
        model_limits_enabled: modelList.length > 0,
        allow_ips: ipWhitelistInput.trim(),
        cross_group_retry: crossGroupRetry,
      };

      const res = await api.request({
        path: '/api/token/',
        method: editingId ? 'PUT' : 'POST',
        body: payload,
      });

      const env = getApiEnvelope(res.body);
      if (env && env.success === false) {
        setError(env.message || '保存失败');
        return;
      }
      if (!res.ok) {
        setError(`保存失败：HTTP ${res.status}`);
        return;
      }
      setFormOpen(false);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : '保存失败');
    } finally {
      setBusy(false);
    }
  }, [
    api,
    editingId,
    expiredTimeInput,
    extraJson,
    ipWhitelistInput,
    load,
    modelLimitInput,
    nameInput,
    remainQuotaInput,
    statusEnabled,
    tokenGroupInput,
    unlimitedQuota,
  ]);

  const toggleStatus = useCallback(
    async (id: number, nextEnabled: boolean) => {
      setError('');
      setBusy(true);
      try {
        const res = await api.request({
          path: '/api/token/',
          method: 'PUT',
          query: { status_only: true },
          body: { id, status: nextEnabled ? 1 : 2 },
        });
        const env = getApiEnvelope(res.body);
        if (env && env.success === false) {
          setError(env.message || '更新状态失败');
          return;
        }
        if (!res.ok) {
          setError(`更新状态失败：HTTP ${res.status}`);
          return;
        }
        await load();
      } catch (e) {
        setError(e instanceof Error ? e.message : '更新状态失败');
      } finally {
        setBusy(false);
      }
    },
    [api, load]
  );

  const deleteToken = useCallback(
    (id: number) => {
      Alert.alert('删除令牌', '确定删除该令牌？删除后不可恢复。', [
        { text: '取消', style: 'cancel' },
        {
          text: '删除',
          style: 'destructive',
          onPress: async () => {
            setError('');
            setBusy(true);
            try {
              const res = await api.request({ path: `/api/token/${id}`, method: 'DELETE' });
              if (!res.ok) {
                setError(`删除失败：HTTP ${res.status}`);
                return;
              }
              await load();
            } catch (e) {
              setError(e instanceof Error ? e.message : '删除失败');
            } finally {
              setBusy(false);
            }
          },
        },
      ]);
    },
    [api, load]
  );

  const totalRemain = useMemo(() => {
    const nums = tokens.map((t) => t.remainQuota).filter((n): n is number => typeof n === 'number');
    if (!nums.length) return undefined;
    return nums.reduce((a, b) => a + b, 0);
  }, [tokens]);

  useEffect(() => {
    void load(1);
  }, [load]);

  return (
    <View style={styles.screen}>
      <FlatList
        style={styles.list}
        contentContainerStyle={[
          styles.container,
          { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 120 },
        ]}
        data={tokens}
        keyExtractor={(item) => String(item.id)}
        ListHeaderComponent={
          <View style={styles.header}>
            <View style={styles.titleRow}>
              <Text style={styles.title}>令牌</Text>
              <View style={styles.headerActions}>
                <Pressable style={styles.actionBtn} onPress={openCreate} disabled={busy}>
                  <Text style={styles.actionText}>新增</Text>
                </Pressable>
              </View>
            </View>
            {!!error && (
              <Surface>
                <Text style={styles.errorText}>{error}</Text>
              </Surface>
            )}
            {formOpen && (
              <Surface style={styles.formCard}>
                <Text style={styles.formTitle}>{editingId ? `编辑 Token #${editingId}` : '新增令牌'}</Text>
                <Text style={styles.sectionTitle}>基本信息</Text>
                {!!editingKey && (
                  <View style={styles.formRow}>
                    <Text style={styles.formLabel}>Key</Text>
                    <View style={[styles.formInput, styles.readOnlyBox]}>
                      <Text selectable style={styles.readOnlyText}>
                        {editingKey}
                      </Text>
                    </View>
                  </View>
                )}
                <View style={styles.formRow}>
                  <Text style={styles.formLabel}>名称</Text>
                  <TextInput
                    value={nameInput}
                    onChangeText={setNameInput}
                    placeholder="例如：我的令牌"
                    autoCapitalize="none"
                    autoCorrect={false}
                    style={[inputStyle, styles.formInput]}
                  />
                </View>
                <View style={styles.formRow}>
                  <Text style={styles.formLabel}>令牌分组</Text>
                  <TextInput
                    value={tokenGroupInput}
                    onChangeText={setTokenGroupInput}
                    placeholder="例如：VIP 通道"
                    autoCapitalize="none"
                    autoCorrect={false}
                    style={[inputStyle, styles.formInput]}
                  />
                </View>
                <View style={styles.formRow}>
                  <Text style={styles.formLabel}>启用</Text>
                  <Switch value={statusEnabled} onValueChange={setStatusEnabled} />
                </View>

                <View style={styles.divider} />
                <Text style={styles.sectionTitle}>到期时间</Text>
                <View style={styles.formRow}>
                  <Text style={styles.formLabel}>到期时间</Text>
                  <TextInput
                    value={expiredTimeInput}
                    onChangeText={setExpiredTimeInput}
                    placeholder="epoch seconds（可选）"
                    keyboardType="numeric"
                    style={[inputStyle, styles.formInput]}
                  />
                </View>
                <View style={styles.quickRow}>
                  <Pressable style={styles.quickBtn} onPress={applyNeverExpire} disabled={busy}>
                    <Text style={styles.quickText}>永不过期</Text>
                  </Pressable>
                  <Pressable style={styles.quickBtn} onPress={() => applyExpiryOffset(30 * 24 * 3600)} disabled={busy}>
                    <Text style={styles.quickText}>一个月</Text>
                  </Pressable>
                  <Pressable style={styles.quickBtn} onPress={() => applyExpiryOffset(24 * 3600)} disabled={busy}>
                    <Text style={styles.quickText}>一天</Text>
                  </Pressable>
                  <Pressable style={styles.quickBtn} onPress={() => applyExpiryOffset(3600)} disabled={busy}>
                    <Text style={styles.quickText}>一小时</Text>
                  </Pressable>
                </View>
                <Text style={styles.helpText}>
                  预览：{formatDateTimeEpochSeconds(expiredTimeInput.trim() ? Number(expiredTimeInput.trim()) : undefined)}
                </Text>

                <View style={styles.divider} />
                <Text style={styles.sectionTitle}>额度设置</Text>
                <View style={styles.formRow}>
                  <Text style={styles.formLabel}>无限额</Text>
                  <Switch value={unlimitedQuota} onValueChange={setUnlimitedQuota} />
                </View>
                {!unlimitedQuota && (
                  <View style={styles.formRow}>
                    <Text style={styles.formLabel}>剩余额度</Text>
                    <TextInput
                      value={remainQuotaInput}
                      onChangeText={setRemainQuotaInput}
                      placeholder="整数"
                      keyboardType="numeric"
                      style={[inputStyle, styles.formInput]}
                    />
                  </View>
                )}

                <View style={styles.divider} />
                <Text style={styles.sectionTitle}>访问限制</Text>
                <View style={styles.formRow}>
                  <Text style={styles.formLabel}>模型限制</Text>
                  <TextInput
                    value={modelLimitInput}
                    onChangeText={setModelLimitInput}
                    placeholder="逗号/换行分隔，或 JSON 数组"
                    autoCapitalize="none"
                    autoCorrect={false}
                    multiline
                    style={[inputStyle, styles.formInput, styles.textArea]}
                    textAlignVertical="top"
                  />
                </View>
                <View style={styles.formRow}>
                  <Text style={styles.formLabel}>IP 白名单</Text>
                  <TextInput
                    value={ipWhitelistInput}
                    onChangeText={setIpWhitelistInput}
                    placeholder="允许的 IP，一行一个；留空不限制"
                    autoCapitalize="none"
                    autoCorrect={false}
                    multiline
                    style={[inputStyle, styles.formInput, styles.textArea]}
                    textAlignVertical="top"
                  />
                </View>

                <View style={styles.divider} />
                <Text style={styles.sectionTitle}>高级字段（JSON）</Text>
                <TextInput
                  value={extraJson}
                  onChangeText={setExtraJson}
                  placeholder={'{\n  "note": "..."\n}'}
                  autoCapitalize="none"
                  autoCorrect={false}
                  multiline
                  style={[inputStyle, styles.textArea]}
                  textAlignVertical="top"
                />
                <View style={styles.formActions}>
                  <Pressable
                    style={[styles.actionBtn, styles.primaryBtn]}
                    onPress={saveToken}
                    disabled={busy}>
                    <Text style={[styles.actionText, styles.primaryText]}>{busy ? '保存中…' : '保存'}</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.actionBtn, styles.secondaryBtn]}
                    onPress={() => setFormOpen(false)}
                    disabled={busy}>
                    <Text style={styles.actionText}>取消</Text>
                  </Pressable>
                </View>
              </Surface>
            )}
            <View style={styles.summaryRow}>
              <Surface style={styles.summaryCard}>
                <Text style={styles.summaryLabel}>令牌数量</Text>
                <Text style={styles.summaryValue}>{total || tokens.length}</Text>
              </Surface>
              <Surface style={styles.summaryCard}>
                <Text style={styles.summaryLabel}>剩余额度</Text>
                <Text style={styles.summaryValue}>{formatQuota(totalRemain, quota ?? undefined)}</Text>
              </Surface>
            </View>
            <Text style={styles.listTitle}>列表</Text>
          </View>
        }
        renderItem={({ item }) => (
          <Surface style={styles.item}>
            <View style={styles.itemTop}>
              <Text style={styles.name}>{item.name || `Token #${item.id}`}</Text>
              <Badge
                text={
                  item.status === 1
                    ? '启用'
                    : item.status === 2
                      ? '禁用'
                      : item.status === 3
                        ? '已过期'
                        : item.status === 4
                          ? '已耗尽'
                          : `状态 ${item.status ?? '—'}`
                }
                color={
                  item.status === 1
                    ? '#DCFCE7'
                    : item.status === 2
                      ? '#FEE2E2'
                      : item.status === 3 || item.status === 4
                        ? '#FEF9C3'
                        : '#E5E7EB'
                }
              />
            </View>
            <View style={styles.opsRow}>
              <Pressable
                style={[styles.smallBtn, item.status === 1 ? styles.dangerBtn : styles.primaryBtn]}
                onPress={() => toggleStatus(item.id, item.status !== 1)}
                disabled={busy}>
                <Text style={[styles.smallBtnText, item.status === 1 ? styles.dangerText : styles.primaryText]}>
                  {item.status === 1 ? '禁用' : '启用'}
                </Text>
              </Pressable>
              <Pressable style={[styles.smallBtn, styles.secondaryBtn]} onPress={() => openEdit(item.id)} disabled={busy}>
                <Text style={styles.smallBtnText}>编辑</Text>
              </Pressable>
              <Pressable style={[styles.smallBtn, styles.ghostBtn]} onPress={() => deleteToken(item.id)} disabled={busy}>
                <Text style={styles.smallBtnText}>删除</Text>
              </Pressable>
            </View>
            <View style={styles.metaRow}>
              <Text style={styles.metaKey}>Key</Text>
              <Text style={styles.metaVal}>{maskKey(item.key)}</Text>
            </View>
            <View style={styles.metaRow}>
              <Text style={styles.metaKey}>剩余额度</Text>
              <Text style={styles.metaVal}>
                {item.unlimitedQuota ? '无限制' : formatQuota(item.remainQuota, quota ?? undefined)}
              </Text>
            </View>
            <View style={styles.metaRow}>
              <Text style={styles.metaKey}>到期</Text>
              <Text style={styles.metaVal}>{formatDateTimeEpochSeconds(item.expiredTime)}</Text>
            </View>
          </Surface>
        )}
        ListEmptyComponent={<Text style={styles.empty}>暂无令牌，点击“刷新”加载</Text>}
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
  headerActions: {
    flexDirection: 'row',
    gap: 10,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: '#11181C',
  },
  actionBtn: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: '#fff',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(0,0,0,0.08)',
  },
  actionText: {
    fontWeight: '700',
    color: '#11181C',
  },
  primaryBtn: {
    backgroundColor: '#11181C',
  },
  primaryText: {
    color: '#fff',
  },
  secondaryBtn: {
    backgroundColor: '#fff',
  },
  dangerBtn: {
    backgroundColor: '#FEE2E2',
    borderColor: '#FCA5A5',
  },
  dangerText: {
    color: '#991B1B',
  },
  ghostBtn: {
    backgroundColor: '#667085',
    borderColor: 'transparent',
  },
  errorText: {
    color: '#d11',
    fontWeight: '600',
  },
  formCard: {
    gap: 10,
  },
  formTitle: {
    fontSize: 14,
    fontWeight: '900',
    color: '#11181C',
  },
  sectionTitle: {
    marginTop: 6,
    fontSize: 13,
    fontWeight: '900',
    color: '#11181C',
  },
  formRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  formLabel: {
    width: 72,
    fontSize: 13,
    fontWeight: '700',
    color: '#667085',
  },
  formInput: {
    flex: 1,
  },
  formActions: {
    marginTop: 4,
    flexDirection: 'row',
    gap: 10,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(0,0,0,0.08)',
    marginTop: 10,
    marginBottom: 2,
  },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  textArea: {
    minHeight: 92,
    paddingVertical: 10,
  },
  inputLight: {
    borderColor: '#d0d0d0',
    backgroundColor: '#fff',
    color: '#11181C',
  },
  inputDark: {
    borderColor: '#333',
    backgroundColor: '#1e1f20',
    color: '#ECEDEE',
  },
  quickRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginLeft: 72,
  },
  quickBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(0,0,0,0.12)',
    backgroundColor: '#fff',
  },
  quickText: {
    fontWeight: '800',
    color: '#11181C',
    fontSize: 12,
  },
  helpText: {
    marginLeft: 72,
    color: '#667085',
    fontSize: 12,
    fontWeight: '600',
  },
  readOnlyBox: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(0,0,0,0.12)',
    backgroundColor: 'rgba(0,0,0,0.03)',
  },
  readOnlyText: {
    color: '#11181C',
    fontWeight: '700',
  },
  summaryRow: {
    flexDirection: 'row',
    gap: 12,
  },
  summaryCard: {
    flex: 1,
    gap: 6,
  },
  summaryLabel: {
    fontSize: 12,
    color: '#667085',
    fontWeight: '700',
  },
  summaryValue: {
    fontSize: 18,
    fontWeight: '900',
    color: '#11181C',
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
    gap: 12,
  },
  opsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  smallBtn: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(0,0,0,0.08)',
    backgroundColor: '#fff',
  },
  smallBtnText: {
    fontWeight: '800',
    color: '#11181C',
  },
  name: {
    flex: 1,
    fontSize: 14,
    fontWeight: '900',
    color: '#11181C',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  metaKey: {
    color: '#667085',
    fontSize: 13,
    fontWeight: '600',
  },
  metaVal: {
    color: '#11181C',
    fontSize: 13,
    fontWeight: '800',
  },
  empty: {
    paddingTop: 16,
    color: '#667085',
    textAlign: 'center',
  },
});
